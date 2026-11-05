-- Apply to managed Supabase. The review payload lives in the OCI database.
alter table public.flp_user_attempts
  add column if not exists review_archived_at timestamptz;
