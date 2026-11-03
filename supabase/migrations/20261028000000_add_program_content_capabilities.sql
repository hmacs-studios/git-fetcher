-- Dashboard capability snapshots keep content checks off the dashboard's hot path.
-- `dashboard_components` remains the rollout/configuration authority; this table
-- only records whether matching content actually exists for a programme scope.

create table if not exists public.program_content_availability (
  institute_code text not null,
  program_code text not null default 'all',
  year_scope text not null default 'all',
  question_bank_chapter_count integer not null default 0,
  question_bank_mcq_count integer not null default 0,
  past_paper_chapter_count integer not null default 0,
  past_paper_mcq_count integer not null default 0,
  content_version bigint not null default 1,
  updated_at timestamptz not null default now(),
  primary key (institute_code, program_code, year_scope)
);

create index if not exists program_content_availability_lookup_idx
  on public.program_content_availability (institute_code, program_code, year_scope);

alter table public.program_content_availability enable row level security;

-- The dashboard reads this through the RPC below, not directly.
revoke all on public.program_content_availability from anon, authenticated;

create or replace function public.refresh_program_content_availability()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Rebuild inside the caller's transaction. Other sessions only see the
  -- completed snapshot at commit, so a dashboard never observes a half-refresh.
  delete from public.program_content_availability;

  with scoped_chapters as (
    select
      lower(trim(audience.institute_code)) as institute_code,
      coalesce(nullif(lower(trim(subject.program_code)), ''), 'all') as program_code,
      coalesce(nullif(lower(trim(subject.year)), ''), 'all') as year_scope,
      chapter.content_type,
      greatest(coalesce(chapter.mcq_count, 0), 0) as mcq_count
    from public.subjects subject
    join public.chapters chapter on chapter.subject_id = subject.id
    cross join lateral jsonb_array_elements_text(coalesce(subject.institutes, '["all"]'::jsonb)) as audience(institute_code)
    where trim(audience.institute_code) <> ''
  ), counts as (
    select
      institute_code,
      program_code,
      year_scope,
      count(*) filter (where content_type is distinct from 'past_paper' and mcq_count > 0)::integer as question_bank_chapter_count,
      coalesce(sum(mcq_count) filter (where content_type is distinct from 'past_paper'), 0)::integer as question_bank_mcq_count,
      count(*) filter (where content_type = 'past_paper' and mcq_count > 0)::integer as past_paper_chapter_count,
      coalesce(sum(mcq_count) filter (where content_type = 'past_paper'), 0)::integer as past_paper_mcq_count
    from scoped_chapters
    group by institute_code, program_code, year_scope
  )
  insert into public.program_content_availability (
    institute_code, program_code, year_scope,
    question_bank_chapter_count, question_bank_mcq_count,
    past_paper_chapter_count, past_paper_mcq_count,
    content_version, updated_at
  )
  select
    institute_code, program_code, year_scope,
    question_bank_chapter_count, question_bank_mcq_count,
    past_paper_chapter_count, past_paper_mcq_count,
    1, now()
  from counts
  ;
end;
$$;

create or replace function public.refresh_program_content_availability_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.refresh_program_content_availability();
  return null;
end;
$$;

-- mcq_count is already maintained by a row trigger. This statement trigger runs
-- after that work is complete, so an import produces one consistent snapshot.
drop trigger if exists refresh_program_content_availability_after_mcq_change on public.mcqs;
create trigger refresh_program_content_availability_after_mcq_change
after insert or delete or update of chapter_id on public.mcqs
for each statement execute function public.refresh_program_content_availability_trigger();

drop trigger if exists refresh_program_content_availability_after_chapter_change on public.chapters;
create trigger refresh_program_content_availability_after_chapter_change
after insert or delete or update of subject_id, content_type on public.chapters
for each statement execute function public.refresh_program_content_availability_trigger();

drop trigger if exists refresh_program_content_availability_after_subject_change on public.subjects;
create trigger refresh_program_content_availability_after_subject_change
after insert or delete or update of institutes, program_code, year on public.subjects
for each statement execute function public.refresh_program_content_availability_trigger();

create or replace function public.get_dashboard_content_capabilities()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_profile record;
  configured_components jsonb;
  base_components jsonb;
  program_components jsonb;
  resolved_components jsonb;
  availability public.program_content_availability%rowtype;
  effective_program text;
  effective_year text;
  practice_enabled boolean;
  papers_enabled boolean;
begin
  select profile.institute, profile.program_code, profile.year, institute.dashboard_components,
    to_jsonb(institute) as institute_data
  into current_profile
  from public.profiles profile
  left join public.institutes institute on lower(institute.code) = lower(profile.institute)
  where profile.id = auth.uid();

  if not found or current_profile.institute is null then
    return jsonb_build_object(
      'institute', null,
      'components', jsonb_build_object('mcqs', false, 'past_papers', false, 'seqs', false, 'viva', false),
      'content_version', 0
    );
  end if;

  effective_program := coalesce(nullif(lower(trim(current_profile.program_code)), ''), 'mbbs');
  effective_year := coalesce(nullif(lower(trim(current_profile.year)), ''), 'all');
  configured_components := coalesce(current_profile.dashboard_components, '{}'::jsonb);
  base_components := configured_components - 'programs';
  program_components := coalesce(configured_components #> array['programs', effective_program], '{}'::jsonb);
  resolved_components := base_components || program_components;

  select * into availability
  from public.program_content_availability
  where institute_code in (lower(trim(current_profile.institute)), 'all')
    and year_scope in (effective_year, 'all')
    and (
      program_code = effective_program
      or program_code = 'all'
    )
  order by
    (institute_code = lower(trim(current_profile.institute))) desc,
    (program_code = effective_program) desc,
    (year_scope = effective_year) desc
  limit 1;

  practice_enabled := coalesce((resolved_components ->> 'mcqs')::boolean, true)
    and coalesce(availability.question_bank_mcq_count, 0) > 0;
  papers_enabled := coalesce((resolved_components ->> 'past_papers')::boolean, true)
    and coalesce(availability.past_paper_mcq_count, 0) > 0;

  return jsonb_build_object(
    'institute', current_profile.institute_data,
    'components', resolved_components || jsonb_build_object(
      'mcqs', practice_enabled,
      'past_papers', papers_enabled
    ),
    'content_version', coalesce(availability.content_version, 0),
    'question_bank_mcq_count', coalesce(availability.question_bank_mcq_count, 0),
    'past_paper_mcq_count', coalesce(availability.past_paper_mcq_count, 0)
  );
end;
$$;

revoke all on function public.refresh_program_content_availability() from public;
revoke all on function public.get_dashboard_content_capabilities() from public;
grant execute on function public.get_dashboard_content_capabilities() to authenticated;

select public.refresh_program_content_availability();
