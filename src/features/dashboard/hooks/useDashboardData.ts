import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchInstitutes, getInstituteByCode } from '@/utils/institutes';
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
  const [profileVerifiedFromServer, setProfileVerifiedFromServer] = useState(false);

  useEffect(() => {
    setProfileVerifiedFromServer(false);
  }, [userId]);

  const profileQuery = useQuery<DashboardProfile | null>({
    queryKey: ['profile', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('id, avatar_url, full_name, updated_at, username, plan, year, email, plan_expiry_date, role, institute, daily_mcq_submissions, heard_about_us')
        .eq('id', userId)
        .maybeSingle();
      if (error) throw error;
      const profile = data as DashboardProfile | null;
      setProfileVerifiedFromServer(true);
      cacheProfile(userId, profile);
      return profile;
    },
    enabled: !!userId,
    initialData: () => readCachedProfile(userId),
    retry: 1,
  });

  const userStatsQuery = useQuery<UserStats | null>({
    queryKey: ['user-stats', userId],
    queryFn: async () => {
      if (!userId) return null;
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
    enabled: !!userId && !isOfflineMode,
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

  const instituteQuery = useQuery({
    queryKey: ['instituteData', profileQuery.data?.institute],
    queryFn: async () => {
      const instituteCode = profileQuery.data?.institute;
      if (!instituteCode) return null;
      const institutes = await fetchInstitutes({ force: true });
      return getInstituteByCode(instituteCode, institutes) || null;
    },
    enabled: !!profileQuery.data?.institute,
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
    profileVerifiedFromServer,
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
