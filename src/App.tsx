import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter as Router, Navigate, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConsentProvider } from '@/components/consent/ConsentProvider';
import { ThemeProvider, useTheme } from 'next-themes';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as SonnerToaster } from '@/components/ui/sonner';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor, registerPlugin } from '@capacitor/core';

// Internal Components & Pages
import BackHandler from "@/components/backhandler";
import ScrollToTop from "@/components/ScrollToTop";
import ConnectionStatusModal from "@/components/ConnectionStatusModal";
import AppTransitionScreen from '@/components/AppTransitionScreen';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import BlockedUserOverlay from '@/components/auth/BlockedUserOverlay';
import { useQuery } from '@tanstack/react-query';
import OtaUpdateScreen from '@/components/OtaUpdateScreen';
import OtaDiagnosticsPanel from '@/components/OtaDiagnosticsPanel';
import DeviceActivityTracker from '@/components/auth/DeviceActivityTracker';
import UpgradeAccountModal from '@/components/UpgradeAccountModal';
import FeatureGate from '@/components/auth/FeatureGate';
import { setOnAiLimitError, type AiApiError } from '@/utils/aiApi';

type InstallStatePluginApi = {
  consumeFreshInstall: () => Promise<{ freshInstall: boolean }>;
};

const InstallState = registerPlugin<InstallStatePluginApi>('InstallState');

const Index = lazy(() => import('@/pages/Index'));
const Login = lazy(() => import('@/pages/Login'));
const Signup = lazy(() => import('@/pages/Signup'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const MCQSubjectSelectionPage = lazy(() => import('@/pages/mcq/MCQSubjectSelectionPage'));
const MCQChapterSelectionPage = lazy(() => import('@/pages/mcq/MCQChapterSelectionPage'));
const MCQSettingsPage = lazy(() => import('@/pages/mcq/MCQSettingsPage'));
const MCQQuizPage = lazy(() => import('@/pages/mcq/MCQQuizPage'));
const ChapterLocks = lazy(() => import('@/pages/admin/ChapterLocks'));
const OtaUpdates = lazy(() => import('@/pages/admin/OtaUpdates'));
const Battle = lazy(() => import('@/pages/Battle'));
const AI = lazy(() => import('@/pages/AI'));
const AITestGeneratorPage = lazy(() => import('@/pages/AITestGenerator'));
const AIChatbotPage = lazy(() => import('@/pages/AIChatbot'));
const Leaderboard = lazy(() => import('@/pages/Leaderboard'));
const Profile = lazy(() => import('@/pages/Profile'));
const Devices = lazy(() => import('@/pages/Devices'));
const BadgesPage = lazy(() => import('@/pages/BadgesPage'));
const Pricing = lazy(() => import('@/pages/Pricing'));
const TermsAndConditions = lazy(() => import('@/pages/TermsAndConditions'));
const PrivacyPolicy = lazy(() => import('@/pages/PrivacyPolicy'));
const RefundPolicy = lazy(() => import('@/pages/RefundPolicy'));
const DMCAPolicy = lazy(() => import('@/pages/DMCAPolicy'));
const Checkout = lazy(() => import('@/pages/Checkout'));
const NotFound = lazy(() => import('@/pages/NotFound'));
const ChangePassword = lazy(() => import('@/pages/ChangePassword'));
const MockTest = lazy(() => import('@/pages/MockTest'));
const TestCompletionPage = lazy(() => import('@/pages/TestCompletion'));
const VerifyEmail = lazy(() => import('@/pages/VerifyEmail'));
const UsernamePage = lazy(() => import('@/pages/UsernamePage'));
const AllSetPage = lazy(() => import('@/pages/AllSetPage'));
const MockTestResults = lazy(() => import('@/pages/MockTestResults'));
const TestCompletion = lazy(() => import('@/pages/TestResults'));
const Career = lazy(() => import('@/pages/Career'));
const TeachingAmbassadors = lazy(() => import('@/pages/TeachingAmbassadors'));
const InternshipApplication = lazy(() => import('@/pages/InternshipApplication'));
const SavedMCQsPage = lazy(() => import('@/pages/SavedMCQsPage'));
const MistakeBookPage = lazy(() => import('@/pages/MistakeBookPage'));
const SmartDeckPage = lazy(() => import('@/pages/SmartDeckPage'));
const LearnWithAIPage = lazy(() => import('@/pages/LearnWithAIPage'));
const Announcements = lazy(() => import('@/pages/Announcements'));
const ContactUsPage = lazy(() => import('@/pages/ContactUsPage'));
const FLP = lazy(() => import('@/pages/FLP'));
const FLPResults = lazy(() => import('@/pages/FLPResults'));
const FLPResultDetail = lazy(() => import('@/components/FLPResultDetail'));
const FLPTestPage = lazy(() => import('@/pages/flp/FLPTestPage'));
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword'));
const UpdatePassword = lazy(() => import('@/pages/UpdatePassword'));
const SelectYear = lazy(() => import('@/pages/SelectYear'));
const Teams = lazy(() => import('@/pages/Team'));
const InstallApp = lazy(() => import('@/pages/InstallApp'));
const PracticalPage = lazy(() => import('@/pages/PracticalPage'));
const SEQSubjectSelectionPage = lazy(() => import('@/pages/seq/SEQSubjectSelectionPage'));
const SEQChapterSelectionPage = lazy(() => import('@/pages/seq/SEQChapterSelectionPage'));
const SEQQuizPage = lazy(() => import('@/pages/seq/SEQQuizPage'));
const RedeemCode = lazy(() => import('@/pages/RedeemCode'));
const Referrals = lazy(() => import('@/pages/Referrals'));
const PurchaseHistory = lazy(() => import('@/pages/PurchaseHistory'));
const PaymentFailure = lazy(() => import('@/pages/PaymentFailure'));
const PaymentSuccess = lazy(() => import('@/pages/PaymentSuccess'));
const Setup = lazy(() => import('@/pages/SetupPage'));
const DetailedAnalytics = lazy(() => import('@/pages/DetailedAnalytics'));
const AchievementUnlockNotifier = lazy(() =>
  import('@/components/profile/AchievementBadges').then((module) => ({
    default: module.AchievementUnlockNotifier,
  })),
);


const queryClient = new QueryClient();

type RestrictionDetails = {
  user_restricted: boolean;
  reason: string | null;
  duration: string | null;
  reviewed: boolean;
  decision: boolean;
  appeal?: string | null;
};

/**
 * StatusBarHandler: 
 * Watches for theme changes and updates the system icon colors.
 */
const StatusBarHandler = () => {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      // Style.Dark means light icons (for dark background)
      // Style.Light means dark icons (for light background)
      StatusBar.setStyle({
        style: resolvedTheme === 'dark' ? Style.Dark : Style.Light,
      }).catch((err) => console.warn('Status bar error', err));
    }
  }, [resolvedTheme]);

  return null;
};

