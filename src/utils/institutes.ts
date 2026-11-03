import { supabase } from '@/integrations/supabase/client';
import type { StudyProgramCode } from './studyPrograms';

export interface Institute {
  id: string;
  code: string;
  name: string;
  short_name: string;
  image_url: string | null;
  enabled: boolean;
  category?: 'institute' | 'specialized_test' | string | null;
  province?: string | null;
  region?: string | null;
  sector?: string | null;
  ownership?: string | null;
  type?: string | null;
  institute_type?: string | null;
  is_public?: boolean | null;
  years: string[];
  programs?: StudyProgramCode[] | null;
  dashboard_components?: {
    mcqs: boolean;
    past_papers?: boolean;
    seqs: boolean;
    viva: boolean;
    programs?: Record<string, {
      mcqs?: boolean;
      past_papers?: boolean;
      seqs?: boolean;
      viva?: boolean;
    }>;
  };
}

let cachedInstitutes: Institute[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000;
export type InstitutesLoadResult = {
  institutes: Institute[];
  error: string | null;
};
const SPECIALIZED_TEST_CODES = new Set([
  'jinnah_house_job_test',
  'jpmc_house_job_test',
  'nre',
  'nle',
  'fcps_part_1',
  'fcps_part_2',
  'medical_cadet',
]);

export async function fetchInstitutesWithStatus(options?: { force?: boolean } | boolean): Promise<InstitutesLoadResult> {
  const force = typeof options === 'boolean' ? options : !!options?.force;
  if (!force && cachedInstitutes && Date.now() - cacheTimestamp < CACHE_TTL) {
    return { institutes: cachedInstitutes, error: null };
  }
  const { data, error } = await supabase
    .from('institutes')
    .select('*')
    .order('name');
  if (error || !data) {
    return {
      institutes: cachedInstitutes || [],
      error: error?.message || 'Could not load institutes. Please try again.',
    };
  }
  cachedInstitutes = data as Institute[];
  cacheTimestamp = Date.now();
  return { institutes: cachedInstitutes, error: null };
}

export async function fetchInstitutes(options?: { force?: boolean } | boolean): Promise<Institute[]> {
  const { institutes } = await fetchInstitutesWithStatus(options);
  return institutes;
}

export async function getEnabledInstitutes(): Promise<Institute[]> {
  const all = await fetchInstitutes();
  return all.filter(i => i.enabled);
}

export async function getAllInstitutes(): Promise<Institute[]> {
  return fetchInstitutes();
}

export function getInstituteDisplayName(code: string, institutes: Institute[]): string {
  const inst = institutes.find(i => i.code === code);
  return inst?.name || code;
}

export function getInstituteByCode(code: string, institutes: Institute[]): Institute | undefined {
  return institutes.find(i => i.code === code);
}

export function getInstituteCategory(institute?: Pick<Institute, 'category' | 'code'> | null): 'institute' | 'specialized_test' {
  if (!institute) return 'institute';
  if (institute.category === 'specialized_test' || isSpecializedTestCode(institute.code)) {
    return 'specialized_test';
  }
  return 'institute';
}

export function isSpecializedTestInstitute(institute?: Pick<Institute, 'category' | 'code'> | null): boolean {
  return getInstituteCategory(institute) === 'specialized_test';
}

export function isSpecializedTestCode(code?: string | null): boolean {
  return !!code && SPECIALIZED_TEST_CODES.has(String(code).trim().toLowerCase());
}
