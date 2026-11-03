-- FCPS non-Anatomy chapter titles, recorded in fcps_sql/fcps_non_anatomy_chapter_renames_20261025.csv.
-- Original names are retained for repeatable source imports.
do $$
declare
  v_updated integer;
begin
  alter table public.chapters add column if not exists original_name text;
  create temporary table fcps_chapter_name_map (
    id uuid primary key,
    subject_name text not null,
    original_name text not null,
    changed_name text not null
  ) on commit drop;
  insert into fcps_chapter_name_map (id, subject_name, original_name, changed_name) values
    ('5e417f0f-3a72-468e-868a-96c3ef281c70'::uuid,'Biochemistry (Paper 1)','Biomedical Diagnostic Techniques - Diagnostic Techniques Part 1','Biomedical Diagnostic Techniques Part 1'),
    ('f3a0d289-8665-4f1e-8fa4-cf3eb4fd2c6e'::uuid,'Biochemistry (Paper 1)','Biomedical Diagnostic Techniques - Diagnostic Techniques Part 2','Biomedical Diagnostic Techniques Part 2'),
    ('50b3fc14-c980-400e-8e57-c852e3a8620a'::uuid,'Biochemistry (Paper 1)','Biomolecules - Carbohydrates','Carbohydrates'),
    ('1458f0d7-de88-41c3-9090-ac0265ea65bf'::uuid,'Biochemistry (Paper 1)','Biomolecules - Lipids','Lipids'),
    ('9e418227-7d5f-447a-806b-d175cbd4d11a'::uuid,'Biochemistry (Paper 1)','Biomolecules - Nucleic Acids','Nucleic Acids'),
    ('31134242-d7c7-4b90-a821-0dbf88bcc163'::uuid,'Biochemistry (Paper 1)','Biomolecules - Proteins','Proteins'),
    ('3ff6f5ad-45a7-4ed7-89a3-6d6dc2b6c042'::uuid,'Biochemistry (Paper 1)','Metabolism Regulation Disorders - Enzymes Coenzymes','Enzymes and Coenzymes'),
    ('e637c859-7125-4724-9405-d23da1085485'::uuid,'Biochemistry (Paper 2)','Metabolism Regulation Disorders - Hormonal Metabolism','Hormonal Metabolism'),
    ('ae58caf8-82de-428e-984d-e65bd9e01a7a'::uuid,'Biochemistry (Paper 2)','Metabolism Regulation Disorders - Metabolic Disorders Part 1','Metabolic Disorders Part 1'),
    ('eba979ef-fdef-434c-90c4-cee7b1b57e84'::uuid,'Biochemistry (Paper 2)','Metabolism Regulation Disorders - Metabolic Disorders Part 2','Metabolic Disorders Part 2'),
    ('f8df71b1-80cc-4558-bdde-eeca3f166ce4'::uuid,'General Pathology Microbiology Immunology (Paper 1)','General Pathology - Cell Injury Inflammation','Cell Injury and Inflammation'),
    ('e790dcee-c412-4ba6-956a-a2e55a713c71'::uuid,'General Pathology Microbiology Immunology (Paper 1)','General Pathology - General Pathology Part 1','General Pathology Part 1'),
    ('df68ae76-b1b9-439e-8d65-6163f9d1cace'::uuid,'General Pathology Microbiology Immunology (Paper 2)','General Pathology - Hemodynamic Disorders','Hemodynamic Disorders'),
    ('95c18bcb-4897-4ab2-9784-554041b1f272'::uuid,'General Pathology Microbiology Immunology (Paper 2)','General Pathology - Immunopathology Genetics','Immunopathology and Genetics'),
    ('511bc2aa-9fb9-4734-acb7-58ac172c6858'::uuid,'General Pathology Microbiology Immunology (Paper 2)','General Pathology - Neoplasia','Neoplasia'),
    ('ea043c06-1da6-4e40-9e4b-7e6e705fc17a'::uuid,'General Pathology Microbiology Immunology (Paper 2)','Microbiology Anaerobic Spirochetes - Anaerobic Spirochetes','Anaerobes and Spirochetes'),
    ('210fcbb0-173f-4084-b14e-087c23057513'::uuid,'General Pathology Microbiology Immunology (Paper 2)','Microbiology Gram Negative - Gram Negative Enteric','Enteric Gram-Negative Bacteria'),
    ('9bdcb395-db33-43ee-8085-21842f7b12d5'::uuid,'General Pathology Microbiology Immunology (Paper 2)','Microbiology Gram Negative - Other Gram Negative','Other Gram-Negative Bacteria'),
    ('58b04587-1525-429c-83a1-6c17c9e2eda6'::uuid,'General Pathology Microbiology Immunology (Paper 2)','Microbiology Gram Positive - Gram Positive Bacilli','Gram-Positive Bacilli'),
    ('be951b57-eb36-4e60-a1d8-b8b1c6d076dd'::uuid,'General Pathology Microbiology Immunology (Paper 2)','Microbiology Gram Positive - Gram Positive Cocci','Gram-Positive Cocci'),
    ('38761a60-d4c8-4819-ae31-3993bedf2e90'::uuid,'General Pathology Microbiology Immunology (Paper 2)','Microbiology Mycobacteria Atypical - Mycobacteria','Mycobacteria, Including Atypical Species'),
    ('83e1fbba-92af-46c3-9bed-6603de98c142'::uuid,'General Pathology Microbiology Immunology (Paper 2)','Virology - Virology Part 1','Virology Part 1'),
    ('64a381bf-86cb-4ed0-b3ac-e4ae80004229'::uuid,'General Pathology Microbiology Immunology (Paper 2)','Virology - Virology Part 2','Virology Part 2'),
    ('2a40a604-6b39-42ae-8739-076ab26ecfdc'::uuid,'Pharmacology (Paper 1)','Autonomic Nervous System - ANS Pharmacology','Autonomic Nervous System Pharmacology'),
    ('e00d2d4a-f9dd-48d0-a8a1-a5ec18b2cb2b'::uuid,'Pharmacology (Paper 1)','Central Nervous System - CNS Pharmacology','Central Nervous System Pharmacology'),
    ('ec72c136-edeb-487d-8a91-789bf6e21cfa'::uuid,'Pharmacology (Paper 2)','Cardiovascular Blood - CV Drugs','Cardiovascular Drugs'),
    ('034c3219-38d3-47d8-9298-2bce71cd1ad5'::uuid,'Pharmacology (Paper 2)','Chemotherapeutic Agents - Chemotherapy Part 1','Chemotherapeutic Agents Part 1'),
    ('ef5ec767-f9c2-4b5a-9335-f476a155728b'::uuid,'Pharmacology (Paper 2)','Chemotherapeutic Agents - Chemotherapy Part 2','Chemotherapeutic Agents Part 2'),
    ('23c09ae6-6f78-4370-a050-fd3fc7691e05'::uuid,'Pharmacology (Paper 2)','Endocrine System - Endocrine Drugs','Endocrine Drugs'),
    ('2ac2d493-eca5-4973-9a70-0944bcdda815'::uuid,'Pharmacology (Paper 2)','GIT Hepatobiliary - GIT Drugs','Gastrointestinal and Hepatobiliary Drugs'),
    ('ae1c0516-cc63-4a91-9cb9-92075cb9c3bc'::uuid,'Pharmacology (Paper 2)','Hematologic Coagulation - Hematologic Drugs','Hematologic and Coagulation Drugs'),
    ('93ca89b9-bc57-4656-875d-8cf085a6bf4c'::uuid,'Pharmacology (Paper 2)','Respiratory System - Respiratory Drugs','Respiratory Drugs'),
    ('cbb0aab6-b282-4de7-8ab1-6552950eb8ce'::uuid,'Physiology (Paper 1)','Exercise Unusual Environment - Exercise Environment','Exercise and Environmental Physiology'),
    ('5ca6df07-6737-4ce2-84dc-c200c1b55fa5'::uuid,'Physiology (Paper 2)','Cardiovascular System - CVS Part 1','Cardiovascular Physiology Part 1'),
    ('80645b47-5e3f-493b-8e16-7dee0b60a9cb'::uuid,'Physiology (Paper 2)','Cardiovascular System - CVS Part 2','Cardiovascular Physiology Part 2'),
    ('90e57883-ebf5-49b0-8c91-a9d1fd8e0f1b'::uuid,'Physiology (Paper 2)','Central Nervous System - CNS Part 1','Central Nervous System Physiology Part 1'),
    ('18d662ea-73cd-47a7-be4a-a07c3b53a6a1'::uuid,'Physiology (Paper 2)','Central Nervous System - CNS Part 2','Central Nervous System Physiology Part 2'),
    ('ca739a2c-dfe0-4a2e-a9d5-15626218530b'::uuid,'Physiology (Paper 2)','Endocrinology - Endocrinology Part 1','Endocrine Physiology Part 1'),
    ('564dcc9a-f706-456b-8582-5b59ef3ca01f'::uuid,'Physiology (Paper 2)','Endocrinology - Endocrinology Part 2','Endocrine Physiology Part 2'),
    ('d91a8dea-5c12-496c-9373-8198557ae77a'::uuid,'Physiology (Paper 2)','GIT Liver - GIT Part 1','Gastrointestinal and Liver Physiology Part 1'),
    ('f4017487-d522-4b4e-821c-199683803642'::uuid,'Physiology (Paper 2)','GIT Liver - GIT Part 2','Gastrointestinal and Liver Physiology Part 2'),
    ('09725add-fdab-49b1-95a6-f99c1afdf4f1'::uuid,'Physiology (Paper 2)','Renal Body Fluids - Renal Part 1','Renal and Body Fluids Physiology Part 1'),
    ('bf3f446c-3edd-4abe-a218-c1054262aadc'::uuid,'Physiology (Paper 2)','Renal Body Fluids - Renal Part 2','Renal and Body Fluids Physiology Part 2'),
    ('d749587e-80aa-4001-9255-36e51a5883ce'::uuid,'Physiology (Paper 2)','Respiratory System - Respiratory Part 1','Respiratory Physiology Part 1'),
    ('70543da7-f481-466b-a4b0-f7415595676c'::uuid,'Physiology (Paper 2)','Respiratory System - Respiratory Part 2','Respiratory Physiology Part 2'),
    ('c91a4058-d324-4451-8dd9-a5fc6fb17ba6'::uuid,'Physiology (Paper 2)','Surgery - Reproduction','Reproductive Physiology (Surgery)'),
    ('98e6e6c9-2c0f-4fc1-a24d-462b1dd53faa'::uuid,'Physiology (Paper 2)','Surgery - Special Senses','Special Senses Physiology (Surgery)'),
    ('5dad5cba-44e1-45d5-bdd8-e471887c35b3'::uuid,'Research and Biostatistics (Paper 1)','Surgery - Biostatistics','Biostatistics (Surgery)'),
    ('9d9a320b-0f4c-4e2e-912a-b4e79f42fc40'::uuid,'Research and Biostatistics (Paper 1)','Surgery - Epidemiology','Epidemiology (Surgery)');

  if (select count(*) from fcps_chapter_name_map) <> 49 then
    raise exception 'Expected exactly 49 FCPS chapter renames';
  end if;
  if exists (
    select 1 from fcps_chapter_name_map m
    left join public.chapters c on c.id = m.id
    left join public.subjects s on s.id = c.subject_id
    where c.id is null or c.name is distinct from m.original_name
      or s.name is distinct from m.subject_name
      or s.institutes::text not ilike '%fcps%'
  ) then
    raise exception 'FCPS chapter or subject changed since audit';
  end if;
  if exists (
    select 1 from fcps_chapter_name_map m
    join public.chapters c on c.id = m.id
    join public.chapters other on other.subject_id = c.subject_id and other.id <> c.id
    left join fcps_chapter_name_map om on om.id = other.id
    where lower(coalesce(om.changed_name, other.name)) = lower(m.changed_name)
  ) then
    raise exception 'Proposed FCPS chapter names collide within a subject';
  end if;

  update public.chapters c
  set original_name = coalesce(c.original_name, c.name),
      name = m.changed_name
  from fcps_chapter_name_map m
  where c.id = m.id;
  get diagnostics v_updated = row_count;
  if v_updated <> 49 then
    raise exception 'Updated % chapters instead of 49', v_updated;
  end if;
end $$;
