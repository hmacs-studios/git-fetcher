-- Extend the existing dashboard availability snapshot.  The JSON contract in
-- institutes.dashboard_components stays unchanged; these counts merely decide
-- whether its configured `seqs` and `viva` flags can be surfaced.

alter table public.program_content_availability
  add column if not exists seq_count integer not null default 0,
  add column if not exists viva_question_count integer not null default 0;

create or replace function public.refresh_program_content_availability()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.program_content_availability;

  with mcq_counts as (
    select
      lower(trim(audience.institute_code)) as institute_code,
      coalesce(nullif(lower(trim(subject.program_code)), ''), 'all') as program_code,
      coalesce(nullif(lower(trim(subject.year)), ''), 'all') as year_scope,
      count(*) filter (where chapter.content_type is distinct from 'past_paper' and greatest(coalesce(chapter.mcq_count, 0), 0) > 0)::integer as question_bank_chapter_count,
      coalesce(sum(greatest(coalesce(chapter.mcq_count, 0), 0)) filter (where chapter.content_type is distinct from 'past_paper'), 0)::integer as question_bank_mcq_count,
      count(*) filter (where chapter.content_type = 'past_paper' and greatest(coalesce(chapter.mcq_count, 0), 0) > 0)::integer as past_paper_chapter_count,
      coalesce(sum(greatest(coalesce(chapter.mcq_count, 0), 0)) filter (where chapter.content_type = 'past_paper'), 0)::integer as past_paper_mcq_count
    from public.subjects subject
    join public.chapters chapter on chapter.subject_id = subject.id
    cross join lateral jsonb_array_elements_text(coalesce(subject.institutes, '["all"]'::jsonb)) as audience(institute_code)
    where trim(audience.institute_code) <> ''
    group by 1, 2, 3
  ), seq_counts as (
    -- Live SEQs are attached to the main subjects/chapters directory, not to
    -- the old seqs_subjects/seqs_chapters sample directory.
    select
      lower(trim(audience.institute_code)) as institute_code,
      coalesce(nullif(lower(trim(subject.program_code)), ''), 'all') as program_code,
      coalesce(nullif(lower(trim(subject.year)), ''), 'all') as year_scope,
      count(seq.id)::integer as seq_count
    from public.subjects subject
    join public.chapters chapter on chapter.subject_id = subject.id
    join public.seqs seq on seq.chapter_id = chapter.id
    cross join lateral jsonb_array_elements_text(coalesce(subject.institutes, '["all"]'::jsonb)) as audience(institute_code)
    where trim(audience.institute_code) <> ''
    group by 1, 2, 3
  ), viva_counts as (
    select
      coalesce(nullif(lower(trim(station.institute_code)), ''), 'all') as institute_code,
      'all'::text as program_code,
      coalesce(nullif(lower(trim(station.year::text)), ''), 'all') as year_scope,
      count(question.id)::integer as viva_question_count
    from public.viva_stations station
    join public.viva_questions question on question.station_id = station.id
    group by 1, 2, 3
  ), scopes as (
    select institute_code, program_code, year_scope from mcq_counts
    union
    select institute_code, program_code, year_scope from seq_counts
    union
    select institute_code, program_code, year_scope from viva_counts
  )
  insert into public.program_content_availability (
    institute_code, program_code, year_scope,
    question_bank_chapter_count, question_bank_mcq_count,
    past_paper_chapter_count, past_paper_mcq_count,
    seq_count, viva_question_count, content_version, updated_at
  )
  select
    scope.institute_code, scope.program_code, scope.year_scope,
    coalesce(mcq.question_bank_chapter_count, 0), coalesce(mcq.question_bank_mcq_count, 0),
    coalesce(mcq.past_paper_chapter_count, 0), coalesce(mcq.past_paper_mcq_count, 0),
    coalesce(seq.seq_count, 0), coalesce(viva.viva_question_count, 0),
    1, now()
  from scopes scope
  left join mcq_counts mcq using (institute_code, program_code, year_scope)
  left join seq_counts seq using (institute_code, program_code, year_scope)
  left join viva_counts viva using (institute_code, program_code, year_scope);
end;
$$;

create or replace function public.get_dashboard_content_capabilities()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_profile record;
  configured_components jsonb;
  resolved_components jsonb;
  availability public.program_content_availability%rowtype;
  effective_program text;
  effective_year text;
  available_seq_count integer := 0;
  available_viva_question_count integer := 0;
