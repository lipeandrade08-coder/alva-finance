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
