import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getProfileFieldsCompletion } from '@/utils/profileCompletion';
import type { Institute } from '@/utils/institutes';
import {
  cacheProfile,
  calculateCurrentStreak,
  getEmptyUserStats,
  parseDashboardNotice,
  readCachedProfile,
} from '../dashboardService';
import type {
  Announcement,
  CaseOfDay,
  DashboardAnnouncement,
  DashboardPromotion,
  DashboardProfile,
  HmacsProduct,
  TermOfDay,
  UserStats,
  WhatsNewItem,
} from '../types';

type DashboardBootstrap = {
  institute: Institute | null;
  components: NonNullable<Institute['dashboard_components']>;
  contentVersion: number;
};

const resolveLegacyComponents = (
  institute: Institute | null,
  programCode?: string | null,
): DashboardBootstrap['components'] => {
  const configured = institute?.dashboard_components;
  const program = String(programCode || 'mbbs').trim().toLowerCase();
  const overrides = configured?.programs?.[program];

  return {
    mcqs: overrides?.mcqs ?? configured?.mcqs ?? true,
    past_papers: overrides?.past_papers ?? configured?.past_papers ?? true,
    seqs: overrides?.seqs ?? configured?.seqs ?? false,
    viva: overrides?.viva ?? configured?.viva ?? false,
  };
};

type UseDashboardDataOptions = {
  userId?: string;
  isOfflineMode: boolean;
  loadWhatsNew: boolean;
  loadSecondaryData: boolean;
};

const normalizeTargetValue = (value?: string | null) => String(value || '').trim().toLowerCase();

const matchesDashboardTarget = (targets: string[] | null | undefined, value?: string | null) => {
  const normalizedTargets = Array.isArray(targets) && targets.length > 0
    ? targets.map(item => normalizeTargetValue(item)).filter(Boolean)
    : ['all'];
  const normalizedValue = normalizeTargetValue(value);

  return normalizedTargets.includes('all') || (!!normalizedValue && normalizedTargets.includes(normalizedValue));
};

