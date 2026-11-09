-- Alva / instalação inicial. Execute uma vez no SQL Editor do seu projeto.
begin;
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '' check (length(full_name) <= 70),
  created_at timestamptz not null default now()
);
create table if not exists public.finance_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  revision bigint not null default 0,
  updated_at timestamptz not null default now()
);
create table if not exists public.agent_usage (
  user_id uuid primary key references auth.users(id) on delete cascade,
  minute_start timestamptz not null default now(),
  day date not null default current_date,
  minute_count integer not null default 0,
  day_count integer not null default 0
);
alter table public.profiles enable row level security;
alter table public.finance_data enable row level security;
alter table public.agent_usage enable row level security;
drop policy if exists "Read own profile" on public.profiles;
create policy "Read own profile" on public.profiles for select to authenticated using ((select auth.uid()) = id);
drop policy if exists "Read own finances" on public.finance_data;
create policy "Read own finances" on public.finance_data for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.profiles, public.finance_data, public.agent_usage from anon, authenticated;
grant select on public.profiles, public.finance_data to authenticated;

create or replace function public.initialize_alva_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare user_name text := left(coalesce(new.raw_user_meta_data->>'full_name', ''), 70);
begin
  insert into public.profiles(id,full_name) values(new.id,user_name) on conflict(id) do nothing;
  insert into public.finance_data(user_id,data) values(new.id,
    jsonb_build_object('profile',jsonb_build_object('name',user_name,'opening_balance',0,'monthly_budget',0),
      'transactions','[]'::jsonb,'goals','[]'::jsonb,'debts','[]'::jsonb,'investments','[]'::jsonb))
    on conflict(user_id) do nothing;
  return new;
end;
$$;
revoke execute on function public.initialize_alva_user() from public, anon, authenticated;
drop trigger if exists on_alva_user_created on auth.users;
create trigger on_alva_user_created after insert on auth.users for each row execute procedure public.initialize_alva_user();

-- Único caminho de escrita: autenticação explícita e controle de revisão.
create or replace function public.save_finances(new_data jsonb, expected_revision bigint) returns bigint
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); next_revision bigint; item jsonb; collection text;
begin
  if uid is null then raise exception 'authentication_required'; end if;
  if new_data is null or octet_length(new_data::text) > 2000000 or jsonb_typeof(new_data) <> 'object'
    or jsonb_typeof(new_data->'profile') is distinct from 'object'
    or jsonb_typeof(new_data->'profile'->'name') is distinct from 'string'
    or length(new_data->'profile'->>'name') > 70
    or jsonb_typeof(new_data->'profile'->'opening_balance') is distinct from 'number'
    or jsonb_typeof(new_data->'profile'->'monthly_budget') is distinct from 'number'
    then raise exception 'invalid_financial_data'; end if;
  foreach collection in array array['transactions','goals','debts','investments'] loop
    if jsonb_typeof(new_data->collection) is distinct from 'array' or jsonb_array_length(new_data->collection)>5000
      then raise exception 'invalid_collection'; end if;
    for item in select value from jsonb_array_elements(new_data->collection) loop
      if jsonb_typeof(item) <> 'object' or jsonb_typeof(item->'id') is distinct from 'string'
        or jsonb_typeof(item->'name') is distinct from 'string' or length(item->>'name')>200
        then raise exception 'invalid_record'; end if;
    end loop;
  end loop;
  update public.finance_data set data = new_data, revision = revision+1, updated_at = now()
    where user_id=uid and revision=expected_revision returning revision into next_revision;
  if next_revision is null then raise exception 'revision_conflict'; end if;
  update public.profiles set full_name=new_data->'profile'->>'name' where id=uid;
  return next_revision;
end;
$$;
revoke execute on function public.save_finances(jsonb,bigint) from public, anon;
grant execute on function public.save_finances(jsonb,bigint) to authenticated;

create or replace function public.claim_agent_request() returns boolean
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); usage public.agent_usage%rowtype;
begin
  if uid is null then raise exception 'authentication_required'; end if;
  perform pg_advisory_xact_lock(hashtext(uid::text));
  insert into public.agent_usage(user_id) values(uid) on conflict do nothing;
  select * into usage from public.agent_usage where user_id=uid for update;
  if usage.day <> current_date then usage.day:=current_date;usage.day_count:=0; end if;
  if usage.minute_start < now()-interval '1 minute' then usage.minute_start:=now();usage.minute_count:=0;end if;
  if usage.minute_count>=5 or usage.day_count>=100 then return false;end if;
  update public.agent_usage set day=usage.day,day_count=usage.day_count+1,
    minute_start=usage.minute_start,minute_count=usage.minute_count+1 where user_id=uid;
  return true;
