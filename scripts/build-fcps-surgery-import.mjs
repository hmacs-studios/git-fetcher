import fs from 'node:fs';
import path from 'node:path';
import Papa from 'papaparse';
import { v5 as uuidv5 } from 'uuid';

const [libraryRoot, seedSqlPath, outputDir] = process.argv.slice(2);
if (!libraryRoot || !seedSqlPath || !outputDir) {
  throw new Error('Usage: node build-fcps-surgery-import.mjs <library> <seed-sql> <output-dir>');
}

const namespace = '1f76e7a0-9637-4b3d-8ed1-f26887b09b2d';
const importCategory = 'fcps1_surgery_allied_2026';
const seedSql = fs.readFileSync(seedSqlPath, 'utf8');

const subjectByKey = new Map();
for (const match of seedSql.matchAll(/\('([^']+)', '([^']+)', '([^']+)', ([12]), \d+\)/g)) {
  const [, key, name, specialty] = match;
  if (key.startsWith('surgery_allied:') && specialty === 'surgery_allied') {
    subjectByKey.set(key, name);
  }
}

const chapterByKeyAndNormalizedName = new Map();
for (const match of seedSql.matchAll(/\('([^']+)', '([^']+)', (\d+)\)/g)) {
  const [, key, name] = match;
  if (key.startsWith('surgery_allied:')) {
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
  const parts = relativePath.split('/');
  const top = parts[0];
  const file = parts[parts.length - 1];
  const stem = file.replace(/\.csv$/i, '');
  const fileNumber = Number(stem.match(/^(\d+)_/)?.[1]);

  if (top.startsWith('01_')) {
    const paper = fileNumber <= 4 ? 1 : 2;
    return `surgery_allied:anatomy:paper_${paper}`;
  }
  if (top.startsWith('02_')) {
    const paper = [1, 2, 12].includes(fileNumber) ? 1 : 2;
    return `surgery_allied:physiology:paper_${paper}`;
  }
  if (top.startsWith('03_')) {
    const paper = [1, 4].includes(fileNumber) ? 1 : 2;
    return `surgery_allied:biochemistry:paper_${paper}`;
  }
  if (top.startsWith('04_')) {
    const paper = [1, 2].includes(fileNumber) ? 1 : 2;
    return `surgery_allied:pharmacology:paper_${paper}`;
  }
  if (top.startsWith('05_')) {
    const paper = [1, 2].includes(fileNumber) ? 1 : 2;
    return `surgery_allied:pathology:paper_${paper}`;
  }
  if (top.startsWith('06_')) return 'surgery_allied:research_and_biostatistics:paper_1';
  if (top.startsWith('07_')) return 'surgery_allied:behavioral_science_and_medical_ethics:paper_1';
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

if (csvFiles.length !== 50) throw new Error(`Expected 50 chapter CSVs, found ${csvFiles.length}`);

const stagingRows = [];
for (const { absolute, relative } of csvFiles) {
  const parts = relative.split('/');
  const expectedChapterName = title(parts[1]);
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
  if (parsed.data.length !== 300) throw new Error(`${relative}: expected 300 rows, found ${parsed.data.length}`);

  parsed.data.forEach((row, index) => {
    const options = ['opt a', 'opt b', 'opt c', 'opt d', 'opt e'].map(key => String(row[key] ?? '').trim());
    const question = String(row.Questions ?? '').trim();
    const correctAnswer = String(row['correct answer'] ?? '').trim();
    const explanation = String(row.explanation ?? '').trim();
    if (!question || options.some(option => !option) || !correctAnswer || !explanation) {
      throw new Error(`${relative} row ${index + 2}: missing required content`);
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
}

if (stagingRows.length !== 15000) throw new Error(`Expected 15,000 MCQs, found ${stagingRows.length}`);

// Split stagingRows into 5 parts of 3000 rows each
const chunkSize = 3000;
const generatedFiles = [];

for (let part = 0; part < 5; part++) {
  const partRows = stagingRows.slice(part * chunkSize, (part + 1) * chunkSize);
  const fileName = `2026082700000${part + 1}_fcps1_surgery_part${part + 1}.sql`;
  const filePath = path.join(outputDir, fileName);

  const output = fs.createWriteStream(filePath, { encoding: 'utf8' });
  output.write(`-- Generated FCPS-1 Surgery Part ${part + 1} MCQ import (${partRows.length} rows).\n`);
  output.write(`create temporary table if not exists fcps_mcq_stage (\n`);
  output.write(`  id uuid primary key, subject_name text not null, chapter_name text not null,\n`);
  output.write(`  question text not null, options jsonb not null, correct_answer text not null, explanation text not null\n`);
  output.write(`) on commit drop;\n\n`);

  const batchSize = 1000;
  for (let start = 0; start < partRows.length; start += batchSize) {
    const batch = partRows.slice(start, start + batchSize);
    output.write(`insert into fcps_mcq_stage (id, subject_name, chapter_name, question, options, correct_answer, explanation) values\n`);
    output.write(batch.map(row => `(${sqlText(row.id)}::uuid, ${sqlText(row.subjectName)}, ${sqlText(row.chapterName)}, ${sqlText(row.question)}, ${sqlText(row.options)}::jsonb, ${sqlText(row.correctAnswer)}, ${sqlText(row.explanation)})`).join(',\n'));
    output.write(';\n');
  }

  output.write(`\ninsert into public.mcqs (id, question, options, correct_answer, explanation, category, chapter_id, subject, difficulty)\n`);
  output.write(`select x.id, x.question, x.options, x.correct_answer, x.explanation, ${sqlText(importCategory)}, c.id, s.name, 'FCPS Part 1'\n`);
  output.write(`from fcps_mcq_stage x\n`);
  output.write(`join public.subjects s on lower(s.name)=lower(x.subject_name)\n`);
  output.write(`join public.chapters c on c.subject_id=s.id and lower(c.name)=lower(x.chapter_name)\n`);
  output.write(`where s.year='surgery_allied' and s.institutes=to_jsonb(array['fcps_part_1']::text[])\n`);
  output.write(`on conflict (id) do update set\n`);
  output.write(`  question=excluded.question, options=excluded.options, correct_answer=excluded.correct_answer,\n`);
  output.write(`  explanation=excluded.explanation, category=excluded.category, chapter_id=excluded.chapter_id,\n`);
  output.write(`  subject=excluded.subject, difficulty=excluded.difficulty;\n\n`);

  output.write(`truncate table fcps_mcq_stage;\n`);
  output.end();

  await new Promise((resolve, reject) => {
    output.on('finish', resolve);
    output.on('error', reject);
  });
  generatedFiles.push(fileName);
}

console.log(JSON.stringify({ filesGenerated: generatedFiles }));