export function useDashboardData({
  userId,
  isOfflineMode,
  loadWhatsNew,
  loadSecondaryData,
}: UseDashboardDataOptions) {
  const queryClient = useQueryClient();

  const profileQuery = useQuery<DashboardProfile | null>({
    queryKey: ['dashboard-entry-profile', userId, isOfflineMode],
    queryFn: async ({ signal }) => {
      if (!userId) return null;
      if (isOfflineMode) return readCachedProfile(userId);
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 10000);
      const abortRequest = () => controller.abort();
      signal.addEventListener('abort', abortRequest, { once: true });
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, avatar_url, full_name, updated_at, username, plan, year, program_code, email, plan_expiry_date, role, institute, daily_mcq_submissions, heard_about_us')
          .eq('id', userId)
          .abortSignal(controller.signal)
          .maybeSingle();
        if (error) throw error;
        const profile = data as DashboardProfile | null;
        cacheProfile(userId, profile);
        return profile;
      } finally {
        window.clearTimeout(timeoutId);
        signal.removeEventListener('abort', abortRequest);
      }
    },
    enabled: !!userId,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    retry: false,
  });

  const userStatsQuery = useQuery<UserStats | null>({
    queryKey: ['user-stats', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data: aggregate, error: aggregateError } = await (supabase as any)
        .rpc('get_dashboard_user_stats');

      if (!aggregateError && aggregate) {
        return {
          totalQuestions: Number(aggregate.total_questions || 0),
          correctAnswers: Number(aggregate.correct_answers || 0),
          accuracy: Number(aggregate.accuracy || 0),
          currentStreak: Number(aggregate.current_streak || 0),
          rankPoints: Number(aggregate.correct_answers || 0) * 10
            + Number(aggregate.current_streak || 0) * 5
            + Number(aggregate.accuracy || 0),
          battlesWon: Number(aggregate.battles_won || 0),
          totalBattles: Number(aggregate.total_battles || 0),
          savedQuestions: Number(aggregate.saved_questions || 0),
        } satisfies UserStats;
      }

      // Older deployments already expose a smaller stats RPC. Use it while the
      // Dashboard-specific RPC migration rolls out instead of downloading history.
      const [{ data: legacyStats, error: legacyStatsError }, winsResult, statsBattlesResult, statsSavedResult, answersResult] = await Promise.all([
        (supabase as any).rpc('get_user_stats', { p_user_id: userId }),
        supabase.from('battle_results').select('rank', { count: 'exact', head: true }).eq('user_id', userId).eq('rank', 1),
        supabase.from('battle_results').select('rank', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('saved_mcqs').select('*', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('user_answers').select('created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(60),
      ]);
      if (!legacyStatsError && legacyStats) {
        const totalQuestions = Number(legacyStats.total_questions || 0);
        const correctAnswers = Number(legacyStats.correct_answers || 0);
        const accuracy = Number(legacyStats.accuracy || 0);
        // Compute strict consecutive streak from recent answers to avoid legacy SQL aggregate bugs
        const currentStreak = answersResult?.data && answersResult.data.length > 0
          ? calculateCurrentStreak(answersResult.data.map(a => a.created_at))
          : Math.min(Number(legacyStats.current_streak || 0), 1);
        return {
          totalQuestions,
          correctAnswers,
          accuracy,
          currentStreak,
          rankPoints: correctAnswers * 10 + currentStreak * 5 + accuracy,
          battlesWon: winsResult.count || 0,
          totalBattles: statsBattlesResult.count || 0,
          savedQuestions: statsSavedResult.count || 0,
        };
      }

      // Final compatibility fallback for environments without either stats RPC.
      const { data: answers, error: answersError } = await supabase
        .from('user_answers')
        .select('is_correct, created_at')
        .eq('user_id', userId);
      if (answersError) return getEmptyUserStats();

      const totalQuestions = answers?.length || 0;
      const correctAnswers = answers?.filter((answer) => answer.is_correct).length || 0;
      const accuracy = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
      const currentStreak = calculateCurrentStreak((answers || []).map((answer) => answer.created_at));

      const [battlesResult, savedResult] = await Promise.all([
        supabase.from('battle_results').select('rank').eq('user_id', userId),
        supabase.from('saved_mcqs').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      ]);
      const battles = battlesResult.data || [];
      return {
        totalQuestions,
        correctAnswers,
        accuracy,
        currentStreak,
        rankPoints: correctAnswers * 10 + currentStreak * 5 + accuracy,
        battlesWon: battles.filter((battle) => battle.rank === 1).length,
        totalBattles: battles.length,
        savedQuestions: savedResult.count || 0,
      };
    },
    enabled: !!userId && !isOfflineMode && profileQuery.isFetchedAfterMount
      && !profileQuery.isError && getProfileFieldsCompletion(profileQuery.data).complete,
    retry: 1,
    staleTime: 1000 * 60 * 5,
  });

  const announcementsQuery = useQuery<Announcement[]>({
    queryKey: ['announcements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('announcements')
        .select('id, title, content, media_url, created_at')
        .eq('is_published', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: loadSecondaryData && !isOfflineMode,
    staleTime: 1000 * 60 * 5,
  });

  const whatsNewQuery = useQuery<WhatsNewItem[]>({
    queryKey: ['whats-new'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('setting_value')
        .eq('setting_name', 'whats_new')
        .maybeSingle();
      if (error) return [];
      try {
        return data?.setting_value ? JSON.parse(data.setting_value) : [];
      } catch {
        return [];
      }
    },
    enabled: loadWhatsNew && !isOfflineMode,
    staleTime: 1000 * 60 * 10,
  });

  const dashboardNoticeQuery = useQuery<string>({
    queryKey: ['dashboard-notice-line'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('setting_value')
        .eq('setting_name', 'dashboard_notice_line')
        .maybeSingle();
      if (error) return '';
      return parseDashboardNotice(data?.setting_value);
    },
    enabled: loadSecondaryData && !isOfflineMode,
    staleTime: 1000 * 60 * 2,
  });

  const readAnnouncementsQuery = useQuery<string[]>({
    queryKey: ['readAnnouncements', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('user_announcements')
        .select('announcement_id')
        .eq('user_id', userId);
      if (error) return [];
      return data.map((item) => item.announcement_id);
    },
    enabled: !!userId && loadSecondaryData && !isOfflineMode,
    staleTime: 1000 * 60 * 5,
  });

  const userYear = profileQuery.data?.year || null;
  const termQuery = useQuery<TermOfDay | null>({
    queryKey: ['termOfDay', userYear],
    queryFn: async () => {
      let query = supabase.from('term_of_day').select('*').order('created_at', { ascending: false }).limit(1);
      if (userYear) query = query.eq('year', userYear);
      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      return data as TermOfDay | null;
    },
    enabled: loadSecondaryData && !isOfflineMode,
    staleTime: 1000 * 60 * 15,
    retry: 1,
  });

  const caseQuery = useQuery<CaseOfDay | null>({
    queryKey: ['caseOfDay', userYear],
    queryFn: async () => {
      let query = supabase.from('case_of_day').select('*').order('created_at', { ascending: false }).limit(1);
      if (userYear) query = query.eq('year', userYear);
      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      return data as CaseOfDay | null;
    },
    enabled: loadSecondaryData && !isOfflineMode,
    staleTime: 1000 * 60 * 15,
    retry: 1,
  });

  const instituteQuery = useQuery<DashboardBootstrap | null>({
    queryKey: ['dashboard-bootstrap', profileQuery.data?.institute, profileQuery.data?.program_code, profileQuery.data?.year],
    queryFn: async () => {
      const instituteCode = profileQuery.data?.institute;
      if (!instituteCode) return null;

      // One server RPC resolves the programme override and the persisted
      // content snapshot. It replaces a client-side chapter-count fan-out.
      const { data: bootstrap, error: bootstrapError } = await (supabase as any)
        .rpc('get_dashboard_content_capabilities');
      if (!bootstrapError && bootstrap && typeof bootstrap === 'object') {
        return {
          institute: (bootstrap.institute || null) as Institute | null,
          components: (bootstrap.components || {}) as DashboardBootstrap['components'],
          contentVersion: Number(bootstrap.content_version || 0),
        };
      }

      // Compatibility fallback while the database migration rolls out.
      const { data, error } = await supabase
        .from('institutes')
        .select('*')
        .eq('code', instituteCode)
        .maybeSingle();
      if (error) throw error;
      const institute = data as Institute | null;
      return {
        institute,
        components: resolveLegacyComponents(institute, profileQuery.data?.program_code),
        contentVersion: 0,
      };
    },
    enabled: !isOfflineMode && profileQuery.isFetchedAfterMount
      && !profileQuery.isError && getProfileFieldsCompletion(profileQuery.data).complete,
    staleTime: 1000 * 60 * 30,
    retry: 1,
  });

  const dashboardAnnouncementsQuery = useQuery<DashboardAnnouncement[]>({
    queryKey: ['dashboardAnnouncements', profileQuery.data?.institute, profileQuery.data?.year],
    queryFn: async () => {
      // Select all columns so environments where the optional `years`
      // targeting column has not been migrated still succeed.
      const { data, error } = await supabase
        .from('dashboard_announcements')
        .select('*')
        .eq('is_published', true)
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: false });
      if (error) return [];
      return (data || []).filter((announcement) =>
        matchesDashboardTarget(announcement.institutes, profileQuery.data?.institute)
        && matchesDashboardTarget(announcement.years, profileQuery.data?.year),
      );
    },
    enabled: !!userId && loadSecondaryData && !isOfflineMode,
    staleTime: 1000 * 60 * 5,
  });

  const hmacsProductsQuery = useQuery<HmacsProduct[]>({
    queryKey: ['hmacs-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hmacs_products')
        .select('*')
        .eq('is_published', true)
        .order('sr_no', { ascending: true });
      if (error) return [];
      return (data || []) as HmacsProduct[];
    },
    enabled: !!userId && loadSecondaryData && !isOfflineMode,
    staleTime: 1000 * 60 * 5,
  });

  const dashboardPromotionsQuery = useQuery<DashboardPromotion[]>({
    queryKey: ['dashboard-promotions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dashboard_promotions')
        .select('id, title, subtitle, image_url, target_url, action_type, display_order')
        .eq('enabled', true)
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) return [];
      return (data || []) as DashboardPromotion[];
    },
    enabled: !!userId && loadSecondaryData && !isOfflineMode,
    staleTime: 1000 * 60 * 5,
  });

  const markAnnouncementsRead = useMutation({
    mutationFn: async (announcementIds: string[]) => {
      if (!userId || !announcementIds.length) return;
      const records = announcementIds.map((announcementId) => ({
        user_id: userId,
        announcement_id: announcementId,
      }));
      const { error } = await supabase
        .from('user_announcements')
        .upsert(records, { onConflict: 'user_id, announcement_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['readAnnouncements', userId] });
    },
  });

  return {
    profileQuery,
    userStatsQuery,
    announcementsQuery,
    whatsNewQuery,
    dashboardNoticeQuery,
    readAnnouncementsQuery,
    termQuery,
    caseQuery,
    instituteQuery,
    dashboardAnnouncementsQuery,
    dashboardPromotionsQuery,
    hmacsProductsQuery,
    markAnnouncementsRead,
  };
}