end;
$$;
revoke execute on function public.claim_agent_request() from public, anon;
grant execute on function public.claim_agent_request() to authenticated;

-- Cadastro por código de e-mail e provisionamento confirmado.
-- Atualização de uma instalação Alva existente. Não apaga registros.
create or replace function public.alva_empty_finances(full_name text) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object(
    'profile', jsonb_build_object('name',left(coalesce(full_name,''),70),'opening_balance',0,'monthly_budget',0),
    'transactions','[]'::jsonb,'goals','[]'::jsonb,'debts','[]'::jsonb,'investments','[]'::jsonb,
    'business',jsonb_build_object('profile',jsonb_build_object('name','','kind','MEI','cnpj','','opening_balance',0,'annual_goal',0),'records','[]'::jsonb,'taxes','[]'::jsonb)
  );
$$;
revoke execute on function public.alva_empty_finances(text) from public, anon, authenticated;

create or replace function public.initialize_alva_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare user_name text := left(coalesce(new.raw_user_meta_data->>'full_name',''),70);
begin
  if new.email_confirmed_at is null then return new;end if;
  insert into public.profiles(id,full_name) values(new.id,user_name) on conflict(id) do nothing;
  insert into public.finance_data(user_id,data) values(new.id,public.alva_empty_finances(user_name)) on conflict(user_id) do nothing;
  return new;
end;
$$;
revoke execute on function public.initialize_alva_user() from public, anon, authenticated;
drop trigger if exists on_alva_email_verified on auth.users;
create trigger on_alva_email_verified after update of email_confirmed_at on auth.users
  for each row when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute procedure public.initialize_alva_user();

-- Recupera contas confirmadas anteriores à instalação, sem sobrescrever dados.
insert into public.profiles(id,full_name)
  select id,left(coalesce(raw_user_meta_data->>'full_name',''),70) from auth.users
  where email_confirmed_at is not null on conflict(id) do nothing;
insert into public.finance_data(user_id,data)
  select p.id,public.alva_empty_finances(p.full_name) from public.profiles p
  join auth.users u on u.id=p.id where u.email_confirmed_at is not null
  on conflict(user_id) do nothing;

create or replace function public.ensure_alva_account() returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); user_name text;
begin
  if uid is null then raise exception 'authentication_required';end if;
  select left(coalesce(raw_user_meta_data->>'full_name',''),70) into user_name
    from auth.users where id=uid and email_confirmed_at is not null;
  if not found then raise exception 'email_verification_required';end if;
  insert into public.profiles(id,full_name) values(uid,user_name) on conflict(id) do nothing;
  insert into public.finance_data(user_id,data) values(uid,public.alva_empty_finances(user_name)) on conflict(user_id) do nothing;
end;
$$;
revoke execute on function public.ensure_alva_account() from public, anon;
grant execute on function public.ensure_alva_account() to authenticated;

