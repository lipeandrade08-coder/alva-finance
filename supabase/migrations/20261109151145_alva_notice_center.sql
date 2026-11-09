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
