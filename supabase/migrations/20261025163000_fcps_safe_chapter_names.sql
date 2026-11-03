-- Safe FCPS chapter titles, reviewed from the live project on 2026-10-25.
-- UUIDs and original names are recorded in fcps_sql/fcps_safe_chapter_renames_20261025.csv.
-- Keep original_name because repeatable FCPS imports still refer to source chapter names.
do $$
declare
  v_updated integer;
begin
  alter table public.chapters add column if not exists original_name text;

  create temporary table fcps_safe_chapter_name_map (
    id uuid primary key,
    original_name text not null,
    changed_name text not null
  ) on commit drop;

  insert into fcps_safe_chapter_name_map (id, original_name, changed_name) values
    ('8816548e-800f-47c3-89bc-683b357522f9'::uuid, 'Community and Preventive Dentistry - Indices', 'Indices'),
    ('2f15565a-e61f-40b4-afb2-b2b796114bbe'::uuid, 'Community and Preventive Dentistry - Oral Epidemiology', 'Oral Epidemiology'),
    ('3abc8421-9a76-41f2-aa9a-703426bd117c'::uuid, 'Community and Preventive Dentistry - Oral Health Education and Promotion', 'Oral Health Education and Promotion'),
    ('c21f19c4-a376-4d16-beec-80af2f0795d7'::uuid, 'Community and Preventive Dentistry - Philosophy of Public Health', 'Philosophy of Public Health'),
    ('ebf1072d-2d91-4f83-a7ad-11e55fa4fdbe'::uuid, 'Community and Preventive Dentistry - Preventive Dental Care Techniques', 'Preventive Dental Care Techniques'),
    ('13df9fd1-f863-46cb-a9ae-a3cd89b97ab2'::uuid, 'Dental Pharmacology - Anti Sialagogues', 'Anti Sialagogues'),
    ('d5020d34-5c3e-445f-946c-c83533eea5cb'::uuid, 'Dental Pharmacology - Anti Microbials', 'Anti Microbials'),
    ('39cb8006-2ac2-4e92-9039-b743e5b69a6a'::uuid, 'Dental Pharmacology - Drugs Used In Rct', 'Drugs Used In Rct'),
    ('3468f474-1618-4fea-974c-ccf075a50ed8'::uuid, 'Dental Pharmacology - Germicides Antiseptics Disinfectants', 'Germicides Antiseptics Disinfectants'),
    ('4df26e2c-f8ce-4272-b0e6-92eff7b98cd6'::uuid, 'Dental Pharmacology - Local Acting Drugs', 'Local Acting Drugs'),
    ('17ff5fe8-cfcd-4193-a57f-696f3de83f70'::uuid, 'Dental Pharmacology - Surface Acting Agents', 'Surface Acting Agents'),
    ('d8d38907-78f9-46ef-9279-82413bb96172'::uuid, 'Operative Dentistry - Amalgam Restorations', 'Amalgam Restorations'),
    ('8b4dda65-5eb4-4193-9b94-ca6a3cb1e5dd'::uuid, 'Operative Dentistry - Cavity Preparation', 'Cavity Preparation'),
    ('e753fa29-cff4-4d0f-a20b-b2a2c22c0d41'::uuid, 'Operative Dentistry - Composite Restorations', 'Composite Restorations'),
    ('662d5344-acd8-4092-96c6-8bd9f34abed8'::uuid, 'Operative Dentistry - Endodontics', 'Endodontics'),
    ('f78c452c-cad5-4574-bf38-8b6d498c3b76'::uuid, 'Operative Dentistry - Post Core and Foundations', 'Post Core and Foundations'),
    ('97c8a31f-8e41-4583-b555-0782b4940c3b'::uuid, 'Oral and Maxillofacial Surgery - Cysts Tumors and Reconstructive Surgery', 'Cysts Tumors and Reconstructive Surgery'),
    ('81aa1ea0-ba9a-49df-a35d-15ca6e261324'::uuid, 'Oral and Maxillofacial Surgery - Dentoalveolar and Midface Trauma', 'Dentoalveolar and Midface Trauma'),
    ('1ed6a0a0-e555-4011-81e9-dcb0e0514fd5'::uuid, 'Oral and Maxillofacial Surgery - Exodontia and Dentoalveolar Surgery', 'Exodontia and Dentoalveolar Surgery'),
    ('64fc7edd-91b9-4e86-bdce-0ab8e4cafedc'::uuid, 'Oral and Maxillofacial Surgery - Impacted Teeth and Surgical Extraction', 'Impacted Teeth and Surgical Extraction'),
    ('134e369f-95f8-4fc0-9f65-40e8003941c5'::uuid, 'Oral and Maxillofacial Surgery - Orofacial Infections and Osteomyelitis', 'Orofacial Infections and Osteomyelitis'),
    ('10cfab98-5054-4795-aba1-cb608b079d09'::uuid, 'Oral and Maxillofacial Surgery - Tmj Surgery and Temporomandibular Disorders', 'Tmj Surgery and Temporomandibular Disorders'),
    ('d44db837-89d3-48af-a34b-e33b750504d8'::uuid, 'Oral Biology - Enamel', 'Enamel'),
    ('f769cfc6-91bf-4c8b-b73a-77d8d58ec960'::uuid, 'Oral Biology - Cementum', 'Cementum'),
    ('b85b7ab5-dbeb-47cd-9627-e061b1aef7ab'::uuid, 'Oral Biology - Cranial Nerves', 'Cranial Nerves'),
    ('194d45dc-b057-4a71-bdaf-8c36786ebbe1'::uuid, 'Oral Biology - Dentine', 'Dentine'),
    ('8652571e-0e3e-4fc0-9076-7b6f17a0c9bc'::uuid, 'Oral Biology - Lymphoid Tissues', 'Lymphoid Tissues'),
    ('74d8749a-0a2e-4723-a5f6-b2167495ed8c'::uuid, 'Oral Biology - Occlusion', 'Occlusion'),
    ('952d2029-0eb5-405f-a564-1b8f4ba484e9'::uuid, 'Oral Biology - Oral Cavity', 'Oral Cavity'),
    ('1c58d58d-f39c-49e2-9791-e452e54c3e6f'::uuid, 'Oral Biology - Oral Mucosa', 'Oral Mucosa'),
    ('f38bf12c-3f01-4ced-8242-558fe05cc5e6'::uuid, 'Oral Biology - Oro Facial Embryology', 'Oro Facial Embryology'),
    ('323ddc1c-9b57-4d36-bdf8-98d1d6e9152e'::uuid, 'Oral Biology - Osteology', 'Osteology'),
    ('f5d3634e-8c54-42d7-88a2-9605fd64d6be'::uuid, 'Oral Biology - Periodontium', 'Periodontium'),
    ('c0e06212-f811-4ad3-a1f2-1d53a0c4d7e7'::uuid, 'Oral Biology - Pulp', 'Pulp'),
    ('2120529f-2546-42cb-8f6f-73817b8c8848'::uuid, 'Oral Biology - Salivary Glands', 'Salivary Glands'),
    ('a59c9505-68e8-466e-88a8-2c7405d00e45'::uuid, 'Oral Biology - Temporomandibular Joint', 'Temporomandibular Joint'),
    ('0e38991a-6c10-46da-87c6-7f8822712bdc'::uuid, 'Oral Biology - Tooth Development Structure Functions', 'Tooth Development Structure Functions'),
    ('6ca3e3c0-cdc0-4ebb-aae5-c1d18c1d54e9'::uuid, 'Oral Biology - Tooth Eruption', 'Tooth Eruption'),
    ('4b3791f3-8079-47da-888e-0de13a8b67b5'::uuid, 'Oral Biology - Tooth Morphology', 'Tooth Morphology'),
    ('d7500479-9fbe-48dc-9495-5a9c14d6721d'::uuid, 'Oral Medicine and Radiology - Oral Malignancy and Systemic Diseases', 'Oral Malignancy and Systemic Diseases'),
    ('a7e27175-9a68-46c8-836f-24bf2d2c74fd'::uuid, 'Oral Medicine and Radiology - Oral Mucosal Diseases and Diagnosis', 'Oral Mucosal Diseases and Diagnosis'),
    ('ffcdbb97-a0e6-417c-8c19-dc8695a2bedd'::uuid, 'Oral Medicine and Radiology - Orofacial Pain and Temporomandibular Disorders', 'Orofacial Pain and Temporomandibular Disorders'),
    ('96fd3e3f-1eff-4956-9a1d-f29cc5a5aed4'::uuid, 'Oral Medicine and Radiology - Radiographic Interpretation and Diagnosis', 'Radiographic Interpretation and Diagnosis'),
    ('269848dd-d09d-41d1-a9fe-a8fbfeebc635'::uuid, 'Oral Medicine and Radiology - Radiographic Techniques and Physics', 'Radiographic Techniques and Physics'),
    ('0beaa579-4ec7-499c-a6d7-fcea2906a1f4'::uuid, 'Oral Medicine and Radiology - Surgical Oral Pathology and Systemic Interactions', 'Surgical Oral Pathology and Systemic Interactions'),
    ('c96cd35f-5682-4e1c-8d54-27b09c8c7ce5'::uuid, 'Oral Pathology - Bacterial Viral Fungal Infections', 'Bacterial Viral Fungal Infections'),
    ('38214b03-8a58-4e17-a456-9e649741abc9'::uuid, 'Oral Pathology - Benign Mucosal Swelling White Lesions', 'Benign Mucosal Swelling White Lesions'),
    ('93f25356-d232-46d7-adbb-f9e44439966c'::uuid, 'Oral Pathology - Cysts of The Jaws', 'Cysts of The Jaws'),
    ('7278c4bb-a67a-48d4-8e28-ffaff294ec4a'::uuid, 'Oral Pathology - Dental Caries', 'Dental Caries'),
    ('6866f2e9-92ee-48ef-9ba6-383d8ffde355'::uuid, 'Oral Pathology - Diseases of Pulp and Periodontal Tissue', 'Diseases of Pulp and Periodontal Tissue'),
    ('3ad454d5-efb8-48f7-a2fe-58036b87b112'::uuid, 'Oral Pathology - Disorders of Development of Teeth', 'Disorders of Development of Teeth'),
    ('46ad1f7a-ec1f-4801-9a2f-fad4d27eb1b2'::uuid, 'Oral Pathology - Disorders of Tmj', 'Disorders of Tmj'),
    ('34ce0014-d35d-4040-81c5-8b83a5046e1a'::uuid, 'Oral Pathology - Mucocutaneous and Autoimmune Disorders', 'Mucocutaneous and Autoimmune Disorders'),
    ('4b4cab3e-46da-4210-add7-ef3ff9bc70aa'::uuid, 'Oral Pathology - Non Neoplastic Bone Diseases', 'Non Neoplastic Bone Diseases'),
    ('26f910ef-482b-4764-82dc-ef865c37a02d'::uuid, 'Oral Pathology - Odontogenic and Non-odontogenic Tumors', 'Odontogenic and Non-odontogenic Tumors'),
    ('98bfe70a-f19c-4325-bc73-f5427ae24b56'::uuid, 'Oral Pathology - Oral Cancer', 'Oral Cancer'),
    ('83ec5333-28c8-429b-b1a1-75c5b2988653'::uuid, 'Oral Pathology - Oral Mucosa Diseases', 'Oral Mucosa Diseases'),
    ('c7150e59-5665-4a6a-8e58-22cf8b8aa254'::uuid, 'Oral Pathology - Oral Pigmentations', 'Oral Pigmentations'),
    ('21d4ddf7-36f5-4e7e-9355-3aeeff9b2edf'::uuid, 'Oral Pathology - Oral Premalignant Conditions', 'Oral Premalignant Conditions'),
    ('c56b4939-3b6e-4e24-a89f-b8c2f1de0c2b'::uuid, 'Oral Pathology - Salivary Gland Diseases', 'Salivary Gland Diseases'),
    ('ef59255c-1aa7-47e4-848f-dc4988ef53e6'::uuid, 'Oral Pathology - Tongue Disorders', 'Tongue Disorders'),
    ('9d9d1281-cb53-43e7-a89c-ebb324c375bb'::uuid, 'Oral Pathology - Wound Healing', 'Wound Healing'),
    ('17e637d9-899c-4446-a21a-f435e80cbd04'::uuid, 'Orthodontics - Growth and Development', 'Growth and Development'),
    ('ec75aee3-9ca8-4efa-8702-c1d4459ab714'::uuid, 'Orthodontics - Malocclusion and Classification', 'Malocclusion and Classification'),
    ('aade857f-19c5-4eb8-a809-3f50b8bde788'::uuid, 'Orthodontics - Orthodontic Anchorage and Adjuncts', 'Orthodontic Anchorage and Adjuncts'),
    ('89f87bfc-9f75-49b4-8301-801c6d57cf06'::uuid, 'Orthodontics - Orthodontic Diagnosis and Cephalometrics', 'Orthodontic Diagnosis and Cephalometrics'),
    ('b3c35464-bac6-43c6-aeaa-4743de85574b'::uuid, 'Orthodontics - Orthodontic Mechanics and Appliances', 'Orthodontic Mechanics and Appliances'),
    ('5aa871c2-9e09-4c43-a240-958788e1d854'::uuid, 'Orthodontics - Orthodontic Treatment and Dentofacial Orthopedics', 'Orthodontic Treatment and Dentofacial Orthopedics'),
    ('378d53ad-508a-4f62-9a52-128764b3f3c7'::uuid, 'Pediatric Dentistry - Growth Development and Behavior Management', 'Growth Development and Behavior Management'),
    ('4a533ed1-751a-4226-bff9-0665ea5f3e1a'::uuid, 'Pediatric Dentistry - Pediatric Medicine Special Needs and Hospital Dentistry', 'Pediatric Medicine Special Needs and Hospital Dentistry'),
    ('23b430ce-7f96-4919-bcfc-917062e10acf'::uuid, 'Pediatric Dentistry - Preventive Dentistry For Children', 'Preventive Dentistry For Children'),
    ('d7dae0ed-9278-458a-93f6-8c459edd173a'::uuid, 'Pediatric Dentistry - Restorative and Endodontic Treatment For Children', 'Restorative and Endodontic Treatment For Children'),
    ('0b65fed7-b82d-43c0-927e-9104d395ba47'::uuid, 'Pediatric Dentistry - Space Management and Orthodontics For Children', 'Space Management and Orthodontics For Children'),
    ('22d8ba20-9f47-449b-a919-a3243dc9ae15'::uuid, 'Pediatric Dentistry - Traumatic Dental Injuries', 'Traumatic Dental Injuries'),
    ('c33c2bf3-d410-4588-b717-56acf4f2ec86'::uuid, 'Periodontology - Clinical Assessment and Diagnosis', 'Clinical Assessment and Diagnosis'),
    ('b428b72a-c204-4f06-a283-c628105d40c0'::uuid, 'Periodontology - Gingival Diseases', 'Gingival Diseases'),
    ('fa5e46ba-bada-45df-8864-28d703b4a102'::uuid, 'Periodontology - Non Surgical Periodontal Therapy', 'Non Surgical Periodontal Therapy'),
    ('fcc2b3d3-8101-4b04-99d1-733eaaff6ca8'::uuid, 'Periodontology - Peri Implant Diseases and Interrelationships', 'Peri Implant Diseases and Interrelationships'),
    ('fb07d994-f607-4637-89b9-3872a3859a07'::uuid, 'Periodontology - Periodontal Disease Classification and Pathogenesis', 'Periodontal Disease Classification and Pathogenesis'),
    ('1c78dd4b-6e9f-4e74-8e12-7e50d49fca09'::uuid, 'Periodontology - Periodontal Surgery', 'Periodontal Surgery'),
    ('e13a3c98-482f-4b2c-bf1b-400ee40c50d0'::uuid, 'Prosthodontics - Complete Dentures', 'Complete Dentures'),
    ('06af0cf3-fc93-4c08-bea8-a49760dbf696'::uuid, 'Prosthodontics - Fixed Partial Dentures', 'Fixed Partial Dentures'),
    ('883d6749-038f-46db-afb3-03a88e70279d'::uuid, 'Prosthodontics - Implant Prosthodontics', 'Implant Prosthodontics'),
    ('798225e8-efc8-4b13-a0f6-49cb03ed2955'::uuid, 'Prosthodontics - Maxillofacial Prosthetics', 'Maxillofacial Prosthetics'),
    ('528c4756-d994-49e3-8f67-9d1ebb56764e'::uuid, 'Prosthodontics - Occlusion In Prosthodontics', 'Occlusion In Prosthodontics'),
    ('b95d7a9a-f5f5-41cf-bd9f-933afd2d901b'::uuid, 'Prosthodontics - Removable Partial Dentures', 'Removable Partial Dentures'),
    ('8dd21755-6730-4a57-8f9d-2a8503fa4a6a'::uuid, 'Science of Dental Materials - Dental Cements', 'Dental Cements'),
    ('8ce95387-02f3-488e-bd61-65d256605fd0'::uuid, 'Science of Dental Materials - Dental Ceramic', 'Dental Ceramic'),
    ('d1dd6c56-f522-44bd-963b-b6740c092705'::uuid, 'Science of Dental Materials - Dental Polymers', 'Dental Polymers'),
    ('932f3d70-a923-4a56-a1ba-64c5051c1d77'::uuid, 'Science of Dental Materials - Direct Restorative Materials', 'Direct Restorative Materials'),
    ('4e71d63b-1215-4a3e-95e2-f0c986a5dfca'::uuid, 'Science of Dental Materials - General Properties', 'General Properties'),
    ('150cec27-8425-4848-96a1-dc4a927c51ef'::uuid, 'Science of Dental Materials - Impression Materials', 'Impression Materials'),
    ('d5b3b5cc-5ada-4596-beca-ce64b4cd4441'::uuid, 'Science of Dental Materials - Investment Materials', 'Investment Materials'),
    ('d19d3160-63f2-4402-bf1c-7168b0b02392'::uuid, 'Science of Dental Materials - Metals and Alloys', 'Metals and Alloys'),
    ('bcbe6ba9-ecab-4efb-b1ff-1b8258d32ebb'::uuid, 'Science of Dental Materials - Miscellaneous Materials', 'Miscellaneous Materials'),
    ('9afc3562-f2d8-4c38-8664-cc55ff42e158'::uuid, 'Science of Dental Materials - Model Cast Die Materials', 'Model Cast Die Materials'),
    ('c0c2365b-afb2-4ede-85ed-be5a8fc59661'::uuid, 'Science of Dental Materials - Waxes', 'Waxes'),
    ('4aabc1be-9007-4191-b17f-c45ce39fd068'::uuid, 'Science of Dental Materials - Part 2', 'Part 2'),
    ('67a67f28-d11b-45e9-a753-844fa2d7eee9'::uuid, 'Science of Dental Materials - Part 3', 'Part 3'),
    ('525ca5e7-b614-4333-b0dc-9deec9e72eae'::uuid, 'Science of Dental Materials - Part 4', 'Part 4'),
    ('bb12f090-9f67-439e-84fb-60166fb9b912'::uuid, 'Science of Dental Materials - Part 1', 'Part 1'),
    ('7adfce3f-e5c3-4b4f-ad1f-f13801c3a587'::uuid, 'Anatomy - Brain Spinal Cord Spinal Cranial Nerves', 'Brain Spinal Cord Spinal Cranial Nerves'),
    ('4b1acf23-dc30-4766-82ab-8888c13f4383'::uuid, 'Anatomy - Endocrine Glands Pituitary Thyroid Parathyroid Adrenal', 'Endocrine Glands Pituitary Thyroid Parathyroid Adrenal'),
    ('34df9ae4-0339-4263-83ff-30ce2e4c76c0'::uuid, 'Anatomy - General Embryology', 'General Embryology'),
    ('5a9d4b3d-717e-4363-b819-08c4eb5c9221'::uuid, 'Anatomy - General Features Muscles Joints Blood Vessels', 'General Features Muscles Joints Blood Vessels'),
    ('c2b146ab-3ba8-473e-b53c-65f68222f723'::uuid, 'Anatomy - Head Neck Major Blood Vessels', 'Head Neck Major Blood Vessels'),
    ('574d76c3-c07b-4dea-8073-82f481f8fac2'::uuid, 'Anatomy - Histology General Features', 'Histology General Features'),
    ('45e2dea9-8516-4ab4-893b-8fc8f93b9944'::uuid, 'Anatomy - Viscera Heart Lung Kidney Liver', 'Viscera Heart Lung Kidney Liver'),
    ('408ff33c-0df8-4021-9d6c-4cbf428ed3ca'::uuid, 'Behavioural Science Ethics - Behavioural Science Ethics', 'Behavioural Science Ethics'),
    ('5c3ebe53-4ea0-45ac-a3d7-fedbb76baeb5'::uuid, 'Biochemistry Specialty Focus - Biochemistry In Pregnancy', 'Biochemistry In Pregnancy'),
    ('3b050a64-4d5e-47ee-9394-66df86b893d2'::uuid, 'Embryology Histology - Embryology Histology O&g', 'Embryology Histology O&g'),
    ('06793cc7-529e-436f-a894-6b3db2229e80'::uuid, 'Gross Anatomy - Gross Anatomy Pelvis', 'Gross Anatomy Pelvis'),
    ('df778ed3-7bb5-4e42-9b68-0e278d897ec1'::uuid, 'Gynaecology - Gynaecology Basics', 'Gynaecology Basics'),
    ('736e60d6-15b5-4bae-8c11-5f431ae25002'::uuid, 'Obstetrics - Obstetrics Basics', 'Obstetrics Basics'),
    ('49b405a5-030b-4e03-a42a-fbe5cece4a3f'::uuid, 'Pathology Microbiology - Pathology Microbiology', 'Pathology Microbiology'),
    ('89bb8bcf-3299-4276-847c-9fea551f87e4'::uuid, 'Pathology Specialty Focus - Gynaecological Pathology', 'Gynaecological Pathology'),
    ('36c9e085-eb1a-447e-ab0a-0c1d1be2039c'::uuid, 'Pharmacology Specialty Focus - Pharmacology In Pregnancy Lactation', 'Pharmacology In Pregnancy Lactation'),
    ('6e9292fe-ee4c-4af7-a761-fd0a43367fa0'::uuid, 'Physiology Biochemistry Pharmacology - Biochemistry General', 'Biochemistry General'),
    ('d400ffc4-b430-4cd3-bd32-f0ba26c0acda'::uuid, 'Physiology Biochemistry Pharmacology - Pharmacology General', 'Pharmacology General'),
    ('90046ce8-bb42-4d56-bc60-06dc5b9fe518'::uuid, 'Physiology Biochemistry Pharmacology - Physiology General', 'Physiology General'),
    ('371bcb0b-d6cb-4d78-af60-9572d5792a1c'::uuid, 'Physiology Specialty Focus - Physiology of Pregnancy Lactation', 'Physiology of Pregnancy Lactation'),
    ('48fdd0de-6107-499c-beda-6ea42646c2ae'::uuid, 'Physiology Systems - Fetal Neonatal Physiology', 'Fetal Neonatal Physiology'),
    ('25e84648-cf35-4057-a67e-e1db79f16861'::uuid, 'Research Biostatistics - Research Biostatistics', 'Research Biostatistics'),
    ('474b01f7-55f5-48f4-b0ba-184970cad668'::uuid, 'Statistics Epidemiology Biophysics - Obstetric Epidemiology Statistics', 'Obstetric Epidemiology Statistics'),
    ('b3ed0f44-d0a3-4a59-9940-0979468956f8'::uuid, 'Medical Ethics - Medical Ethics', 'Medical Ethics'),
    ('c6ddc0cc-4fbd-4cae-9286-54e28bd5d3d0'::uuid, 'Communication Skills - Communication Skills', 'Communication Skills'),
    ('1960f020-542d-456c-8e13-072581df0450'::uuid, 'Psychosocial Aspects - Psychosocial Aspects', 'Psychosocial Aspects'),
    ('cb08c409-08c1-46db-bb2c-18dfd1fd6b79'::uuid, 'Parasitology - Parasitology', 'Parasitology'),
    ('a1e29614-4a1e-4afc-99ad-a9f11ef320b3'::uuid, 'General Pharmacology - General Pharmacology', 'General Pharmacology'),
    ('df577d32-9118-4a0a-8101-8e076ca24a5f'::uuid, 'Analgesics - Analgesics', 'Analgesics'),
    ('b1f815b4-a1c5-48ba-aede-eb3a712b6b0e'::uuid, 'Miscellaneous - Miscellaneous', 'Miscellaneous'),
    ('67871e6b-f798-40de-9f3b-197536ad3359'::uuid, 'Immunopharmacology - Immunopharmacology', 'Immunopharmacology'),
    ('2187d2d7-a9a1-42ad-8bc6-68cf2f7e5c8c'::uuid, 'Cell Nerve Muscle - Cell Nerve Muscle', 'Cell Nerve Muscle'),
    ('13176e9d-0c9f-4dc6-a975-95408b5d4e2a'::uuid, 'Blood Immunity - Blood Immunity', 'Blood Immunity'),
    ('c349d964-7ada-45b8-b6e6-9c7f644a905f'::uuid, 'Special Senses - Special Senses', 'Special Senses'),
    ('4d31193a-3482-457f-9812-74074f66c699'::uuid, 'Reproduction - Reproduction', 'Reproduction'),
    ('d2a45093-359b-4304-a3ae-84085bc47112'::uuid, 'Epidemiology - Epidemiology', 'Epidemiology'),
    ('d43ca999-ed8c-47ec-bc1e-3d105e160a3d'::uuid, 'Biostatistics - Biostatistics', 'Biostatistics');

  if (select count(*) from fcps_safe_chapter_name_map) <> 138 then
    raise exception 'Expected 138 FCPS chapter name changes';
  end if;

  if exists (
    select 1 from fcps_safe_chapter_name_map m
    left join public.chapters c on c.id = m.id
    left join public.subjects s on s.id = c.subject_id
    where c.id is null or c.name is distinct from m.original_name
      or not (s.institutes @> '["fcps_part_1"]'::jsonb or s.institutes @> '["fcps_part_2"]'::jsonb)
  ) then
    raise exception 'FCPS chapter names or scope changed since the audit; no names updated';
  end if;

  if exists (
    select 1
    from fcps_safe_chapter_name_map m
    join public.chapters c on c.id = m.id
    join public.chapters other on other.subject_id = c.subject_id and other.id <> c.id
    left join fcps_safe_chapter_name_map other_map on other_map.id = other.id
    where lower(m.changed_name) = lower(coalesce(other_map.changed_name, other.name))
  ) then
    raise exception 'A proposed FCPS chapter name collides within its subject; no names updated';
  end if;

  update public.chapters c
  set original_name = coalesce(c.original_name, m.original_name),
      name = m.changed_name
  from fcps_safe_chapter_name_map m
  where c.id = m.id;

  get diagnostics v_updated = row_count;
  if v_updated <> 138 then
    raise exception 'Expected 138 updates, got %', v_updated;
  end if;
end;
$$;
