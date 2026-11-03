import fs from 'node:fs';
import path from 'node:path';
import Papa from 'papaparse';
import { v5 as uuidv5 } from 'uuid';

const [libraryRoot, seedSqlPath, outputSqlPath] = process.argv.slice(2);
if (!libraryRoot || !seedSqlPath || !outputSqlPath) {
  throw new Error('Usage: node build-fcps-mcq-import.mjs <library> <seed-sql> <output-sql>');
}

const namespace = '1f76e7a0-9637-4b3d-8ed1-f26887b09b2d';
const importCategory = 'fcps1_medicine_allied_2026';
const seedSql = fs.readFileSync(seedSqlPath, 'utf8');

const subjectByKey = new Map();
for (const match of seedSql.matchAll(/\('([^']+)', '([^']+)', '([^']+)', ([12]), \d+\)/g)) {
  const [, key, name, specialty] = match;
  if (key.startsWith('medicine_allied:') && specialty === 'medicine_allied') {
    subjectByKey.set(key, name);
  }
}

const chapterByKeyAndNormalizedName = new Map();
for (const match of seedSql.matchAll(/\('([^']+)', '([^']+)', (\d+)\)/g)) {
  const [, key, name] = match;
  if (key.startsWith('medicine_allied:')) {
    chapterByKeyAndNormalizedName.set(`${key}|${normalize(name)}`, name);
  }
}

function normalize(value) {
  return String(value)
    .replace(/\bPt\s*(\d+)\b/gi, 'Part $1')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/gi, '')
    .toLowerCase();
}

function title(value) {
  return value
    .replace(/^\d+_/, '')
    .replace(/\.csv$/i, '')
    .replace(/_Pt(\d+)\b/gi, '_Part_$1')
    .replaceAll('_', ' ')
    .trim();
}

function subjectKeyFor(relativePath) {
  const [top, parent, file] = relativePath.split('/');
  const stem = file.replace(/\.csv$/i, '');
  const parentNumber = Number(parent.match(/^(\d+)_/)?.[1]);

  if (top.startsWith('01_')) {
    const paper = parentNumber <= 4 ? 1 : 2;
    return `medicine_allied:anatomy_histology_embryology:paper_${paper}`;
  }
  if (top.startsWith('02_')) {
    const paper = [1, 2, 11].includes(parentNumber) ? 1 : 2;
    return `medicine_allied:physiology:paper_${paper}`;
  }
  if (top.startsWith('03_')) {
    const paper = parentNumber === 2 && !stem.startsWith('Enzymes_') ? 2 : 1;
    return `medicine_allied:biochemistry:paper_${paper}`;
  }
  if (top.startsWith('04_')) {
    const paper = [1, 2, 3, 4, 12].includes(parentNumber) ? 1 : 2;
    return `medicine_allied:pharmacology:paper_${paper}`;
  }
  if (top.startsWith('05_')) {
    const paper = parentNumber === 1 && ['Cell_Injury_Inflammation', 'General_Pathology_Pt1'].includes(stem) ? 1 : 2;
    return `medicine_allied:general_pathology_microbiology_immunology:paper_${paper}`;
  }
  if (top.startsWith('06_')) return 'medicine_allied:research_biostatistics:paper_1';
  if (top.startsWith('07_')) return 'medicine_allied:behavioural_science_medical_ethics:paper_1';
  throw new Error(`Unsupported FCPS directory: ${relativePath}`);
}

function sqlText(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

const csvFiles = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolute);
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.csv')) {
      const relative = path.relative(libraryRoot, absolute).split(path.sep).join('/');
      if (/^\d{2}_/.test(relative)) csvFiles.push({ absolute, relative });
    }
  }
}
walk(libraryRoot);
csvFiles.sort((a, b) => a.relative.localeCompare(b.relative));

if (csvFiles.length !== 117) throw new Error(`Expected 117 chapter CSVs, found ${csvFiles.length}`);

const stagingRows = [];
const mappedChapters = new Set();
for (const { absolute, relative } of csvFiles) {
  const parts = relative.split('/');
  const expectedChapterName = `${title(parts[1])} - ${title(parts[2])}`;
  const subjectKey = subjectKeyFor(relative);
  const subjectName = subjectByKey.get(subjectKey);
  const chapterName = chapterByKeyAndNormalizedName.get(`${subjectKey}|${normalize(expectedChapterName)}`);
  if (!subjectName) throw new Error(`No seeded subject for ${relative}: ${subjectKey}`);
  if (!chapterName) throw new Error(`No seeded chapter for ${relative}: ${expectedChapterName}`);

  const parsed = Papa.parse(fs.readFileSync(absolute, 'utf8'), {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: header => header.trim(),
  });
  if (parsed.errors.length) throw new Error(`${relative}: ${parsed.errors[0].message}`);
  if (parsed.data.length === 0) throw new Error(`${relative}: expected non-empty file, found 0 rows`);

  parsed.data.forEach((row, index) => {
    const options = ['Option A', 'Option B', 'Option C', 'Option D', 'Option E'].map(key => String(row[key] ?? '').trim());
    const question = String(row.Question ?? '').trim();
    const correctAnswer = String(row['Correct Answer'] ?? '').trim();
    const explanation = String(row.Explanation ?? '').trim();
    if (!question || options.some(option => !option) || !correctAnswer || !explanation) {
      throw new Error(`${relative} row ${index + 2}: missing required content`);
    }
    if (!options.includes(correctAnswer)) {
      throw new Error(`${relative} row ${index + 2}: correct answer does not exactly match an option`);
    }

    const id = uuidv5(`${relative}\n${index + 1}\n${question}`, namespace);
    stagingRows.push({
      id,
      subjectName,
      chapterName,
      question,
      options: JSON.stringify(options),
      correctAnswer,
      explanation,
    });
  });
  mappedChapters.add(`${subjectName}|${chapterName}`);
}

