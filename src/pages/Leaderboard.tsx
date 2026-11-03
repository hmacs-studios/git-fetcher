import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Trophy, Medal, Award, Crown, Star, Target, Users, Globe2, School, CalendarDays } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ProfileDropdown } from '@/components/ProfileDropdown';
import { useState, useEffect, useMemo, useRef } from 'react';
import Seo from '@/components/Seo';
import PlanBadge from '@/components/PlanBadge';
import PageSkeleton from '@/components/skeletons/PageSkeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fetchInstitutes, getInstituteByCode, getInstituteDisplayName, isSpecializedTestInstitute } from '@/utils/institutes';
import { fetchLeaderboardEntries, leaderboardQueryKey, type LeaderboardEntry, type LeaderboardPeriod, type LeaderboardScope } from '@/services/leaderboard';

type LeaderboardProfile = {
    id: string;
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
    plan?: string | null;
    institute: string | null;
    year: string | null;
};

const PERIOD_LABELS: Record<LeaderboardPeriod, string> = {
    'all-time': 'All time',
    monthly: 'Monthly',
    weekly: 'Weekly',
};

const getPakistanPeriodRange = (period: LeaderboardPeriod) => {
    if (period === 'all-time') return null;

    const pakistanOffsetMs = 5 * 60 * 60 * 1000;
    const pakistanNow = new Date(Date.now() + pakistanOffsetMs);
    const year = pakistanNow.getUTCFullYear();
    const month = pakistanNow.getUTCMonth();
    const day = pakistanNow.getUTCDate();

    if (period === 'monthly') {
        return {
            start: new Date(Date.UTC(year, month, 1) - pakistanOffsetMs),
            end: new Date(Date.UTC(year, month + 1, 1) - pakistanOffsetMs),
        };
    }

    const utcDay = pakistanNow.getUTCDay();
    const daysSinceMonday = (utcDay + 6) % 7;
    return {
        start: new Date(Date.UTC(year, month, day - daysSinceMonday) - pakistanOffsetMs),
        end: new Date(Date.UTC(year, month, day - daysSinceMonday + 7) - pakistanOffsetMs),
    };
};

const formatPakistanDate = (date: Date) =>
    new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Karachi',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    }).format(date);

const getPeriodDetailLabel = (period: LeaderboardPeriod) => {
    const periodRange = getPakistanPeriodRange(period);

    if (!periodRange) return 'All historical attempts';

    if (period === 'monthly') {
        return `Month of ${new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Karachi',
            month: 'long',
            year: 'numeric',
        }).format(periodRange.start)}`;
    }

    const inclusiveEnd = new Date(periodRange.end.getTime() - 1);
    return `From ${formatPakistanDate(periodRange.start)} to ${formatPakistanDate(inclusiveEnd)}`;
};

