-- The initial capability RPC resolved the component flags correctly but did
-- not preserve the joined institute record in its JSON response. That made a
-- valid profile look like it had an unknown institute to the dashboard.

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
  base_components := configured_components - 'programs';
  program_components := coalesce(configured_components #> array['programs', effective_program], '{}'::jsonb);
  resolved_components := base_components || program_components;

  select * into availability
  from public.program_content_availability
  where institute_code in (lower(trim(current_profile.institute)), 'all')
    and year_scope in (effective_year, 'all')
    and (program_code = effective_program or program_code = 'all')
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
