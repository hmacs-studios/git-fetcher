import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { aiApiJson, AiApiError } from '@/utils/aiApi';
import type { AnalyticsPlan, AiUsageSummary, DashboardProfile } from '../types';

type ToastInput = {
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
};

type UseDashboardAnalyticsPlanOptions = {
  userId?: string;
  profile?: DashboardProfile | null;
  rawUserPlan: string;
  isOfflineMode: boolean;
  loadAnalyticsPlan: boolean;
  toast: (input: ToastInput) => void;
};

type AiFeaturePolicy = {
  feature: string;
  enabled: boolean | null;
  daily_requests: number | null;
  weekly_requests: number | null;
  monthly_requests: number | null;
};

type AiUserOverride = Partial<Omit<AiFeaturePolicy, 'feature'>> & {
  feature: string;
  expires_at: string | null;
};

type AiUsageEvent = {
  feature: string;
  created_at: string;
};

type AnalyticsAnswer = {
  is_correct: boolean;
  time_taken: number | null;
  created_at: string;
  mcqs: {
    chapters: {
      subjects: {
        name: string;
        year: string | null;
        program_code: string | null;
      } | null;
    } | null;
  } | null;
};

type SubjectAnalytics = {
  subject: string;
  total: number;
  correct: number;
  wrong: number;
  totalTime: number;
  recentTotal: number;
  recentCorrect: number;
};

