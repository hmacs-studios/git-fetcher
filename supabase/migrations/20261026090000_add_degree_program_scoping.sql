-- Additive curriculum scoping. Existing MBBS and specialized-test values remain valid.
alter table public.profiles
  add column if not exists program_code text;

alter table public.subjects
  add column if not exists program_code text;

alter table public.institutes
  add column if not exists programs text[] not null default array['mbbs']::text[];

update public.institutes
set programs = case
  when category = 'specialized_test' then array[]::text[]
  else coalesce(nullif(programs, array[]::text[]), array['mbbs']::text[])
end;

-- Existing undergraduate subject years are MBBS. FCPS specialties and other
-- specialized-test rows deliberately keep program_code null.
update public.subjects
set program_code = 'mbbs'
where program_code is null
  and year in ('1st', '2nd', '3rd', '4th', '5th');

-- Production currently exposes the FCPS option as `anesthesia`, while four
-- subjects were imported with the British-spelling key. Align the content key
-- and hide Radiology until a scoped subject directory actually exists.
update public.subjects
set year = 'anesthesia'
where year = 'anaesthesiology'
  and exists (
    select 1
    from jsonb_array_elements_text(coalesce(institutes, '[]'::jsonb)) audience(code)
    where lower(audience.code) = 'fcps_part_1'
  );

update public.institutes
set years = array_remove(years, 'radiology')
where lower(code) = 'fcps_part_1'
  and not exists (
    select 1
    from public.subjects subject
    where subject.year = 'radiology'
      and exists (
        select 1
        from jsonb_array_elements_text(coalesce(subject.institutes, '[]'::jsonb)) audience(code)
        where lower(audience.code) = 'fcps_part_1'
      )
  );

alter table public.profiles
  drop constraint if exists profiles_program_code_check;
alter table public.profiles
  add constraint profiles_program_code_check
  check (program_code is null or program_code in ('mbbs', 'bds', 'd_pharm')) not valid;

alter table public.subjects
  drop constraint if exists subjects_program_code_check;
alter table public.subjects
  add constraint subjects_program_code_check
  check (program_code is null or program_code in ('mbbs', 'bds', 'd_pharm')) not valid;

alter table public.institutes
  drop constraint if exists institutes_programs_check;
alter table public.institutes
  add constraint institutes_programs_check
  check (programs <@ array['mbbs', 'bds', 'd_pharm']::text[]) not valid;

alter table public.profiles validate constraint profiles_program_code_check;
alter table public.subjects validate constraint subjects_program_code_check;
alter table public.institutes validate constraint institutes_programs_check;

create index if not exists subjects_program_year_idx
  on public.subjects (program_code, year);

comment on column public.profiles.program_code is
  'Undergraduate degree programme. Null remains valid for legacy MBBS profiles and specialized tests.';
comment on column public.subjects.program_code is
  'Undergraduate degree programme. Specialized-test subjects remain null.';
comment on column public.institutes.programs is
  'Enabled undergraduate programmes. Add bds/d_pharm only after scoped content is available.';