-- Além da revisão e da propriedade, valida o estado antes de persistir.
create or replace function public.save_finances(new_data jsonb, expected_revision bigint) returns bigint
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); next_revision bigint; item jsonb; collection text; profile_data jsonb;
begin
  if uid is null then raise exception 'authentication_required';end if;
  if not exists(select 1 from auth.users where id=uid and email_confirmed_at is not null)
    then raise exception 'email_verification_required';end if;
  if new_data is null or jsonb_typeof(new_data) is distinct from 'object' or octet_length(new_data::text)>2000000
    then raise exception 'invalid_financial_data';end if;
  profile_data:=new_data->'profile';
  if jsonb_typeof(profile_data) is distinct from 'object' or jsonb_typeof(profile_data->'name') is distinct from 'string'
    or length(profile_data->>'name')>70 or jsonb_typeof(profile_data->'opening_balance') is distinct from 'number'
    or jsonb_typeof(profile_data->'monthly_budget') is distinct from 'number'
    then raise exception 'invalid_profile';end if;
  foreach collection in array array['transactions','goals','debts','investments'] loop
    if jsonb_typeof(new_data->collection) is distinct from 'array' then raise exception 'invalid_collection';end if;
    if jsonb_array_length(new_data->collection)>5000 then raise exception 'collection_limit_exceeded';end if;
    for item in select value from jsonb_array_elements(new_data->collection) loop
      if jsonb_typeof(item) is distinct from 'object' or jsonb_typeof(item->'id') is distinct from 'string'
        or jsonb_typeof(item->'name') is distinct from 'string' or length(item->>'name')>200
        then raise exception 'invalid_record';end if;
      if collection in ('transactions','investments') then
        if jsonb_typeof(item->'amount') is distinct from 'number' then raise exception 'invalid_amount';end if;
        if (item->>'amount')::numeric<0 or (item->>'amount')::numeric<>trunc((item->>'amount')::numeric)
          then raise exception 'invalid_amount';end if;
      end if;
    end loop;
  end loop;
  if new_data ? 'business' then
    if jsonb_typeof(new_data->'business') is distinct from 'object'
      or jsonb_typeof(new_data->'business'->'profile') is distinct from 'object'
      then raise exception 'invalid_business';end if;
    foreach collection in array array['records','taxes'] loop
      if jsonb_typeof(new_data->'business'->collection) is distinct from 'array' then raise exception 'invalid_business_collection';end if;
      if jsonb_array_length(new_data->'business'->collection)>5000 then raise exception 'collection_limit_exceeded';end if;
      for item in select value from jsonb_array_elements(new_data->'business'->collection) loop
        if jsonb_typeof(item->'id') is distinct from 'string' or jsonb_typeof(item->'name') is distinct from 'string'
          or length(item->>'name')>200 or jsonb_typeof(item->'amount') is distinct from 'number'
          then raise exception 'invalid_business_record';end if;
        if (item->>'amount')::numeric<=0 or (item->>'amount')::numeric<>trunc((item->>'amount')::numeric)
          then raise exception 'invalid_amount';end if;
      end loop;
    end loop;
  end if;
  update public.finance_data set data=new_data,revision=revision+1,updated_at=now()
    where user_id=uid and revision=expected_revision returning revision into next_revision;
  if next_revision is null then raise exception 'revision_conflict';end if;
  update public.profiles set full_name=profile_data->>'name' where id=uid;
  return next_revision;
end;
$$;
revoke execute on function public.save_finances(jsonb,bigint) from public, anon;
grant execute on function public.save_finances(jsonb,bigint) to authenticated;
commit;

-- Alva: acesso por senha, sessão ativa e operações privilegiadas fora da API.
-- Não altera nem apaga os registros financeiros existentes.
begin;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;
alter default privileges in schema private revoke execute on functions from public;

create or replace function private.current_user_id() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid(); sid text := auth.jwt()->>'session_id';
begin
  if uid is null or sid is null or sid !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'session_expired' using errcode='28000';
  end if;
  if not exists(select 1 from auth.sessions s where s.id=sid::uuid and s.user_id=uid
    and (s.not_after is null or s.not_after>now())) then
    raise exception 'session_expired' using errcode='28000';
  end if;
  return uid;
end; $$;
revoke all on function private.current_user_id() from public,anon;
grant execute on function private.current_user_id() to authenticated;

-- Mantém as dependências dos triggers e remove as funções privilegiadas do esquema exposto.
alter function public.alva_empty_finances(text) set schema private;
alter function public.initialize_alva_user() set schema private;
alter function public.ensure_alva_account() set schema private;
alter function public.save_finances(jsonb,bigint) set schema private;
alter function public.claim_agent_request() set schema private;
create or replace function private.alva_empty_finances(full_name text) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object(
    'profile', jsonb_build_object('name',left(coalesce(full_name,''),70),'opening_balance',0,'monthly_budget',0),
    'transactions','[]'::jsonb,'goals','[]'::jsonb,'debts','[]'::jsonb,'investments','[]'::jsonb,
    'business',jsonb_build_object('profile',jsonb_build_object('name','','kind','MEI','cnpj','','opening_balance',0,'annual_goal',0),'records','[]'::jsonb,'taxes','[]'::jsonb)
  );
$$;
create or replace function private.initialize_alva_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare user_name text := left(coalesce(new.raw_user_meta_data->>'full_name',''),70);
begin
  if new.email_confirmed_at is null then return new;end if;
  insert into public.profiles(id,full_name) values(new.id,user_name) on conflict(id) do nothing;
  insert into public.finance_data(user_id,data) values(new.id,private.alva_empty_finances(user_name)) on conflict(user_id) do nothing;
  return new;
