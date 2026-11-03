import { createClient } from '@supabase/supabase-js';
import sharedQuestionBanks from '../config/shared-question-banks';

type ContentRequest = {
  method?: string;
  query: Record<string, string | string[] | undefined>;
  headers: Record<string, string | string[] | undefined>;
};

type ContentResponse = {
  setHeader(name: string, value: string | number | readonly string[]): ContentResponse;
  status(statusCode: number): ContentResponse;
  json(payload: unknown): ContentResponse;
  end(payload?: unknown): ContentResponse;
};

const MEDMACS_SUPABASE_URL = 'https://ssmmquedryomwxccaqqb.supabase.co';
const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || MEDMACS_SUPABASE_URL).replace(/\/+$/, '');
if (SUPABASE_URL !== MEDMACS_SUPABASE_URL) {
  throw new Error('SUPABASE_URL must point to the Medmacs Supabase project.');
}
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_GkYgPdKV2U51Dd6Wo3AeLQ_nuyW-PIH';

const allowedOrigins = new Set([
  'https://medmacs.app',
  'https://www.medmacs.app',
  'https://medistics.app',
  'https://www.medistics.app',
  'http://localhost:3000',
  'http://localhost:8080',
  'http://localhost:8081',
  'http://localhost:5173',
  'capacitor://localhost',
  'https://com.hmacs.medmacs',
]);

type SubjectLike = {
  institutes?: string[] | null;
  program_code?: string | null;
};

type SubjectRow = SubjectLike & {
  id: string;
  name: string;
};

type InstituteScope = {
  category?: string | null;
  years?: string[] | null;
};

type ChapterRow = {
  id: string;
  name: string;
  description?: string | null;
  chapter_number: number;
  subject_id: string;
  content_type?: string | null;
  mcq_count?: number | null;
};

type SharedQuestionBankGroup = {
  id: string;
  enabled: boolean;
  sourceSubject: { name: string; instituteCode: string };
  targets: { mode: 'all_subjects_for_institute'; instituteCode: string };
  includeInSubjectPractice: boolean;
  chapters: Array<{ name: string; sortOrder: number }>;
};

let cachedSharedQuestionBankGroups: SharedQuestionBankGroup[] | null = null;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const getSharedQuestionBankGroups = (): SharedQuestionBankGroup[] => {
  if (cachedSharedQuestionBankGroups) return cachedSharedQuestionBankGroups;

  try {
    const config = sharedQuestionBanks as { version?: unknown; groups?: unknown };
    if (config.version !== 1 || !Array.isArray(config.groups)) throw new Error('Unsupported mapping format');

    const groupIds = new Set<string>();
    const groups: SharedQuestionBankGroup[] = [];
    for (const candidate of config.groups as Array<Record<string, any>>) {
      const source = candidate.sourceSubject as Record<string, unknown> | undefined;
      const targets = candidate.targets as Record<string, unknown> | undefined;
      const chapters = candidate.chapters as Array<Record<string, unknown>> | undefined;
      const valid = isNonEmptyString(candidate.id)
        && !groupIds.has(candidate.id)
        && typeof candidate.enabled === 'boolean'
        && isNonEmptyString(source?.name)
        && isNonEmptyString(source?.instituteCode)
        && targets?.mode === 'all_subjects_for_institute'
        && isNonEmptyString(targets?.instituteCode)
        && typeof candidate.includeInSubjectPractice === 'boolean'
        && Array.isArray(chapters)
        && chapters.length > 0
        && chapters.every(chapter => isNonEmptyString(chapter.name)
          && Number.isInteger(chapter.sortOrder)
          && Number(chapter.sortOrder) >= 0);
      if (!valid) throw new Error(`Invalid mapping group: ${String(candidate.id || 'unknown')}`);

      const normalizedChapterNames = chapters.map(chapter => String(chapter.name).trim().toLowerCase());
      if (new Set(normalizedChapterNames).size !== normalizedChapterNames.length) {
        throw new Error(`Duplicate chapter name in mapping group: ${candidate.id}`);
      }

      groupIds.add(candidate.id);
      groups.push({
        id: candidate.id.trim(),
        enabled: candidate.enabled,
        sourceSubject: {
          name: String(source.name).trim(),
          instituteCode: String(source.instituteCode).trim().toLowerCase(),
        },
        targets: {
          mode: 'all_subjects_for_institute',
          instituteCode: String(targets.instituteCode).trim().toLowerCase(),
        },
        includeInSubjectPractice: candidate.includeInSubjectPractice,
        chapters: chapters.map(chapter => ({
          name: String(chapter.name).trim(),
          sortOrder: Number(chapter.sortOrder),
        })),
      });
    }

    cachedSharedQuestionBankGroups = groups.filter(group => group.enabled);
    return cachedSharedQuestionBankGroups;
  } catch (error) {
    // Mapping failures must never take down ordinary subject-owned content.
    console.error('Shared question-bank mapping could not be loaded; shared banks are disabled.', error);
    return [];
  }
};