export function useDashboardAnalyticsPlan({
  userId,
  profile,
  rawUserPlan,
  isOfflineMode,
  loadAnalyticsPlan,
  toast,
}: UseDashboardAnalyticsPlanOptions) {
  const queryClient = useQueryClient();
  const [analyticsPlan, setAnalyticsPlan] = useState<AnalyticsPlan | null>(null);
  const [analyticsPlanLoading, setAnalyticsPlanLoading] = useState(false);

  const aiUsageSummaryQuery = useQuery<AiUsageSummary>({
    queryKey: ['dashboard-ai-usage-summary', userId, rawUserPlan],
    queryFn: async () => {
      if (!userId) return { kind: 'disabled', label: 'AI off by policy' };
      const now = Date.now();
      const dayStartIso = new Date(now - 24 * 60 * 60 * 1000).toISOString();
      const monthStartIso = new Date(now - 31 * 24 * 60 * 60 * 1000).toISOString();

      const [policyResult, overrideResult, usageResult] = await Promise.all([
        // These tables are deployed but not yet represented in the generated Supabase schema.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from('ai_feature_policies') as any)
          .select('feature, enabled, daily_requests, weekly_requests, monthly_requests')
          .eq('plan', rawUserPlan),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from('ai_user_overrides') as any)
          .select('feature, enabled, daily_requests, weekly_requests, monthly_requests, expires_at')
          .eq('user_id', userId),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from('ai_usage_events') as any)
          .select('feature, status, created_at')
          .eq('user_id', userId)
          .in('status', ['success', 'fallback'])
          .gte('created_at', monthStartIso),
      ]);

      if (policyResult.error) return { kind: 'unknown', label: 'AI usage unavailable' };

      const policies = (policyResult.data || []) as AiFeaturePolicy[];
      const overrides = (overrideResult.data || []) as AiUserOverride[];
      const usageRows = (usageResult.data || []) as AiUsageEvent[];
      const policyMap = new Map<string, AiFeaturePolicy>();
      policies.forEach((policy) => policyMap.set(policy.feature, policy));
      const activeOverrides = overrides.filter((override) =>
        !override.expires_at || new Date(override.expires_at).getTime() > now
      );
      activeOverrides.forEach((override) => {
        const base = policyMap.get(override.feature) || {
          feature: override.feature,
          enabled: false,
          daily_requests: null,
          weekly_requests: null,
          monthly_requests: null,
        };
        policyMap.set(override.feature, {
          ...base,
          enabled: override.enabled ?? base.enabled,
          daily_requests: override.daily_requests ?? base.daily_requests,
          weekly_requests: override.weekly_requests ?? base.weekly_requests,
          monthly_requests: override.monthly_requests ?? base.monthly_requests,
        });
      });

      const effectivePolicies = Array.from(policyMap.values()).filter((policy) => policy.enabled);
      if (!effectivePolicies.length) return { kind: 'disabled', label: 'AI off by policy' };

      const dailyFeatures = effectivePolicies.filter((policy) => Number.isFinite(Number(policy.daily_requests)));
      const monthlyFeatures = effectivePolicies.filter((policy) => Number.isFinite(Number(policy.monthly_requests)));
      const hasUnlimitedFeature = effectivePolicies.some((policy) =>
        policy.daily_requests == null && policy.weekly_requests == null && policy.monthly_requests == null
      );
      const countUsage = (feature: string, sinceIso: string) =>
        usageRows.filter((event) => event.feature === feature && event.created_at >= sinceIso).length;

      const dailyAllowed = dailyFeatures.reduce((sum, policy) => sum + Number(policy.daily_requests || 0), 0);
      const dailyUsed = dailyFeatures.reduce((sum, policy) => sum + countUsage(policy.feature, dayStartIso), 0);
      const monthlyAllowed = monthlyFeatures.reduce((sum, policy) => sum + Number(policy.monthly_requests || 0), 0);
      const monthlyUsed = monthlyFeatures.reduce((sum, policy) => sum + countUsage(policy.feature, monthStartIso), 0);
      const parts: string[] = [];
      if (dailyAllowed > 0) parts.push(`${Math.max(dailyAllowed - dailyUsed, 0)}/${dailyAllowed} today`);
      if (monthlyAllowed > 0) parts.push(`${Math.max(monthlyAllowed - monthlyUsed, 0)}/${monthlyAllowed} month`);
      if (!parts.length && hasUnlimitedFeature) return { kind: 'unlimited', label: 'AI usage: Unlimited' };
      if (!parts.length) return { kind: 'disabled', label: 'AI off by policy' };
      return { kind: 'limited', label: `AI left: ${parts.join(' · ')}` };
    },
    enabled: !!userId && !isOfflineMode,
    staleTime: 60 * 1000,
  });

  const syncedPlanQuery = useQuery<AnalyticsPlan | null>({
    queryKey: ['analytics-ai-plan', userId],
    queryFn: async () => {
      if (!userId) return null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('user_analytics_ai_plans') as any)
        .select('plan_payload, updated_at, created_at')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      return data?.plan_payload
        ? { ...data.plan_payload, generatedAt: data.updated_at || data.created_at }
        : null;
    },
    enabled: !!userId && !isOfflineMode && loadAnalyticsPlan,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (syncedPlanQuery.data) setAnalyticsPlan(syncedPlanQuery.data);
  }, [syncedPlanQuery.data]);

  const buildAnalyticsPayload = useCallback(async () => {
    if (!userId) return null;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [answersResult, savedResult, testsResult, battlesResult] = await Promise.all([
      supabase
        .from('user_answers')
        .select('is_correct, time_taken, created_at, mcqs(id, chapter_id, chapters(id, name, subjects(id, name, year, program_code)))')
        .eq('user_id', userId)
        .gte('created_at', thirtyDaysAgo),
      supabase.from('saved_mcqs').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('ai_generated_tests').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('battle_results').select('rank').eq('user_id', userId),
    ]);
    if (answersResult.error) throw answersResult.error;

    const subjectMap = new Map<string, SubjectAnalytics>();
    ((answersResult.data || []) as unknown as AnalyticsAnswer[]).forEach((answer) => {
      const subject = answer.mcqs?.chapters?.subjects;
      const subjectName = subject?.name || 'Unknown Subject';
      if (profile?.year && subject?.year && subject.year !== profile.year) return;
      if ((subject?.program_code || 'mbbs') !== (profile?.program_code || 'mbbs')) return;
      const row = subjectMap.get(subjectName) || {
        subject: subjectName,
        total: 0,
        correct: 0,
        wrong: 0,
        totalTime: 0,
        recentTotal: 0,
        recentCorrect: 0,
      };
      row.total += 1;
      row.correct += answer.is_correct ? 1 : 0;
      row.wrong += answer.is_correct ? 0 : 1;
      row.totalTime += Number(answer.time_taken || 0);
      if (answer.created_at >= sevenDaysAgo) {
        row.recentTotal += 1;
        row.recentCorrect += answer.is_correct ? 1 : 0;
      }
      subjectMap.set(subjectName, row);
    });

    const subjects = Array.from(subjectMap.values())
      .map((row) => ({
        subject: row.subject,
        total: row.total,
        correct: row.correct,
        wrong: row.wrong,
        accuracy: row.total ? Math.round((row.correct / row.total) * 100) : 0,
        avgTime: row.total ? Math.round(row.totalTime / row.total) : 0,
        recentTotal: row.recentTotal,
        recentAccuracy: row.recentTotal ? Math.round((row.recentCorrect / row.recentTotal) * 100) : null,
      }))
      .sort((a, b) => b.wrong - a.wrong)
      .slice(0, 10);
    const total = subjects.reduce((sum, subject) => sum + subject.total, 0);
    const correct = subjects.reduce((sum, subject) => sum + subject.correct, 0);

    return {
      generatedAt: new Date().toISOString(),
      plan: rawUserPlan,
      year: profile?.year || null,
      institute: profile?.institute || null,
      windowDays: 30,
      totals: {
        questions: total,
        accuracy: total ? Math.round((correct / total) * 100) : 0,
        savedMcqs: savedResult.count || 0,
        aiTests: testsResult.count || 0,
        battlesPlayed: battlesResult.data?.length || 0,
        battlesWon: (battlesResult.data || []).filter((battle) => battle.rank === 1).length,
      },
      subjects,
    };
  }, [profile?.institute, profile?.program_code, profile?.year, rawUserPlan, userId]);

  const requestAnalyticsPlan = useCallback(async () => {
    if (!userId || analyticsPlanLoading) return;
    if (isOfflineMode) {
      toast({
        title: 'AI analysis unavailable offline',
        description: 'Connect to the internet and try again.',
        variant: 'destructive',
      });
      return;
    }

    setAnalyticsPlanLoading(true);
    try {
      const analytics = await buildAnalyticsPayload();
      if (!analytics) return;
      const plan = await aiApiJson<AnalyticsPlan>('analytics-plan', { analytics }, {});
      const nextPlan = { ...plan, generatedAt: new Date().toISOString() };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('user_analytics_ai_plans') as any)
        .upsert({
          user_id: userId,
          plan_payload: nextPlan,
          analytics_snapshot: analytics,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
      if (error) throw error;
      setAnalyticsPlan(nextPlan);
      queryClient.invalidateQueries({ queryKey: ['dashboard-ai-usage-summary', userId, rawUserPlan] });
      queryClient.invalidateQueries({ queryKey: ['analytics-ai-plan', userId] });
      toast({ title: 'AI analysis ready', description: 'Dr Ahroid updated your study strategy.' });
    } catch (error) {
      if (!(error instanceof AiApiError && (error.status === 403 || error.status === 429))) {
        toast({
          title: 'AI analysis unavailable',
          description: error instanceof Error ? error.message : 'Dr Ahroid could not analyze your stats right now.',
          variant: 'destructive',
        });
      }
    } finally {
      setAnalyticsPlanLoading(false);
    }
  }, [analyticsPlanLoading, buildAnalyticsPayload, isOfflineMode, queryClient, rawUserPlan, toast, userId]);

  return {
    analyticsPlan,
    analyticsPlanLoading,
    aiUsageSummary: aiUsageSummaryQuery.data,
    aiUsageSummaryLoading: aiUsageSummaryQuery.isLoading,
    requestAnalyticsPlan,
  };
}
