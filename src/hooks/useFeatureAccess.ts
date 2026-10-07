import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type PlanTier = 'free' | 'iconic' | 'premium';

export type FeatureKey = 
  | 'mcqs'
  | 'saved_questions'
  | 'viva'
  | 'flps'
  | 'battle_mode'
  | 'seqs'
  | 'ospe'
  | 'ai_tutor'
  | 'mistake_book'
  | 'flashcards'
  | 'ai_test_attempt';

export interface FeatureAccessResult {
  isAccessible: boolean;
  isLoading: boolean;
  planTier: PlanTier;
  instituteCode: string;
}

export function normalizePlanTier(rawPlan?: string | null): PlanTier {
  const planStr = String(rawPlan || '').trim().toLowerCase();
  if (planStr.includes('premium')) return 'premium';
  if (planStr.includes('iconic')) return 'iconic';
  return 'free';
}

function parseFeatures(val: any): Record<string, Record<PlanTier, boolean>> | null {
  if (!val) return null;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch {
      return null;
    }
  }
  if (typeof val === 'object') return val;
  return null;
}

/**
 * Custom React hook to evaluate cloud-managed feature availability based on Institute & Plan Tier.
 * Supabase Cloud Database is the SINGLE SOURCE OF TRUTH.
 */
export function useFeatureAccess(
  featureKey: FeatureKey,
  overrideInstituteCode?: string | null,
  overridePlanTier?: string | null
): FeatureAccessResult {
  const { user } = useAuth();

  // 1. Fetch user profile from Cloud DB
  const { data: userProfile, isLoading: isProfileLoading } = useQuery({
    queryKey: ['feature-access-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('plan, institute')
        .eq('id', user.id)
        .maybeSingle();

      if (error) return null;
      return data;
    },
    enabled: !!user?.id && (!overrideInstituteCode || !overridePlanTier),
    staleTime: 0, // Always fetch fresh profile from Cloud DB
  });

  const activePlan = overridePlanTier ?? userProfile?.plan ?? 'free';
  const activeInstitute = overrideInstituteCode ?? userProfile?.institute ?? 'global';

  const planTier = normalizePlanTier(activePlan);
  const normalizedInstitute = String(activeInstitute || 'global').trim().toLowerCase();

  // 2. Fetch access control matrix directly from Cloud DB (institute_plan_features)
  const { data: featureMatrix, isLoading: isMatrixLoading } = useQuery({
    queryKey: ['institute_plan_features', normalizedInstitute],
    queryFn: async () => {
      try {
        const { data, error } = await (supabase.from('institute_plan_features') as any)
          .select('institute_code, features')
          .in('institute_code', [normalizedInstitute, 'global', 'all']);

        if (error || !data || data.length === 0) return null;

        // Custom institute override takes top priority
        const customEntry = data.find((row: any) => String(row.institute_code).toLowerCase() === normalizedInstitute);
        if (customEntry && customEntry.features) {
          const parsed = parseFeatures(customEntry.features);
          if (parsed) return parsed;
        }

        // Global default entry in Cloud DB
        const globalEntry = data.find((row: any) => ['global', 'all'].includes(String(row.institute_code).toLowerCase()));
        if (globalEntry && globalEntry.features) {
          const parsed = parseFeatures(globalEntry.features);
          if (parsed) return parsed;
        }

        return null;
      } catch {
        return null;
      }
    },
    staleTime: 0, // Always fetch fresh permissions matrix from Cloud DB
  });

  const isLoading = (isProfileLoading && !overridePlanTier) || isMatrixLoading;
  
  // Single Source of Truth Evaluation from Cloud DB:
  // While loading permissions, return false (locked).
  // Once loaded, evaluate exact Cloud DB boolean flag.
  const featureConfig = featureMatrix ? featureMatrix[featureKey] : null;

  const isAccessible = isLoading
    ? false
    : featureConfig
    ? featureConfig[planTier] !== false
    : false; // Strict fallback: if Cloud DB matrix is missing/empty, default to locked!

  return {
    isAccessible,
    isLoading,
    planTier,
    instituteCode: normalizedInstitute
  };
}

/**
 * Hook to retrieve full feature access dictionary from Cloud DB.
 */
export function useAllFeatureAccess(
  overrideInstituteCode?: string | null,
  overridePlanTier?: string | null
): { features: Record<FeatureKey, boolean>; isLoading: boolean; planTier: PlanTier } {
  const { user } = useAuth();

  const { data: userProfile, isLoading: isProfileLoading } = useQuery({
    queryKey: ['feature-access-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('plan, institute')
        .eq('id', user.id)
        .maybeSingle();

      if (error) return null;
      return data;
    },
    enabled: !!user?.id && (!overrideInstituteCode || !overridePlanTier),
    staleTime: 0,
  });

  const activePlan = overridePlanTier ?? userProfile?.plan ?? 'free';
  const activeInstitute = overrideInstituteCode ?? userProfile?.institute ?? 'global';

  const planTier = normalizePlanTier(activePlan);
  const normalizedInstitute = String(activeInstitute || 'global').trim().toLowerCase();

  const { data: featureMatrix, isLoading: isMatrixLoading } = useQuery({
    queryKey: ['institute_plan_features', normalizedInstitute],
    queryFn: async () => {
      try {
        const { data, error } = await (supabase.from('institute_plan_features') as any)
          .select('institute_code, features')
          .in('institute_code', [normalizedInstitute, 'global', 'all']);

        if (error || !data || data.length === 0) return null;

        const customEntry = data.find((row: any) => String(row.institute_code).toLowerCase() === normalizedInstitute);
        if (customEntry && customEntry.features) {
          const parsed = parseFeatures(customEntry.features);
          if (parsed) return parsed;
        }

        const globalEntry = data.find((row: any) => ['global', 'all'].includes(String(row.institute_code).toLowerCase()));
        if (globalEntry && globalEntry.features) {
          const parsed = parseFeatures(globalEntry.features);
          if (parsed) return parsed;
        }

        return null;
      } catch {
        return null;
      }
    },
    staleTime: 0,
  });

  const isLoading = (isProfileLoading && !overridePlanTier) || isMatrixLoading;
  const matrix = featureMatrix || {};

  const getFlag = (key: FeatureKey): boolean => {
    if (isLoading) return false;
    const cfg = matrix[key];
    return cfg ? cfg[planTier] !== false : false;
  };

  const features: Record<FeatureKey, boolean> = {
    mcqs: getFlag('mcqs'),
    saved_questions: getFlag('saved_questions'),
    viva: getFlag('viva'),
    flps: getFlag('flps'),
    battle_mode: getFlag('battle_mode'),
    seqs: getFlag('seqs'),
    ospe: getFlag('ospe'),
    ai_tutor: getFlag('ai_tutor'),
    mistake_book: getFlag('mistake_book'),
    flashcards: getFlag('flashcards'),
    ai_test_attempt: getFlag('ai_test_attempt'),
  };

  return {
    features,
    isLoading,
    planTier
  };
}
