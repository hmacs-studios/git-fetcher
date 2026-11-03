import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  ChevronLeft, User, Loader2, XCircle, Shield, Star, Crown, Lock, CreditCard, Users, Gift, Copy,
  GraduationCap, Building2, Mail, Settings, ExternalLink, CheckCircle2, Sparkles,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import Seo from '@/components/Seo';
import ProfileAvatar from '@/components/profile/ProfileAvatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fetchInstitutes, getInstituteByCode, getInstituteDisplayName, isSpecializedTestInstitute, type Institute } from '@/utils/institutes';
import PageSkeleton from '@/components/skeletons/PageSkeleton';
import { useAchievementData } from '@/components/profile/AchievementBadges';
import { motion, type Variants } from 'framer-motion';
import { getUsernameValidationError, isUsernameConflict, normalizeUsername } from '@/utils/username';
import {
    getEffectiveProgramCode,
    getInstituteProgramYearOptions,
    type StudyProgramCode,
} from '@/utils/studyPrograms';
import { getEffectivePlan } from '@/utils/subscription';

const planStyles = {
    free: { gradient: 'from-slate-500 via-slate-600 to-slate-700', icon: Shield, accent: 'bg-slate-300' },
    premium: { gradient: 'from-blue-600 via-indigo-600 to-violet-700', icon: Star, accent: 'bg-yellow-400' },
    iconic: { gradient: 'from-rose-600 via-red-600 to-orange-700', icon: Crown, accent: 'bg-amber-400' },
};

const easing = [0.25, 0.1, 0.25, 1] as const;

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.07 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: easing } },
};

