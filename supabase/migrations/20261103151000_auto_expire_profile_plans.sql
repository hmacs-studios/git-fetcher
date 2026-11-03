-- Keep stored subscription plans consistent with their expiry timestamps.
-- Paid upgrades/extensions remain server-managed; the only automatic
-- transition is an elapsed paid plan to the free plan.

create or replace function public.protect_profile_subscription_fields()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  is_automatic_expiry boolean :=
    lower(coalesce(old.plan, 'free')) <> 'free'
    and old.plan_expiry_date is not null
    and old.plan_expiry_date <= now()
    and lower(coalesce(new.plan, 'free')) = 'free'
    and new.plan_expiry_date is null;
  is_admin boolean := exists (
    select 1 from public.profiles actor
    where actor.id = auth.uid() and actor.role = 'admin'
  );
begin
  if auth.role() is distinct from 'service_role'
     and not is_admin
     and not is_automatic_expiry
     and (new.plan is distinct from old.plan
       or new.plan_expiry_date is distinct from old.plan_expiry_date) then
    raise exception 'subscription fields are server-managed' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.protect_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('request.jwt.claim.role', true) = 'service_role'
     or current_user = 'service_role'
     or coalesce((auth.jwt() ->> 'role'), '') = 'service_role' then
    return new;
  end if;

  -- The scheduler may only downgrade an already-expired plan. It cannot grant,
  -- extend, or alter any other privileged profile field.
  if lower(coalesce(old.plan, 'free')) <> 'free'
     and old.plan_expiry_date is not null
     and old.plan_expiry_date <= now()
     and lower(coalesce(new.plan, 'free')) = 'free'
     and new.plan_expiry_date is null
     and new.role is not distinct from old.role
     and new.institute is not distinct from old.institute
     and new.year is not distinct from old.year then
    return new;
  end if;

  if new.role is distinct from old.role
     or new.plan is distinct from old.plan
     or new.plan_expiry_date is distinct from old.plan_expiry_date then
    if not exists (
      select 1 from public.profiles actor
      where actor.id = auth.uid() and actor.role = 'admin'
    ) then
      raise exception 'Modifying privileged profile fields is not allowed';
    end if;
  end if;

  if new.institute is distinct from old.institute or new.year is distinct from old.year then
    if auth.uid() <> new.id and not exists (
      select 1 from public.profiles actor
      where actor.id = auth.uid() and actor.role = 'admin'
    ) then
      raise exception 'Modifying privileged profile fields is not allowed';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.expire_elapsed_profile_plans()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  update public.profiles
  set plan = 'free',
      plan_expiry_date = null,
      updated_at = now()
  where lower(coalesce(plan, 'free')) <> 'free'
    and plan_expiry_date is not null
    and plan_expiry_date <= now();

  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.expire_elapsed_profile_plans() from public, anon, authenticated;
grant execute on function public.expire_elapsed_profile_plans() to service_role;

select public.expire_elapsed_profile_plans();

create extension if not exists pg_cron with schema extensions;

do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job
  from cron.job
  where jobname = 'expire-elapsed-profile-plans'
  limit 1;

  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;

  perform cron.schedule(
    'expire-elapsed-profile-plans',
    -- pg_cron uses UTC and minute precision. 19:00 UTC is 00:00 PKT.
    '0 19 * * *',
    'select public.expire_elapsed_profile_plans();'
  );
end;
$$;