end;
$$;
create or replace function private.ensure_alva_account() returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.current_user_id(); user_name text;
begin
  if uid is null then raise exception 'authentication_required';end if;
  select left(coalesce(raw_user_meta_data->>'full_name',''),70) into user_name
    from auth.users where id=uid;
  if not found then raise exception 'authentication_required';end if;
  insert into public.profiles(id,full_name) values(uid,user_name) on conflict(id) do nothing;
  insert into public.finance_data(user_id,data) values(uid,private.alva_empty_finances(user_name)) on conflict(user_id) do nothing;
end;
$$;

create or replace function private.validate_document(doc jsonb) returns void
language plpgsql immutable set search_path = '' as $$
declare val jsonb; k text; record jsonb; col text;
begin
  -- Todos os valores em centavos devem ser inteiros seguros para JavaScript.
  for val in select doc->'profile' union all select doc->'business'->'profile' loop
    for k in select jsonb_object_keys(coalesce(val,'{}'::jsonb)) loop
      if k in ('opening_balance','monthly_budget','annual_goal') and
        (jsonb_typeof(val->k) is distinct from 'number' or abs((val->>k)::numeric)>10000000000
          or (val->>k)::numeric<>trunc((val->>k)::numeric)) then raise exception 'invalid_amount';end if;
      if jsonb_typeof(val->k)='string' and length(val->>k)>200 then raise exception 'invalid_text';end if;
    end loop;
  end loop;
  foreach col in array array['transactions','goals','debts','investments','records','taxes'] loop
    for record in select value from jsonb_array_elements(coalesce(
      case when col in ('records','taxes') then doc->'business'->col else doc->col end,'[]'::jsonb)) loop
      for k in select jsonb_object_keys(record) loop
        if k in ('amount','target','saved','total','balance') and
          (jsonb_typeof(record->k) is distinct from 'number' or (record->>k)::numeric<0
            or (record->>k)::numeric>10000000000 or (record->>k)::numeric<>trunc((record->>k)::numeric)) then
          raise exception 'invalid_amount';
        end if;
        if jsonb_typeof(record->k)='string' and length(record->>k)>200 then raise exception 'invalid_text';end if;
      end loop;
      if record ? 'rate' and (jsonb_typeof(record->'rate') is distinct from 'number'
        or (record->>'rate')::numeric<0 or (record->>'rate')::numeric>100) then raise exception 'invalid_rate';end if;
    end loop;
  end loop;
