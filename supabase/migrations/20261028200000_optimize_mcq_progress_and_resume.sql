-- Use the existing one-row-per-user/chapter projection. Do not aggregate the
-- append-only user_answers history when a chapter list renders.
create or replace function public.get_mcq_chapter_progress(
  p_chapter_ids uuid[]
)
returns table(chapter_id uuid, attempted_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select state.chapter_id, state.attempted_count::bigint
  from public.user_chapter_mcq_state state
  where state.user_id = auth.uid()
    and state.chapter_id = any(p_chapter_ids);
$$;

revoke all on function public.get_mcq_chapter_progress(uuid[]) from public;
grant execute on function public.get_mcq_chapter_progress(uuid[]) to authenticated;

-- A quiz only needs its cursor at startup. Returning every answered MCQ made
-- chapter resume proportional to chapter size and answer history.
create or replace function public.get_mcq_chapter_resume(
  p_chapter_id uuid
)
returns table(last_mcq_id uuid, selected_answer text)
language sql
stable
security definer
set search_path = public
as $$
  select
    state.last_mcq_id,
    latest.selected_answer
  from public.user_chapter_mcq_state state
  left join public.user_mcq_latest_answers latest
    on latest.user_id = state.user_id
   and latest.mcq_id = state.last_mcq_id
  where state.user_id = auth.uid()
    and state.chapter_id = p_chapter_id;
$$;

revoke all on function public.get_mcq_chapter_resume(uuid) from public;
grant execute on function public.get_mcq_chapter_resume(uuid) to authenticated;