const normalizeInstitute = (institute?: string | null) => String(institute || '').trim().toLowerCase();

const getInstituteYearOptions = (institute?: InstituteScope | null): string[] => (
  Array.isArray(institute?.years)
    ? institute.years.map(item => String(item).trim()).filter(Boolean)
    : []
);

const getSubjectInstitutes = <T extends SubjectLike>(subject: T): string[] => {
  const institutes = subject.institutes;

  if (!institutes || !Array.isArray(institutes) || institutes.length === 0) {
    return [];
  }

  return institutes.map(item => normalizeInstitute(item)).filter(Boolean);
};

const hasInstituteSpecificSubject = <T extends SubjectLike>(subject: T, institute?: string | null): boolean => {
  const normalized = getSubjectInstitutes(subject);
  const normalizedInstitute = normalizeInstitute(institute);

  if (!normalizedInstitute || normalized.length === 0 || normalized.includes('all') || normalized.includes('any')) {
    return false;
  }

  return normalized.includes(normalizedInstitute);
};

const getStringQuery = (value: string | string[] | undefined) => {
  if (Array.isArray(value)) return value[0];
  return value;
};

const getStringHeader = (value: string | string[] | undefined) => {
  if (Array.isArray(value)) return value[0];
  return value;
};

const normalizeMcqs = (rows: any[] | null) => (rows || []).map(mcq => ({
  ...mcq,
  options: Array.isArray(mcq.options)
    ? mcq.options
    : typeof mcq.options === 'string'
      ? JSON.parse(mcq.options)
      : [],
}));

const normalizeSeqs = (rows: any[] | null) => (rows || []).map(seq => ({
  ...seq,
  key_points: Array.isArray(seq.key_points)
    ? seq.key_points
    : typeof seq.key_points === 'string'
      ? JSON.parse(seq.key_points)
      : [],
}));

const setCors = (req: ContentRequest, res: ContentResponse) => {
  const origin = getStringHeader(req.headers.origin);
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Cache-Control', 'private, max-age=30, stale-while-revalidate=120');
};

const getUserProfile = async (client: any) => {
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) {
    return null;
  }

  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('year, program_code, institute')
    .eq('id', userData.user.id)
    .single();

  if (profileError || !profile) {
    return null;
  }

  return profile as { year?: string | null; program_code?: string | null; institute?: string | null };
};

const getInstituteScope = async (client: any, institute?: string | null): Promise<InstituteScope | null> => {
  const normalizedInstitute = normalizeInstitute(institute);
  if (!normalizedInstitute) return null;

  const { data, error } = await client
    .from('institutes')
    .select('category, years')
    .eq('code', normalizedInstitute)
    .maybeSingle();

  if (error) throw error;
  return data as InstituteScope | null;
};

