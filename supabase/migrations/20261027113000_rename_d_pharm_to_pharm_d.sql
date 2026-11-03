-- Standardize the Doctor of Pharmacy programme code and expose all five years.
-- No enrolled profiles or scoped subjects used the legacy code at migration time.
alter table public.profiles drop constraint if exists profiles_program_code_check;
alter table public.subjects drop constraint if exists subjects_program_code_check;
alter table public.institutes drop constraint if exists institutes_programs_check;

update public.profiles
set program_code = 'pharm_d'
where program_code = 'd_pharm';

update public.subjects
set program_code = 'pharm_d'
where program_code = 'd_pharm';

update public.institutes institute
set programs = (
  select array_agg(case when item.code = 'd_pharm' then 'pharm_d' else item.code end order by item.position)
  from unnest(institute.programs) with ordinality as item(code, position)
)
where institute.programs @> array['d_pharm']::text[];

alter table public.profiles add constraint profiles_program_code_check
  check (program_code is null or program_code in ('mbbs', 'bds', 'pharm_d')) not valid;
alter table public.subjects add constraint subjects_program_code_check
  check (program_code is null or program_code in ('mbbs', 'bds', 'pharm_d')) not valid;
alter table public.institutes add constraint institutes_programs_check
  check (programs <@ array['mbbs', 'bds', 'pharm_d']::text[]) not valid;

alter table public.profiles validate constraint profiles_program_code_check;
alter table public.subjects validate constraint subjects_program_code_check;
alter table public.institutes validate constraint institutes_programs_check;

comment on column public.institutes.programs is
  'Enabled undergraduate programmes. Add bds/pharm_d only after scoped content is available.';