/**
 * UserRestrictionHandler:
 * Monitors the current user's restriction status and displays the BlockedUserOverlay if needed.
 */
const UserRestrictionHandler = () => {
  const { user, signOut } = useAuth();

  const { data: restrictionDetails, isLoading } = useQuery({
    queryKey: ['profile-restriction', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('restriction_details')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching restriction status:', error);
        return null;
      }
      
      return data?.restriction_details as unknown as RestrictionDetails | null;
    },
    enabled: !!user?.id,
    refetchInterval: 60000, // Check every minute
  });

  if (isLoading || !restrictionDetails || !restrictionDetails.user_restricted) {
    return null;
  }

  // Check if restriction is still active based on duration
  if (restrictionDetails.duration) {
    const unlockDate = new Date(restrictionDetails.duration);
    if (unlockDate < new Date()) {
      return null;
    }
  }

  return <BlockedUserOverlay details={restrictionDetails} onSignOut={signOut} userId={user.id} />;
};

const AchievementNotifierHandler = () => {
  const { user } = useAuth();
  if (!user?.id) return null;
  return (
    <Suspense fallback={null}>
      <AchievementUnlockNotifier userId={user.id} />
    </Suspense>
  );
};

const AiLimitHandler = () => {
  const [error, setError] = useState<AiApiError | null>(null);

  useEffect(() => {
    setOnAiLimitError((err: AiApiError) => setError(err));
    return () => setOnAiLimitError(null);
  }, []);

  return (
    <UpgradeAccountModal
      isOpen={!!error}
      onClose={() => setError(null)}
      limitError={error}
    />
  );
};