const fetchScopedSubjects = async (client: any, table: string) => {
  const profile = await getUserProfile(client);
  if (!profile?.institute) {
    return [];
  }

  const instituteScope = await getInstituteScope(client, profile.institute);
  const yearOptions = getInstituteYearOptions(instituteScope);
  const normalizedProfileYear = String(profile?.year || '').trim();
  const effectiveYear = normalizedProfileYear || null;
  const isSpecializedTest = instituteScope?.category === 'specialized_test';
  const effectiveProgram = isSpecializedTest
    ? null
    : String(profile.program_code || 'mbbs').trim().toLowerCase();

  // Specialized curricula must never infer a specialty for a profile whose
  // year is null. Even a single available option must be selected explicitly.
  if (yearOptions.length > 0 && !effectiveYear) {
    return [];
  }

  let query = client
    .from(table)
    .select('*')
    .order('name');

  if (effectiveYear) {
    query = query.eq('year', effectiveYear);
  }
  if (effectiveProgram === 'mbbs') {
    query = query.or('program_code.eq.mbbs,program_code.is.null');
  } else if (effectiveProgram) {
    query = query.eq('program_code', effectiveProgram);
  }

  const { data, error } = await query;

  if (error) throw error;

  const subjects = data || [];
  const instituteSubjects = subjects.filter(subject => hasInstituteSpecificSubject(subject, profile.institute));

  if (instituteSubjects.length > 0) {
    return instituteSubjects;
  }

  if (yearOptions.length > 0 && !effectiveYear) {
    return [];
  }

  // `all` is a fallback audience, not an audience that is merged into every
  // institute curriculum. Exact institute matches always win above.
  const generalSubjects = subjects.filter(subject => getSubjectInstitutes(subject).includes('all'));
  if (generalSubjects.length > 0) {
    return generalSubjects;
  }

  // Keep existing users working until the audience migration reaches the
  // production database. This path becomes inactive as soon as `all` exists.
  return subjects.filter(subject => {
    const institutes = getSubjectInstitutes(subject);
    return institutes.includes('smbb') || institutes.includes('smbbmc');
  });
};

const normalizeName = (value?: string | null) => String(value || '').trim().toLowerCase();

const resolveSourceSubject = async (client: any, group: SharedQuestionBankGroup): Promise<SubjectRow | null> => {
  const { data, error } = await client
    .from('subjects')
    .select('id, name, institutes')
    .ilike('name', group.sourceSubject.name);

  if (error) throw error;

  const matches = (data || []).filter((subject: SubjectRow) =>
    getSubjectInstitutes(subject).includes(group.sourceSubject.instituteCode),
  );

  if (matches.length !== 1) {
    console.error('Shared question-bank source must resolve exactly once; group disabled for this request.', {
      groupId: group.id,
      sourceName: group.sourceSubject.name,
      matches: matches.length,
    });
    return null;
  }

  return matches[0];
};

const resolveSharedChapters = async (
  client: any,
  targetSubject: SubjectRow,
  forSubjectPractice = false,
): Promise<ChapterRow[]> => {
  const resolved: ChapterRow[] = [];

  for (const group of getSharedQuestionBankGroups()) {
    if (forSubjectPractice && !group.includeInSubjectPractice) continue;
    if (!getSubjectInstitutes(targetSubject).includes(group.targets.instituteCode)) continue;

    const sourceSubject = await resolveSourceSubject(client, group);
    if (!sourceSubject) continue;

    const { data, error } = await client
      .from('chapters')
      .select('id, name, description, chapter_number, subject_id, content_type, mcq_count')
      .eq('subject_id', sourceSubject.id);

    if (error) throw error;

    const sourceChapters = (data || []) as ChapterRow[];
    const chaptersByName = new Map<string, ChapterRow[]>();
    for (const chapter of sourceChapters) {
      const key = normalizeName(chapter.name);
      chaptersByName.set(key, [...(chaptersByName.get(key) || []), chapter]);
    }

    const groupChapters: ChapterRow[] = [];
    let groupIsComplete = true;
    for (const configuredChapter of group.chapters) {
      const matches = chaptersByName.get(normalizeName(configuredChapter.name)) || [];
      if (matches.length !== 1) {
        console.error('Shared question-bank chapter must resolve exactly once; group disabled for this request.', {
          groupId: group.id,
          chapterName: configuredChapter.name,
          matches: matches.length,
        });
        groupIsComplete = false;
        break;
      }

      groupChapters.push({
        ...matches[0],
        chapter_number: configuredChapter.sortOrder,
        subject_id: targetSubject.id,
        content_type: 'question_bank',
      });
    }

    if (groupIsComplete) resolved.push(...groupChapters);
  }

  return resolved;
};

const fetchVisibleSubject = async (client: any, subjectId: string): Promise<SubjectRow | null> => {
  const subjects = await fetchScopedSubjects(client, 'subjects') as SubjectRow[];
  return subjects.find(subject => subject.id === subjectId) || null;
};

