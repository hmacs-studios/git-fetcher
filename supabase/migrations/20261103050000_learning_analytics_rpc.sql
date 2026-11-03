create or replace function public.medmacs_learning_analytics(
  p_period_days integer default 30,
  p_user_id uuid default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  target_user uuid;
  period_days integer := greatest(1, least(coalesce(p_period_days, 30), 365));
  result jsonb;
begin
  target_user := auth.uid();
  if target_user is null and auth.role() = 'service_role' then
    target_user := p_user_id;
  end if;
  if target_user is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  with
  totals as (
    select
      count(*)::bigint as attempts,
      count(*) filter (where ua.is_correct)::bigint as correct,
      round(avg(ua.time_taken) filter (where ua.time_taken > 0))::integer as average_time_seconds,
      max(ua.created_at) as latest_attempt_at
    from public.user_answers ua
    where ua.user_id = target_user
  ),
  period as (
    select
      count(*)::bigint as attempts,
      count(*) filter (where ua.is_correct)::bigint as correct,
      round(avg(ua.time_taken) filter (where ua.time_taken > 0))::integer as average_time_seconds
    from public.user_answers ua
    where ua.user_id = target_user
      and ua.created_at >= now() - make_interval(days => period_days)
  ),
  active_days as (
    select distinct (ua.created_at at time zone 'Asia/Karachi')::date as active_day
    from public.user_answers ua
    where ua.user_id = target_user
  ),
  streak as (
    select coalesce(min(step) filter (
      where not exists (
        select 1 from active_days ad
        where ad.active_day =
          case when exists (select 1 from active_days where active_day = (now() at time zone 'Asia/Karachi')::date)
            then (now() at time zone 'Asia/Karachi')::date
            else (now() at time zone 'Asia/Karachi')::date - 1
          end - step
      )
    ), 366)::integer as days
    from generate_series(0, 365) as step
  ),
  subject_rows as (
    select
      coalesce(s.name, 'Unspecified') as subject,
      count(*)::bigint as attempts,
      count(*) filter (where ua.is_correct)::bigint as correct
    from public.user_answers ua
    left join public.mcqs m on m.id = ua.mcq_id
    left join public.chapters c on c.id = m.chapter_id
    left join public.subjects s on s.id = c.subject_id
    where ua.user_id = target_user
    group by coalesce(s.name, 'Unspecified')
  ),
  subjects_json as (
    select coalesce(jsonb_agg(to_jsonb(r) order by r.accuracy_percent, r.attempts desc), '[]'::jsonb) as value
    from (
      select subject, attempts, correct,
        round(correct * 100.0 / nullif(attempts, 0))::integer as accuracy_percent
      from subject_rows
      order by accuracy_percent asc, attempts desc
      limit 20
    ) r
  ),
  extras as (
    select
      (select count(*)::bigint from public.ai_generated_tests where user_id = target_user) as tests_generated,
      (select count(*)::bigint from public.battle_results where user_id = target_user) as battles_played,
      (select count(*)::bigint from public.battle_results where user_id = target_user and rank = 1) as battles_won,
      (select count(*)::bigint from public.saved_mcqs where user_id = target_user) as saved_count
  )
  select jsonb_build_object(
    'period_days', period_days,
    'period_attempts', p.attempts,
    'period_correct', p.correct,
    'period_accuracy_percent', case when p.attempts > 0 then round(p.correct * 100.0 / p.attempts)::integer else null end,
    'period_average_time_seconds', p.average_time_seconds,
    'attempts', t.attempts,
    'correct', t.correct,
    'accuracy_percent', case when t.attempts > 0 then round(t.correct * 100.0 / t.attempts)::integer else 0 end,
    'average_time_seconds', t.average_time_seconds,
    'current_streak_days', st.days,
    'latest_attempt_at', t.latest_attempt_at,
    'subjects', sj.value,
    'tests_generated', e.tests_generated,
    'battles_played', e.battles_played,
    'battles_won', e.battles_won,
    'saved_count', e.saved_count
  ) into result
  from totals t cross join period p cross join streak st cross join subjects_json sj cross join extras e;

  return result;
end;
$$;

revoke all on function public.medmacs_learning_analytics(integer, uuid) from public, anon;
grant execute on function public.medmacs_learning_analytics(integer, uuid) to authenticated, service_role;

comment on function public.medmacs_learning_analytics(integer, uuid) is
  'Exact per-user learning analytics computed inside PostgreSQL; avoids the Data API row-return ceiling.';
