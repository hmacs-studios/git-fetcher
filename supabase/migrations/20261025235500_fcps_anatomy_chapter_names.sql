-- Rename 51 FCPS Medicine & Allied chapters after the subject split.
-- UUID, previous name, and new name are in fcps_sql/fcps_anatomy_histology_embryology_chapter_renames_20261025.csv.
-- Neuroanatomy chapter names stay unchanged. Original names remain available for legacy imports.
do $$
declare
  v_updated integer;
begin
  create temporary table fcps_anatomy_chapter_name_map (
    id uuid primary key,
    subject_name text not null,
    original_name text not null,
    changed_name text not null
  ) on commit drop;
  insert into fcps_anatomy_chapter_name_map (id, subject_name, original_name, changed_name) values
    ('aba786d2-2244-478e-b298-e8abadd3176a'::uuid, 'Anatomy (Paper 2)', 'Gross Anatomy Upper Limb - Arm Forearm Wrist Hand', 'Upper Limb - Arm Forearm Wrist Hand'),
    ('42b36d92-25d0-461b-babc-9bf838890e73'::uuid, 'Anatomy (Paper 2)', 'Gross Anatomy Upper Limb - Breast', 'Upper Limb - Breast'),
    ('da31d330-49c8-4e9b-83bb-3fbb00e32805'::uuid, 'Anatomy (Paper 2)', 'Gross Anatomy Upper Limb - Innervation of Muscles', 'Upper Limb - Innervation of Muscles'),
    ('737b2c91-7d83-4420-be7f-1d8be87ff62c'::uuid, 'Anatomy (Paper 2)', 'Gross Anatomy Upper Limb - Osteology', 'Upper Limb - Osteology'),
    ('4c60d8f8-9dc9-442d-9e27-89393396d744'::uuid, 'Anatomy (Paper 2)', 'Gross Anatomy Upper Limb - Pectoral Girdle Axilla', 'Upper Limb - Pectoral Girdle Axilla'),
    ('51359f51-6aea-4e9f-ae2a-bb44ac8fc839'::uuid, 'Anatomy (Paper 2)', 'Gross Anatomy Lower Limb - Ankle Foot', 'Lower Limb - Ankle Foot'),
    ('444febc7-b1e2-40c9-ab40-b0f6a70eb04c'::uuid, 'Anatomy (Paper 2)', 'Gross Anatomy Lower Limb - Gluteal Region Hip Joint', 'Lower Limb - Gluteal Region Hip Joint'),
    ('16258fd5-7527-4ca0-8807-e446e6d1aedd'::uuid, 'Anatomy (Paper 2)', 'Gross Anatomy Lower Limb - Innervation of Muscles', 'Lower Limb - Innervation of Muscles'),
    ('4df937f5-9441-4dbe-a479-183bf6b138b7'::uuid, 'Anatomy (Paper 2)', 'Gross Anatomy Lower Limb - Osteology', 'Lower Limb - Osteology'),
    ('99559fa0-e156-42d4-9c75-d8e47d3cc069'::uuid, 'Anatomy (Paper 2)', 'Gross Anatomy Lower Limb - Thigh Popliteal Knee Leg', 'Lower Limb - Thigh Popliteal Knee Leg'),
    ('29feaa1b-eea3-4493-ab74-192f6cc282e9'::uuid, 'Anatomy (Paper 2)', 'Gross Anatomy Head and Neck - Ear Temporal Bone', 'Head and Neck - Ear Temporal Bone'),
    ('7b204a8f-e2d4-4a5c-b284-11f577b01f21'::uuid, 'Anatomy (Paper 2)', 'Gross Anatomy Head and Neck - Nose Paranasal Sinuses', 'Head and Neck - Nose Paranasal Sinuses'),
    ('3a795448-5e22-4d11-a947-25440ca99022'::uuid, 'Anatomy (Paper 2)', 'Gross Anatomy Head and Neck - Oral Cavity Pharynx', 'Head and Neck - Oral Cavity Pharynx'),
    ('2305a07c-3bec-4cc8-b257-b741585583c1'::uuid, 'Anatomy (Paper 2)', 'Gross Anatomy Head and Neck - Orbit Eyeball', 'Head and Neck - Orbit Eyeball'),
    ('e8607705-d9cd-415f-8826-698e60538cd7'::uuid, 'Anatomy (Paper 2)', 'Gross Anatomy Head and Neck - Scalp Face Parotid', 'Head and Neck - Scalp Face Parotid'),
    ('e2ac1de1-5a75-4954-b5d1-cd5987c134f7'::uuid, 'Anatomy (Paper 2)', 'Gross Anatomy Head and Neck - Thyroid Larynx Pharynx', 'Head and Neck - Thyroid Larynx Pharynx'),
    ('781aca4e-516f-4e37-9c17-284c94a3ab35'::uuid, 'Anatomy (Paper 2)', 'Gross Anatomy Head and Neck - Triangles of Neck', 'Head and Neck - Triangles of Neck'),
    ('3f7430f4-1be3-4e38-a34e-d691ca759ff5'::uuid, 'Anatomy (Paper 2)', 'Gross Anatomy Thorax - Heart Pericardium', 'Thorax - Heart Pericardium'),
    ('0dc0afac-81a0-4708-a56c-a9e7e436244e'::uuid, 'Anatomy (Paper 2)', 'Gross Anatomy Thorax - Lungs Pleura', 'Thorax - Lungs Pleura'),
    ('088a2faa-ed10-41cf-9f76-343e24c5f49c'::uuid, 'Anatomy (Paper 2)', 'Gross Anatomy Thorax - Mediastinum', 'Thorax - Mediastinum'),
    ('9a9e17b8-a9e1-42ad-ba54-1bd46367cfba'::uuid, 'Anatomy (Paper 2)', 'Gross Anatomy Thorax - Thoracic Wall Breast', 'Thorax - Thoracic Wall Breast'),
    ('15cf0ed8-1346-494a-bfaf-c65c0772acd4'::uuid, 'Anatomy (Paper 2)', 'Gross Anatomy Abdomen - Anterior Abdominal Wall', 'Abdomen - Anterior Abdominal Wall'),
    ('bd23b368-d193-463a-a827-311626fb7b49'::uuid, 'Anatomy (Paper 2)', 'Gross Anatomy Abdomen - Intestines Appendix Colon', 'Abdomen - Intestines Appendix Colon'),
    ('ec605f11-71bf-4c0e-a8db-1647d6a2e9fa'::uuid, 'Anatomy (Paper 2)', 'Gross Anatomy Abdomen - Liver Gallbladder Pancreas Spleen', 'Abdomen - Liver Gallbladder Pancreas Spleen'),
    ('63f34207-617d-42e9-984e-32855dbde09f'::uuid, 'Anatomy (Paper 2)', 'Gross Anatomy Abdomen - Posterior Abdominal Wall', 'Abdomen - Posterior Abdominal Wall'),
    ('eaf8df87-0fea-4694-85df-93906b15f6cd'::uuid, 'Anatomy (Paper 2)', 'Gross Anatomy Abdomen - Stomach Duodenum', 'Abdomen - Stomach Duodenum'),
    ('bbe27de9-97c8-480c-820e-1bfac20e536f'::uuid, 'Anatomy (Paper 2)', 'Gross Anatomy Pelvis and Perineum - Female Reproductive Organs', 'Pelvis and Perineum - Female Reproductive Organs'),
    ('e42a34f6-f159-48cc-aef6-651c14fca142'::uuid, 'Anatomy (Paper 2)', 'Gross Anatomy Pelvis and Perineum - Male Reproductive Organs', 'Pelvis and Perineum - Male Reproductive Organs'),
    ('c5501cb5-11da-4c0d-a262-fe24a4f9e934'::uuid, 'Anatomy (Paper 2)', 'Gross Anatomy Pelvis and Perineum - Pelvic Wall Vessels Nerves', 'Pelvis and Perineum - Pelvic Wall Vessels Nerves'),
    ('ae3cb31a-3402-448f-879f-992f59dc6d36'::uuid, 'Anatomy (Paper 2)', 'Gross Anatomy Pelvis and Perineum - Perineum', 'Pelvis and Perineum - Perineum'),
    ('2669c97b-33bc-465e-85b0-03380771f1b7'::uuid, 'Anatomy (Paper 2)', 'Gross Anatomy Pelvis and Perineum - Urinary Bladder Urethra', 'Pelvis and Perineum - Urinary Bladder Urethra'),
    ('563ec722-c40a-437a-962c-a969a40e1ce6'::uuid, 'Embryology (Paper 1)', 'General Embryology - Early Development', 'Early Development'),
    ('77a902b9-4109-46e3-ab93-70492684f800'::uuid, 'Embryology (Paper 1)', 'Normal Defective Development - Cardiovascular System', 'Cardiovascular Development'),
    ('67f2c886-b8cb-45d1-b632-e668cb379436'::uuid, 'Embryology (Paper 1)', 'Normal Defective Development - Central Nervous System', 'Central Nervous System Development'),
    ('548b034b-f9e4-4451-863b-cfef582fa9c5'::uuid, 'Embryology (Paper 1)', 'Normal Defective Development - Gastrointestinal Tract', 'Gastrointestinal Development'),
    ('f7b90774-ebda-462f-b2db-eb682eb70c60'::uuid, 'Embryology (Paper 1)', 'Normal Defective Development - Head and Neck', 'Head and Neck Development'),
    ('e2a23ed8-ee0d-4d86-b64a-738d2a767cf6'::uuid, 'Embryology (Paper 1)', 'Normal Defective Development - Musculoskeletal System', 'Musculoskeletal Development'),
    ('022b643f-edc2-4f97-91ac-c3adf2795e85'::uuid, 'Embryology (Paper 1)', 'Normal Defective Development - Respiratory System', 'Respiratory Development'),
    ('f0c99b8b-c833-495e-8b76-da0af04f8709'::uuid, 'Embryology (Paper 1)', 'Normal Defective Development - Special Senses', 'Special Senses Development'),
    ('d7d753cf-3ca2-484d-9e80-ef2774b589f3'::uuid, 'Embryology (Paper 1)', 'Normal Defective Development - Urogenital System', 'Urogenital Development'),
    ('5d88d735-9294-4083-99ae-2b8b3961fdad'::uuid, 'Histology (Paper 1)', 'General Histology - Connective Tissue Bone Cartilage', 'Connective Tissue Bone Cartilage'),
    ('1617e4d4-d9f7-4f30-bb83-2084a5458f27'::uuid, 'Histology (Paper 1)', 'General Histology - Epithelia Cell Junctions', 'Epithelia Cell Junctions'),
    ('237c1022-cb5d-4e87-bb6a-8a5e32965c51'::uuid, 'Histology (Paper 1)', 'General Histology - Muscular Tissue', 'Muscular Tissue'),
    ('ad30f04f-a55e-411b-a9d8-bce98f7e4fe7'::uuid, 'Histology (Paper 1)', 'General Histology - Nervous Tissue', 'Nervous Tissue'),
    ('a2d1e840-5292-4139-8295-45c2600a3b3e'::uuid, 'Histology (Paper 1)', 'Special Histology - Endocrine System', 'Endocrine System'),
    ('c001db03-49fa-42b9-94ab-a0ce13f0350b'::uuid, 'Histology (Paper 1)', 'Special Histology - Gastrointestinal Tract', 'Gastrointestinal Tract'),
    ('016fe0d8-dcf5-48ba-be42-556b27cbae22'::uuid, 'Histology (Paper 1)', 'Special Histology - Immune Lymphatic System', 'Immune Lymphatic System'),
    ('9d9312b5-f9d1-4d67-a3de-cd629b8c54f5'::uuid, 'Histology (Paper 1)', 'Special Histology - Integumentary System', 'Integumentary System'),
    ('50c2521f-d68f-4a1a-bcbb-5a80d076a173'::uuid, 'Histology (Paper 1)', 'Special Histology - Respiratory System', 'Respiratory System'),
    ('c4540787-5de4-4e51-85f4-abd0c355c641'::uuid, 'Histology (Paper 1)', 'Special Histology - Special Senses', 'Special Senses'),
    ('c9dad32d-8352-4c2e-807d-e47e2721c0e2'::uuid, 'Histology (Paper 1)', 'Special Histology - Urinary Reproductive System', 'Urinary Reproductive System');

  if (select count(*) from fcps_anatomy_chapter_name_map) <> 51 then
    raise exception 'Expected exactly 51 FCPS chapter renames';
  end if;
  if exists (
    select 1 from fcps_anatomy_chapter_name_map m
    left join public.chapters c on c.id = m.id
    left join public.subjects s on s.id = c.subject_id
    where c.id is null or c.name is distinct from m.original_name
      or s.name is distinct from m.subject_name
      or s.year is distinct from 'medicine_allied'
      or s.institutes is distinct from '["fcps_part_1"]'::jsonb
  ) then
    raise exception 'FCPS chapter or subject changed since audit';
  end if;
  if exists (
    select 1 from fcps_anatomy_chapter_name_map m
    join public.chapters c on c.id = m.id
    join public.chapters other on other.subject_id = c.subject_id and other.id <> c.id
    left join fcps_anatomy_chapter_name_map om on om.id = other.id
    where lower(coalesce(om.changed_name, other.name)) = lower(m.changed_name)
  ) then
    raise exception 'Proposed FCPS chapter names collide within a subject';
  end if;

  update public.chapters c
  set original_name = coalesce(c.original_name, c.name),
      name = m.changed_name
  from fcps_anatomy_chapter_name_map m
  where c.id = m.id;
  get diagnostics v_updated = row_count;
  if v_updated <> 51 then
    raise exception 'Updated % chapters instead of 51', v_updated;
  end if;
end $$;