function App() {
  const [themeRestoreChecked, setThemeRestoreChecked] = useState(
    () => !Capacitor.isNativePlatform(),
  );

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let active = true;
    InstallState.consumeFreshInstall()
      .then(({ freshInstall }) => {
        if (freshInstall) {
          localStorage.removeItem('theme');
          document.documentElement.classList.remove('dark');
          document.documentElement.classList.add('light');
          document.documentElement.style.colorScheme = 'light';
        }
      })
      .catch((error) => {
        console.warn('Unable to verify restored theme state', error);
      })
      .finally(() => {
        if (active) setThemeRestoreChecked(true);
      });

    return () => {
      active = false;
    };
  }, []);

  if (!themeRestoreChecked) {
    return <div className="fixed inset-0 bg-white" aria-hidden="true" />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem
        themes={['light', 'dark']}
      >
        <StatusBarHandler />
        <OtaUpdateScreen />
        <OtaDiagnosticsPanel />

        <ConsentProvider><Router>
          {/* Crucial: The bg-background class here ensures the div 
              behind the status bar is dark as soon as the app loads.
          */}
          <div className="App min-h-screen w-full bg-background text-foreground transition-colors duration-300">
            <ScrollToTop />
              <BackHandler />
              <ConnectionStatusModal />
              <DeviceActivityTracker />
              <UserRestrictionHandler />
              <AchievementNotifierHandler />
              <AiLimitHandler />
              <Suspense fallback={<AppTransitionScreen />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/mcqs" element={<FeatureGate feature="mcqs"><MCQSubjectSelectionPage /></FeatureGate>} />
                <Route path="/mcqs/chapter/:subjectId" element={<FeatureGate feature="mcqs"><MCQChapterSelectionPage /></FeatureGate>} />
                <Route path="/mcqs/settings/:subjectId/:chapterId" element={<FeatureGate feature="mcqs"><MCQSettingsPage /></FeatureGate>} />
                <Route path="/mcqs/quiz/:subjectId/:chapterId" element={<FeatureGate feature="mcqs"><MCQQuizPage /></FeatureGate>} />
                <Route path="/medmacs-supers/chapter-locks" element={<ChapterLocks />} />
                <Route path="/medmacs-supers/updates" element={<OtaUpdates />} />
                <Route path="/battle" element={<FeatureGate feature="battle_mode"><Battle /></FeatureGate>} />
                <Route path="/ai" element={<FeatureGate feature="ai_tutor"><AI /></FeatureGate>} />
                <Route path="/ai/test-generator" element={<FeatureGate feature="ai_test_attempt"><AITestGeneratorPage /></FeatureGate>} />
                <Route path="/ai/chatbot" element={<FeatureGate feature="ai_tutor"><AIChatbotPage /></FeatureGate>} />
                <Route path="/leaderboard" element={<Leaderboard />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/profile/devices" element={<Devices />} />
                <Route path="/profile/badges" element={<BadgesPage />} />
                <Route path="/profile/password" element={<ChangePassword />} />
                <Route path="/profile/upgrade" element={<Profile />} />
                <Route path="/pricing" element={<Pricing />} />
                <Route path="/privacypolicy" element={<PrivacyPolicy />} />
                <Route path="/refund-policy" element={<RefundPolicy />} />
                <Route path="/dcma" element={<DMCAPolicy />} />
                <Route path="/dmca" element={<DMCAPolicy />} />
                <Route path="/mock-test" element={<FeatureGate feature="ai_test_attempt"><MockTest /></FeatureGate>} />
                <Route path="/test-completed" element={<TestCompletionPage />} />
                <Route path="/verify-email" element={<VerifyEmail />} />
                <Route path="/terms" element={<TermsAndConditions />} />
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/welcome-new-user" element={<Setup />} />
                <Route path="/all-set" element={<AllSetPage />} />
                <Route path="/settings/username" element={<UsernamePage />} />
                <Route path="/results" element={<MockTestResults />} />
                <Route path="/test-summary" element={<TestCompletion />} />
                <Route path="/career" element={<Career />} />
                <Route path="/teaching-career" element={<TeachingAmbassadors />} />
                <Route path="/summerinternship2025" element={<InternshipApplication />} />
                <Route path="/saved-mcqs" element={<FeatureGate feature="saved_questions"><SavedMCQsPage /></FeatureGate>} />
                <Route path="/mistake-book" element={<FeatureGate feature="mistake_book"><MistakeBookPage /></FeatureGate>} />
                <Route path="/smart-deck" element={<FeatureGate feature="flashcards"><SmartDeckPage /></FeatureGate>} />
                <Route path="/revision-queue" element={<Navigate to="/smart-deck" replace />} />
                <Route path="/titration" element={<Navigate to="/smart-deck" replace />} />
                <Route path="/learn-with-ai" element={<FeatureGate feature="ai_tutor"><LearnWithAIPage /></FeatureGate>} />
                <Route path="/announcements" element={<Announcements />} />
                <Route path="/contact-us" element={<ContactUsPage />} />
                <Route path="/flp" element={<FeatureGate feature="flps"><FLP /></FeatureGate>} />
                <Route path="/flp/test" element={<FeatureGate feature="flps"><FLPTestPage /></FeatureGate>} />
                <Route path="/flp-result" element={<FeatureGate feature="flps"><FLPResults /></FeatureGate>} />
                <Route path="/results/flp/:id" element={<FeatureGate feature="flps"><FLPResultDetail /></FeatureGate>} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/update-password" element={<UpdatePassword />} />
                <Route path="/select-year" element={<SelectYear />} />
                <Route path="/teams" element={<Teams />} />
                <Route path="/install-app" element={<InstallApp />} />
                <Route path="/practicals" element={<FeatureGate feature="ospe"><PracticalPage /></FeatureGate>} />
                <Route path="/seqs" element={<FeatureGate feature="seqs"><SEQSubjectSelectionPage /></FeatureGate>} />
                <Route path="/seqs/chapter/:subjectId" element={<FeatureGate feature="seqs"><SEQChapterSelectionPage /></FeatureGate>} />
                <Route path="/seqs/quiz/:subjectId/:chapterId" element={<FeatureGate feature="seqs"><SEQQuizPage /></FeatureGate>} />
                <Route path="/redeem" element={<RedeemCode />} />
                <Route path="/referrals" element={<Referrals />} />
                <Route path="/purchase-history" element={<PurchaseHistory />} />
                <Route path="/payment-failure" element={<PaymentFailure />} />
                <Route path="/payment-success" element={<PaymentSuccess />} />
                <Route path="/setup" element={<Setup />} />
                <Route path="/detailed-analytics" element={<DetailedAnalytics />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
              </Suspense>
              <Toaster />
              <SonnerToaster position="bottom-center" />
            </div>
        </Router></ConsentProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
