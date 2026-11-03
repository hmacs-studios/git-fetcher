-- Calculate leaderboard scores in Postgres and return only the visible leaders
-- plus the signed-in user's rank. Scope is derived from their profile.
create index if not exists user_answers_leaderboard_user_date_idx
  on public.user_answers (user_id, created_at, mcq_id);

create or replace function public.get_leaderboard_entries(
  p_scope text default 'pakistan',
  p_period text default 'all-time'
)
returns table (
  rank_position bigint,
  user_id uuid,
  username text,
  avatar_url text,
  total_score bigint,
  accuracy integer,
  best_streak bigint,
  total_questions bigint,
  correct_answers bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with viewer as (
    select institute, year
    from public.profiles
    where id = auth.uid()
  ),
  period_bounds as (
    select case p_period
      when 'weekly' then date_trunc('week', now() at time zone 'Asia/Karachi') at time zone 'Asia/Karachi'
      when 'monthly' then date_trunc('month', now() at time zone 'Asia/Karachi') at time zone 'Asia/Karachi'
      else null::timestamptz
    end as starts_at,
    case p_period
      when 'weekly' then (date_trunc('week', now() at time zone 'Asia/Karachi') + interval '1 week') at time zone 'Asia/Karachi'
      when 'monthly' then (date_trunc('month', now() at time zone 'Asia/Karachi') + interval '1 month') at time zone 'Asia/Karachi'
      else null::timestamptz
    end as ends_at
  ),
  scoped_profiles as (
    select p.id, coalesce(nullif(p.username, ''), nullif(p.full_name, ''), 'Anonymous') as username,
      p.avatar_url
    from public.profiles p
    left join viewer v on true
    where auth.uid() is not null
      and p_scope in ('pakistan', 'institute', 'year-campus')
      and p_period in ('all-time', 'monthly', 'weekly')
      and (p_scope = 'pakistan'
        or (v.institute is not null and p.institute = v.institute
          and (p_scope = 'institute' or (v.year is not null and p.year = v.year))))
  ),
  scoped_answers as (
    select a.user_id, a.is_correct, coalesce(a.time_taken, 0)::numeric as time_taken,
      a.created_at, a.mcq_id
    from public.user_answers a
    join scoped_profiles p on p.id = a.user_id
    cross join period_bounds b
    where (b.starts_at is null or a.created_at >= b.starts_at)
      and (b.ends_at is null or a.created_at < b.ends_at)
  ),
  streak_groups as (
    select user_id, is_correct,
      sum(case when is_correct then 0 else 1 end) over (
        partition by user_id order by created_at, mcq_id rows unbounded preceding
      ) as group_id
    from scoped_answers
  ),
  streaks as (
    select user_id, max(correct_run)::bigint as best_streak
    from (
      select user_id, group_id, count(*) filter (where is_correct) as correct_run
      from streak_groups
      group by user_id, group_id
    ) runs
    group by user_id
  ),
  totals as (
    select user_id, count(*)::bigint as total_questions,
      count(*) filter (where is_correct)::bigint as correct_answers,
      sum(time_taken) as total_time
    from scoped_answers
    group by user_id
  ),
  scores as (
    select p.id as user_id, p.username, p.avatar_url,
      t.total_questions, t.correct_answers, coalesce(s.best_streak, 0) as best_streak,
      round(t.correct_answers::numeric * 100 / t.total_questions)::integer as accuracy,
      (t.correct_answers * 10 + coalesce(s.best_streak, 0) * 5
        + round(t.correct_answers::numeric * 100 / t.total_questions)::integer
        + greatest(0, 60 - round(t.total_time / t.total_questions)::integer))::bigint as total_score
    from totals t
    join scoped_profiles p on p.id = t.user_id
    left join streaks s on s.user_id = t.user_id
  ),
  ranked as (
    select row_number() over (order by total_score desc, user_id) as rank_position,
      scores.*
    from scores
  )
  select r.rank_position, r.user_id, r.username, r.avatar_url, r.total_score,
    r.accuracy, r.best_streak, r.total_questions, r.correct_answers
  from ranked r
  where r.rank_position <= 50 or r.user_id = auth.uid()
  order by r.rank_position;
$$;

revoke all on function public.get_leaderboard_entries(text, text) from public, anon;
grant execute on function public.get_leaderboard_entries(text, text) to authenticated;
