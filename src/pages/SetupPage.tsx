import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight, ChevronLeft, Sparkles, User, Building2, GraduationCap, CheckCircle2, Loader2, Gift, HeartHandshake, Moon, Sun, Search, SlidersHorizontal, X, Megaphone, Share2, Bot, Users, CalendarDays, BadgePercent, MessageCircle
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { fetchInstitutes, getInstituteByCode, isSpecializedTestCode, isSpecializedTestInstitute, type Institute } from '@/utils/institutes';
import { getInstituteYearOptions, getProfileCompletion, VALID_PROFILE_YEARS } from '@/utils/profileCompletion';
import { generateUniqueReferralCode, resolveReferralCode } from '@/utils/referral';
import { notifyAchievementProgress } from '@/components/profile/AchievementBadges';
import { getUsernameValidationError, isUsernameConflict, normalizeUsername } from '@/utils/username';
import {
  getEffectiveProgramCode,
  getInstituteProgramCodes,
  STUDY_PROGRAMS,
  type StudyProgramCode,
} from '@/utils/studyPrograms';

const VALID_YEARS = VALID_PROFILE_YEARS;
const PROGRAM_YEAR_OPTION_STYLES: Record<StudyProgramCode, { idle: string; selected: string; divider: string }> = {
  mbbs: {
    idle: 'border-red-200 bg-red-50 text-red-900 hover:bg-red-100 dark:border-red-900/70 dark:bg-red-950/35 dark:text-red-100 dark:hover:bg-red-950/55',
    selected: 'border-red-400 bg-red-100 text-red-950 ring-2 ring-red-300/50 dark:border-red-600 dark:bg-red-950/70 dark:text-red-50 dark:ring-red-700/50',
    divider: 'bg-red-200 text-red-700 dark:bg-red-900/70 dark:text-red-300',
  },
  bds: {
    idle: 'border-blue-200 bg-blue-50 text-blue-900 hover:bg-blue-100 dark:border-blue-900/70 dark:bg-blue-950/35 dark:text-blue-100 dark:hover:bg-blue-950/55',
    selected: 'border-blue-400 bg-blue-100 text-blue-950 ring-2 ring-blue-300/50 dark:border-blue-600 dark:bg-blue-950/70 dark:text-blue-50 dark:ring-blue-700/50',
    divider: 'bg-blue-200 text-blue-700 dark:bg-blue-900/70 dark:text-blue-300',
  },
  pharm_d: {
    idle: 'border-amber-200 bg-amber-50 text-amber-950 hover:bg-amber-100 dark:border-amber-900/70 dark:bg-amber-950/35 dark:text-amber-100 dark:hover:bg-amber-950/55',
    selected: 'border-amber-400 bg-amber-100 text-amber-950 ring-2 ring-amber-300/50 dark:border-amber-600 dark:bg-amber-950/70 dark:text-amber-50 dark:ring-amber-700/50',
    divider: 'bg-amber-200 text-amber-700 dark:bg-amber-900/70 dark:text-amber-300',
  },
};
const usernameFromName = (name?: string | null) => {
  const ignored = new Set(['dr', 'doctor', 'mr', 'mrs', 'ms', 'miss', 'prof', 'professor']);
  const muhammad = new Set(['muhammad', 'mohammad', 'mohammed', 'mohd', 'md']);
  const words = String(name || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).filter(word => !ignored.has(word));
  return (muhammad.has(words[0]) && words[1] ? words[1] : words[0] || 'med_student').slice(0, 14);
};
const getSetupFullName = (user: { email?: string | null; user_metadata?: { full_name?: unknown } } | null) =>
  String(user?.user_metadata?.full_name || '').trim()
  || String(user?.email || '').split('@')[0].trim()
  || 'Medmacs User';
type SetupSelectionCategory = 'institute' | 'specialized_test';
type SetupThemeChoice = 'light' | 'dark';
type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';
type PendingYearSelection = {
  year: string;
  label: string;
  programCode?: StudyProgramCode;
};
type HeardAboutUsOption = {
  value: string;
  label: string;
  icon: string | null;
};

const heardAboutUsIconMap = {
  share: Share2,
  badge_percent: BadgePercent,
  bot: Bot,
  users: Users,
  calendar_days: CalendarDays,
  megaphone: Megaphone,
  message_circle: MessageCircle,
};

const fallbackHeardAboutUsOptions: HeardAboutUsOption[] = [
  { value: 'social_media', label: 'Social Media', icon: 'share' },
  { value: 'ads', label: 'Ads', icon: 'badge_percent' },
  { value: 'ai_chatbot', label: 'AI Chatbot', icon: 'bot' },
  { value: 'recommended_by_someone', label: 'Recommended by Someone', icon: 'users' },
  { value: 'public_event', label: 'Public Event', icon: 'calendar_days' },
  { value: 'marketing_posters', label: 'Marketing Posters', icon: 'megaphone' },
  { value: 'friends_group', label: 'Friends Group', icon: 'message_circle' },
];

const getInstituteProvince = (inst: Institute) => {
  const value = (inst.province || inst.region || '').trim();
  return value || 'Other';
};

const formatYearOptionLabel = (value: string) => value
  .split('_')
  .map(word => word.charAt(0).toUpperCase() + word.slice(1))
  .join(' ')
  .replace(/\bAllied\b/g, '& Allied');