if (stagingRows.length === 0) throw new Error(`Expected MCQs, found 0`);
if (mappedChapters.size !== 117) throw new Error(`Expected 117 mapped chapters, found ${mappedChapters.size}`);

const output = fs.createWriteStream(outputSqlPath, { encoding: 'utf8' });
output.write(`-- Generated FCPS-1 Medicine & Allied MCQ import.\n`);
output.write(`-- Source: ${libraryRoot}\n`);
output.write(`create temporary table fcps_mcq_stage (\n`);
output.write(`  id uuid primary key, subject_name text not null, chapter_name text not null,\n`);
output.write(`  question text not null, options jsonb not null, correct_answer text not null, explanation text not null\n`);
output.write(`) on commit drop;\n\n`);

// Keep the migration to a few dozen statements. Supabase executes migration
// statements sequentially, so small batches unnecessarily expose long imports
// to transient pooler disconnects.
const batchSize = 1000;
for (let start = 0; start < stagingRows.length; start += batchSize) {
  const batch = stagingRows.slice(start, start + batchSize);
  output.write(`insert into fcps_mcq_stage (id, subject_name, chapter_name, question, options, correct_answer, explanation) values\n`);
  output.write(batch.map(row => `(${sqlText(row.id)}::uuid, ${sqlText(row.subjectName)}, ${sqlText(row.chapterName)}, ${sqlText(row.question)}, ${sqlText(row.options)}::jsonb, ${sqlText(row.correctAnswer)}, ${sqlText(row.explanation)})`).join(',\n'));
  output.write(';\n');
}

output.write(`\ndo $$\n`);
output.write(`declare v_stage integer; v_matched integer; v_chapters integer;\n`);
output.write(`begin\n`);
output.write(`  select count(*) into v_stage from fcps_mcq_stage;\n`);
output.write(`  select count(*), count(distinct c.id) into v_matched, v_chapters\n`);
output.write(`  from fcps_mcq_stage x join public.subjects s on lower(s.name)=lower(x.subject_name)\n`);
output.write(`  join public.chapters c on c.subject_id=s.id and lower(c.name)=lower(x.chapter_name)\n`);
output.write(`  where s.year='medicine_allied' and s.institutes=to_jsonb(array['fcps_part_1']::text[]);\n`);
output.write(`  if v_stage<>${stagingRows.length} or v_matched<>${stagingRows.length} or v_chapters<>117 then\n`);
output.write(`    raise exception 'FCPS import mapping failed: stage=%, matched=%, chapters=%', v_stage, v_matched, v_chapters;\n`);
output.write(`  end if;\n`);
output.write(`end $$;\n\n`);

output.write(`insert into public.mcqs (id, question, options, correct_answer, explanation, category, chapter_id, subject, difficulty)\n`);
output.write(`select x.id, x.question, x.options, x.correct_answer, x.explanation, ${sqlText(importCategory)}, c.id, s.name, 'FCPS Part 1'\n`);
output.write(`from fcps_mcq_stage x\n`);
output.write(`join public.subjects s on lower(s.name)=lower(x.subject_name)\n`);
output.write(`join public.chapters c on c.subject_id=s.id and lower(c.name)=lower(x.chapter_name)\n`);
output.write(`where s.year='medicine_allied' and s.institutes=to_jsonb(array['fcps_part_1']::text[])\n`);
output.write(`on conflict (id) do update set\n`);
output.write(`  question=excluded.question, options=excluded.options, correct_answer=excluded.correct_answer,\n`);
output.write(`  explanation=excluded.explanation, category=excluded.category, chapter_id=excluded.chapter_id,\n`);
output.write(`  subject=excluded.subject, difficulty=excluded.difficulty;\n\n`);

output.write(`do $$\n`);
output.write(`declare v_total integer; v_null_year integer; v_wrong_scope integer; v_chapters integer;\n`);
output.write(`begin\n`);
output.write(`  select count(*), count(distinct c.id),\n`);
output.write(`    count(*) filter (where s.year is null),\n`);
output.write(`    count(*) filter (where s.year<>'medicine_allied' or s.institutes<>to_jsonb(array['fcps_part_1']::text[]))\n`);
output.write(`  into v_total, v_chapters, v_null_year, v_wrong_scope\n`);
output.write(`  from public.mcqs m join public.chapters c on c.id=m.chapter_id join public.subjects s on s.id=c.subject_id\n`);
output.write(`  where m.category=${sqlText(importCategory)};\n`);
output.write(`  if v_total<>${stagingRows.length} or v_chapters<>117 or v_null_year<>0 or v_wrong_scope<>0 then\n`);
output.write(`    raise exception 'FCPS import verification failed: total=%, chapters=%, null_year=%, wrong_scope=%', v_total, v_chapters, v_null_year, v_wrong_scope;\n`);
output.write(`  end if;\n`);
output.write(`end $$;\n`);
output.end();

await new Promise((resolve, reject) => {
  output.on('finish', resolve);
  output.on('error', reject);
});

console.log(JSON.stringify({ files: csvFiles.length, rows: stagingRows.length, chapters: mappedChapters.size, output: outputSqlPath }));
