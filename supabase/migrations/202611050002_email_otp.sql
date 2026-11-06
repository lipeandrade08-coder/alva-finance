-- Atualização de uma instalação Alva existente. Não apaga registros.
begin;
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