export default async function handler(req: ContentRequest, res: ContentResponse) {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const resource = getStringQuery(req.query.resource);
  const subjectId = getStringQuery(req.query.subjectId);
  const chapterId = getStringQuery(req.query.chapterId);
  const authorization = getStringHeader(req.headers.authorization);

  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: authorization ? { headers: { Authorization: authorization } } : undefined,
  });

  try {
    switch (resource) {
      case 'mcq-subjects': {
        return res.status(200).json({ data: await fetchScopedSubjects(client, 'subjects') });
      }

      case 'mcq-subject': {
        if (!subjectId) return res.status(400).json({ error: 'subjectId is required' });
        const subject = await fetchVisibleSubject(client, subjectId);
        if (!subject) return res.status(404).json({ error: 'Subject not found' });
        return res.status(200).json({ data: subject });
      }

      case 'mcq-chapters': {
        if (!subjectId) return res.status(400).json({ error: 'subjectId is required' });
        const subject = await fetchVisibleSubject(client, subjectId);
        if (!subject) return res.status(404).json({ error: 'Subject not found' });
        const { data, error } = await client
          .from('chapters')
          .select('id, name, description, chapter_number, subject_id, content_type, mcq_count')
          .eq('subject_id', subjectId)
          .order('chapter_number');
        if (error) throw error;
        const sharedChapters = await resolveSharedChapters(client, subject);
        const chaptersById = new Map<string, ChapterRow>();
        for (const chapter of (data || []) as ChapterRow[]) chaptersById.set(chapter.id, chapter);
        for (const chapter of sharedChapters) chaptersById.set(chapter.id, chapter);

        return res.status(200).json({
          data: [...chaptersById.values()].sort((a, b) => a.chapter_number - b.chapter_number).map((chapter: ChapterRow) => ({
            ...chapter,
            mcq_count: chapter.mcq_count || 0,
          })),
        });
      }

      case 'mcq-directory': {
        if (!subjectId) return res.status(400).json({ error: 'subjectId is required' });
        const subject = await fetchVisibleSubject(client, subjectId);
        if (!subject) return res.status(404).json({ error: 'Subject not found' });
        const { data, error } = await client
          .from('chapters')
          .select('id, name, description, chapter_number, subject_id, content_type, mcq_count')
          .eq('subject_id', subjectId)
          .order('chapter_number');
        if (error) throw error;
        const sharedChapters = await resolveSharedChapters(client, subject);
        const chaptersById = new Map<string, ChapterRow>();
        for (const chapter of (data || []) as ChapterRow[]) chaptersById.set(chapter.id, chapter);
        for (const chapter of sharedChapters) chaptersById.set(chapter.id, chapter);
        return res.status(200).json({
          data: {
            subject,
            chapters: [...chaptersById.values()]
              .sort((a, b) => a.chapter_number - b.chapter_number)
              .map(chapter => ({ ...chapter, mcq_count: chapter.mcq_count || 0 })),
          },
        });
      }

      case 'mcq-chapter': {
        if (!subjectId || !chapterId) {
          return res.status(400).json({ error: 'subjectId and chapterId are required' });
        }
        const subject = await fetchVisibleSubject(client, subjectId);
        if (!subject) return res.status(404).json({ error: 'Subject not found' });

        const { data: directChapter, error } = await client
          .from('chapters')
          .select('id, name, description, chapter_number, subject_id, content_type, mcq_count')
          .eq('id', chapterId)
          .eq('subject_id', subjectId)
          .maybeSingle();
        if (error) throw error;

        const sharedChapter = (await resolveSharedChapters(client, subject))
          .find(chapter => chapter.id === chapterId);
        const chapter = sharedChapter || directChapter;
        if (!chapter) return res.status(404).json({ error: 'Chapter not found' });

        return res.status(200).json({
          data: { ...chapter, mcq_count: chapter.mcq_count || 0 },
        });
      }

      case 'mcqs': {
        if (!chapterId) return res.status(400).json({ error: 'chapterId is required' });

        // Resolve the parent subject before returning questions. This prevents
        // callers from bypassing year/specialty visibility with a known chapter
        // UUID, including FCPS-1 profiles whose year is null.
        const { data: chapterScope, error: chapterScopeError } = await client
          .from('chapters')
          .select('subject_id')
          .eq('id', chapterId)
          .maybeSingle();
        if (chapterScopeError) throw chapterScopeError;
        if (!chapterScope?.subject_id) return res.status(404).json({ error: 'Chapter not found' });

        const visibleSubject = await fetchVisibleSubject(client, chapterScope.subject_id);
        if (!visibleSubject) return res.status(404).json({ error: 'Chapter not found' });

        const { data, error } = await client
          .from('mcqs')
          .select('*')
          .eq('chapter_id', chapterId)
          .order('created_at');
        if (error) throw error;
        return res.status(200).json({ data: normalizeMcqs(data) });
      }

      case 'mcqs-by-subject': {
        if (!subjectId) return res.status(400).json({ error: 'subjectId is required' });

        const subject = await fetchVisibleSubject(client, subjectId);
        if (!subject) return res.status(404).json({ error: 'Subject not found' });

        const { data: chapters, error: chaptersError } = await client
          .from('chapters')
          .select('id')
          .eq('subject_id', subjectId);
        if (chaptersError) throw chaptersError;

        const sharedChapters = await resolveSharedChapters(client, subject, true);
        const chapterIds = [...new Set([
          ...(chapters || []).map((chapter: any) => chapter.id),
          ...sharedChapters.map(chapter => chapter.id),
        ])];
        if (chapterIds.length === 0) {
          return res.status(200).json({ data: [] });
        }

        const { data, error } = await client
          .from('mcqs')
          .select('*')
          .in('chapter_id', chapterIds);
        if (error) throw error;

        return res.status(200).json({ data: normalizeMcqs(data) });
      }

      case 'flp-questions': {
        const limitStr = getStringQuery(req.query.limit);
        const limit = Math.min(Math.max(parseInt(limitStr || '100', 10), 1), 200);

        // Retrieve scoped/visible subjects for the user profile
        const allScopedSubjects = await fetchScopedSubjects(client, 'subjects') as SubjectRow[];
        let targetSubjects = allScopedSubjects;

        if (subjectId) {
          targetSubjects = allScopedSubjects.filter(subj => subj.id === subjectId);
        }

        if (targetSubjects.length === 0) {
          // If no institute-scoped subjects found or profile.year is null (like FCPS Part 1),
          // query all available subjects for FCPS Part 1 or general subjects.
          const { data: fallbackSubjects } = await client.from('subjects').select('id, name, institutes');
          targetSubjects = (fallbackSubjects || []) as SubjectRow[];
        }

        if (targetSubjects.length === 0) {
          return res.status(200).json({ data: [] });
        }

        // Get chapters for these subjects
        const { data: chapters, error: chaptersError } = await client
          .from('chapters')
          .select('id, subject_id')
          .in('subject_id', targetSubjects.map(s => s.id));
        if (chaptersError) throw chaptersError;

        // Also resolve shared chapters
        const allSharedChaptersPromises = targetSubjects.map(subj => resolveSharedChapters(client, subj, true));
        const sharedChaptersArrays = await Promise.all(allSharedChaptersPromises);
        const sharedChapters = sharedChaptersArrays.flat();

        const chapterIds = [...new Set([
          ...(chapters || []).map((chapter: any) => chapter.id),
          ...sharedChapters.map(chapter => chapter.id),
        ])];

        if (chapterIds.length === 0) {
          return res.status(200).json({ data: [] });
        }

        const { data, error } = await client
          .from('mcqs')
          .select('*')
          .in('chapter_id', chapterIds)
          .limit(limit * 2); // Fetch extra for client-side random balancing

        if (error) throw error;

        return res.status(200).json({ data: normalizeMcqs(data) });
      }

      case 'mcqs-by-subjects': {
        const subjectIdsStr = getStringQuery(req.query.subjectIds);
        if (!subjectIdsStr) return res.status(400).json({ error: 'subjectIds is required' });
        const subjectIds = subjectIdsStr.split(',').filter(Boolean);
        if (subjectIds.length === 0) return res.status(200).json({ data: [] });

        // Retrieve the scoped/visible subjects
        const allScopedSubjects = await fetchScopedSubjects(client, 'subjects') as SubjectRow[];
        const visibleSubjects = allScopedSubjects.filter(subj => subjectIds.includes(subj.id));

        if (visibleSubjects.length === 0) return res.status(200).json({ data: [] });

        // Get all chapters for these subjects
        const { data: chapters, error: chaptersError } = await client
          .from('chapters')
          .select('id, subject_id')
          .in('subject_id', visibleSubjects.map(s => s.id));
        if (chaptersError) throw chaptersError;

        // Resolve shared chapters for each visible subject
        const allSharedChaptersPromises = visibleSubjects.map(subj => resolveSharedChapters(client, subj, true));
        const sharedChaptersArrays = await Promise.all(allSharedChaptersPromises);
        const sharedChapters = sharedChaptersArrays.flat();

        const chapterIds = [...new Set([
          ...(chapters || []).map((chapter: any) => chapter.id),
          ...sharedChapters.map(chapter => chapter.id),
        ])];

        if (chapterIds.length === 0) {
          return res.status(200).json({ data: [] });
        }

        const { data, error } = await client
          .from('mcqs')
          .select('*')
          .in('chapter_id', chapterIds);
        if (error) throw error;

        return res.status(200).json({ data: normalizeMcqs(data) });
      }

      case 'app-seq-subjects': {
        const scopedSubjects = await fetchScopedSubjects(client, 'subjects') as SubjectRow[];
        if (scopedSubjects.length === 0) return res.status(200).json({ data: [] });
        const { data: chapters, error } = await client
          .from('chapters')
          .select('subject_id, seqs(count)')
          .in('subject_id', scopedSubjects.map(subject => subject.id));
        if (error) throw error;
        const subjectIdsWithSeqs = new Set(
          (chapters || [])
            .filter((chapter: any) => Number(chapter.seqs?.[0]?.count || 0) > 0)
            .map((chapter: any) => chapter.subject_id),
        );
        return res.status(200).json({ data: scopedSubjects.filter(subject => subjectIdsWithSeqs.has(subject.id)) });
      }

      case 'app-seq-chapters': {
        if (!subjectId) return res.status(400).json({ error: 'subjectId is required' });
        const subject = await fetchVisibleSubject(client, subjectId);
        if (!subject) return res.status(404).json({ error: 'Subject not found' });
        const { data, error } = await client
          .from('chapters')
          .select('id, name, description, chapter_number, subject_id, seqs(count)')
          .eq('subject_id', subjectId)
          .order('chapter_number');
        if (error) throw error;
        return res.status(200).json({
          data: (data || []).map((chapter: any) => ({
            ...chapter,
            seq_count: chapter.seqs?.[0]?.count || 0,
          })),
        });
      }

      case 'app-seqs': {
        if (!chapterId) return res.status(400).json({ error: 'chapterId is required' });
        const { data, error } = await client
          .from('seqs')
          .select('*')
          .eq('chapter_id', chapterId)
          .order('created_at');
        if (error) throw error;
        return res.status(200).json({ data: data || [] });
      }

      case 'seq-subjects': {
        return res.status(200).json({ data: await fetchScopedSubjects(client, 'subjects') });
      }

      case 'seq-chapters': {
        if (!subjectId) return res.status(400).json({ error: 'subjectId is required' });
        const { data, error } = await client
          .from('chapters')
          .select('id, name, description, chapter_number, subject_id, seq(count)')
          .eq('subject_id', subjectId)
          .order('chapter_number');
        if (error) throw error;
        return res.status(200).json({
          data: (data || []).map((chapter: any) => ({
            id: chapter.id,
            name: chapter.name,
            description: chapter.description,
            chapter_number: chapter.chapter_number,
            subject_id: chapter.subject_id,
            seq_count: chapter.seq?.[0]?.count || 0,
          })),
        });
      }

      case 'seqs': {
        if (!chapterId) return res.status(400).json({ error: 'chapterId is required' });
        const { data, error } = await client
          .from('seq')
          .select('*')
          .eq('chapter_id', chapterId)
          .order('created_at');
        if (error) throw error;
        return res.status(200).json({ data: normalizeSeqs(data) });
      }

      default:
        return res.status(400).json({ error: 'Unknown resource' });
    }
  } catch (error: any) {
    console.error('content api error', { resource, message: error?.message ?? error });
    return res.status(500).json({ error: 'Content service unavailable' });
  }
}