const SetupWizard = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { resolvedTheme, setTheme } = useTheme();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [selectionCategory, setSelectionCategory] = useState<SetupSelectionCategory>('institute');
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [pendingYearSelection, setPendingYearSelection] = useState<PendingYearSelection | null>(null);

  const [username, setUsername] = useState('');
  const [institute, setInstitute] = useState('');
  const [year, setYear] = useState('');
  const [programCode, setProgramCode] = useState<StudyProgramCode>('mbbs');
  const [usernameError, setUsernameError] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');
  const [existingProfile, setExistingProfile] = useState<any>(null);
  const [setupLoadError, setSetupLoadError] = useState('');
  const [referredByName, setReferredByName] = useState<string | null>(null);
  const [referralStepCode, setReferralStepCode] = useState('');
  const [heardAboutUs, setHeardAboutUs] = useState('');
  const [heardAboutUsOptions, setHeardAboutUsOptions] = useState<HeardAboutUsOption[]>(fallbackHeardAboutUsOptions);
  const [setupTheme, setSetupTheme] = useState<SetupThemeChoice>('light');
  const [studySearchExpanded, setStudySearchExpanded] = useState(false);
  const [studyFiltersExpanded, setStudyFiltersExpanded] = useState(false);
  const [studySearch, setStudySearch] = useState('');
  const [provinceFilter, setProvinceFilter] = useState('all');
  const [studyPathChangeMode, setStudyPathChangeMode] = useState(false);
  const setupLoadUserIdRef = useRef<string | null>(null);
  const setupLoadToastShownRef = useRef(false);
  const studyOverlayRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (resolvedTheme === 'light' || resolvedTheme === 'dark') {
      setSetupTheme(resolvedTheme);
    }
  }, [resolvedTheme]);

  useEffect(() => {
    if (!studySearchExpanded && !studyFiltersExpanded) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (studyOverlayRef.current?.contains(target)) return;
      setStudySearchExpanded(false);
      setStudyFiltersExpanded(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [studySearchExpanded, studyFiltersExpanded]);

  const chooseSetupTheme = (theme: SetupThemeChoice) => {
    setSetupTheme(theme);
    setTheme(theme);
  };

  const readStudyPathChangeVerification = useCallback(() => {
    if (typeof window === 'undefined' || !user?.id) return false;
    try {
      const raw = sessionStorage.getItem('medmacs_setup_change_verified');
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      const verifiedAt = Number(parsed?.verifiedAt || 0);
      const stillFresh = Date.now() - verifiedAt < 10 * 60 * 1000;
      return parsed?.userId === user.id && stillFresh;
    } catch {
      return false;
    }
  }, [user?.id]);

  const getNextStudyPathChangeAt = (profile: any = existingProfile) => {
    const changedAt = profile?.study_path_changed_at ? new Date(profile.study_path_changed_at) : null;
    if (!changedAt || Number.isNaN(changedAt.getTime())) return null;
    return new Date(changedAt.getTime() + 7 * 24 * 60 * 60 * 1000);
  };

  const canChangeStudyPathNow = (profile: any = existingProfile) => {
    const nextChangeAt = getNextStudyPathChangeAt(profile);
    return !nextChangeAt || nextChangeAt.getTime() <= Date.now();
  };

  const formatStudyPathChangeDate = (date: Date | null) =>
    date?.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) || '';

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return;

    const root = document.getElementById('root');
    const previousHtmlBackground = document.documentElement.style.backgroundColor;
    const previousBodyBackground = document.body.style.backgroundColor;
    const previousRootBackground = root?.style.backgroundColor;
    const fallbackColor = setupTheme === 'dark' ? '#000000' : '#f8fafc';

    document.documentElement.style.backgroundColor = fallbackColor;
    document.body.style.backgroundColor = fallbackColor;
    if (root) root.style.backgroundColor = fallbackColor;

    const applyNativeBars = async () => {
      try {
        const { NavigationBar } = await import('@capgo/capacitor-navigation-bar');
        await StatusBar.setStyle({ style: setupTheme === 'dark' ? Style.Dark : Style.Light });
        await StatusBar.setBackgroundColor({ color: 'transparent' });

        if ((NavigationBar as any).setNavigationBarColor) {
          await (NavigationBar as any).setNavigationBarColor({ color: 'transparent', darkButtons: setupTheme === 'light' });
        } else {
          await (NavigationBar as any).set?.({ color: fallbackColor, darkButtons: setupTheme === 'light' });
          await (NavigationBar as any).setBackgroundColor?.({ color: fallbackColor });
          await (NavigationBar as any).setButtonsColor?.({ dark: setupTheme === 'light' });
        }
      } catch (error) {
        console.warn('Failed to sync setup page native bars', error);
      }
    };

    applyNativeBars();

    return () => {
      document.documentElement.style.backgroundColor = previousHtmlBackground;
      document.body.style.backgroundColor = previousBodyBackground;
      if (root && previousRootBackground !== undefined) root.style.backgroundColor = previousRootBackground;
    };
  }, [setupTheme]);

  const ensureProfile = useCallback(async () => {
    if (!user?.id) throw new Error('User not authenticated.');

    const { data: existing, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (existing) {
      if (!existing.referral_code) {
        try {
          const code = await generateUniqueReferralCode();
          const { error: referralUpdateError } = await supabase.from('profiles').update({ referral_code: code }).eq('id', user.id);
          if (!referralUpdateError) existing.referral_code = code;
        } catch (error) {
          console.warn('Failed to backfill referral code during setup load', error);
        }
      }
      return existing;
    }

    const referralCode = await generateUniqueReferralCode();
    let referredBy: string | null = null;
    const metaReferralCode = user.user_metadata?.referral_code as string | undefined;
    if (metaReferralCode) {
      referredBy = await resolveReferralCode(metaReferralCode);
    }

    const profileSeed = {
      id: user.id,
      full_name: getSetupFullName(user),
      avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
      referral_code: referralCode,
      referred_by: referredBy,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('profiles')
      .insert(profileSeed as any)
      .select('*')
      .maybeSingle();

    if (error) {
      if (error.code === '23505') {
        const { data: raceProfile, error: raceFetchError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (raceFetchError) throw raceFetchError;
        return raceProfile;
      }

      throw error;
    }

    if (data && referredBy) {
      notifyAchievementProgress('referral');
    }

    return data;
  }, [user]);

  const getInitialStep = useCallback((profile: any, instituteRows: Institute[]) => {
    const hasUsername = !!profile?.username;
    const hasInstitute = !!profile?.institute;
    const selectedInstitute = getInstituteByCode(profile?.institute || '', instituteRows);
    const yearOptions = getInstituteYearOptions(selectedInstitute);
    const hasValidYear = yearOptions.length === 0 || yearOptions.includes(String(profile?.year || '').trim());

    // Brand-new users should see the welcome step first.
    if (!hasUsername && !hasInstitute && !hasValidYear) return 0;
    const completion = getProfileCompletion(profile, instituteRows);
    if (completion.complete) return 4;
    if (completion.reason === 'missing_username' || completion.reason === 'missing_full_name') return 1;
    if (completion.reason === 'missing_institute' || completion.reason === 'unknown_institute') return 2;
    if (completion.reason === 'missing_year') return 2;
    return 0;
  }, []);

  const loadHeardAboutUsOptions = useCallback(async () => {
    const { data, error } = await supabase
      .from('heard_about_us_options' as any)
      .select('value, label, icon')
      .eq('enabled', true)
      .order('order_index', { ascending: true });

    if (error || !data?.length) {
      if (error) console.warn('Failed to load heard_about_us_options; using fallback', error);
      return fallbackHeardAboutUsOptions;
    }

    return data.map((option: any) => ({
      value: String(option.value),
      label: String(option.label),
      icon: option.icon ? String(option.icon) : null,
    })) as HeardAboutUsOption[];
  }, []);

  const loadSetupProfile = useCallback(async () => {
    setLoading(true);
    setSetupLoadError('');

    try {
      const [profile, insts, heardOptions] = await Promise.all([
        ensureProfile(),
        fetchInstitutes({ force: true }),
        loadHeardAboutUsOptions(),
      ]);
      setInstitutes(insts);
      setHeardAboutUsOptions(heardOptions);
      setExistingProfile(profile);

      setUsername(profile?.username || usernameFromName(profile?.full_name || getSetupFullName(user)));
      setInstitute((profile as any)?.institute || '');
      setYear((profile as any)?.year || '');
      setProgramCode(getEffectiveProgramCode((profile as any)?.program_code));
      setHeardAboutUs((profile as any)?.heard_about_us || '');
      const selectedInstitute = getInstituteByCode((profile as any)?.institute || '', insts);
      setSelectionCategory(
        isSpecializedTestInstitute(selectedInstitute) || isSpecializedTestCode((profile as any)?.institute)
          ? 'specialized_test'
          : 'institute'
      );

      if (profile?.referred_by) {
        const { data: referrer } = await supabase.from('profiles').select('full_name, username').eq('id', profile.referred_by).maybeSingle();
        if (referrer) setReferredByName(referrer.full_name || referrer.username || 'a friend');
      }

      const changeMode = readStudyPathChangeVerification();
      setStudyPathChangeMode(changeMode);
      if (changeMode && !canChangeStudyPathNow(profile)) {
        sessionStorage.removeItem('medmacs_setup_change_verified');
        toast.error(`You can change institute or Post Graduate Exam once per week. Try again after ${formatStudyPathChangeDate(getNextStudyPathChangeAt(profile))}.`);
        navigate('/dashboard', { replace: true });
        return;
      }
      const initialStep = changeMode ? 2 : getInitialStep(profile, insts);
      if (initialStep === 4) { navigate('/dashboard', { replace: true }); return; }
      setCurrentStep(initialStep);
    } catch (error) {
      console.error('Failed to initialize setup profile:', error);
      setSetupLoadError(
        navigator.onLine
          ? 'We could not load your profile from the server. Please try again.'
          : 'You appear to be offline, so setup fields cannot be verified right now.'
      );
      if (!setupLoadToastShownRef.current) {
        setupLoadToastShownRef.current = true;
        toast.error('Failed to load setup. Please try again.', { id: 'setup-load-failed' });
      }
    } finally {
      setLoading(false);
    }
  }, [ensureProfile, getInitialStep, loadHeardAboutUsOptions, navigate, readStudyPathChangeVerification]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate('/login'); return; }
    if (setupLoadUserIdRef.current === user.id) return;
    setupLoadUserIdRef.current = user.id;
    setupLoadToastShownRef.current = false;
    loadSetupProfile();
  }, [user?.id, authLoading, navigate, loadSetupProfile]);

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'there';

  useEffect(() => {
    const value = normalizeUsername(username);
    if (!user?.id) return;

    if (!value) {
      setUsernameStatus('idle');
      setUsernameError('');
      return;
    }

    const validationError = getUsernameValidationError(value);
    if (validationError) {
      setUsernameStatus('invalid');
      setUsernameError(validationError);
      return;
    }

    if (normalizeUsername(existingProfile?.username || '') === value) {
      setUsernameStatus('available');
      setUsernameError('');
      return;
    }

    let cancelled = false;
    setUsernameStatus('checking');
    setUsernameError('');

    const timer = window.setTimeout(async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .ilike('username', value)
        .neq('id', user.id)
        .limit(1);

      if (cancelled) return;

      if (error) {
        setUsernameStatus('idle');
        setUsernameError('Could not check username');
        return;
      }

      if ((data || []).length > 0) {
        setUsernameStatus('taken');
        setUsernameError('Username already taken');
      } else {
        setUsernameStatus('available');
        setUsernameError('');
      }
    }, 450);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [username, user?.id, existingProfile?.username]);

  const validateUsername = async (value: string) => {
    const normalizedValue = normalizeUsername(value);
    const validationError = getUsernameValidationError(normalizedValue);
    if (validationError) { setUsernameError(validationError); return false; }
    const { data, error } = await supabase.from('profiles').select('id').ilike('username', normalizedValue).neq('id', user!.id).limit(1);
    if (error) { setUsernameError('Could not verify username availability'); return false; }
    if ((data || []).length > 0) { setUsernameError('Username already taken'); return false; }
    setUsernameError('');
    return true;
  };

  const handleNext = async () => {
    if (currentStep === 0) { setCurrentStep(1); return; }
    if (currentStep === 1) {
      setSaving(true);
      const valid = await validateUsername(username);
      if (!valid) { setSaving(false); return; }
      const { error } = await supabase.from('profiles').upsert({
        id: user!.id,
        username: normalizeUsername(username),
        full_name: String(existingProfile?.full_name || '').trim() || getSetupFullName(user),
        updated_at: new Date().toISOString(),
      } as any, { onConflict: 'id' });
      setSaving(false);
      if (error) {
        const message = isUsernameConflict(error) ? 'Username already taken' : 'Failed to save username';
        setUsernameError(message);
        if (isUsernameConflict(error)) setUsernameStatus('taken');
        toast.error(message);
        return;
      }
      setCurrentStep(2);
      return;
    }
    if (currentStep === 2) {
      if (studyPathChangeMode && !canChangeStudyPathNow()) {
        sessionStorage.removeItem('medmacs_setup_change_verified');
        toast.error(`You can change institute or Post Graduate Exam once per week. Try again after ${formatStudyPathChangeDate(getNextStudyPathChangeAt())}.`);
        navigate('/dashboard', { replace: true });
        return;
      }
      if (!institute) {
        toast.error(selectionCategory === 'specialized_test' ? 'Please select a Post Graduate Exam' : 'Please select an institute');
        return;
      }
      const selectedInstitute = getInstituteByCode(institute, institutes);
      const selectedSpecializedTest =
        selectionCategory === 'specialized_test' ||
        isSpecializedTestInstitute(selectedInstitute) ||
        isSpecializedTestCode(institute);
      const yearOptions = getInstituteYearOptions(selectedInstitute);
      const nextYear = selectedSpecializedTest && yearOptions.length === 1 ? yearOptions[0] : null;
      const requiresYearChoice = selectedSpecializedTest ? yearOptions.length > 1 : true;
      if (requiresYearChoice && !year) {
        setShowYearPicker(true);
        return;
      }
      const profilePatch: any = {
        institute,
        year: requiresYearChoice ? year : nextYear,
        program_code: selectedSpecializedTest ? null : programCode,
        updated_at: new Date().toISOString(),
      };
      if (studyPathChangeMode) profilePatch.study_path_changed_at = new Date().toISOString();
      setSaving(true);
      const { error } = studyPathChangeMode
        ? await supabase.from('profiles').update(profilePatch).eq('id', user!.id)
        : await supabase.from('profiles').upsert({ id: user!.id, ...profilePatch }, { onConflict: 'id' });
      setSaving(false);
      if (error) {
        toast.error(selectedSpecializedTest ? 'Failed to save Post Graduate Exam' : 'Failed to save institute');
        return;
      }
      if (nextYear) setYear(nextYear);
      if (studyPathChangeMode) {
        sessionStorage.removeItem('medmacs_setup_change_verified');
        toast.success(selectedSpecializedTest ? 'Post Graduate Exam updated.' : 'Institute updated.');
        navigate('/dashboard', { replace: true });
        return;
      }
      setCurrentStep(3);
      return;
    }
    if (currentStep === 3) {
      navigate('/dashboard');
    }
  };

  const handleBack = () => {
    if (currentStep === 4) {
      const selectedInstitute = getInstituteByCode(institute, institutes);
      if (getInstituteYearOptions(selectedInstitute).length === 0) {
        setCurrentStep(2);
        return;
      }
    }
    if (currentStep > 0) setCurrentStep(prev => prev - 1);
  };

  const handleConfirmYearSelection = async () => {
    if (!pendingYearSelection || saving) return;

    const selection = pendingYearSelection;
    const selectedProgramCode = selection.programCode || programCode;
    const selectedInstitute = getInstituteByCode(institute, institutes);
    const selectedSpecializedTest =
      selectionCategory === 'specialized_test' ||
      isSpecializedTestInstitute(selectedInstitute) ||
      isSpecializedTestCode(institute);

    setYear(selection.year);
    setProgramCode(selectedProgramCode);
    setPendingYearSelection(null);

    // Move forward immediately while the small profile update completes.
    if (!studyPathChangeMode) setCurrentStep(3);

    const profilePatch: any = {
      institute,
      year: selection.year,
      program_code: selectedSpecializedTest ? null : selectedProgramCode,
      updated_at: new Date().toISOString(),
    };
    if (studyPathChangeMode) profilePatch.study_path_changed_at = new Date().toISOString();

    setSaving(true);
    const { error } = studyPathChangeMode
      ? await supabase.from('profiles').update(profilePatch).eq('id', user!.id)
      : await supabase.from('profiles').upsert({ id: user!.id, ...profilePatch }, { onConflict: 'id' });
    setSaving(false);

    if (error) {
      if (!studyPathChangeMode) setCurrentStep(2);
      toast.error(selectedSpecializedTest ? 'Failed to save Post Graduate Exam' : 'Failed to save institute and year');
      return;
    }

    if (studyPathChangeMode) {
      sessionStorage.removeItem('medmacs_setup_change_verified');
      toast.success(selectedSpecializedTest ? 'Post Graduate Exam updated.' : 'Institute updated.');
      navigate('/dashboard', { replace: true });
    }
  };

  const steps = [
    { title: 'Welcome', icon: Sparkles },
    { title: 'Username', icon: User },
    { title: 'Study Path', icon: Building2 },
    { title: 'All Set', icon: CheckCircle2 },
  ];

  const haloLayouts = [
    { primary: '-left-28 -top-28', secondary: '-right-24 bottom-16' },
    { primary: 'left-[8%] -top-32', secondary: '-right-28 top-[42%]' },
    { primary: '-right-20 -top-24', secondary: 'left-[-6rem] bottom-20' },
    { primary: 'right-[12%] bottom-[-7rem]', secondary: 'left-[8%] top-[18%]' },
    { primary: '-left-24 top-[34%]', secondary: 'right-[-5rem] top-12' },
    { primary: 'left-[22%] bottom-[-8rem]', secondary: 'right-[10%] top-[20%]' },
    { primary: 'right-[18%] -top-28', secondary: 'left-[12%] bottom-[-7rem]' },
  ];
  const haloLayout = haloLayouts[currentStep] || haloLayouts[0];
  const setupIsDark = setupTheme === 'dark';
  const headingClass = "font-['Bricolage_Grotesque'] text-[clamp(2rem,8vw,2.8rem)] font-extrabold leading-[1.02] tracking-[-.055em] text-white";

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <img src="/lovable-uploads/bf69a7f7-550a-45a1-8808-a02fb889f8c5.png" alt="Loading" className="w-24 h-24 object-contain animate-pulse" />
      </div>
    );
  }

  if (setupLoadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6 text-center">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-6 text-white shadow-2xl">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
            <User className="h-6 w-6 text-white/80" />
          </div>
          <h1 className="font-['Bricolage_Grotesque'] text-2xl font-extrabold tracking-[-.045em]">
            Profile Setup <span className="font-extrabold text-cyan-300">Unavailable</span>
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-white/60">{setupLoadError}</p>
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Button onClick={() => navigate('/dashboard', { replace: true })} variant="outline" className="h-12 rounded-2xl border-white/20 bg-white/5 text-white hover:bg-white/10">
              Go Back
            </Button>
            <Button onClick={loadSetupProfile} className="h-12 rounded-2xl bg-white font-black text-black hover:bg-white/90">
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const renderStepContent = () => {
    const searchTerm = studySearch.trim().toLowerCase();
    const categoryInstitutes = institutes.filter(inst => {
      const category = isSpecializedTestInstitute(inst) ? 'specialized_test' : 'institute';
      return category === selectionCategory;
    });
    const availableProvinces = Array.from(
      new Set(
        institutes
          .filter(inst => !isSpecializedTestInstitute(inst))
          .map(getInstituteProvince)
      )
    ).sort((a, b) => a.localeCompare(b));
    const filteredInstitutes = categoryInstitutes.filter(inst => {
      return selectionCategory !== 'institute' || provinceFilter === 'all' || getInstituteProvince(inst) === provinceFilter;
    });
    const searchResults = searchTerm ? filteredInstitutes.filter(inst => {
      const searchable = `${inst.name} ${inst.short_name} ${getInstituteProvince(inst)}`.toLowerCase();
      return searchable.includes(searchTerm);
    }) : [];
    const groupedInstitutes = filteredInstitutes.reduce<Record<string, Institute[]>>((groups, inst) => {
      const groupName = selectionCategory === 'institute' ? getInstituteProvince(inst) : 'Post Graduate Exams';
      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(inst);
      return groups;
    }, {});
    const sortedGroupNames = Object.keys(groupedInstitutes).sort((a, b) => {
      if (a === 'Other') return 1;
      if (b === 'Other') return -1;
      return a.localeCompare(b);
    });
    const studyOverlayOpen = studySearchExpanded || studyFiltersExpanded;
    const renderStudyPathRow = (inst: Institute, compact = false) => {
      const selected = institute === inst.code;
      const yearOptions = getInstituteYearOptions(inst);
      const metadata = selectionCategory === 'institute'
        ? `${inst.short_name}${yearOptions.length ? ` · ${yearOptions.length} year${yearOptions.length === 1 ? '' : 's'}` : ''}`
        : yearOptions.length ? `${yearOptions.length} option${yearOptions.length === 1 ? '' : 's'}` : 'No selection required';

      return (
        <button
          key={inst.code}
          onClick={() => {
            if (!inst.enabled) return;
            setInstitute(inst.code);
            setYear('');
            setProgramCode('mbbs');
            if (getInstituteYearOptions(inst).length > 1 || !isSpecializedTestInstitute(inst)) {
              setShowYearPicker(true);
            }
          }}
          disabled={!inst.enabled}
          className={`w-full flex items-center gap-3 ${compact ? 'p-2.5' : 'p-3'} rounded-2xl border-2 transition-all duration-200 text-left ${
            selected
              ? 'border-white bg-white/20 shadow-lg'
              : inst.enabled
                ? 'border-white/10 bg-white/5 hover:bg-white/10'
                : 'border-white/5 bg-white/[0.02] opacity-50 cursor-not-allowed'
          }`}
        >
          <div className={`${compact ? 'w-11 h-11' : 'w-14 h-14'} relative rounded-xl overflow-hidden shrink-0 bg-white/10`}>
            {inst.image_url ? (
              <img
                src={inst.image_url}
                alt={inst.short_name}
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-l from-transparent to-white/5" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Building2 className={`${compact ? 'w-5 h-5' : 'w-6 h-6'} text-white/30`} />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-bold leading-tight ${selected ? 'text-white' : 'text-white/80'}`}>
              {inst.name}
            </p>
            <p className="text-[11px] text-white/40 mt-0.5">{metadata}</p>
          </div>
          {!inst.enabled && (
            <span className="text-[10px] font-bold text-amber-300 bg-amber-300/10 px-2 py-1 rounded-full shrink-0 whitespace-nowrap">
              Coming Soon
            </span>
          )}
          {selected && (
            <CheckCircle2 className="w-5 h-5 text-white shrink-0" />
          )}
        </button>
      );
    };
    const handleSelectionCategoryChange = (value: string) => {
      const nextCategory = value as SetupSelectionCategory;
      setSelectionCategory(nextCategory);
      setStudyFiltersExpanded(false);
      setStudySearchExpanded(false);
      const selectedInstitute = getInstituteByCode(institute, institutes);
      const selectedCategory =
        isSpecializedTestInstitute(selectedInstitute) || isSpecializedTestCode(institute)
          ? 'specialized_test'
          : 'institute';
      if (selectedInstitute && selectedCategory !== nextCategory) {
        setInstitute('');
      }
    };

    switch (currentStep) {
      case 0:
        return (
          <div className="mx-auto flex max-w-md flex-col items-center text-center">
            <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', delay: 0.12 }}>
              <img
                src="/lovable-uploads/bf69a7f7-550a-45a1-8808-a02fb889f8c5.png"
                alt="Medmacs"
                className="mx-auto mb-5 h-32 w-32 object-contain drop-shadow-2xl md:h-40 md:w-40"
              />
            </motion.div>
            <h2 className={`${headingClass} mb-3 max-w-full text-balance`}>
              <span className="setup-heading-accent mb-2 font-extrabold text-cyan-300">Welcome,</span>
              <motion.span
                className="mx-auto mt-1 block max-w-full break-words text-white"
                initial={{ opacity: 0, y: 12, filter: 'blur(8px)' }}
                animate={{
                  opacity: 1,
                  y: 0,
                  filter: 'blur(0px)',
                }}
                transition={{
                  opacity: { delay: 0.28, duration: 0.6, ease: [0.22, 1, 0.36, 1] },
                  y: { delay: 0.28, duration: 0.6, ease: [0.22, 1, 0.36, 1] },
                  filter: { delay: 0.28, duration: 0.6, ease: [0.22, 1, 0.36, 1] },
                }}
              >
                {displayName}!
              </motion.span>
            </h2>
            <p className="mx-auto mb-7 max-w-xs text-sm font-semibold leading-6 text-white/70">Let's set up your profile in 3 quick steps.</p>
            <div className="grid w-full grid-cols-2 gap-4">
              {([
                { value: 'dark' as const, label: 'Dark', icon: Moon, description: 'Pitch black setup' },
                { value: 'light' as const, label: 'Light', icon: Sun, description: 'Bright and soft' },
              ]).map((option) => {
                const Icon = option.icon;
                const selected = setupTheme === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={() => chooseSetupTheme(option.value)}
                    className={`min-h-36 rounded-3xl border-2 p-6 text-left transition-all duration-200 ${
                      selected
                        ? 'border-cyan-300 bg-cyan-400/15 shadow-2xl shadow-cyan-500/20'
                        : 'border-white/10 bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <div className="mb-5 flex items-center justify-between">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400/15">
                        <Icon className="h-5 w-5 text-white" />
                      </div>
                      {selected && <CheckCircle2 className="h-5 w-5 text-cyan-300" />}
                    </div>
                    <p className="text-base font-bold text-white">{option.label}</p>
                    <p className="mt-1 text-xs font-semibold text-white/50">{option.description}</p>
                  </button>
                );
              })}
            </div>
          </div>
        );

      case 1:
        return (
          <div className="text-center max-w-md mx-auto">
            <h2 className={`${headingClass} mb-2`}>Choose Your <span className="setup-heading-accent text-cyan-300">Username</span></h2>
            <p className="text-white/60 text-sm mb-8">This will be visible on leaderboards and battles.</p>
            <div className="relative">
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                placeholder="Enter your username"
                className="h-14 rounded-2xl bg-white/10 border-white/20 text-white placeholder:text-white/40 text-center text-lg font-bold focus:ring-2 focus:ring-white/30"
                maxLength={20}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
              {usernameStatus === 'checking' && (
                <p className="text-cyan-300 text-xs mt-2 font-semibold">Checking availability...</p>
              )}
              {usernameStatus === 'available' && username.trim().length >= 3 && (
                <p className="text-emerald-300 text-xs mt-2 font-semibold">Username is available</p>
              )}
              {usernameError && usernameStatus !== 'checking' && usernameStatus !== 'available' && (
                <p className="text-red-300 text-xs mt-2 font-semibold">{usernameError}</p>
              )}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="text-center max-w-lg mx-auto">
            <div className="relative mb-5">
              <div
                ref={studyOverlayRef}
                className="absolute -top-16 right-0 z-50 flex items-start justify-end gap-2"
              >
                <motion.div
                  initial={false}
                  animate={{ width: studySearchExpanded ? 210 : 44 }}
                  className="relative rounded-2xl border border-white/10 bg-white/10 backdrop-blur-md"
                >
                  {studySearchExpanded ? (
                    <>
                      <div className="flex h-11 items-center gap-2 px-3">
                        <Search className="h-4 w-4 shrink-0 text-white/50" />
                        <input
                          value={studySearch}
                          onChange={(event) => setStudySearch(event.target.value)}
                          placeholder="Search"
                          autoFocus
                          className="min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none placeholder:text-white/40"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setStudySearch('');
                            setStudySearchExpanded(false);
                          }}
                          className="rounded-full p-1 text-white/50 hover:bg-white/10 hover:text-white"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <AnimatePresence>
                        {searchTerm && (
                          <motion.div
                            initial={{ opacity: 0, y: -6, scale: 0.98 }}
                            animate={{ opacity: 1, y: 8, scale: 1 }}
                            exit={{ opacity: 0, y: -6, scale: 0.98 }}
                            className={`absolute right-0 top-11 z-50 w-[min(22rem,calc(100vw-3rem))] rounded-3xl border p-2 shadow-2xl backdrop-blur-2xl ${
                              setupIsDark ? 'border-white/10 bg-black/80 shadow-black/60' : 'border-cyan-600/15 bg-white/90 shadow-cyan-950/10'
                            }`}
                          >
                            <div className="max-h-72 space-y-2 overflow-y-auto overscroll-contain pr-1">
                              {searchResults.length > 0 ? (
                                searchResults.map((inst) => renderStudyPathRow(inst, true))
                              ) : (
                                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center text-xs font-bold text-white/50">
                                  No matches found
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setStudyFiltersExpanded(false);
                        setStudySearchExpanded(true);
                      }}
                      className="flex h-11 w-full items-center justify-center text-white/70 hover:text-white"
                    >
                      <Search className="h-5 w-5" />
                    </button>
                  )}
                </motion.div>
                <button
                  type="button"
                  disabled={selectionCategory !== 'institute'}
                  onClick={() => {
                    if (selectionCategory !== 'institute') return;
                    setStudySearchExpanded(false);
                    setStudyFiltersExpanded((value) => !value);
                  }}
                  title={selectionCategory === 'institute' ? 'Filter by province' : 'Province filter is available for institutes'}
                  className={`flex h-11 w-11 items-center justify-center rounded-2xl border transition-all ${
                    selectionCategory !== 'institute'
                      ? 'cursor-not-allowed border-white/5 bg-white/5 text-white/25'
                      : studyFiltersExpanded || provinceFilter !== 'all'
                      ? 'border-cyan-300 bg-cyan-400/15 text-cyan-300'
                      : 'border-white/10 bg-white/10 text-white/70 hover:text-white'
                  }`}
                >
                  <SlidersHorizontal className="h-5 w-5" />
                </button>
                <AnimatePresence>
                  {studyFiltersExpanded && selectionCategory === 'institute' && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 8, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.98 }}
                      className={`absolute right-0 top-11 z-50 w-[min(22rem,calc(100vw-3rem))] rounded-3xl border p-3 text-left shadow-2xl backdrop-blur-2xl ${
                        setupIsDark ? 'border-white/10 bg-black/80 shadow-black/60' : 'border-cyan-600/15 bg-white/90 shadow-cyan-950/10'
                      }`}
                    >
                      <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-white/50">Province</p>
                      <div className="flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
                        {['all', ...availableProvinces].map((province) => (
                          <button
                            key={province}
                            type="button"
                            onClick={() => setProvinceFilter(province)}
                            className={`w-full rounded-2xl px-4 py-3 text-left text-xs font-black transition-all ${
                              provinceFilter === province
                                ? 'bg-gradient-to-r from-cyan-500 to-teal-400 !text-white shadow-lg shadow-cyan-500/20'
                                : 'bg-white/10 text-white/60 hover:bg-white/15 hover:text-white'
                            }`}
                          >
                            {province === 'all' ? 'All' : province}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div className={`transition-all duration-300 ${studyOverlayOpen ? 'pointer-events-none blur-[2px] opacity-55' : ''}`}>
              <h2 className={`${headingClass} mb-2`}>Choose Your <span className="setup-heading-accent text-cyan-300">Study Path</span></h2>
              <p className="text-white/60 text-sm">
                {selectionCategory === 'specialized_test'
                  ? "We'll tailor content for your selected exam."
                  : "We'll tailor content for your college."}
              </p>
              {studyPathChangeMode && (
                <p className={`mt-3 rounded-2xl border px-4 py-3 text-xs font-bold transition-colors ${
                  setupIsDark
                    ? 'border-cyan-400/20 bg-cyan-950/40 text-cyan-200'
                    : 'border-cyan-600/20 bg-cyan-50 text-cyan-900'
                }`}>
                  You can change institute or Post Graduate Exam once per week. This weekly cooldown starts after you save this change.
                </p>
              )}
              </div>
            </div>
            <div className={`transition-all duration-300 ${studyOverlayOpen ? 'pointer-events-none blur-[2px] opacity-55' : ''}`}>
            <Tabs value={selectionCategory} onValueChange={handleSelectionCategoryChange} className="mb-4 relative">
              <TabsList className="grid h-auto w-full grid-cols-2 rounded-none border-b border-white/10 bg-transparent p-0">
                <TabsTrigger value="institute" className="rounded-none border-b-2 border-transparent bg-transparent px-2 pb-3 pt-1 text-xs font-black text-white/50 shadow-none transition-all data-[state=active]:border-cyan-400 data-[state=active]:bg-transparent data-[state=active]:!text-cyan-300 data-[state=active]:shadow-none">
                  Institutes
                </TabsTrigger>
                <TabsTrigger value="specialized_test" className="rounded-none border-b-2 border-transparent bg-transparent px-2 pb-3 pt-1 text-xs font-black text-white/50 shadow-none transition-all data-[state=active]:border-cyan-400 data-[state=active]:bg-transparent data-[state=active]:!text-cyan-300 data-[state=active]:shadow-none">
                  Post Graduate Exams
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="space-y-3 max-h-[40vh] overflow-y-auto px-1 overscroll-contain">
              {sortedGroupNames.map((groupName) => (
                <section key={groupName} className="space-y-2">
                  <div className={`sticky top-0 z-10 flex items-center justify-between rounded-xl border px-3 py-2 text-left backdrop-blur-md ${
                    setupIsDark ? 'border-white/10 bg-black/30' : 'border-cyan-600/15 bg-white/70'
                  }`}>
                    <h3 className="text-[11px] font-black uppercase tracking-widest text-white/70">{groupName}</h3>
                    <span className="text-[10px] font-bold text-white/40">{groupedInstitutes[groupName].length}</span>
                  </div>
                  {groupedInstitutes[groupName].map((inst) => renderStudyPathRow(inst))}
                </section>
              ))}
              {filteredInstitutes.length === 0 && (
                <div className="rounded-2xl border-2 border-white/10 bg-white/5 p-5 text-sm font-semibold text-white/60">
                  {selectionCategory === 'specialized_test'
                    ? 'Post Graduate Exams are coming soon.'
                    : 'No institutes match your filters.'}
                </div>
              )}
            </div>
            </div>
          </div>
        );

      case 99: {
        const selectedInstitute = getInstituteByCode(institute, institutes);
        const yearOptions = getInstituteYearOptions(selectedInstitute);
        const selectedIsSpecializedTest =
          isSpecializedTestInstitute(selectedInstitute) || isSpecializedTestCode(institute);
        const selectionLabel = selectedIsSpecializedTest ? 'Specialty' : 'Year';
        const options = yearOptions.length > 0 ? yearOptions : VALID_YEARS;

        return (
          <div className="text-center max-w-md mx-auto">
            <h2 className={`${headingClass} mb-2`}>Select Your <span className="setup-heading-accent text-cyan-300">{selectionLabel}</span></h2>
            <p className="text-white/60 text-sm mb-8">
              Pick your {selectedIsSpecializedTest ? 'FCPS specialty' : 'current Medical year'}.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {options.map((y) => (
                <button
                  key={y}
                  onClick={() => setYear(y)}
                  className={`p-4 rounded-2xl border-2 transition-all duration-200 font-bold ${
                    year === y
                      ? 'border-white bg-white/20 text-white shadow-lg'
                      : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                  }`}
                >
                  {formatYearOptionLabel(y)}{selectedIsSpecializedTest ? '' : ' Year MBBS'}
                </button>
              ))}
            </div>
          </div>
        );
      }

      case 3:
        return (
          <div className="text-center max-w-md mx-auto">
            <motion.img initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} src="/mascots/Mascot14.png" alt="Dr Ahroid" className="w-44 h-auto mx-auto mb-5 drop-shadow-2xl" />
            <CheckCircle2 className="mx-auto mb-4 h-10 w-10 text-emerald-300" />
            <h2 className={`${headingClass} mb-3`}>You're All <span className="setup-heading-accent text-cyan-300">Set!</span></h2>
            <p className="text-white/70 text-lg">Your Medical study space is ready.</p>
          </div>
        );

      case 5:
        return (
          <div className="text-center max-w-lg mx-auto">
            <h2 className={`${headingClass} mb-2`}>Where did you hear about <span className="setup-heading-accent text-cyan-300">us?</span></h2>
            <p className="text-white/60 text-sm mb-6">This helps us understand what is working. You can skip it.</p>
            <div className="grid grid-cols-2 gap-3">
              {heardAboutUsOptions.map((option) => {
                const Icon = heardAboutUsIconMap[(option.icon || 'megaphone') as keyof typeof heardAboutUsIconMap] || Megaphone;
                const selected = heardAboutUs === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setHeardAboutUs(selected ? '' : option.value)}
                    className={`min-h-24 rounded-2xl border-2 p-3 text-left transition-all ${
                      selected
                        ? 'border-cyan-300 bg-cyan-400/15 shadow-xl shadow-cyan-500/20'
                        : 'border-white/10 bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-400/15">
                        <Icon className="h-4 w-4 text-white" />
                      </span>
                      {selected && <CheckCircle2 className="h-5 w-5 text-cyan-300" />}
                    </div>
                    <p className="text-sm font-bold leading-tight text-white">{option.label}</p>
                  </button>
                );
              })}
            </div>
          </div>
        );

      case 6:
        return (
          <div className="text-center">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.2 }}>
              <img src="/mascots/Mascot14.png" alt="All Set" className="w-48 h-auto mx-auto mb-6 drop-shadow-2xl" />
            </motion.div>
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.4, type: 'spring' }}>
              <CheckCircle2 className="mx-auto mb-4 h-10 w-10 text-emerald-300" />
            </motion.div>
            <h2 className={`${headingClass} mb-3`}>You're All <span className="setup-heading-accent text-cyan-300">Set!</span></h2>
            <p className="text-white/70 text-lg">Your profile is complete. Let's start learning!</p>
          </div>
        );
    }
  };

  const canProceed = () => {
    if (currentStep === 0) return true;
    if (currentStep === 1) return usernameStatus === 'available';
    if (currentStep === 2) return !!institute;
    if (currentStep === 3) return true;
    return false;
  };

  return (
    <div className={`setup-theme-${setupTheme} fixed inset-0 isolate h-dvh w-full flex flex-col items-center justify-center overflow-hidden overscroll-none transition-all duration-700 ${setupIsDark ? 'bg-black' : 'bg-white'}`}>
      {!setupIsDark && (
        <style>{`
          .setup-theme-light .text-white { color: rgb(15 23 42) !important; }
          .setup-theme-light .text-white\\/80 { color: rgba(15, 23, 42, 0.80) !important; }
          .setup-theme-light .text-white\\/70 { color: rgba(15, 23, 42, 0.70) !important; }
          .setup-theme-light .text-white\\/60 { color: rgba(15, 23, 42, 0.62) !important; }
          .setup-theme-light .text-white\\/50 { color: rgba(15, 23, 42, 0.52) !important; }
          .setup-theme-light .text-white\\/40 { color: rgba(15, 23, 42, 0.42) !important; }
          .setup-theme-light .text-white\\/30 { color: rgba(15, 23, 42, 0.32) !important; }
          .setup-theme-light .text-cyan-300 { color: rgb(8 145 178) !important; }
          .setup-theme-light .text-emerald-300 { color: rgb(5 150 105) !important; }
          .setup-theme-light .text-black { color: rgb(15 23 42) !important; }
          .setup-theme-light .bg-white { background-color: rgb(255 255 255) !important; }
          .setup-theme-light .bg-white\\/20 { background-color: rgba(45, 212, 191, 0.14) !important; }
          .setup-theme-light .bg-white\\/15 { background-color: rgba(45, 212, 191, 0.12) !important; }
          .setup-theme-light .bg-white\\/10 { background-color: rgba(45, 212, 191, 0.08) !important; }
          .setup-theme-light .bg-white\\/5 { background-color: rgba(45, 212, 191, 0.05) !important; }
          .setup-theme-light .bg-white\\/\\[0\\.02\\] { background-color: rgba(45, 212, 191, 0.03) !important; }
          .setup-theme-light .border-white { border-color: rgb(45 212 191) !important; }
          .setup-theme-light .border-white\\/20 { border-color: rgba(45, 212, 191, 0.24) !important; }
          .setup-theme-light .border-white\\/10 { border-color: rgba(45, 212, 191, 0.18) !important; }
          .setup-theme-light .border-white\\/5 { border-color: rgba(45, 212, 191, 0.12) !important; }
          .setup-theme-light .shadow-cyan-500\\/20,
          .setup-theme-light .shadow-cyan-700\\/20 { --tw-shadow-color: rgba(14, 165, 233, 0.16) !important; }
          .setup-theme-light .placeholder\\:text-white\\/40::placeholder { color: rgba(15, 23, 42, 0.42) !important; }
          .setup-theme-light .setup-brand-gradient {
            background-image: linear-gradient(90deg, #0891b2 0%, #00a6c8 42%, #0f766e 100%) !important;
          }
          .setup-theme-light .setup-heading-accent {
            color: #0891b2 !important;
          }
        `}</style>
      )}
      {setupIsDark && (
        <>
          <div className={`absolute h-80 w-80 rounded-full bg-cyan-500/25 blur-3xl transition-all duration-700 ${haloLayout.primary}`} />
          <div className={`absolute h-96 w-96 rounded-full bg-teal-400/20 blur-3xl transition-all duration-700 ${haloLayout.secondary}`} />
          <div className="absolute inset-0 z-0 bg-black/45 transition-all duration-700" />
        </>
      )}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, duration: 0.42, ease: 'easeOut' }}
        className="absolute left-6 top-[calc(env(safe-area-inset-top,0px)+18px)] z-50 flex items-center gap-2.5"
      >
        <img
          src="/lovable-uploads/bf69a7f7-550a-45a1-8808-a02fb889f8c5.png"
          alt="Medmacs"
          className="h-9 w-9 object-contain"
        />
        <span className="brand-wordmark text-lg text-white">Medmacs</span>
      </motion.div>

      {currentStep === 0 && (
        <button
          onClick={() => setCurrentStep(1)}
          className="absolute right-6 top-[calc(env(safe-area-inset-top,0px)+22px)] z-50 text-xs font-bold uppercase tracking-widest text-white/40 hover:text-white"
        >
          Skip
        </button>
      )}

      <div className="relative z-10 w-full max-w-2xl px-6 py-24">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -40, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            {renderStepContent()}
          </motion.div>
        </AnimatePresence>
      </div>


      <div className="absolute bottom-[calc(env(safe-area-inset-bottom,0px)+24px)] left-6 right-6 z-50">
        <div className="mb-4 flex items-center justify-center gap-2.5">
          {steps.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => i <= currentStep && setCurrentStep(i)}
              aria-label={`Go to setup step ${i + 1}`}
              aria-current={i === currentStep ? 'step' : undefined}
              className={`rounded-full transition-all duration-300 ${
                i === currentStep
                  ? `h-4 w-4 ${setupIsDark ? 'bg-white' : 'bg-cyan-600'}`
                  : i < currentStep
                    ? `h-2.5 w-2.5 ${setupIsDark ? 'bg-white/70' : 'bg-cyan-500/70'}`
                    : `h-2.5 w-2.5 ${setupIsDark ? 'bg-white/20' : 'bg-slate-300'}`
              }`}
            />
          ))}
        </div>
        <div className={`flex items-center gap-3 ${currentStep > 0 ? 'justify-between' : 'justify-center'}`}>
          {currentStep > 0 && currentStep < 3 && (
            <Button
              onClick={handleBack}
              variant="outline"
              className={`flex-1 h-14 rounded-2xl border-2 font-bold ${
                setupIsDark
                  ? 'border-white/20 bg-white/5 text-white hover:bg-white/10'
                  : 'border-cyan-600/20 bg-cyan-600/5 text-cyan-700 hover:bg-cyan-600/10'
              }`}
            >
              <ChevronLeft className="mr-1 h-4 w-4" /> Back
            </Button>
          )}
          <Button
            onClick={handleNext}
            disabled={!canProceed() || saving}
            className={`h-14 rounded-2xl font-black shadow-2xl transition-all active:scale-95 ${
              setupIsDark
                ? 'bg-white text-black hover:bg-white/90'
                : 'bg-gradient-to-r from-cyan-600 to-teal-500 text-white hover:from-cyan-500 hover:to-teal-400 shadow-cyan-700/20'
            } ${
              currentStep > 0 && currentStep < 3 ? 'flex-1' : 'w-full max-w-md'
            }`}
          >
            {saving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : currentStep === 3 ? (
              <span className="flex items-center gap-2">Go to Dashboard <Sparkles className={`h-5 w-5 ${setupIsDark ? 'fill-black' : 'fill-white'}`} /></span>
            ) : currentStep === 0 ? (
              <span className="flex items-center gap-2">Let's Go <ChevronRight className="h-5 w-5" /></span>
            ) : (
              <span className="flex items-center gap-2">Continue <ChevronRight className="h-5 w-5" /></span>
            )}
          </Button>
        </div>
      </div>
      <Dialog open={showYearPicker} onOpenChange={setShowYearPicker}>
        <DialogContent className="fixed inset-x-0 bottom-0 top-auto w-full translate-x-0 translate-y-0 rounded-t-[2rem] rounded-b-none border-x-0 border-b-0 px-6 pb-[calc(env(safe-area-inset-bottom,0px)+24px)] pt-4 data-[state=open]:[--tw-enter-translate-y:100%] data-[state=closed]:[--tw-exit-translate-y:100%] data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100 sm:left-1/2 sm:right-auto sm:w-[min(100%,28rem)] sm:-translate-x-1/2 sm:rounded-t-[2rem]">
          <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-muted-foreground/25" />
          <DialogHeader className="items-center text-center sm:text-center">
            <span className="brand-wordmark mb-4 text-[1.85rem] text-foreground" aria-label="Medmacs">Medmacs</span>
            <DialogTitle
              className="text-[1.75rem] font-semibold leading-tight tracking-[-0.045em]"
              style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
            >
              Choose your <span className="font-extrabold text-teal-600 dark:text-teal-300">Year</span>
            </DialogTitle>
            <DialogDescription>This personalizes your medical study path.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[58dvh] overflow-y-auto pr-1">
            {(() => {
              const selectedInstitute = getInstituteByCode(institute, institutes);
              const selectedIsSpecializedTest =
                isSpecializedTestInstitute(selectedInstitute) || isSpecializedTestCode(institute);
              if (selectedIsSpecializedTest) {
                const specialtyOptions = getInstituteYearOptions(selectedInstitute);
                return (
                  <div className="grid grid-cols-2 gap-3">
                    {(specialtyOptions.length ? specialtyOptions : VALID_YEARS).map(option => (
                      <Button
                        key={option}
                        variant={year === option ? 'default' : 'outline'}
                        className="min-h-12 rounded-xl px-3 py-2"
                        onClick={() => {
                          setPendingYearSelection({ year: option, label: formatYearOptionLabel(option) });
                          setShowYearPicker(false);
                        }}
                      >
                        {formatYearOptionLabel(option)}
                      </Button>
                    ))}
                  </div>
                );
              }

              return (
                <div className="space-y-5">
                  {getInstituteProgramCodes(selectedInstitute).map(program => {
                    const styles = PROGRAM_YEAR_OPTION_STYLES[program];
                    return (
                      <section key={program}>
                        <div className="mb-3 flex items-center gap-3" aria-label={`${STUDY_PROGRAMS[program].label} years`}>
                          <span className={`h-px flex-1 ${styles.divider.split(' ')[0]}`} />
                          <span className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] ${styles.divider}`}>
                            {STUDY_PROGRAMS[program].label}
                          </span>
                          <span className={`h-px flex-1 ${styles.divider.split(' ')[0]}`} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          {STUDY_PROGRAMS[program].years.map(optionYear => {
                            const isSelected = year === optionYear && programCode === program;
                            const label = `${optionYear} Year ${STUDY_PROGRAMS[program].label}`;
                            return (
                              <Button
                                key={`${program}:${optionYear}`}
                                variant="outline"
                                aria-pressed={isSelected}
                                className={`min-h-12 rounded-xl border px-3 py-2 text-xs font-bold shadow-none sm:text-sm ${isSelected ? styles.selected : styles.idle}`}
                                onClick={() => {
                                  setPendingYearSelection({ year: optionYear, label, programCode: program });
                                  setShowYearPicker(false);
                                }}
                              >
                                {optionYear} Year
                              </Button>
                            );
                          })}
                        </div>
                      </section>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(pendingYearSelection)} onOpenChange={(open) => { if (!open) setPendingYearSelection(null); }}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-sm rounded-3xl border-border/60 p-6">
          <DialogHeader>
            <DialogTitle className="brand-display text-xl font-extrabold tracking-[-0.035em]">Confirm study <span className="text-teal-600 dark:text-teal-300">year</span></DialogTitle>
            <DialogDescription>
              Continue with <span className="font-bold text-foreground">{pendingYearSelection?.label}</span>?
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 flex gap-3">
            <Button type="button" variant="ghost" className="h-12 flex-1 rounded-xl" onClick={() => setPendingYearSelection(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="h-12 flex-1 rounded-xl font-bold"
              disabled={saving}
              onClick={handleConfirmYearSelection}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SetupWizard;
