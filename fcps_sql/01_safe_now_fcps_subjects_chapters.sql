-- FCPS Part-1 Medicine & Allied directory seed: subjects and chapters only.
-- Safe to run before app v30 because it does not move users, progress, or MCQs.
-- Re-runnable: existing subjects/chapters are reused by name + specialty/year.
-- Paper labels are based on the Medicine & Allied and Surgery & Allied curriculum PDFs supplied on 2026-07-30.
-- Ordering: Paper 1 subjects are listed first, then Paper 2 subjects.

create extension if not exists pgcrypto;

do $$
declare
  v_subject_id uuid;
  v_chapter_id uuid;
  v_subject record;
  v_chapter record;
begin
  insert into public.institutes (
    code,
    name,
    short_name,
    enabled,
    category,
    years,
    dashboard_components
  )
  select
    'fcps_part_1',
    'FCPS Part-1',
    'FCPS-1',
    false,
    'specialized_test',
    array['medicine_allied']::text[],
    jsonb_build_object('mcqs', true, 'seqs', false, 'viva', false)
  where not exists (select 1 from public.institutes where lower(code) = 'fcps_part_1');

  update public.institutes
  set
    category = 'specialized_test',
    years = array['medicine_allied']::text[],
    dashboard_components = jsonb_build_object('mcqs', true, 'seqs', false, 'viva', false)
  where lower(code) = 'fcps_part_1';

  create temporary table fcps_subject_seed (
    subject_key text primary key,
    subject_name text not null,
    specialty text not null,
    paper integer not null,
    display_order integer not null
  ) on commit drop;

  insert into fcps_subject_seed (subject_key, subject_name, specialty, paper, display_order)
  values
    ('medicine_allied:anatomy_histology_embryology:paper_1', 'Embryology (Paper 1)', 'medicine_allied', 1, 101),
    ('medicine_allied:histology:paper_1', 'Histology (Paper 1)', 'medicine_allied', 1, 102),
    ('medicine_allied:physiology:paper_1', 'Physiology (Paper 1)', 'medicine_allied', 1, 102),
    ('medicine_allied:biochemistry:paper_1', 'Biochemistry (Paper 1)', 'medicine_allied', 1, 103),
    ('medicine_allied:pharmacology:paper_1', 'Pharmacology (Paper 1)', 'medicine_allied', 1, 104),
    ('medicine_allied:general_pathology_microbiology_immunology:paper_1', 'General Pathology Microbiology Immunology (Paper 1)', 'medicine_allied', 1, 105),
    ('medicine_allied:research_biostatistics:paper_1', 'Research Biostatistics (Paper 1)', 'medicine_allied', 1, 106),
    ('medicine_allied:behavioural_science_medical_ethics:paper_1', 'Behavioural Science Medical Ethics (Paper 1)', 'medicine_allied', 1, 107),
    ('medicine_allied:anatomy_histology_embryology:paper_2', 'Anatomy (Paper 2)', 'medicine_allied', 2, 201),
    ('medicine_allied:physiology:paper_2', 'Physiology (Paper 2)', 'medicine_allied', 2, 202),
    ('medicine_allied:biochemistry:paper_2', 'Biochemistry (Paper 2)', 'medicine_allied', 2, 203),
    ('medicine_allied:pharmacology:paper_2', 'Pharmacology (Paper 2)', 'medicine_allied', 2, 204),
    ('medicine_allied:general_pathology_microbiology_immunology:paper_2', 'General Pathology Microbiology Immunology (Paper 2)', 'medicine_allied', 2, 205),
    ('surgery_allied:anatomy:paper_1', 'Anatomy (Paper 1)', 'surgery_allied', 1, 101),
    ('surgery_allied:physiology:paper_1', 'Physiology (Paper 1)', 'surgery_allied', 1, 102),
    ('surgery_allied:biochemistry:paper_1', 'Biochemistry (Paper 1)', 'surgery_allied', 1, 103),
    ('surgery_allied:pharmacology:paper_1', 'Pharmacology (Paper 1)', 'surgery_allied', 1, 104),
    ('surgery_allied:pathology:paper_1', 'Pathology (Paper 1)', 'surgery_allied', 1, 105),
    ('surgery_allied:research_and_biostatistics:paper_1', 'Research and Biostatistics (Paper 1)', 'surgery_allied', 1, 106),
    ('surgery_allied:behavioral_science_and_medical_ethics:paper_1', 'Behavioral Science and Medical Ethics (Paper 1)', 'surgery_allied', 1, 107),
    ('surgery_allied:anatomy:paper_2', 'Anatomy (Paper 2)', 'surgery_allied', 2, 201),
    ('surgery_allied:physiology:paper_2', 'Physiology (Paper 2)', 'surgery_allied', 2, 202),
    ('surgery_allied:biochemistry:paper_2', 'Biochemistry (Paper 2)', 'surgery_allied', 2, 203),
    ('surgery_allied:pharmacology:paper_2', 'Pharmacology (Paper 2)', 'surgery_allied', 2, 204),
    ('surgery_allied:pathology:paper_2', 'Pathology (Paper 2)', 'surgery_allied', 2, 205);

  create temporary table fcps_chapter_seed (
    subject_key text not null,
    chapter_name text not null,
    chapter_number integer not null
  ) on commit drop;

  insert into fcps_chapter_seed (subject_key, chapter_name, chapter_number)
  values
    ('medicine_allied:anatomy_histology_embryology:paper_1', 'General Embryology - Early Development', 1),
    ('medicine_allied:anatomy_histology_embryology:paper_1', 'Normal Defective Development - Cardiovascular System', 2),
    ('medicine_allied:anatomy_histology_embryology:paper_1', 'Normal Defective Development - Central Nervous System', 3),
    ('medicine_allied:anatomy_histology_embryology:paper_1', 'Normal Defective Development - Gastrointestinal Tract', 4),
    ('medicine_allied:anatomy_histology_embryology:paper_1', 'Normal Defective Development - Head and Neck', 5),
    ('medicine_allied:anatomy_histology_embryology:paper_1', 'Normal Defective Development - Musculoskeletal System', 6),
    ('medicine_allied:anatomy_histology_embryology:paper_1', 'Normal Defective Development - Respiratory System', 7),
    ('medicine_allied:anatomy_histology_embryology:paper_1', 'Normal Defective Development - Special Senses', 8),
    ('medicine_allied:anatomy_histology_embryology:paper_1', 'Normal Defective Development - Urogenital System', 9),
    ('medicine_allied:histology:paper_1', 'General Histology - Connective Tissue Bone Cartilage', 1),
    ('medicine_allied:histology:paper_1', 'General Histology - Epithelia Cell Junctions', 2),
    ('medicine_allied:histology:paper_1', 'General Histology - Muscular Tissue', 3),
    ('medicine_allied:histology:paper_1', 'General Histology - Nervous Tissue', 4),
    ('medicine_allied:histology:paper_1', 'Special Histology - Endocrine System', 5),
    ('medicine_allied:histology:paper_1', 'Special Histology - Gastrointestinal Tract', 6),
    ('medicine_allied:histology:paper_1', 'Special Histology - Immune Lymphatic System', 7),
    ('medicine_allied:histology:paper_1', 'Special Histology - Integumentary System', 8),
    ('medicine_allied:histology:paper_1', 'Special Histology - Respiratory System', 9),
    ('medicine_allied:histology:paper_1', 'Special Histology - Special Senses', 10),
    ('medicine_allied:histology:paper_1', 'Special Histology - Urinary Reproductive System', 11),
    ('medicine_allied:physiology:paper_1', 'Cell Nerve Muscle - Cell Nerve Muscle', 1),
    ('medicine_allied:physiology:paper_1', 'Blood Immunity - Blood Immunity', 2),
    ('medicine_allied:physiology:paper_1', 'Exercise Unusual Environment - Exercise Environment', 3),
    ('medicine_allied:biochemistry:paper_1', 'Biomolecules - Carbohydrates', 1),
    ('medicine_allied:biochemistry:paper_1', 'Biomolecules - Lipids', 2),
    ('medicine_allied:biochemistry:paper_1', 'Biomolecules - Nucleic Acids', 3),
    ('medicine_allied:biochemistry:paper_1', 'Biomolecules - Proteins', 4),
    ('medicine_allied:biochemistry:paper_1', 'Metabolism Regulation Disorders - Enzymes Coenzymes', 5),
    ('medicine_allied:biochemistry:paper_1', 'Biomedical Diagnostic Techniques - Diagnostic Techniques Part 1', 6),
    ('medicine_allied:biochemistry:paper_1', 'Biomedical Diagnostic Techniques - Diagnostic Techniques Part 2', 7),
    ('medicine_allied:pharmacology:paper_1', 'General Pharmacology - General Pharmacology', 1),
    ('medicine_allied:pharmacology:paper_1', 'Autonomic Nervous System - ANS Pharmacology', 2),
    ('medicine_allied:pharmacology:paper_1', 'Central Nervous System - CNS Pharmacology', 3),
    ('medicine_allied:pharmacology:paper_1', 'Analgesics - Analgesics', 4),
    ('medicine_allied:pharmacology:paper_1', 'Miscellaneous - Miscellaneous', 5),
    ('medicine_allied:general_pathology_microbiology_immunology:paper_1', 'General Pathology - Cell Injury Inflammation', 1),
    ('medicine_allied:general_pathology_microbiology_immunology:paper_1', 'General Pathology - General Pathology Part 1', 2),
    ('medicine_allied:research_biostatistics:paper_1', 'Epidemiology - Epidemiology', 1),
    ('medicine_allied:research_biostatistics:paper_1', 'Biostatistics - Biostatistics', 2),
    ('medicine_allied:behavioural_science_medical_ethics:paper_1', 'Medical Ethics - Medical Ethics', 1),
    ('medicine_allied:behavioural_science_medical_ethics:paper_1', 'Communication Skills - Communication Skills', 2),
    ('medicine_allied:behavioural_science_medical_ethics:paper_1', 'Psychosocial Aspects - Psychosocial Aspects', 3),
    ('medicine_allied:anatomy_histology_embryology:paper_2', 'Gross Anatomy Upper Limb - Arm Forearm Wrist Hand', 1),
    ('medicine_allied:anatomy_histology_embryology:paper_2', 'Gross Anatomy Upper Limb - Breast', 2),
    ('medicine_allied:anatomy_histology_embryology:paper_2', 'Gross Anatomy Upper Limb - Innervation of Muscles', 3),
    ('medicine_allied:anatomy_histology_embryology:paper_2', 'Gross Anatomy Upper Limb - Osteology', 4),
    ('medicine_allied:anatomy_histology_embryology:paper_2', 'Gross Anatomy Upper Limb - Pectoral Girdle Axilla', 5),
    ('medicine_allied:anatomy_histology_embryology:paper_2', 'Gross Anatomy Lower Limb - Ankle Foot', 6),
    ('medicine_allied:anatomy_histology_embryology:paper_2', 'Gross Anatomy Lower Limb - Gluteal Region Hip Joint', 7),
    ('medicine_allied:anatomy_histology_embryology:paper_2', 'Gross Anatomy Lower Limb - Innervation of Muscles', 8),
    ('medicine_allied:anatomy_histology_embryology:paper_2', 'Gross Anatomy Lower Limb - Osteology', 9),
    ('medicine_allied:anatomy_histology_embryology:paper_2', 'Gross Anatomy Lower Limb - Thigh Popliteal Knee Leg', 10),
    ('medicine_allied:anatomy_histology_embryology:paper_2', 'Gross Anatomy Head and Neck - Ear Temporal Bone', 11),
    ('medicine_allied:anatomy_histology_embryology:paper_2', 'Gross Anatomy Head and Neck - Nose Paranasal Sinuses', 12),
    ('medicine_allied:anatomy_histology_embryology:paper_2', 'Gross Anatomy Head and Neck - Oral Cavity Pharynx', 13),
    ('medicine_allied:anatomy_histology_embryology:paper_2', 'Gross Anatomy Head and Neck - Orbit Eyeball', 14),
    ('medicine_allied:anatomy_histology_embryology:paper_2', 'Gross Anatomy Head and Neck - Scalp Face Parotid', 15),
    ('medicine_allied:anatomy_histology_embryology:paper_2', 'Gross Anatomy Head and Neck - Thyroid Larynx Pharynx', 16),
    ('medicine_allied:anatomy_histology_embryology:paper_2', 'Gross Anatomy Head and Neck - Triangles of Neck', 17),
    ('medicine_allied:anatomy_histology_embryology:paper_2', 'Gross Anatomy Thorax - Heart Pericardium', 18),
    ('medicine_allied:anatomy_histology_embryology:paper_2', 'Gross Anatomy Thorax - Lungs Pleura', 19),
    ('medicine_allied:anatomy_histology_embryology:paper_2', 'Gross Anatomy Thorax - Mediastinum', 20),
    ('medicine_allied:anatomy_histology_embryology:paper_2', 'Gross Anatomy Thorax - Thoracic Wall Breast', 21),
    ('medicine_allied:anatomy_histology_embryology:paper_2', 'Gross Anatomy Abdomen - Anterior Abdominal Wall', 22),
    ('medicine_allied:anatomy_histology_embryology:paper_2', 'Gross Anatomy Abdomen - Intestines Appendix Colon', 23),
    ('medicine_allied:anatomy_histology_embryology:paper_2', 'Gross Anatomy Abdomen - Liver Gallbladder Pancreas Spleen', 24),
    ('medicine_allied:anatomy_histology_embryology:paper_2', 'Gross Anatomy Abdomen - Posterior Abdominal Wall', 25),
    ('medicine_allied:anatomy_histology_embryology:paper_2', 'Gross Anatomy Abdomen - Stomach Duodenum', 26),
    ('medicine_allied:anatomy_histology_embryology:paper_2', 'Gross Anatomy Pelvis and Perineum - Female Reproductive Organs', 27),
    ('medicine_allied:anatomy_histology_embryology:paper_2', 'Gross Anatomy Pelvis and Perineum - Male Reproductive Organs', 28),
    ('medicine_allied:anatomy_histology_embryology:paper_2', 'Gross Anatomy Pelvis and Perineum - Pelvic Wall Vessels Nerves', 29),
    ('medicine_allied:anatomy_histology_embryology:paper_2', 'Gross Anatomy Pelvis and Perineum - Perineum', 30),
    ('medicine_allied:anatomy_histology_embryology:paper_2', 'Gross Anatomy Pelvis and Perineum - Urinary Bladder Urethra', 31),
    ('medicine_allied:anatomy_histology_embryology:paper_2', 'Neuroanatomy - Brainstem', 32),
    ('medicine_allied:anatomy_histology_embryology:paper_2', 'Neuroanatomy - Cerebellum', 33),
    ('medicine_allied:anatomy_histology_embryology:paper_2', 'Neuroanatomy - Cerebral Hemispheres', 34),
    ('medicine_allied:anatomy_histology_embryology:paper_2', 'Neuroanatomy - Cranial Nerves', 35),
    ('medicine_allied:anatomy_histology_embryology:paper_2', 'Neuroanatomy - Diencephalon', 36),
    ('medicine_allied:anatomy_histology_embryology:paper_2', 'Neuroanatomy - Meninges Ventricles CSF', 37),
    ('medicine_allied:anatomy_histology_embryology:paper_2', 'Neuroanatomy - Spinal Cord Tracts', 38),
    ('medicine_allied:physiology:paper_2', 'Cardiovascular System - CVS Part 1', 1),
    ('medicine_allied:physiology:paper_2', 'Cardiovascular System - CVS Part 2', 2),
    ('medicine_allied:physiology:paper_2', 'Respiratory System - Respiratory Part 1', 3),
    ('medicine_allied:physiology:paper_2', 'Respiratory System - Respiratory Part 2', 4),
    ('medicine_allied:physiology:paper_2', 'GIT Liver - GIT Part 1', 5),
    ('medicine_allied:physiology:paper_2', 'GIT Liver - GIT Part 2', 6),
    ('medicine_allied:physiology:paper_2', 'Renal Body Fluids - Renal Part 1', 7),
    ('medicine_allied:physiology:paper_2', 'Renal Body Fluids - Renal Part 2', 8),
    ('medicine_allied:physiology:paper_2', 'Central Nervous System - CNS Part 1', 9),
    ('medicine_allied:physiology:paper_2', 'Central Nervous System - CNS Part 2', 10),
    ('medicine_allied:physiology:paper_2', 'Special Senses - Special Senses', 11),
    ('medicine_allied:physiology:paper_2', 'Endocrinology - Endocrinology Part 1', 12),
    ('medicine_allied:physiology:paper_2', 'Endocrinology - Endocrinology Part 2', 13),
    ('medicine_allied:physiology:paper_2', 'Reproduction - Reproduction', 14),
    ('medicine_allied:biochemistry:paper_2', 'Metabolism Regulation Disorders - Hormonal Metabolism', 1),
    ('medicine_allied:biochemistry:paper_2', 'Metabolism Regulation Disorders - Metabolic Disorders Part 1', 2),
    ('medicine_allied:biochemistry:paper_2', 'Metabolism Regulation Disorders - Metabolic Disorders Part 2', 3),
    ('medicine_allied:pharmacology:paper_2', 'Cardiovascular Blood - CV Drugs', 1),
    ('medicine_allied:pharmacology:paper_2', 'GIT Hepatobiliary - GIT Drugs', 2),
    ('medicine_allied:pharmacology:paper_2', 'Respiratory System - Respiratory Drugs', 3),
    ('medicine_allied:pharmacology:paper_2', 'Endocrine System - Endocrine Drugs', 4),
    ('medicine_allied:pharmacology:paper_2', 'Chemotherapeutic Agents - Chemotherapy Part 1', 5),
    ('medicine_allied:pharmacology:paper_2', 'Chemotherapeutic Agents - Chemotherapy Part 2', 6),
    ('medicine_allied:pharmacology:paper_2', 'Hematologic Coagulation - Hematologic Drugs', 7),
    ('medicine_allied:pharmacology:paper_2', 'Immunopharmacology - Immunopharmacology', 8),
    ('medicine_allied:general_pathology_microbiology_immunology:paper_2', 'General Pathology - Hemodynamic Disorders', 1),
    ('medicine_allied:general_pathology_microbiology_immunology:paper_2', 'General Pathology - Immunopathology Genetics', 2),
    ('medicine_allied:general_pathology_microbiology_immunology:paper_2', 'General Pathology - Neoplasia', 3),
    ('medicine_allied:general_pathology_microbiology_immunology:paper_2', 'Microbiology Gram Positive - Gram Positive Bacilli', 4),
    ('medicine_allied:general_pathology_microbiology_immunology:paper_2', 'Microbiology Gram Positive - Gram Positive Cocci', 5),
    ('medicine_allied:general_pathology_microbiology_immunology:paper_2', 'Microbiology Gram Negative - Gram Negative Enteric', 6),
    ('medicine_allied:general_pathology_microbiology_immunology:paper_2', 'Microbiology Gram Negative - Other Gram Negative', 7),
    ('medicine_allied:general_pathology_microbiology_immunology:paper_2', 'Microbiology Mycobacteria Atypical - Mycobacteria', 8),
    ('medicine_allied:general_pathology_microbiology_immunology:paper_2', 'Microbiology Anaerobic Spirochetes - Anaerobic Spirochetes', 9),
    ('medicine_allied:general_pathology_microbiology_immunology:paper_2', 'Virology - Virology Part 1', 10),
    ('medicine_allied:general_pathology_microbiology_immunology:paper_2', 'Virology - Virology Part 2', 11),
    ('medicine_allied:general_pathology_microbiology_immunology:paper_2', 'Parasitology - Parasitology', 12),
    ('surgery_allied:anatomy:paper_1', 'General Embryology', 1),
    ('surgery_allied:anatomy:paper_1', 'Normal and Defective Development', 2),
    ('surgery_allied:anatomy:paper_1', 'General Histology', 3),
    ('surgery_allied:anatomy:paper_1', 'Special Histology', 4),
    ('surgery_allied:physiology:paper_1', 'Cell Nerve and Muscle', 1),
    ('surgery_allied:physiology:paper_1', 'Blood and Immunity', 2),
    ('surgery_allied:physiology:paper_1', 'Exercise and Unusual Environment', 3),
    ('surgery_allied:biochemistry:paper_1', 'Biomolecules', 1),
    ('surgery_allied:biochemistry:paper_1', 'Biomedical Diagnostic Techniques', 2),
    ('surgery_allied:pharmacology:paper_1', 'General Pharmacology', 1),
    ('surgery_allied:pharmacology:paper_1', 'Autonomic and CNS', 2),
    ('surgery_allied:pathology:paper_1', 'General Pathology', 1),
    ('surgery_allied:pathology:paper_1', 'Microbiology', 2),
    ('surgery_allied:research_and_biostatistics:paper_1', 'Epidemiology', 1),
    ('surgery_allied:research_and_biostatistics:paper_1', 'Biostatistics', 2),
    ('surgery_allied:behavioral_science_and_medical_ethics:paper_1', 'Behavioral Science and Medical Ethics', 1),
    ('surgery_allied:anatomy:paper_2', 'Upper Limb', 1),
    ('surgery_allied:anatomy:paper_2', 'Lower Limb', 2),
    ('surgery_allied:anatomy:paper_2', 'Thorax', 3),
    ('surgery_allied:anatomy:paper_2', 'Abdomen', 4),
    ('surgery_allied:anatomy:paper_2', 'Pelvis and Perineum', 5),
    ('surgery_allied:anatomy:paper_2', 'Head and Neck', 6),
    ('surgery_allied:anatomy:paper_2', 'Cranium', 7),
    ('surgery_allied:anatomy:paper_2', 'Brain', 8),
    ('surgery_allied:anatomy:paper_2', 'Vertebral Column', 9),
    ('surgery_allied:anatomy:paper_2', 'Neuroanatomy', 10),
    ('surgery_allied:physiology:paper_2', 'Cardiovascular System', 1),
    ('surgery_allied:physiology:paper_2', 'Circulation', 2),
    ('surgery_allied:physiology:paper_2', 'Respiratory System', 3),
    ('surgery_allied:physiology:paper_2', 'GIT and Liver', 4),
    ('surgery_allied:physiology:paper_2', 'Renal and Body Fluids', 5),
    ('surgery_allied:physiology:paper_2', 'CNS', 6),
    ('surgery_allied:physiology:paper_2', 'Special Senses', 7),
    ('surgery_allied:physiology:paper_2', 'Endocrinology', 8),
    ('surgery_allied:physiology:paper_2', 'Reproduction', 9),
    ('surgery_allied:biochemistry:paper_2', 'Metabolism Control', 1),
    ('surgery_allied:biochemistry:paper_2', 'Disorders', 2),
    ('surgery_allied:pharmacology:paper_2', 'CVS and Blood', 1),
    ('surgery_allied:pharmacology:paper_2', 'GIT and Hepato Biliary', 2),
    ('surgery_allied:pharmacology:paper_2', 'Respiratory System', 3),
    ('surgery_allied:pharmacology:paper_2', 'Endocrine System', 4),
    ('surgery_allied:pharmacology:paper_2', 'Chemotherapeutic Agents', 5),
    ('surgery_allied:pharmacology:paper_2', 'Additional Topics', 6),
    ('surgery_allied:pathology:paper_2', 'Immunology and Genetics', 1),
    ('surgery_allied:pathology:paper_2', 'Clinical Pathology', 2),
    ('surgery_allied:pathology:paper_2', 'Hematology', 3),
    ('surgery_allied:pathology:paper_2', 'Oncology', 4),
    ('surgery_allied:pathology:paper_2', 'Surgical Pathology', 5),
    ('surgery_allied:pathology:paper_2', 'Infection Control', 6),
    ('surgery_allied:pathology:paper_2', 'Nutritional Diseases', 7);

  -- Expose both Medicine & Allied and Surgery & Allied.

  if (select count(*) from fcps_subject_seed) <> 25 then
    raise exception 'FCPS subject seed must contain exactly 25 subjects';
  end if;

  if (select count(*) from fcps_chapter_seed) <> 167 then
    raise exception 'FCPS chapter seed must contain exactly 167 chapters';
  end if;

  for v_subject in select * from fcps_subject_seed order by specialty, display_order loop
    select s.id
    into v_subject_id
    from public.subjects s
    where lower(s.name) = lower(v_subject.subject_name)
      and s.year = v_subject.specialty
      and s.institutes = to_jsonb(array['fcps_part_1']::text[])
    limit 1;

    if v_subject_id is null then
      insert into public.subjects (id, name, description, icon, color, year, institutes)
      values (
        gen_random_uuid(),
        v_subject.subject_name,
        'FCPS Part-1 ' || initcap(replace(v_subject.specialty, '_', ' ')) || ' Paper ' || v_subject.paper,
        'stethoscope',
        case when v_subject.paper = 1 then '#0ea5e9' else '#10b981' end,
        v_subject.specialty,
        to_jsonb(array['fcps_part_1']::text[])
      )
      returning id into v_subject_id;
    else
      update public.subjects
      set
        description = 'FCPS Part-1 ' || initcap(replace(v_subject.specialty, '_', ' ')) || ' Paper ' || v_subject.paper,
        icon = coalesce(icon, 'stethoscope'),
        color = coalesce(color, case when v_subject.paper = 1 then '#0ea5e9' else '#10b981' end)
      where id = v_subject_id;
    end if;

    for v_chapter in select * from fcps_chapter_seed where subject_key = v_subject.subject_key order by chapter_number loop
      select c.id
      into v_chapter_id
      from public.chapters c
      where c.subject_id = v_subject_id
        and (lower(c.name) = lower(v_chapter.chapter_name)
          or lower(to_jsonb(c)->>'original_name') = lower(v_chapter.chapter_name))
      limit 1;

      if v_chapter_id is null then
        insert into public.chapters (id, name, description, chapter_number, subject_id, content_type)
        values (gen_random_uuid(), v_chapter.chapter_name, 'FCPS Part-1 chapter directory. MCQs can be uploaded into this chapter.', v_chapter.chapter_number, v_subject_id, 'mcq');
      else
        update public.chapters
        set chapter_number = v_chapter.chapter_number, content_type = coalesce(content_type, 'mcq')
        where id = v_chapter_id;
      end if;
    end loop;
  end loop;
end $$;

-- Post-run verification: expected result is 25 subjects and 167 chapters.
select
  count(distinct s.id) as subject_count,
  count(c.id) as chapter_count
from public.subjects s
left join public.chapters c on c.subject_id = s.id
where s.year in ('medicine_allied', 'surgery_allied')
  and s.institutes = to_jsonb(array['fcps_part_1']::text[]);
