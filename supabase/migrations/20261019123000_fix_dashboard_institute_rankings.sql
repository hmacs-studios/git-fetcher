-- Rankings need all students' answers; invoker rights only expose the caller's
-- RLS-visible rows. Return aggregates only, and only to an MBBS student.
begin;

create index if not exists user_answers_created_at_dashboard_idx
  on public.user_answers (created_at desc);

create or replace function public.get_dashboard_institute_rankings_24h()
returns table (
  institute_code text,
  institute_name text,
  points bigint,
  questions bigint,
  correct_answers bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with mbbs_students as (
    select p.id, p.institute
    from public.profiles p
    where p.institute is not null
      and btrim(coalesce(p.year, '')) ~* '^(1st|2nd|3rd|4th|5th)( year)?( mbbs)?$|^final year( mbbs)?$'
  ),
  recent_answers as (
    select a.user_id, a.is_correct, coalesce(a.time_taken, 0)::numeric as time_taken,
      a.created_at, a.mcq_id
    from public.user_answers a
    join mbbs_students s on s.id = a.user_id
    where a.created_at >= now() - interval '24 hours'
  ),
  streak_groups as (
    select user_id, is_correct,
      sum(case when not is_correct then 1 else 0 end) over (
        partition by user_id order by created_at, mcq_id rows unbounded preceding
      ) as group_id
    from recent_answers
  ),
  user_streaks as (
    select user_id, max(correct_run)::bigint as best_streak
    from (
      select user_id, group_id, count(*) filter (where is_correct) as correct_run
      from streak_groups
      group by user_id, group_id
    ) runs
    group by user_id
  ),
  user_totals as (
    select s.institute, a.user_id,
      count(*)::bigint as questions,
      count(*) filter (where a.is_correct)::bigint as correct_answers,
      coalesce(sum(a.time_taken), 0) as total_time
    from recent_answers a
    join mbbs_students s on s.id = a.user_id
    group by s.institute, a.user_id
  ),
  institute_totals as (
    select u.institute,
      sum(
        u.correct_answers * 10
        + coalesce(st.best_streak, 0) * 5
        + round(u.correct_answers::numeric * 100 / nullif(u.questions, 0))
        + greatest(0, 60 - round(u.total_time / nullif(u.questions, 0)))
      )::bigint as points,
      sum(u.questions)::bigint as questions,
      sum(u.correct_answers)::bigint as correct_answers
    from user_totals u
    left join user_streaks st on st.user_id = u.user_id
    group by u.institute
  )
  select t.institute, coalesce(i.name::text, t.institute), t.points, t.questions, t.correct_answers
  from institute_totals t
  left join public.institutes i on i.code = t.institute
  where exists (select 1 from mbbs_students viewer where viewer.id = auth.uid())
  order by t.points desc, t.institute;
$$;

revoke all on function public.get_dashboard_institute_rankings_24h() from public;
revoke all on function public.get_dashboard_institute_rankings_24h() from anon;
grant execute on function public.get_dashboard_institute_rankings_24h() to authenticated;

commit;