end; $$;
revoke all on function private.validate_document(jsonb) from public,anon,authenticated;
create or replace function private.save_finances(new_data jsonb, expected_revision bigint) returns bigint
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.current_user_id(); next_revision bigint; item jsonb; collection text; profile_data jsonb;
begin
  if uid is null then raise exception 'authentication_required';end if;
  if new_data is null or jsonb_typeof(new_data) is distinct from 'object' or octet_length(new_data::text)>2000000
    then raise exception 'invalid_financial_data';end if;
  profile_data:=new_data->'profile';
  if jsonb_typeof(profile_data) is distinct from 'object' or jsonb_typeof(profile_data->'name') is distinct from 'string'
    or length(profile_data->>'name')>70 or jsonb_typeof(profile_data->'opening_balance') is distinct from 'number'
    or jsonb_typeof(profile_data->'monthly_budget') is distinct from 'number'
    then raise exception 'invalid_profile';end if;
  foreach collection in array array['transactions','goals','debts','investments'] loop
    if jsonb_typeof(new_data->collection) is distinct from 'array' then raise exception 'invalid_collection';end if;
    if jsonb_array_length(new_data->collection)>5000 then raise exception 'collection_limit_exceeded';end if;
    for item in select value from jsonb_array_elements(new_data->collection) loop
      if jsonb_typeof(item) is distinct from 'object' or jsonb_typeof(item->'id') is distinct from 'string'
        or jsonb_typeof(item->'name') is distinct from 'string' or length(item->>'name')>200 or (item->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then raise exception 'invalid_record';end if;
      if collection in ('transactions','investments') then
        if jsonb_typeof(item->'amount') is distinct from 'number' then raise exception 'invalid_amount';end if;
        if (item->>'amount')::numeric<0 or (item->>'amount')::numeric<>trunc((item->>'amount')::numeric)
          then raise exception 'invalid_amount';end if;
      end if;
    end loop;
  end loop;
  if new_data ? 'business' then
    if jsonb_typeof(new_data->'business') is distinct from 'object'
      or jsonb_typeof(new_data->'business'->'profile') is distinct from 'object'
      then raise exception 'invalid_business';end if;
    foreach collection in array array['records','taxes'] loop
      if jsonb_typeof(new_data->'business'->collection) is distinct from 'array' then raise exception 'invalid_business_collection';end if;
      if jsonb_array_length(new_data->'business'->collection)>5000 then raise exception 'collection_limit_exceeded';end if;
      for item in select value from jsonb_array_elements(new_data->'business'->collection) loop
        if jsonb_typeof(item->'id') is distinct from 'string' or jsonb_typeof(item->'name') is distinct from 'string'
          or length(item->>'name')>200 or (item->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or jsonb_typeof(item->'amount') is distinct from 'number'
          then raise exception 'invalid_business_record';end if;
        if (item->>'amount')::numeric<=0 or (item->>'amount')::numeric<>trunc((item->>'amount')::numeric)
          then raise exception 'invalid_amount';end if;
      end loop;
    end loop;
  end if;
  -- Limita números monetários e textos usados pelo cliente. Identificadores nunca são HTML.
  perform private.validate_document(new_data);
  update public.finance_data set data=new_data,revision=revision+1,updated_at=now()
    where user_id=uid and revision=expected_revision returning revision into next_revision;
  if next_revision is null then raise exception 'revision_conflict';end if;
  update public.profiles set full_name=profile_data->>'name' where id=uid;
  return next_revision;
end;
$$;
create or replace function private.claim_agent_request() returns boolean
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.current_user_id(); usage public.agent_usage%rowtype;
begin
  if uid is null then raise exception 'authentication_required'; end if;
  perform pg_advisory_xact_lock(hashtext(uid::text));
  insert into public.agent_usage(user_id) values(uid) on conflict do nothing;
  select * into usage from public.agent_usage where user_id=uid for update;
  if usage.day <> current_date then usage.day:=current_date;usage.day_count:=0; end if;
  if usage.minute_start < now()-interval '1 minute' then usage.minute_start:=now();usage.minute_count:=0;end if;
  if usage.minute_count>=5 or usage.day_count>=100 then return false;end if;
  update public.agent_usage set day=usage.day,day_count=usage.day_count+1,
    minute_start=usage.minute_start,minute_count=usage.minute_count+1 where user_id=uid;
  return true;
end;
$$;

-- A API expõe somente wrappers invoker. O proprietário é sempre derivado da sessão.
create function public.ensure_alva_account() returns void
language sql security invoker set search_path = '' as $$ select private.ensure_alva_account(); $$;
create function public.save_finances(new_data jsonb,expected_revision bigint) returns bigint
language sql security invoker set search_path = '' as $$ select private.save_finances(new_data,expected_revision); $$;
create function public.claim_agent_request() returns boolean
language sql security invoker set search_path = '' as $$ select private.claim_agent_request(); $$;
revoke all on function public.ensure_alva_account(),public.save_finances(jsonb,bigint),public.claim_agent_request() from public,anon;
grant execute on function public.ensure_alva_account(),public.save_finances(jsonb,bigint),public.claim_agent_request() to authenticated;
revoke all on function private.ensure_alva_account(),private.save_finances(jsonb,bigint),private.claim_agent_request() from public,anon;
grant execute on function private.ensure_alva_account(),private.save_finances(jsonb,bigint),private.claim_agent_request() to authenticated;
revoke all on function private.initialize_alva_user(),private.alva_empty_finances(text) from public,anon,authenticated;

drop policy if exists "Read own profile" on public.profiles;
create policy "Read own profile" on public.profiles for select to authenticated using ((select private.current_user_id())=id);
drop policy if exists "Read own finances" on public.finance_data;
create policy "Read own finances" on public.finance_data for select to authenticated using ((select private.current_user_id())=user_id);
drop policy if exists "Internal usage only" on public.agent_usage;
create policy "Internal usage only" on public.agent_usage for all to authenticated using (false) with check (false);
revoke all on public.profiles,public.finance_data,public.agent_usage from anon,authenticated;
grant select on public.profiles,public.finance_data to authenticated;
commit;

-- Central de avisos e confirmação do canal de e-mail.
begin;

create table public.alva_notices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  limit_id uuid not null,
  month date not null,
  level smallint not null check (level in (80, 100)),
  label text not null check (char_length(label) between 1 and 80),
  spent_cents bigint not null check (spent_cents >= 0),
  limit_cents bigint not null check (limit_cents > 0),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  email_state text not null default 'panel' check (email_state in ('panel','queued','sending','accepted','failed','paused')),
  attempts smallint not null default 0,
  next_attempt_at timestamptz not null default now(),
  lease uuid,
  unique (user_id, limit_id, month, level)
);

alter table public.alva_notices enable row level security;
revoke all on public.alva_notices from public, anon, authenticated;
grant select (id, limit_id, month, level, label, spent_cents, limit_cents, created_at, read_at, email_state) on public.alva_notices to authenticated;
grant update (read_at) on public.alva_notices to authenticated;
grant all on public.alva_notices to service_role;
create policy alva_notice_read on public.alva_notices for select to authenticated
  using (user_id = (select private.current_user_id()));
create policy alva_notice_mark_read on public.alva_notices for update to authenticated
  using (user_id = (select private.current_user_id()))
  with check (user_id = (select private.current_user_id()));
create index alva_notice_history_idx on public.alva_notices (user_id, created_at desc, id desc);
create index alva_notice_queue_idx on public.alva_notices (next_attempt_at, created_at)
  where email_state in ('queued','sending');

create table private.alva_notice_contacts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  verified_email text,
  enabled boolean not null default false,
  code_email text,
  code_digest text,
  code_expires_at timestamptz,
  code_attempts smallint not null default 0
);
create table private.alva_notice_code_requests (
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  requested_at timestamptz not null default now()
);
create index alva_notice_code_user_idx on private.alva_notice_code_requests (user_id, requested_at desc);
create index alva_notice_code_email_idx on private.alva_notice_code_requests (email, requested_at desc);
alter table private.alva_notice_contacts enable row level security;
alter table private.alva_notice_code_requests enable row level security;
revoke all on private.alva_notice_contacts, private.alva_notice_code_requests from public, anon, authenticated;
grant usage on schema private to service_role;
grant select, insert, update on private.alva_notice_contacts to service_role;
grant select, insert, delete on private.alva_notice_code_requests to service_role;

