-- Keep Dashboard aggregates on the database so the app doesn't download a user's
-- complete answer history or every student's profile to build summary cards.

create index if not exists user_answers_created_at_dashboard_idx
  on public.user_answers (created_at desc);
create index if not exists profiles_institute_year_dashboard_idx
  on public.profiles (institute, year)
  where institute is not null;

create or replace function public.get_dashboard_user_stats()
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with answer_stats as (
    select
      count(*)::bigint as total_questions,
      count(*) filter (where is_correct)::bigint as correct_answers
    from public.user_answers
    where user_id = auth.uid()
  ),
  daily_dates as (
    select distinct (created_at at time zone 'Asia/Karachi')::date as day
    from public.user_answers
    where user_id = auth.uid()
  ),
  numbered_dates as (
    select day, row_number() over (order by day desc) as row_num
    from daily_dates
  ),
  latest_date as (
    select max(day) as day from daily_dates
  ),
  streak_stats as (
    select case
      when l.day >= (now() at time zone 'Asia/Karachi')::date - 1
        then count(n.day)::integer
      else 0
    end as current_streak
    from latest_date l
    left join numbered_dates n
      on n.day = l.day - (n.row_num - 1)::integer
    group by l.day
  ),
  battle_stats as (
    select
      count(*) filter (where rank = 1)::bigint as battles_won,
      count(*)::bigint as total_battles
    from public.battle_results
    where user_id = auth.uid()
  ),
  saved_stats as (
    select count(*)::bigint as saved_questions
    from public.saved_mcqs
    where user_id = auth.uid()
  )
  select jsonb_build_object(
    'total_questions', a.total_questions,
    'correct_answers', a.correct_answers,
    'accuracy', case when a.total_questions = 0 then 0
      else round(a.correct_answers::numeric * 100 / a.total_questions)::integer end,
    'current_streak', coalesce(s.current_streak, 0),
    'battles_won', b.battles_won,
    'total_battles', b.total_battles,
    'saved_questions', sv.saved_questions
  )
  from answer_stats a
  cross join streak_stats s
  cross join battle_stats b
  cross join saved_stats sv;
$$;

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

revoke all on function public.get_dashboard_user_stats() from public;
revoke all on function public.get_dashboard_institute_rankings_24h() from public;
revoke all on function public.get_dashboard_institute_rankings_24h() from anon;
grant execute on function public.get_dashboard_user_stats() to authenticated;
grant execute on function public.get_dashboard_institute_rankings_24h() to authenticated;