const Leaderboard = () => {
    const { user } = useAuth();
    const [activeScope, setActiveScope] = useState<LeaderboardScope>('pakistan');
    const [activePeriod, setActivePeriod] = useState<LeaderboardPeriod>('all-time');
    const headerRef = useRef<HTMLDivElement>(null);
    const lastScrollY = useRef(0);
    const [headerVisible, setHeaderVisible] = useState(true);

    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY;
            setHeaderVisible(currentScrollY < lastScrollY.current || currentScrollY < 10);
            lastScrollY.current = currentScrollY;
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const { data: currentProfile } = useQuery<LeaderboardProfile | null>({
        queryKey: ['leaderboard-current-profile', user?.id],
        queryFn: async () => {
            if (!user?.id) return null;
            const { data, error } = await supabase
                .from('profiles')
                .select('id, username, full_name, avatar_url, plan, institute, year')
                .eq('id', user.id)
                .maybeSingle();
            if (error) return null;
            return data as LeaderboardProfile | null;
        },
        enabled: !!user?.id,
    });

    const { data: institutes = [] } = useQuery({
        queryKey: ['leaderboard-institutes'],
        queryFn: () => fetchInstitutes(),
    });

    const instituteName = currentProfile?.institute
        ? getInstituteDisplayName(currentProfile.institute, institutes)
        : 'Institute Name';
    const selectedInstitute = currentProfile?.institute
        ? getInstituteByCode(currentProfile.institute, institutes)
        : null;
    const selectedSpecializedTest = isSpecializedTestInstitute(selectedInstitute);
    const yearCampusLabel = currentProfile?.year && currentProfile?.institute
        ? `${currentProfile.year} Year ${currentProfile.institute}`
        : 'Year Campus';

    const hasInstituteScope = !!currentProfile?.institute;
    const hasYearCampusScope = !!currentProfile?.institute && !!currentProfile?.year && !selectedSpecializedTest;
    useEffect(() => {
        if (activeScope === 'institute' && !hasInstituteScope) setActiveScope('pakistan');
        if (activeScope === 'year-campus' && !hasYearCampusScope) setActiveScope('pakistan');
    }, [activeScope, hasInstituteScope, hasYearCampusScope]);

    const { data: leaderboardData = [], isLoading } = useQuery<LeaderboardEntry[]>({
        queryKey: leaderboardQueryKey(user?.id, activeScope, activePeriod, currentProfile?.institute, currentProfile?.year),
        queryFn: () => fetchLeaderboardEntries(activeScope, activePeriod, user?.id),
        enabled: !!user?.id && (activeScope === 'pakistan' || !!currentProfile),
        staleTime: 1000 * 60,
    });

    const visibleLeaders = leaderboardData.filter(entry => entry.rank_position <= 50);
    const currentUserData = leaderboardData.find(entry => entry.user_id === user?.id);
    const userRank = currentUserData?.rank_position || 0;

    const activeScopeLabel = useMemo(() => {
        if (activeScope === 'institute') return instituteName;
        if (activeScope === 'year-campus') return yearCampusLabel;
        return 'All over Pakistan';
    }, [activeScope, instituteName, yearCampusLabel]);

    const periodDetailLabel = useMemo(() => getPeriodDetailLabel(activePeriod), [activePeriod]);

    const emptyStateMessage = useMemo(() => {
        const period = activePeriod === 'all-time' ? 'yet' : activePeriod === 'monthly' ? 'this month' : 'this week';
        if (activeScope === 'institute') return `No rankings ${period} for ${instituteName}.`;
        if (activeScope === 'year-campus') return `No rankings ${period} for ${yearCampusLabel}.`;
        return `No rankings ${period}. Start practicing!`;
    }, [activePeriod, activeScope, instituteName, yearCampusLabel]);

    const getRankIcon = (rank: number) => {
        switch (rank) {
            case 1: return <Crown className="w-5 h-5 md:w-6 md:h-6 text-yellow-500" />;
            case 2: return <Medal className="w-5 h-5 md:w-6 md:h-6 text-gray-400" />;
            case 3: return <Award className="w-5 h-5 md:w-6 md:h-6 text-amber-600" />;
            default: return <Trophy className="w-5 h-5 md:w-6 md:h-6 text-primary" />;
        }
    };

    const getRankBadge = (rank: number) => {
        if (rank <= 3) {
            return rank === 1 ? 'bg-gradient-to-r from-yellow-400 to-yellow-600' :
                rank === 2 ? 'bg-gradient-to-r from-gray-300 to-gray-500' :
                    'bg-gradient-to-r from-amber-400 to-amber-600';
        }
        return 'bg-gradient-to-r from-primary to-accent-foreground';
    };

    return (
        <div className="min-h-screen w-full bg-background">
            <Seo title="Leaderboard" description="See how you rank against other students on the Medmacs leaderboard." canonical="https://medmacs.app/leaderboard" />

            <div
                ref={headerRef}
                className={`fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/40 pt-[env(safe-area-inset-top)] transition-transform duration-300 ${headerVisible ? 'translate-y-0' : '-translate-y-full'}`}
            >
                <div className="container mx-auto grid h-14 grid-cols-[1fr_auto_1fr] items-center px-4 lg:px-8">
                    <img src="/lovable-uploads/bf69a7f7-550a-45a1-8808-a02fb889f8c5.png" alt="Medmacs" className="h-9 w-9 object-contain" />
                    <h1 className="brand-wordmark text-xl text-foreground">Leaderboard</h1>
                    <div className="flex items-center justify-self-end">
                        <ProfileDropdown />
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-4 lg:px-8 py-6 lg:py-8 mt-[var(--header-height)]">
                <div className="text-center mb-6 lg:mb-8 animate-fade-in">
                    <h1 className="text-2xl md:text-3xl lg:text-4xl font-black tracking-tight text-foreground mb-3">
                        🏆 Leaderboard
                    </h1>
                    <p className="text-sm md:text-base lg:text-lg font-medium text-muted-foreground max-w-2xl mx-auto">
                        Track your progress, compare scores, and climb the rankings with every practice session.
                    </p>
                </div>

                <div className="mb-6 lg:mb-8 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <Tabs value={activeScope} onValueChange={(value) => setActiveScope(value as LeaderboardScope)} className="w-full lg:w-auto">
                        <TabsList className="grid h-auto w-full grid-cols-3 rounded-2xl bg-muted/70 p-1 lg:w-auto">
                            <TabsTrigger value="pakistan" className="rounded-xl px-2 py-2 text-[11px] font-bold sm:text-sm">
                                <Globe2 className="mr-1.5 h-3.5 w-3.5" />
                                All over Pakistan
                            </TabsTrigger>
                            <TabsTrigger disabled={!hasInstituteScope} value="institute" className="rounded-xl px-2 py-2 text-[11px] font-bold sm:text-sm">
                                <School className="mr-1.5 h-3.5 w-3.5" />
                                {selectedSpecializedTest ? 'Post Graduate Exams' : 'Your Institute'}
                            </TabsTrigger>
                            <TabsTrigger disabled={!hasYearCampusScope} value="year-campus" className="rounded-xl px-2 py-2 text-[11px] font-bold sm:text-sm">
                                <Target className="mr-1.5 h-3.5 w-3.5" />
                                Your Batch
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>

                    <div className="flex items-center gap-2 lg:justify-end">
                        <CalendarDays className="h-4 w-4 text-primary" />
                        <Select value={activePeriod} onValueChange={(value) => setActivePeriod(value as LeaderboardPeriod)}>
                            <SelectTrigger className="h-11 w-full rounded-xl border-border/60 bg-card/80 font-bold lg:w-[150px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all-time">All time</SelectItem>
                                <SelectItem value="monthly">Monthly</SelectItem>
                                <SelectItem value="weekly">Weekly</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
                            {activeScopeLabel} / {PERIOD_LABELS[activePeriod]}
                        </p>
                        <p className="mt-1 text-xs font-medium text-primary">
                            {periodDetailLabel}
                        </p>
                    </div>
                    {(activeScope !== 'pakistan' && (!hasInstituteScope || (activeScope === 'year-campus' && !hasYearCampusScope))) && (
                        <p className="text-xs text-muted-foreground">Complete your profile setup to unlock this leaderboard.</p>
                    )}
                </div>

                {currentUserData && (
                    <Card className="mb-6 lg:mb-8 bg-gradient-to-br from-primary/5 to-accent border-border hover:shadow-lg transition-all duration-300 animate-scale-in backdrop-blur-sm">
                        <CardHeader className="p-4 lg:p-6">
                            <CardTitle className="flex items-center space-x-2 text-foreground text-lg md:text-xl">
                                <Target className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                                <span>Your Current Rank</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 lg:p-6 pt-0">
                            <div className="flex items-center justify-between flex-wrap gap-4">
                                <div className="flex items-center space-x-3 md:space-x-4">
                                    <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-r from-primary to-primary/70 rounded-full flex items-center justify-center overflow-hidden">
                                        {currentProfile?.avatar_url ? (
                                            <img src={currentProfile?.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-primary-foreground font-bold text-lg md:text-xl">
                                                {currentUserData.username?.substring(0, 2).toUpperCase() || 'U'}
                                            </span>
                                        )}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-foreground text-sm md:text-base">{currentUserData.username}</p>
                                        <p className="text-xs md:text-sm text-muted-foreground">Total Score: {currentUserData.total_score}</p>
                                        <p className="text-xs text-muted-foreground">{PERIOD_LABELS[activePeriod]} / {activeScopeLabel}</p>
                                        <p className="text-xs text-primary">{periodDetailLabel}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xl md:text-2xl font-bold text-primary">#{userRank || 'N/A'}</div>
                                    <p className="text-xs md:text-sm text-muted-foreground">Current Rank</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {visibleLeaders.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 lg:gap-6 mb-6 lg:mb-8">
                        {visibleLeaders.slice(0, 3).map((entry, index) => (
                            <Card
                                key={entry.id}
                                className={`relative overflow-hidden hover:scale-105 transition-all duration-300 animate-fade-in bg-gradient-to-br from-primary/5 to-accent border-border backdrop-blur-sm ${index === 0 ? 'md:order-2' : index === 1 ? 'md:order-1' : 'md:order-3'
                                    }`}
                                style={{ animationDelay: `${index * 100}ms` }}
                            >
                                <div className={`absolute top-0 left-0 right-0 h-2 ${getRankBadge(index + 1)}`}></div>
                                <CardHeader className="text-center pb-2 p-4 lg:p-6">
                                    <div className="flex justify-center mb-2">{getRankIcon(index + 1)}</div>
                                    <CardTitle className="text-base md:text-lg text-foreground">#{index + 1}</CardTitle>
                                </CardHeader>
                                <CardContent className="text-center p-4 lg:p-6 pt-0">
                                    <div className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-r from-primary to-primary/70 rounded-full flex items-center justify-center mx-auto mb-2 overflow-hidden">
                                        {entry.avatar_url ? (
                                            <img src={entry.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-primary-foreground font-bold text-lg md:text-xl">
                                                {entry.username?.substring(0, 2).toUpperCase() || 'U'}
                                            </span>
                                        )}
                                    </div>
                                    <h3 className="font-semibold text-foreground mb-1 text-sm md:text-base truncate">{entry.username || 'Anonymous'}</h3>
                                    <div className="space-y-1">
                                        <p className="text-lg md:text-2xl font-bold text-primary">{entry.total_score}</p>
                                        <p className="text-xs text-muted-foreground">Total Score</p>
                                        <p className="text-xs text-muted-foreground">{entry.accuracy}% accuracy • {entry.total_questions} questions</p>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

                <Card className="bg-gradient-to-br from-primary/5 to-accent border-border hover:shadow-lg transition-all duration-300 animate-slide-up backdrop-blur-sm">
                    <CardHeader className="p-4 lg:p-6">
                        <CardTitle className="flex items-center space-x-2 text-foreground text-lg md:text-xl">
                            <Users className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                        <span>Top Students</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 lg:p-6 pt-0">
                        {isLoading ? (
                            <div className="space-y-4">
                                <PageSkeleton />
                            </div>
                        ) : visibleLeaders.length === 0 ? (
                            <div className="text-center py-8">
                                <p className="text-muted-foreground text-sm md:text-base">{emptyStateMessage}</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {visibleLeaders.slice(3).map((entry, index) => (
                                    <div
                                        key={entry.id}
                                        className="flex items-center space-x-3 md:space-x-4 p-3 rounded-lg bg-card/60 hover:bg-accent/50 transition-all duration-300 border border-border/40 backdrop-blur-sm"
                                    >
                                        <div className="flex items-center space-x-2 md:space-x-3 flex-1 min-w-0">
                                            <span className="text-xs md:text-sm font-medium text-muted-foreground w-6 md:w-8 flex-shrink-0">#{index + 4}</span>
                                            <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-r from-primary to-primary/70 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
                                                {entry.avatar_url ? (
                                                    <img src={entry.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className="text-primary-foreground font-bold text-xs md:text-sm">
                                                        {entry.username?.substring(0, 2).toUpperCase() || 'U'}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="font-medium text-foreground text-sm md:text-base truncate">{entry.username || 'Anonymous'}</p>
                                                <p className="text-xs md:text-sm text-muted-foreground">{entry.accuracy}% accuracy • {entry.total_questions} questions</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-2 md:space-x-4 flex-shrink-0">
                                            <div className="text-right">
                                                <p className="font-bold text-primary text-sm md:text-base">{entry.total_score}</p>
                                                <p className="text-xs text-muted-foreground">Score</p>
                                            </div>
                                            <Star className="w-3 h-3 md:w-4 md:h-4 text-yellow-500 flex-shrink-0" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default Leaderboard;