begin
  select profile.institute, profile.program_code, profile.year, inst.dashboard_components,
    to_jsonb(inst) as institute_data
  into current_profile
  from public.profiles profile
  left join public.institutes as inst on lower(inst.code) = lower(profile.institute)
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
  resolved_components := (configured_components - 'programs')
    || coalesce(configured_components #> array['programs', effective_program], '{}'::jsonb);

  select * into availability
  from public.program_content_availability
  where institute_code in (lower(trim(current_profile.institute)), 'all')
    and year_scope in (effective_year, 'all')
    and program_code in (effective_program, 'all')
  order by
    (institute_code = lower(trim(current_profile.institute))) desc,
    (program_code = effective_program) desc,
    (year_scope = effective_year) desc
  limit 1;

  -- SEQ and Viva data is currently programme-neutral (`program_code = all`).
  -- It can therefore live in a different snapshot row from MCQ/Past Paper
  -- data that is programme-specific. Resolve these two counts across every
  -- matching scope instead of losing them to the nearest MCQ row above.
  select
    coalesce(max(seq_count), 0),
    coalesce(max(viva_question_count), 0)
  into available_seq_count, available_viva_question_count
  from public.program_content_availability
  where institute_code in (lower(trim(current_profile.institute)), 'all')
    and year_scope in (effective_year, 'all')
    and program_code in (effective_program, 'all');

  return jsonb_build_object(
    'institute', current_profile.institute_data,
    'components', resolved_components || jsonb_build_object(
      'mcqs', coalesce((resolved_components ->> 'mcqs')::boolean, true) and coalesce(availability.question_bank_mcq_count, 0) > 0,
      'past_papers', coalesce((resolved_components ->> 'past_papers')::boolean, true) and coalesce(availability.past_paper_mcq_count, 0) > 0,
      'seqs', coalesce((resolved_components ->> 'seqs')::boolean, false) and available_seq_count > 0,
      'viva', coalesce((resolved_components ->> 'viva')::boolean, false) and available_viva_question_count > 0
    ),
    'content_version', coalesce(availability.content_version, 0),
    'question_bank_mcq_count', coalesce(availability.question_bank_mcq_count, 0),
    'past_paper_mcq_count', coalesce(availability.past_paper_mcq_count, 0),
    'seq_count', available_seq_count,
    'viva_question_count', available_viva_question_count
  );
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

drop trigger if exists refresh_program_content_availability_after_seq_change on public.seqs;
create trigger refresh_program_content_availability_after_seq_change
after insert or delete or update on public.seqs
for each statement execute function public.refresh_program_content_availability_trigger();

drop trigger if exists refresh_program_content_availability_after_seq_chapter_change on public.seqs_chapters;
create trigger refresh_program_content_availability_after_seq_chapter_change
after insert or delete or update on public.seqs_chapters
for each statement execute function public.refresh_program_content_availability_trigger();

drop trigger if exists refresh_program_content_availability_after_seq_subject_change on public.seqs_subjects;
create trigger refresh_program_content_availability_after_seq_subject_change
after insert or delete or update on public.seqs_subjects
for each statement execute function public.refresh_program_content_availability_trigger();

-- The live SEQ bank uses the main chapter directory.  The `seqs` trigger
-- above keeps counts current, while these existing subject/chapter triggers
-- already cover scope changes on the same directory.

drop trigger if exists refresh_program_content_availability_after_viva_station_change on public.viva_stations;
create trigger refresh_program_content_availability_after_viva_station_change
after insert or delete or update on public.viva_stations
for each statement execute function public.refresh_program_content_availability_trigger();

drop trigger if exists refresh_program_content_availability_after_viva_question_change on public.viva_questions;
create trigger refresh_program_content_availability_after_viva_question_change
after insert or delete or update on public.viva_questions
for each statement execute function public.refresh_program_content_availability_trigger();

select public.refresh_program_content_availability();

-- Configuration remains in the original JSON. The server-side count above
-- still hides SEQs for every DMC programme/year with no live SEQ content.
update public.institutes
set dashboard_components = jsonb_set(
  coalesce(dashboard_components, '{}'::jsonb),
  '{seqs}',
  'true'::jsonb,
  true
)
where lower(code) = 'dmc';