const Profile = () => {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const { user, loading: authLoading } = useAuth();

    const [editableProfile, setEditableProfile] = useState<{
        full_name: string;
        username: string;
        year: string;
        program_code: StudyProgramCode;
    }>({ full_name: '', username: '', year: '', program_code: 'mbbs' });
    const [loadingUpdateProfile, setLoadingUpdateProfile] = useState(false);
    const [showStatsModal, setShowStatsModal] = useState(false);
    const [showStudyPathModal, setShowStudyPathModal] = useState(false);
    const [studyPathOtp, setStudyPathOtp] = useState('');
    const [studyPathOtpSent, setStudyPathOtpSent] = useState(false);
    const [sendingStudyPathOtp, setSendingStudyPathOtp] = useState(false);
    const [verifyingStudyPathOtp, setVerifyingStudyPathOtp] = useState(false);
    const [institutes, setInstitutes] = useState<Institute[]>([]);
    const [copiedReferral, setCopiedReferral] = useState(false);
    const planColors = {
        'free': { light: 'bg-purple-100 text-purple-800 border-purple-300', dark: 'dark:bg-purple-900/30 dark:text-purple-200 dark:border-purple-700' },
        'premium': { light: 'bg-yellow-100 text-yellow-800 border-yellow-300', dark: 'dark:bg-yellow-900/30 dark:text-yellow-200 dark:border-yellow-700' },
        'pro': { light: 'bg-green-100 text-green-800 border-green-300', dark: 'dark:bg-green-900/30 dark:text-green-200 dark:border-green-700' },
        'iconic': { light: 'bg-red-100 text-red-800 border-red-300', dark: 'dark:bg-red-900/30 dark:text-red-200 dark:border-red-700' },
        'default': { light: 'bg-gray-100 text-gray-800 border-gray-300', dark: 'dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600' }
    };

    const { data: profileData, isLoading: profileLoading, isError: profileFetchError, error: profileFetchErrorMessage } = useQuery({
        queryKey: ['profile-page', user?.id],
        queryFn: async () => {
            if (!user?.id) return null;
            const { data, error } = await supabase.from('profiles').select('id, full_name, username, email, avatar_url, plan, plan_expiry_date, role, year, program_code, institute, badges, referral_code, study_path_changed_at').eq('id', user.id).maybeSingle();
            if (error && error.code !== 'PGRST116') throw new Error(error.message);
            return data;
        },
        enabled: !!user?.id && !authLoading,
        staleTime: 1000 * 60,
    });

    useEffect(() => {
        fetchInstitutes().then(setInstitutes);
    }, []);

    useEffect(() => {
        if (profileData) {
            setEditableProfile({
                full_name: profileData.full_name ?? user?.user_metadata?.full_name ?? '',
                username: profileData.username ?? user?.user_metadata?.username ?? '',
                year: profileData.year ?? '',
                program_code: getEffectiveProgramCode((profileData as any).program_code),
            });
        }
    }, [profileData]);

    const displayName = editableProfile.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
    const userEmail = profileData?.email || user?.email || 'N/A';
    const rawUserPlan = getEffectivePlan(profileData?.plan, profileData?.plan_expiry_date);
    const userPlanDisplayName = rawUserPlan.charAt(0).toUpperCase() + rawUserPlan.slice(1) + ' Plan';
    const planExpiryDate = rawUserPlan === 'free' ? null : profileData?.plan_expiry_date;
    const style = planStyles[rawUserPlan] || planStyles.free;
    const PlanIcon = style.icon;

    const userInstituteCode = (profileData as any)?.institute || '';
    const userInstituteName = getInstituteDisplayName(userInstituteCode, institutes);
    const selectedInstitute = getInstituteByCode(userInstituteCode, institutes);
    const selectedSpecializedTest = isSpecializedTestInstitute(selectedInstitute);
    const studyPathChangedAt = (profileData as any)?.study_path_changed_at ? new Date((profileData as any).study_path_changed_at) : null;
    const nextStudyPathChangeAt = studyPathChangedAt ? new Date(studyPathChangedAt.getTime() + 7 * 24 * 60 * 60 * 1000) : null;
    const canChangeStudyPath = !nextStudyPathChangeAt || nextStudyPathChangeAt.getTime() <= Date.now();
    const nextStudyPathChangeLabel = nextStudyPathChangeAt?.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
    const { data: achievementData } = useAchievementData(user?.id);

    useEffect(() => {
        if (!canChangeStudyPath) {
            setShowStudyPathModal(false);
            setStudyPathOtp('');
            setStudyPathOtpSent(false);
        }
    }, [canChangeStudyPath]);
    const achievementStats = achievementData?.stats || {
        lifetimeMcqs: 0, flpCompletions: 0, aiChatSessions: 0, points: 0, accuracy: 0,
    };

    const updateProfile = async (e) => {
        e.preventDefault();
        if (!editableProfile.full_name.trim() || !editableProfile.username.trim() || (!selectedSpecializedTest && !editableProfile.year.trim())) {
            toast.error("Please fill in all required fields.");
            return;
        }
        const normalizedUsername = normalizeUsername(editableProfile.username);
        const usernameValidationError = getUsernameValidationError(normalizedUsername);
        if (usernameValidationError) {
            toast.error(usernameValidationError);
            return;
        }
        setLoadingUpdateProfile(true);
        try {
            const { data: existingProfile, error: checkError } = await supabase.from('profiles').select('id').ilike('username', normalizedUsername).neq('id', user?.id).maybeSingle();
            if (checkError && checkError.code !== 'PGRST116') throw checkError;
            if (existingProfile) { toast.error("Username already in use."); setLoadingUpdateProfile(false); return; }
            const { error } = await supabase.from('profiles').upsert({
                id: user?.id, full_name: editableProfile.full_name.trim(),
                username: normalizedUsername,
                year: selectedSpecializedTest ? null : editableProfile.year.trim(),
                program_code: selectedSpecializedTest ? null : editableProfile.program_code,
                updated_at: new Date().toISOString()
            }, { onConflict: 'id' });
            if (error) throw error;
            queryClient.invalidateQueries({ queryKey: ['profile', user.id] });
            queryClient.invalidateQueries({ queryKey: ['profile-page', user.id] });
            toast.success("Profile updated successfully.");
        } catch (error) {
            toast.error(isUsernameConflict(error) ? 'Username already in use.' : error.message || "Failed to update profile.");
        } finally { setLoadingUpdateProfile(false); }
    };

    const copyReferralCode = () => {
        if (!profileData?.referral_code) return;
        navigator.clipboard.writeText(profileData.referral_code);
        setCopiedReferral(true);
        toast.success('Referral code copied!');
        setTimeout(() => setCopiedReferral(false), 2500);
    };

    const sendStudyPathOtp = async () => {
        if (!user?.email) {
            toast.error('No email is attached to this account.');
            return;
        }
        const { data: latestProfile, error: cooldownError } = await supabase
            .from('profiles')
            .select('study_path_changed_at')
            .eq('id', user.id)
            .maybeSingle();
        if (cooldownError) {
            toast.error('Could not verify the institute-change cooldown. Please try again.');
            return;
        }
        const latestChangedAt = latestProfile?.study_path_changed_at ? new Date(latestProfile.study_path_changed_at) : null;
        const latestNextChangeAt = latestChangedAt && !Number.isNaN(latestChangedAt.getTime())
            ? new Date(latestChangedAt.getTime() + 7 * 24 * 60 * 60 * 1000)
            : null;
        if (latestNextChangeAt && latestNextChangeAt.getTime() > Date.now()) {
            setShowStudyPathModal(false);
            toast.error(`You can change this once per week. Try again after ${latestNextChangeAt.toLocaleString()}.`);
            return;
        }

        setSendingStudyPathOtp(true);
        try {
            const { error } = await supabase.auth.signInWithOtp({
                email: user.email,
                options: { shouldCreateUser: false },
            });
            if (error) {
                toast.error(error.message || 'Could not send the email code.');
                return;
            }
            setStudyPathOtpSent(true);
            toast.success('Verification code sent to your email.');
        } finally {
            setSendingStudyPathOtp(false);
        }
    };

    const openStudyPathChangeModal = () => {
        if (!canChangeStudyPath) {
            toast.error(`You can request another institute or Post Graduate Exam change after ${nextStudyPathChangeLabel}.`);
            return;
        }
        setStudyPathOtp('');
        setStudyPathOtpSent(false);
        setShowStudyPathModal(true);
    };

    const verifyStudyPathChange = async (event) => {
        event.preventDefault();
        if (!user?.email || studyPathOtp.trim().length < 6) {
            toast.error('Please enter the 6-digit email code.');
            return;
        }
        if (!canChangeStudyPath) {
            toast.error(`You can change this once per week. Try again after ${nextStudyPathChangeLabel}.`);
            return;
        }

        setVerifyingStudyPathOtp(true);
        try {
            const { error } = await supabase.auth.verifyOtp({
                email: user.email,
                token: studyPathOtp.trim(),
                type: 'email',
            });
            if (error) {
                toast.error(error.message || 'Email code verification failed.');
                return;
            }

            sessionStorage.setItem('medmacs_setup_change_verified', JSON.stringify({
                userId: user.id,
                verifiedAt: Date.now(),
            }));
            setShowStudyPathModal(false);
            setStudyPathOtp('');
            setStudyPathOtpSent(false);
            navigate('/setup');
        } finally {
            setVerifyingStudyPathOtp(false);
        }
    };

    if (authLoading || profileLoading) {
        return <PageSkeleton />;
    }

    if (profileFetchError) {
        return (
            <div className="dashboard-modern-font flex min-h-screen items-center justify-center bg-background p-6">
                <div className="text-center">
                    <XCircle className="mx-auto mb-4 h-10 w-10 text-destructive" />
                    <p className="font-bold text-destructive">{profileFetchErrorMessage?.message || 'Error loading profile.'}</p>
                    <Button variant="outline" className="mt-4 rounded-xl" onClick={() => window.location.reload()}>
                        Try Again
                    </Button>
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="dashboard-modern-font flex min-h-screen items-center justify-center bg-background p-6">
                <div className="text-center">
                    <User className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
                    <p className="font-bold text-muted-foreground">Please log in to view your profile.</p>
                    <Button asChild className="mt-4 rounded-xl">
                        <Link to="/login">Go to Login</Link>
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="dashboard-modern-font relative flex h-[100dvh] w-full flex-col overflow-hidden bg-gradient-to-b from-background via-primary/[0.055] to-background text-foreground">
            <Seo title="User Profile" description="Manage your Medmacs profile" canonical="https://medmacs.app/profile" />

            {/* Ambient orbs */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -left-32 -top-24 h-80 w-80 rounded-full bg-primary/15 blur-[110px]" />
                <div className="absolute -right-32 top-[38%] h-72 w-72 rounded-full bg-sky-500/10 blur-[110px]" />
                <div className="absolute -bottom-24 left-1/4 h-64 w-64 rounded-full bg-primary/10 blur-[110px]" />
            </div>

            {/* Fixed glass header */}
            <header className="fixed inset-x-0 top-0 z-50 border-b border-border/30 bg-background/75 pt-[env(safe-area-inset-top)] backdrop-blur-2xl">
                <div className="mx-auto grid h-14 max-w-2xl grid-cols-[1fr_auto_1fr] items-center px-5">
                    <img src="/lovable-uploads/bf69a7f7-550a-45a1-8808-a02fb889f8c5.png" alt="Medmacs" className="h-9 w-9 object-contain" />
                    <h1 className="brand-wordmark text-xl text-foreground">My Profile</h1>
                    <div aria-hidden="true" />
                </div>
            </header>

            {/* Scrollable content */}
            <div className="relative z-10 min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-[calc(env(safe-area-inset-top)+3.5rem)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="mx-auto max-w-2xl py-5">
                    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-5">

                        {/* Profile hero card */}
                        <motion.div variants={itemVariants}>
                            <div
                                role="button"
                                tabIndex={0}
                                onClick={() => setShowStatsModal(true)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') setShowStatsModal(true);
                                }}
                                className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${style.gradient} text-white shadow-xl shadow-primary/10 active:scale-[0.99] transition-transform cursor-pointer`}
                            >
                                <div className="absolute -bottom-4 -right-4 opacity-[0.1]">
                                    <PlanIcon className="h-28 w-28" />
                                </div>
                                <div className="absolute inset-0 opacity-10" style={{
                                    backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 20px, rgba(255,255,255,0.4) 20px, rgba(255,255,255,0.4) 40px)`,
                                    maskImage: 'radial-gradient(circle at center, black 30%, transparent 80%)'
                                }} />
                                <div className="relative z-10 flex items-center gap-4 p-6">
                                    <div className="shrink-0" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                                        <ProfileAvatar user={user} profileData={profileData} displayName={displayName} rawUserPlan={rawUserPlan} userPlanDisplayName={userPlanDisplayName} planColors={planColors} isHeader={false} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h2 className="truncate text-xl font-black italic uppercase tracking-tight">{displayName}</h2>
                                        <p className="truncate text-xs text-white/60">{userEmail}</p>
                                        <div className="mt-2 flex flex-wrap items-center gap-2">
                                            <Badge className="border-white/20 bg-white/20 text-[10px] font-extrabold uppercase tracking-widest text-white">
                                                <PlanIcon className="mr-1 h-3 w-3" />
                                                {userPlanDisplayName}
                                            </Badge>
                                            {planExpiryDate && (
                                                <span className="text-[9px] font-bold uppercase tracking-widest text-white/45">
                                                    Expires {new Date(planExpiryDate).toLocaleDateString()}
                                                </span>
                                            )}
                                        </div>
                                        <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-white/45">
                                            Tap to view stats
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </motion.div>

                        {/* Referral code card */}
                        {profileData?.referral_code && (
                            <motion.div variants={itemVariants}>
                                <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 text-white shadow-xl shadow-emerald-500/15">
                                    <div className="absolute -bottom-5 -right-5 opacity-[0.12]">
                                        <Gift className="h-24 w-24" />
                                    </div>
                                    <div className="relative z-10 p-5">
                                        <div className="mb-1 flex items-center gap-2">
                                            <Gift className="h-4 w-4 text-emerald-200" />
                                            <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-200">
                                                Your Referral Code
                                            </span>
                                        </div>
                                        <div className="mt-3 flex flex-col gap-2.5">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={copyReferralCode}
                                                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm border-2 border-white/20 transition-colors hover:bg-white/20 active:scale-95"
                                                >
                                                    {copiedReferral ? (
                                                        <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                                                    ) : (
                                                        <Copy className="h-5 w-5 text-white" />
                                                    )}
                                                </button>
                                                <div className="flex-1 rounded-2xl bg-white/10 backdrop-blur-sm px-4 py-2.5 border border-white/15 min-w-0 text-center">
                                                    <span className="text-lg font-black tracking-[0.25em] select-all sm:text-2xl truncate block">
                                                        {profileData.referral_code}
                                                    </span>
                                                </div>
                                            </div>

                                            <Link
                                                to="/referrals"
                                                className="flex h-10 w-full items-center justify-center gap-1.5 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20 text-xs font-extrabold uppercase tracking-widest text-white transition-colors hover:bg-white/25 active:scale-[0.99]"
                                            >
                                                Details
                                                <ExternalLink className="h-3.5 w-3.5" />
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* Personal Information card */}
                        <motion.div variants={itemVariants}>
                            <div className="relative overflow-hidden rounded-3xl border border-border/40 bg-card/85 shadow-sm backdrop-blur-xl">
                                <div className="relative z-10 p-5">
                                    <div className="mb-5 flex items-center gap-2">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                                            <Settings className="h-4 w-4 text-primary" />
                                        </div>
                                        <h3 className="text-base font-black uppercase tracking-tight text-foreground">
                                            Personal Information
                                        </h3>
                                    </div>
                                    <form onSubmit={updateProfile} className="space-y-4">
                                        <div>
                                            <Label htmlFor="email" className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
                                                <Mail className="mr-1 inline h-3 w-3" /> Email
                                            </Label>
                                            <Input id="email" type="email" value={userEmail} disabled
                                                className="mt-1.5 h-11 rounded-xl border-border/40 bg-muted/30 text-muted-foreground cursor-not-allowed" />
                                        </div>
                                        <div>
                                            <Label htmlFor="institute" className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
                                                <Building2 className="mr-1 inline h-3 w-3" /> {selectedSpecializedTest ? 'Post Graduate Exam' : 'Institute'}
                                            </Label>
                                            <div className="mt-1.5 flex gap-2">
                                                <Input id="institute" value={userInstituteName} disabled
                                                    className="h-11 rounded-xl border-border/40 bg-muted/30 text-muted-foreground cursor-not-allowed" />
                                                {canChangeStudyPath && (
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        className="h-11 rounded-xl font-bold"
                                                        onClick={openStudyPathChangeModal}
                                                    >
                                                        Change
                                                    </Button>
                                                )}
                                            </div>
                                            <p className="mt-1 text-[10px] text-muted-foreground/60">
                                                You can change this once per week. Email OTP verification is required.
                                                {!canChangeStudyPath && nextStudyPathChangeLabel ? ` Next change available after ${nextStudyPathChangeLabel}.` : ''}
                                            </p>
                                        </div>
                                        <div>
                                            <Label htmlFor="full_name" className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
                                                <User className="mr-1 inline h-3 w-3" /> Full Name *
                                            </Label>
                                            <Input id="full_name" value={editableProfile.full_name}
                                                onChange={(e) => setEditableProfile({ ...editableProfile, full_name: e.target.value })}
                                                className="mt-1.5 h-11 rounded-xl border-border/40 bg-muted/20 text-foreground placeholder:text-muted-foreground/50" required />
                                        </div>
                                        <div>
                                            <Label htmlFor="username" className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
                                                <User className="mr-1 inline h-3 w-3" /> Username *
                                            </Label>
                                            <Input id="username" value={editableProfile.username}
                                                onChange={(e) => setEditableProfile({ ...editableProfile, username: e.target.value.toLowerCase() })}
                                                autoCapitalize="none" autoCorrect="off" spellCheck={false}
                                                className="mt-1.5 h-11 rounded-xl border-border/40 bg-muted/20 text-foreground placeholder:text-muted-foreground/50" required />
                                            <p className="mt-1 text-[10px] text-muted-foreground/60">Displayed on leaderboards</p>
                                        </div>
                                        {!selectedSpecializedTest && (
                                            <div>
                                                <Label htmlFor="year" className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
                                                    <GraduationCap className="mr-1 inline h-3 w-3" /> Year of Study *
                                                </Label>
                                                <Select
                                                    value={`${editableProfile.program_code}:${editableProfile.year}`}
                                                    onValueChange={(value) => {
                                                        const [nextProgram, nextYear] = value.split(':');
                                                        setEditableProfile({
                                                            ...editableProfile,
                                                            program_code: getEffectiveProgramCode(nextProgram),
                                                            year: nextYear,
                                                        });
                                                    }}
                                                >
                                                    <SelectTrigger className="mt-1.5 h-11 rounded-xl border-border/40 bg-muted/20 text-foreground">
                                                        <SelectValue placeholder="Select your year" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {getInstituteProgramYearOptions(selectedInstitute).map((option) => (
                                                            <SelectItem
                                                                key={`${option.programCode}:${option.year}`}
                                                                value={`${option.programCode}:${option.year}`}
                                                            >
                                                                {option.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        )}
                                        <Button type="submit" disabled={loadingUpdateProfile}
                                            className="h-12 w-full rounded-xl bg-gradient-to-r from-[#2dd4bf] to-[#0ea5e9] font-extrabold text-white shadow-lg shadow-[#0ea5e9]/20 transition-all hover:scale-[1.02] active:scale-95">
                                            {loadingUpdateProfile ? (
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            ) : (
                                                <Sparkles className="mr-2 h-4 w-4" />
                                            )}
                                            Update Profile
                                        </Button>
                                    </form>
                                </div>
                            </div>
                        </motion.div>

                        {/* Quick links */}
                        <motion.div variants={itemVariants}>
                            <div className="rounded-2xl border border-border/40 bg-card shadow-sm overflow-hidden divide-y divide-border/40">
                                <Link to="/referrals" className="flex items-center justify-between p-4 transition-colors hover:bg-muted/50 active:bg-muted/80">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                                            <Gift className="h-5 w-5 text-primary" />
                                        </div>
                                        <span className="text-sm font-bold text-foreground">Referrals</span>
                                    </div>
                                    <ChevronLeft className="h-4 w-4 text-muted-foreground rotate-180" />
                                </Link>
                                <Link to="/profile/password" className="flex items-center justify-between p-4 transition-colors hover:bg-muted/50 active:bg-muted/80">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                                            <Lock className="h-5 w-5 text-muted-foreground" />
                                        </div>
                                        <span className="text-sm font-bold text-foreground">Change Password</span>
                                    </div>
                                    <ChevronLeft className="h-4 w-4 text-muted-foreground rotate-180" />
                                </Link>
                                <Link to="/pricing" className="flex items-center justify-between p-4 transition-colors hover:bg-muted/50 active:bg-muted/80">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                                            <CreditCard className="h-5 w-5 text-muted-foreground" />
                                        </div>
                                        <div>
                                            <span className="text-sm font-bold text-foreground">Subscription</span>
                                            <p className="text-xs text-muted-foreground">{userPlanDisplayName}{planExpiryDate ? ` · Expires ${new Date(planExpiryDate).toLocaleDateString()}` : ''}</p>
                                        </div>
                                    </div>
                                    <ChevronLeft className="h-4 w-4 text-muted-foreground rotate-180" />
                                </Link>
                                <Link to="/teams" className="flex items-center justify-between p-4 transition-colors hover:bg-muted/50 active:bg-muted/80">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                                            <Users className="h-5 w-5 text-muted-foreground" />
                                        </div>
                                        <span className="text-sm font-bold text-foreground">About Us</span>
                                    </div>
                                    <ChevronLeft className="h-4 w-4 text-muted-foreground rotate-180" />
                                </Link>
                            </div>
                        </motion.div>

                        {/* Footer */}
                        <div className="text-center pt-6 pb-2">
                            <p className="text-[10px] text-muted-foreground font-medium">A Project by Hmacs Studios.</p>
                            <p className="text-[10px] text-muted-foreground mt-1">© 2026 Hmacs Studios. All rights reserved</p>
                        </div>

                    </motion.div>
                </div>
            </div>

            {/* Stats Modal */}
            <Dialog open={showStatsModal} onOpenChange={setShowStatsModal}>
                <DialogContent className="sm:max-w-[430px] rounded-[2rem]">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black">Your Stats</DialogTitle>
                        <DialogDescription>Lifetime learning progress on Medmacs.</DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-3">
                        {[
                            { label: 'Lifetime MCQs', value: achievementStats.lifetimeMcqs },
                            { label: 'FLPs Completed', value: achievementStats.flpCompletions },
                            { label: 'AI Chats', value: achievementStats.aiChatSessions },
                            { label: 'Points', value: achievementStats.points },
                            { label: 'Accuracy', value: `${achievementStats.accuracy}%` },
                        ].map((stat) => (
                            <div key={stat.label} className="rounded-2xl border border-border/40 bg-muted/30 p-4">
                                <p className="text-2xl font-black text-primary">{stat.value}</p>
                                <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{stat.label}</p>
                            </div>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
            <Dialog open={showStudyPathModal} onOpenChange={setShowStudyPathModal}>
                <DialogContent className="sm:max-w-[430px] rounded-[2rem]">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black">Verify Email</DialogTitle>
                        <DialogDescription>
                            Institute or Post Graduate Exam can be changed once per week. We will send a 6-digit code to {userEmail}.
                        </DialogDescription>
                    </DialogHeader>
                    {!canChangeStudyPath && nextStudyPathChangeLabel ? (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                            Your study path was changed recently. You can change it again after {nextStudyPathChangeLabel}.
                        </div>
                    ) : (
                        <form onSubmit={verifyStudyPathChange} className="space-y-4">
                            <div className="rounded-2xl border border-border/50 bg-muted/30 p-3 text-xs font-medium text-muted-foreground">
                                This change is allowed once per week. After you save the new institute or test, the next change unlocks 7 days later.
                            </div>
                            {!studyPathOtpSent ? (
                                <Button type="button" onClick={sendStudyPathOtp} disabled={sendingStudyPathOtp} className="w-full rounded-xl font-bold">
                                    {sendingStudyPathOtp ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                                    Send Email Code
                                </Button>
                            ) : (
                                <>
                                    <div>
                                        <Label htmlFor="study-path-otp">Email code</Label>
                                        <Input
                                            id="study-path-otp"
                                            inputMode="numeric"
                                            maxLength={6}
                                            value={studyPathOtp}
                                            onChange={(event) => setStudyPathOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                                            placeholder="Enter 6-digit code"
                                            className="mt-1.5 h-11 rounded-xl text-center text-lg font-black tracking-[0.35em]"
                                        />
                                    </div>
                                    <div className="grid gap-2 sm:grid-cols-2">
                                        <Button type="button" variant="outline" onClick={sendStudyPathOtp} disabled={sendingStudyPathOtp} className="rounded-xl font-bold">
                                            {sendingStudyPathOtp ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                                            Resend
                                        </Button>
                                        <Button type="submit" disabled={verifyingStudyPathOtp || studyPathOtp.length < 6} className="rounded-xl font-bold">
                                            {verifyingStudyPathOtp ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Shield className="mr-2 h-4 w-4" />}
                                            Continue
                                        </Button>
                                    </div>
                                </>
                            )}
                        </form>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default Profile;
