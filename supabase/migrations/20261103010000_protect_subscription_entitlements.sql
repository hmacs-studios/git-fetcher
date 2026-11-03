-- Paid entitlements may only be changed by trusted server code using service_role.
create or replace function public.protect_profile_subscription_fields()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.role() is distinct from 'service_role'
     and (new.plan is distinct from old.plan
       or new.plan_expiry_date is distinct from old.plan_expiry_date) then
    raise exception 'subscription fields are server-managed' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_subscription_fields on public.profiles;
create trigger protect_profile_subscription_fields
before update of plan, plan_expiry_date on public.profiles
for each row execute function public.protect_profile_subscription_fields();
