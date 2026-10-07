import { useAuth } from '@/hooks/useAuth';
import { SignOutConfirmModal } from '@/components/auth/SignOutConfirmModal';
import {
  BellNavIcon,
  ChartDonutNavIcon,
  HomeNavIcon,
  TrophyNavIcon,
  UserNavIcon,
} from '@/components/ui/TabIcons';
import { Home, Megaphone, PieChart, Trophy, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { supabase } from '@/integrations/supabase/client';
import { lazy, Suspense, useEffect, useMemo, useState, type ComponentType } from 'react';
import Seo from '@/components/Seo';
import AppTransitionScreen from '@/components/AppTransitionScreen';

import VersionGuard from '@/components/VersionControl';
import { initializeOtaUpdates } from '@/services/otaUpdateService';
import { isSpecializedTestCode } from '@/utils/institutes';
import { getProfileCompletion } from '@/utils/profileCompletion';
import { useCachedImage } from '@/hooks/useCachedImage';
import { useToast } from '@/hooks/use-toast';
import {
  getInstituteActions,
  getPersonalizationActions,
  getPremiumActions,
  getQuickActions,
} from '@/features/dashboard/dashboardActions';
import { DASHBOARD_APP_VERSION } from '@/features/dashboard/constants';
import { getDashboardGreeting } from '@/features/dashboard/dashboardService';
import { useDashboardData } from '@/features/dashboard/hooks/useDashboardData';
import { useDashboardAnalyticsPlan } from '@/features/dashboard/hooks/useDashboardAnalyticsPlan';
import { HomeDashboardTab } from '@/features/dashboard/components/HomeDashboardTab';
import { DashboardHeader } from '@/features/dashboard/components/DashboardHeader';
import {
  DashboardBottomNavigation,
  type DashboardNavigationItem,
} from '@/features/dashboard/components/DashboardBottomNavigation';
import { UsageLimitsSheet } from '@/features/dashboard/components/UsageLimitsSheet';
import type { DashboardAnnouncement, DashboardTabId } from '@/features/dashboard/types';
import { prepareMCQQuiz } from '@/features/mcq/quizBootstrap';
import { fetchSubjects } from '@/utils/mcqData';
import { isConstrainedConnection } from '@/utils/networkQuality';

const lazyWithRetry = <T extends { default: ComponentType<any> }>(
  loader: () => Promise<T>,
  retries = 2,
): Promise<T> =>
  loader().catch((error) => {
    if (retries <= 0) throw error;
    return new Promise<T>((resolve) => {
      window.setTimeout(resolve, 350);
    }).then(() => lazyWithRetry(loader, retries - 1));
  });

const LazyLeaderboardPreview = lazy(() =>
  lazyWithRetry(() =>
  import('@/components/dashboard/LeaderboardPreview').then((module) => ({
    default: module.LeaderboardPreview,
  })))
);
const LazyAnnouncementsDashboardTab = lazy(() =>
  lazyWithRetry(() =>
  import('@/features/dashboard/components/AnnouncementsDashboardTab').then((module) => ({
    default: module.AnnouncementsDashboardTab,
  })))
);
const LazyAnalyticsDashboardTab = lazy(() =>
  lazyWithRetry(() =>
  import('@/features/dashboard/components/AnalyticsDashboardTab').then((module) => ({
    default: module.AnalyticsDashboardTab,
  })))
);
const LazyProfileDashboardTab = lazy(() =>
  lazyWithRetry(() =>
  import('@/features/dashboard/components/ProfileDashboardTab').then((module) => ({
    default: module.ProfileDashboardTab,
  })))
);
const LazyDashboardDialogs = lazy(() =>
  lazyWithRetry(() =>
  import('@/features/dashboard/components/DashboardDialogs').then((module) => ({
    default: module.DashboardDialogs,
  })))
);
const LazyTabFallback = ({ className = 'h-32' }: { className?: string }) => (
  <div className={`animate-pulse rounded-2xl border border-border/30 bg-muted/30 ${className}`} />
);

const Dashboard = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<DashboardTabId>('home');
  const [isNavigating, setIsNavigating] = useState(true);
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [showTermOfDay, setShowTermOfDay] = useState(false);
  const [showCaseOfDay, setShowCaseOfDay] = useState(false);
  const [showCollaborateModal, setShowCollaborateModal] = useState(false);
  const [showUsageLimits, setShowUsageLimits] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [selectedDashboardAnnouncement, setSelectedDashboardAnnouncement] = useState<DashboardAnnouncement | null>(null);
  const dashboardModalOpen = showWhatsNew || showTermOfDay || showCaseOfDay || showCollaborateModal || !!selectedDashboardAnnouncement;
  const appVersion = DASHBOARD_APP_VERSION;
  const [isOfflineMode, setIsOfflineMode] = useState(() => typeof navigator !== 'undefined' ? !navigator.onLine : false);
  const [loadSecondaryData, setLoadSecondaryData] = useState(false);

  const {
    profileQuery: {
      data: profile,
      isLoading: profileLoading,
      isFetchedAfterMount: profileFetchedAfterMount,
      isError: profileFetchFailed,
    },
    profileVerifiedFromServer,
    userStatsQuery: { data: userStats, isLoading: userStatsLoading },
    announcementsQuery: { data: announcements, isLoading: announcementsLoading },
    whatsNewQuery: { data: whatsNewContent, isLoading: whatsNewLoading },
    dashboardNoticeQuery: { data: dashboardNoticeLine },
    readAnnouncementsQuery: { data: readAnnouncements },
    termQuery: { data: termOfDay, isLoading: termLoading },
    caseQuery: { data: caseOfDay, isLoading: caseLoading },
    instituteQuery: { data: instituteData, isLoading: instituteDataLoading },
    dashboardAnnouncementsQuery: { data: dashboardAnnouncements = [] },
    dashboardPromotionsQuery: { data: dashboardPromotions = [] },
    hmacsProductsQuery: { data: hmacsProducts = [] },
    markAnnouncementsRead,
  } = useDashboardData({
    userId: user?.id,
    isOfflineMode,
    loadWhatsNew: showWhatsNew,
    loadSecondaryData,
  });

  const waitingForLiveProfileConfirmation = !!user && !profile && !profileFetchFailed && (
    profileLoading || !profileFetchedAfterMount || !profileVerifiedFromServer
  );
  const dashboardComponents = instituteData?.dashboard_components || { mcqs: true, seqs: false, viva: false };


  useEffect(() => {
    (window as any).__currentDashboardTab = activeTab;
    document.body.dataset.dashboardTab = activeTab;
  }, [activeTab]);

  useEffect(() => {
    const handleSwitchTab = (e: CustomEvent) => {
      if (e.detail) setActiveTab(e.detail as DashboardTabId);
    };
    const handleCloseModals = () => {
      setShowUsageLimits(false);
      setShowCaseOfDay(false);
      setShowTermOfDay(false);
      setShowWhatsNew(false);
      setShowCollaborateModal(false);
      setSelectedDashboardAnnouncement(null);
    };

    window.addEventListener('switch-dashboard-tab', handleSwitchTab as EventListener);
    window.addEventListener('close-dashboard-modals', handleCloseModals);

    return () => {
      window.removeEventListener('switch-dashboard-tab', handleSwitchTab as EventListener);
      window.removeEventListener('close-dashboard-modals', handleCloseModals);
    };
  }, []);

  useEffect(() => {
    const updateOnlineState = () => setIsOfflineMode(!navigator.onLine);
    updateOnlineState();
    window.addEventListener('online', updateOnlineState);
    window.addEventListener('offline', updateOnlineState);
    return () => {
      window.removeEventListener('online', updateOnlineState);
      window.removeEventListener('offline', updateOnlineState);
    };
  }, []);

  useEffect(() => {
    if (isNavigating || !user) return;
    setLoadSecondaryData(true);
  }, [isNavigating, user]);

  useEffect(() => {
    if (isNavigating || !user?.id || isOfflineMode || isConstrainedConnection()) return;

    const prefetchTimer = window.setTimeout(() => {
      void fetchSubjects().catch(() => undefined);

      try {
        const savedSessions = JSON.parse(
          localStorage.getItem('mcq_saved_sessions') || '[]',
        ) as Array<{ chapterId?: string; timestamp?: string }>;
        const likelySession = savedSessions
          .filter(session => session.chapterId)
          .sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')))[0];

        if (likelySession?.chapterId) {
          void prepareMCQQuiz({
            chapterId: likelySession.chapterId,
            userId: user.id,
          }).catch(() => undefined);
        }
      } catch {
        // Prefetch is opportunistic and must never delay the dashboard.
      }
    }, 750);

    return () => window.clearTimeout(prefetchTimer);
  }, [isNavigating, isOfflineMode, user?.id]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login', { replace: true });
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (activeTab === 'announcements' && user && announcements?.length) {
      markAnnouncementsRead.mutate(announcements.map((announcement) => announcement.id));
    }
  }, [activeTab, announcements, markAnnouncementsRead, user]);

  useEffect(() => {
    if (authLoading || waitingForLiveProfileConfirmation) { setIsNavigating(true); return; }
    if (!user) { setIsNavigating(false); return; }

    if (profileFetchFailed) {
      const canUseCachedProfile = typeof navigator !== 'undefined' && !navigator.onLine && !!profile;
      if (canUseCachedProfile) {
        setIsNavigating(false);
        return;
      }
      navigate('/setup', { replace: true });
      return;
    }

    if (profile === undefined) {
      setIsNavigating(true);
      return;
    }

    if (!profileVerifiedFromServer && !profile) {
      setIsNavigating(true);
      return;
    }

    if (!profile) {
      navigate('/setup', { replace: true });
      return;
    }

    if (profile?.institute && instituteDataLoading) {
      setIsNavigating(true);
      return;
    }

    const isOnline = typeof navigator === 'undefined' || navigator.onLine;
    if (isOnline && profile?.institute && !instituteData && !isSpecializedTestCode(profile.institute)) {
      navigate('/setup', { replace: true });
      return;
    }

    if (!getProfileCompletion(profile, instituteData ? [instituteData] : []).complete) {
      navigate('/setup', { replace: true });
      return;
    }

    setIsNavigating(false);
  }, [authLoading, waitingForLiveProfileConfirmation, profileFetchFailed, profileVerifiedFromServer, user, profile, instituteData, instituteDataLoading, navigate]);

  const quickActions = useMemo(getQuickActions, []);
  const personalizationActions = useMemo(getPersonalizationActions, []);
  const premiumPerks = useMemo(getPremiumActions, []);
  const isSpecializedTest = isSpecializedTestCode(profile?.institute);
  const instituteModules = getInstituteActions(dashboardComponents, isSpecializedTest);

  const displayName = profile?.full_name || profile?.username || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Medmacs User';
  const greetingMessage = useMemo(
    () => getDashboardGreeting(displayName, user?.id),
    [displayName, user?.id],
  );
  const rawUserPlan = profile?.plan?.toLowerCase() || 'free';
  const userPlanDisplayName = rawUserPlan.charAt(0).toUpperCase() + rawUserPlan.slice(1) + ' Plan';
  const analyticsPlanCadence = rawUserPlan === 'premium'
    ? 'every day'
    : rawUserPlan === 'iconic'
      ? 'every 3 days'
      : 'once a week';
  const {
    analyticsPlan,
    analyticsPlanLoading,
    aiUsageSummary,
    aiUsageSummaryLoading,
    requestAnalyticsPlan,
  } = useDashboardAnalyticsPlan({
    userId: user?.id,
    profile,
    rawUserPlan,
    isOfflineMode,
    loadAnalyticsPlan: activeTab === 'analytics',
    toast,
  });
  const dashboardAnnouncement = dashboardAnnouncements[0] || null;
  const cachedAvatarUrl = useCachedImage(profile?.avatar_url);

  useEffect(() => {
    initializeOtaUpdates();
  }, []);

  if (isNavigating || authLoading || waitingForLiveProfileConfirmation) {
    return <AppTransitionScreen />;
  }


  if (!user) {
    return <AppTransitionScreen />;
  }


  const unreadCount = (announcements && readAnnouncements)
    ? announcements.filter(a => !readAnnouncements.includes(a.id)).length : 0;

  const tabs: DashboardNavigationItem[] = [
    { id: 'home', label: 'Home', icon: HomeNavIcon as any },
    { id: 'leaderboard', label: 'Ranks', icon: TrophyNavIcon as any },
    { id: 'analytics', label: 'Stats', icon: ChartDonutNavIcon as any },
    { id: 'profile', label: 'Profile', icon: UserNavIcon as any, avatarUrl: cachedAvatarUrl },
  ];

  const handleLogout = () => {
    setShowSignOutConfirm(true);
  };

  const handleConfirmSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
    } finally {
      setIsSigningOut(false);
      setShowSignOutConfirm(false);
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'announcements':
        return (
          <Suspense fallback={<LazyTabFallback className="h-[420px]" />}>
            <LazyAnnouncementsDashboardTab
              announcements={announcements}
              isLoading={announcementsLoading}
            />
          </Suspense>
        );

      case 'leaderboard':
        return (
          <div>
            <h1 className="text-xl font-bold text-foreground mb-1">🏆 Leaderboard</h1>
            <p className="text-xs text-muted-foreground mb-5">See where you rank</p>
            <Suspense fallback={<LazyTabFallback className="h-[520px]" />}>
              <LazyLeaderboardPreview />
            </Suspense>
          </div>
        );

      case 'analytics':
        return (
          <Suspense fallback={<LazyTabFallback className="h-[620px]" />}>
            <LazyAnalyticsDashboardTab
              userId={user?.id}
              isOfflineMode={isOfflineMode}
              analyticsPlan={analyticsPlan}
              analyticsPlanLoading={analyticsPlanLoading}
              analyticsPlanCadence={analyticsPlanCadence}
              onRequestPlan={requestAnalyticsPlan}
              onNavigateToMcqs={() => navigate('/mcqs')}
              onNavigateToDetails={() => navigate('/detailed-analytics')}
            />
          </Suspense>
        );

      case 'profile':
        return (
          <Suspense fallback={<LazyTabFallback className="h-[620px]" />}>
            <LazyProfileDashboardTab
              userId={user?.id}
              email={user?.email}
              displayName={displayName}
              cachedAvatarUrl={cachedAvatarUrl}
              userPlanDisplayName={userPlanDisplayName}
              aiUsageSummary={aiUsageSummary}
              aiUsageSummaryLoading={aiUsageSummaryLoading}
              isOfflineMode={isOfflineMode}
              theme={theme}
              onThemeChange={setTheme}
              onShowWhatsNew={() => setShowWhatsNew(true)}
              onOpenUsageLimits={() => setShowUsageLimits(true)}
              onLogout={handleLogout}
            />
          </Suspense>
        );

      case 'home':
      default:
        return (
          <HomeDashboardTab
            greetingMessage={greetingMessage}
            displayName={displayName}
            dashboardNoticeLine={dashboardNoticeLine}
            isOfflineMode={isOfflineMode}
            userStats={userStats}
            userStatsLoading={userStatsLoading}
            quickActions={quickActions}
            rawUserPlan={rawUserPlan}
            profile={profile}
            aiUsageSummary={aiUsageSummary}
            aiUsageSummaryLoading={aiUsageSummaryLoading}
            termOfDay={termOfDay}
            termLoading={termLoading}
            onOpenTerm={() => setShowTermOfDay(true)}
            onOpenUsageLimits={() => setShowUsageLimits(true)}
            caseOfDay={caseOfDay}
            caseLoading={caseLoading}
            onOpenCase={() => setShowCaseOfDay(true)}
            instituteModules={instituteModules}
            dashboardAnnouncement={dashboardAnnouncement}
            onOpenAnnouncement={setSelectedDashboardAnnouncement}
            instituteData={instituteData}
            personalizationActions={personalizationActions}
            premiumPerks={premiumPerks}
            promotions={dashboardPromotions}
            hmacsProducts={hmacsProducts}
            onOpenCollaborate={() => setShowCollaborateModal(true)}
          />
        );
    }
  };

  return (
    <div className="dashboard-modern-font relative min-h-screen w-full overflow-x-hidden bg-gradient-to-b from-primary/10 via-background to-background pb-28 dark:from-background dark:via-background dark:to-background" style={{ WebkitOverflowScrolling: 'touch' }}>
      <Seo title="Dashboard" description="Your personalized Medmacs App dashboard." canonical="https://medmacs.app/dashboard" />
      <VersionGuard />

      {/* Minimal top bar with announcement icon */}
      <DashboardHeader
        displayName={displayName}
        userPlanDisplayName={userPlanDisplayName}
        cachedAvatarUrl={cachedAvatarUrl}
        unreadCount={unreadCount}
        onOpenAnnouncements={() => navigate('/announcements')}
      />
      {/* Content */}
      <div className="px-5 mt-[var(--header-height)]">
        {renderTabContent()}
      </div>

      {dashboardModalOpen && (
        <Suspense fallback={null}>
          <LazyDashboardDialogs
            appVersion={appVersion}
            showWhatsNew={showWhatsNew}
            onShowWhatsNewChange={setShowWhatsNew}
            whatsNewContent={whatsNewContent}
            whatsNewLoading={whatsNewLoading}
            showTermOfDay={showTermOfDay}
            onShowTermOfDayChange={setShowTermOfDay}
            termOfDay={termOfDay}
            selectedAnnouncement={selectedDashboardAnnouncement}
            onSelectedAnnouncementChange={setSelectedDashboardAnnouncement}
            showCollaborate={showCollaborateModal}
            onShowCollaborateChange={setShowCollaborateModal}
            showCaseOfDay={showCaseOfDay}
            onShowCaseOfDayChange={setShowCaseOfDay}
            caseOfDay={caseOfDay}
            isPremium={rawUserPlan === 'premium'}
            onNavigateToChat={(text) => navigate('/ai/chatbot', { state: { prefilledText: text } })}
            onNavigateToPricing={() => navigate('/pricing')}
          />
        </Suspense>
      )}

      {/* Premium bottom tab bar — active tab expands with label */}
      <DashboardBottomNavigation
        activeTab={activeTab}
        items={tabs}
        onTabChange={setActiveTab}
      />

      <UsageLimitsSheet
        open={showUsageLimits}
        onOpenChange={setShowUsageLimits}
        userId={user?.id}
        rawUserPlan={rawUserPlan}
        userPlanDisplayName={userPlanDisplayName}
      />

      <SignOutConfirmModal
        open={showSignOutConfirm}
        onOpenChange={setShowSignOutConfirm}
        onConfirm={handleConfirmSignOut}
        isSigningOut={isSigningOut}
      />

    </div>
  );
};

export default Dashboard;
