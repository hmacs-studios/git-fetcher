-- Split FCPS Medicine & Allied Paper 1 into Embryology and Histology.
-- Keep all chapter UUIDs and names so MCQ attempts and saved questions remain linked.
do $$
declare
  v_embryology_id uuid := '8afd4f12-473a-4e03-b147-2cd9bfa4d95d';
  v_anatomy_id uuid := '0e661b15-8b34-4133-b44b-9139f4d8458f';
  v_histology_id uuid;
  v_moved integer;
begin
  if not exists (
    select 1 from public.subjects
    where id = v_embryology_id
      and name = 'Anatomy Histology Embryology (Paper 1)'
      and year = 'medicine_allied'
      and institutes = '["fcps_part_1"]'::jsonb
  ) or not exists (
    select 1 from public.subjects
    where id = v_anatomy_id
      and name = 'Anatomy Histology Embryology (Paper 2)'
      and year = 'medicine_allied'
      and institutes = '["fcps_part_1"]'::jsonb
  ) then
    raise exception 'Original FCPS Medicine & Allied subjects changed';
  end if;

  if (select count(*) from public.chapters where subject_id = v_embryology_id) <> 20
    or (select count(*) from public.chapters where subject_id = v_anatomy_id) <> 38
    or (select count(*) from public.chapters
        where subject_id = v_embryology_id
          and (name like 'General Histology - %' or name like 'Special Histology - %')) <> 11
  then
    raise exception 'FCPS chapter distribution changed; expected 20, 38, and 11 Histology chapters';
  end if;

  if exists (
    select 1 from public.subjects
    where year = 'medicine_allied'
      and institutes = '["fcps_part_1"]'::jsonb
      and name in ('Embryology (Paper 1)', 'Histology (Paper 1)', 'Anatomy (Paper 2)')
  ) then
    raise exception 'A proposed FCPS subject name already exists';
  end if;

  insert into public.subjects
    (name, description, icon, color, year, institutes, free_unlimited_access)
  select
    'Histology (Paper 1)', 'FCPS Part-1 Medicine Allied Paper 1',
    '🔬', '#8b5cf6', year, institutes, free_unlimited_access
  from public.subjects
  where id = v_embryology_id
  returning id into v_histology_id;

  update public.chapters
  set subject_id = v_histology_id,
      chapter_number = chapter_number - 9
  where subject_id = v_embryology_id
    and (name like 'General Histology - %' or name like 'Special Histology - %');
  get diagnostics v_moved = row_count;
  if v_moved <> 11 then
    raise exception 'Moved % Histology chapters instead of 11', v_moved;
  end if;

  update public.subjects
  set name = 'Embryology (Paper 1)', icon = '🧬'
  where id = v_embryology_id;

  update public.subjects
  set name = 'Anatomy (Paper 2)', icon = '🦴'
  where id = v_anatomy_id;

  if (select count(*) from public.chapters where subject_id = v_embryology_id) <> 9
    or (select count(*) from public.chapters where subject_id = v_histology_id) <> 11
    or (select count(*) from public.chapters where subject_id = v_anatomy_id) <> 38
  then
    raise exception 'FCPS subject split failed final chapter count check';
  end if;
end $$;