create function public.alva_notice_session() returns uuid
language sql stable security invoker set search_path = ''
as $$ select private.current_user_id(); $$;
revoke all on function public.alva_notice_session() from public, anon, authenticated;
grant execute on function public.alva_notice_session() to authenticated;

-- A Edge Function valida a sessão e fornece a identidade e o endereço do Supabase Auth.
create function public.alva_notice_contact(p_user uuid, p_email text, p_action text, p_digest text default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  contact private.alva_notice_contacts%rowtype;
  address text := lower(btrim(p_email));
  at_time timestamptz := now();
begin
  if address is null or length(address) > 254 or address !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    return jsonb_build_object('state','invalid_email');
  end if;
  if p_action = 'status' then
    select * into contact from private.alva_notice_contacts where user_id = p_user;
  else
    insert into private.alva_notice_contacts(user_id) values (p_user) on conflict do nothing;
    select * into contact from private.alva_notice_contacts where user_id = p_user for update;
  end if;

  if p_action = 'start' then
    if p_digest is null or p_digest !~ '^[0-9a-f]{64}$' then return jsonb_build_object('state','invalid_code'); end if;
    if contact.enabled and contact.verified_email = address then return jsonb_build_object('state','enabled'); end if;
    perform pg_advisory_xact_lock(hashtextextended(address, 177));
    if exists (select 1 from private.alva_notice_code_requests where email = address and requested_at > at_time - interval '2 minutes')
      or (select count(*) from private.alva_notice_code_requests where email = address and requested_at > at_time - interval '1 day') >= 3
      or (select count(*) from private.alva_notice_code_requests where user_id = p_user and requested_at > at_time - interval '1 day') >= 5
    then return jsonb_build_object('state','rate_limited'); end if;
    delete from private.alva_notice_code_requests where user_id = p_user and requested_at < at_time - interval '2 days';
    insert into private.alva_notice_code_requests(user_id, email, requested_at) values (p_user, address, at_time);
    update private.alva_notice_contacts set code_email = address, code_digest = p_digest,
      code_expires_at = at_time + interval '10 minutes', code_attempts = 0 where user_id = p_user;
    return jsonb_build_object('state','challenge_created');
  elsif p_action = 'confirm' then
    if contact.code_email is distinct from address or contact.code_digest is null
      or contact.code_expires_at <= at_time or contact.code_attempts >= 5 then
      return jsonb_build_object('state','expired');
    end if;
    if contact.code_digest is distinct from p_digest then
      update private.alva_notice_contacts set code_attempts = code_attempts + 1 where user_id = p_user;
      return jsonb_build_object('state','invalid_code');
    end if;
    update private.alva_notice_contacts set verified_email = address, enabled = true,
      code_email = null, code_digest = null, code_expires_at = null, code_attempts = 0 where user_id = p_user;
    return jsonb_build_object('state','enabled');
  elsif p_action = 'disable' then
    update private.alva_notice_contacts set enabled = false, code_email = null, code_digest = null,
      code_expires_at = null, code_attempts = 0 where user_id = p_user;
    update public.alva_notices set email_state = 'paused' where user_id = p_user and email_state = 'queued';
    return jsonb_build_object('state','disabled');
  elsif p_action = 'cancel_code' then
    update private.alva_notice_contacts set code_email = null, code_digest = null, code_expires_at = null
      where user_id = p_user and code_email = address and code_digest = p_digest;
    return jsonb_build_object('state','disabled');
  elsif p_action = 'status' then
    return jsonb_build_object('state',case
      when contact.enabled and contact.verified_email = address then 'enabled'
      when contact.code_email = address and contact.code_expires_at > at_time and contact.code_attempts < 5 then 'pending'
      else 'disabled' end);
  end if;
  return jsonb_build_object('state','invalid_action');
end;
$$;
revoke all on function public.alva_notice_contact(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.alva_notice_contact(uuid,text,text,text) to service_role;

create function private.alva_notice_normalize(value text) returns text
language sql immutable set search_path = '' as $$
  select regexp_replace(normalize(lower(btrim(coalesce(value,''))), NFD), U&'[\0300-\036F]', '', 'g');
$$;

create function private.alva_notice_totals(doc jsonb, month_key text)
returns table(rule_id uuid, label text, limit_cents bigint, spent_cents bigint)
language sql stable set search_path = '' as $$
  with rule_values as (
    select case when (item->>'id') ~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' then (item->>'id')::uuid end as id,
      left(btrim(item->>'name'),80) as label,
      private.alva_notice_normalize(item->>'name') as rule_name,
      private.alva_notice_normalize(item->>'category') as rule_category,
      coalesce(item->>'scope','any') as scope,
      case when jsonb_typeof(item->'limit') = 'number' then (item->>'limit')::numeric end as amount,
      position
    from jsonb_array_elements(case when jsonb_typeof(doc->'spending_limits') = 'array' then doc->'spending_limits' else '[]'::jsonb end)
      with ordinality as r(item, position)
    limit 100
  ), rules as (
    select distinct on (id) * from rule_values
    where id is not null and label <> '' and rule_name <> '' and amount between 1 and 10000000000 and amount = trunc(amount)
    order by id, position
  ), expenses as (
    select private.alva_notice_normalize(item->>'name') as name,
      private.alva_notice_normalize(item->>'category') as category,
      case when jsonb_typeof(item->'amount') = 'number' then (item->>'amount')::numeric end as amount
    from jsonb_array_elements(case when jsonb_typeof(doc->'transactions') = 'array' then doc->'transactions' else '[]'::jsonb end) as t(item)
    where item->>'type' = 'expense' and left(item->>'date',7) = month_key
  )
  select r.id, r.label, r.amount::bigint, coalesce(sum(e.amount),0)::bigint
  from rules r left join expenses e on e.amount between 1 and 10000000000 and e.amount = trunc(e.amount) and (
    strpos(e.name,r.rule_name) > 0
    or ((r.scope = 'category' or r.rule_name in ('alimentacao','moradia','transporte','saude','lazer','compras','educacao','assinaturas','dividas','metas','investimentos','salario','freelance','outros'))
      and e.category in (r.rule_name,r.rule_category))
    or (r.scope <> 'keyword' and r.rule_name = r.rule_category and r.rule_category <> 'todas' and e.category = r.rule_category)
  )
  group by r.id, r.label, r.amount;
$$;

revoke all on function private.alva_notice_normalize(text), private.alva_notice_totals(jsonb,text) from public, anon, authenticated, service_role;

create function private.alva_record_spending_notices() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  month_start date := date_trunc('month', now() at time zone 'America/Sao_Paulo')::date;
  month_key text := to_char(month_start,'YYYY-MM');
  email_slots integer := 0;
begin
  if new.data->'transactions' is not distinct from old.data->'transactions'
    and new.data->'spending_limits' is not distinct from old.data->'spending_limits' then return new; end if;
  if exists (select 1 from private.alva_notice_contacts c join auth.users u on u.id = c.user_id
    where c.user_id = new.user_id and c.enabled and c.verified_email = lower(btrim(u.email))) then
    select greatest(3 - count(*), 0)::integer into email_slots from public.alva_notices
    where user_id = new.user_id and created_at > now() - interval '1 day' and email_state <> 'panel';
  end if;
  insert into public.alva_notices(user_id,limit_id,month,level,label,spent_cents,limit_cents,email_state)
  select new.user_id,rule_id,month_start,level,label,spent_cents,limit_cents,
    case when row_number() over (order by level desc,rule_id) <= email_slots then 'queued' else 'panel' end
  from (
    select n.*, case when n.spent_cents >= n.limit_cents then 100 else 80 end as level
    from private.alva_notice_totals(new.data,month_key) n
    left join private.alva_notice_totals(old.data,month_key) p using (rule_id)
    where n.spent_cents * 5 >= n.limit_cents * 4
      and ((n.spent_cents >= n.limit_cents and coalesce(p.spent_cents >= p.limit_cents,false) = false)
        or coalesce(p.spent_cents * 5 >= p.limit_cents * 4,false) = false)
  ) as candidates
  where not exists (
    select 1 from public.alva_notices n where n.user_id = new.user_id
    and n.limit_id = candidates.rule_id and n.month = month_start and n.level = candidates.level
  )
  on conflict (user_id,limit_id,month,level) do nothing;
  return new;
end;
$$;
revoke all on function private.alva_record_spending_notices() from public, anon, authenticated, service_role;
create trigger alva_record_spending_notices after update of data on public.finance_data
  for each row execute function private.alva_record_spending_notices();

-- Somente o worker lê destinatários e controla a fila. A função privada lê o e-mail atual do Auth.
create function private.alva_claim_notice_email(p_user uuid)
returns table(id uuid, lease uuid, email text, level smallint)
language plpgsql security definer set search_path = '' as $$
begin
  update public.alva_notices n set email_state = 'failed', lease = null
  where (p_user is null or n.user_id = p_user) and n.email_state in ('queued','sending')
    and n.next_attempt_at <= now() and (n.attempts >= 3 or n.created_at < now() - interval '1 day');
  update public.alva_notices n set email_state = 'paused', lease = null
  where (p_user is null or n.user_id = p_user) and n.email_state in ('queued','sending')
    and n.next_attempt_at <= now() and not exists (
      select 1 from private.alva_notice_contacts c join auth.users u on u.id = c.user_id
      where c.user_id = n.user_id and c.enabled and c.verified_email = lower(btrim(u.email))
    );
  return query with picked as (
    select n.id, c.verified_email
    from public.alva_notices n join private.alva_notice_contacts c on c.user_id = n.user_id
    join auth.users u on u.id = n.user_id
    where (p_user is null or n.user_id = p_user) and n.email_state in ('queued','sending')
      and n.next_attempt_at <= now() and n.attempts < 3 and c.enabled and c.verified_email = lower(btrim(u.email))
    order by n.next_attempt_at, n.created_at
    limit 8 for update of n skip locked
  ), claimed as (
    update public.alva_notices n set email_state = 'sending', lease = gen_random_uuid(),
      next_attempt_at = now() + interval '2 minutes', attempts = n.attempts + 1
    from picked p where n.id = p.id returning n.id,n.lease,p.verified_email,n.level
  ) select claimed.id,claimed.lease,claimed.verified_email,claimed.level from claimed;
end;
$$;
revoke all on function private.alva_claim_notice_email(uuid) from public, anon, authenticated;
grant execute on function private.alva_claim_notice_email(uuid) to service_role;

create function public.alva_claim_notice_email(p_user uuid default null)
returns table(id uuid, lease uuid, email text, level smallint)
language sql security invoker set search_path = '' as $$ select * from private.alva_claim_notice_email(p_user); $$;
create function public.alva_finish_notice_email(p_id uuid, p_lease uuid, p_accepted boolean, p_retryable boolean)
returns boolean language sql security invoker set search_path = '' as $$
  with changed as (
    update public.alva_notices set email_state = case
      when p_accepted then 'accepted' when p_retryable and attempts < 3 then 'queued' else 'failed' end,
      lease = null, next_attempt_at = now() + make_interval(mins => 5 * attempts)
    where id = p_id and lease = p_lease and email_state = 'sending' returning id
  ) select exists(select 1 from changed);
$$;
revoke all on function public.alva_claim_notice_email(uuid), public.alva_finish_notice_email(uuid,uuid,boolean,boolean) from public, anon, authenticated;
grant execute on function public.alva_claim_notice_email(uuid), public.alva_finish_notice_email(uuid,uuid,boolean,boolean) to service_role;

commit;
