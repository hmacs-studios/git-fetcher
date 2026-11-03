import LottiePlayer from '@/components/LottiePlayer';
import paymentProcessingAnim from '@/assets/animations/Bank.json';
import paymentSuccessAnim from '@/assets/animations/Payment Success.json';
import paymentFailAnim from '@/assets/animations/Close.json';
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, CheckCircle2, Crown, Zap, Star, Shield, BriefcaseBusiness, RotateCcw, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import Seo from '@/components/Seo';
import PageSkeleton from '@/components/skeletons/PageSkeleton';
import { useConsent } from '@/components/consent/ConsentProvider';
import { trackMetaAddToCart } from '@/utils/metaAppEvents';
import { trackGoogleAddToCart } from '@/utils/googleAnalytics';
import {
    isPlayBillingSupported,
    getPlayBillingOfferings,
    findPackageForPlan,
    purchasePlayBillingPackage,
    restorePlayBillingPurchases,
} from '@/services/playBillingService';

interface SupabasePlan {
    id: string;
    name: string;
    display_name: string;
    type: 'monthly' | 'yearly';
    currency: 'PKR' | 'USD';
    price: number;
    original_price: number | null;
    features: string[];
    is_popular: boolean;
    order: number;
}
interface GroupedPlan {
    name: string;
    display: string;
    id: string;
    popular: boolean;
    monthly: {
        PKR: { price: string; originalPrice: string | null; features: string[] };
        USD: { price: string; originalPrice: string | null; features: string[] };
    };
    yearly: {
        PKR: { price: string; originalPrice: string | null; features: string[] };
        USD: { price: string; originalPrice: string | null; features: string[] };
    };
    contactOnly?: boolean;
}
interface AiFeaturePolicy {
    plan: string;
    feature: string;
    enabled: boolean;
    daily_requests: number | null;
}

interface PlanStyleConfig {
    border: string;
    cardBg: string;
    iconBg: string;
    icon: React.ReactNode;
    accentColor: string;
    checkColor: string;
    buttonClass: string;
}

const planStyles: Record<string, PlanStyleConfig> = {
    free: {
        border: 'border-border/80 dark:border-border/60',
        cardBg: 'bg-card',
        iconBg: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
        icon: <Shield className="w-5 h-5" />,
        accentColor: 'bg-slate-400 dark:bg-slate-500',
        checkColor: 'text-slate-500 dark:text-slate-400',
        buttonClass: 'bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border/50',
    },
    iconic: {
        border: 'border-2 border-teal-500 dark:border-teal-400',
        cardBg: 'bg-gradient-to-b from-teal-50/60 via-card to-card dark:from-teal-950/25 dark:via-card dark:to-card',
        iconBg: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
        icon: <Crown className="w-5 h-5" />,
        accentColor: 'bg-teal-500',
        checkColor: 'text-teal-600 dark:text-teal-400',
        buttonClass: 'bg-teal-600 hover:bg-teal-700 text-white shadow-md shadow-teal-600/20',
    },
    premium: {
        border: 'border border-cyan-500/40 dark:border-cyan-500/30',
        cardBg: 'bg-gradient-to-b from-cyan-50/40 via-card to-card dark:from-cyan-950/20 dark:via-card dark:to-card',
        iconBg: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
        icon: <Star className="w-5 h-5" />,
        accentColor: 'bg-cyan-500',
        checkColor: 'text-cyan-600 dark:text-cyan-400',
        buttonClass: 'bg-cyan-600 hover:bg-cyan-700 text-white shadow-md shadow-cyan-600/20',
    },
    executive: {
        border: 'border border-border/80 dark:border-border/60',
        cardBg: 'bg-card',
        iconBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
        icon: <BriefcaseBusiness className="w-5 h-5" />,
        accentColor: 'bg-amber-500',
        checkColor: 'text-amber-600 dark:text-amber-400',
        buttonClass: 'bg-secondary hover:bg-secondary/80 text-foreground border border-border/60',
    },
};

// One heartbeat tile, 0..400, flat-in / spike / flat-out so it tiles seamlessly.
const ECG_TILE = 'M0,30 L60,30 L72,8 L84,52 L96,14 L108,30 L200,30 L212,8 L224,52 L236,14 L248,30 L400,30';

const EcgLine = ({ className = '' }: { className?: string }) => (
    <div className={`overflow-hidden ${className}`}>
        <motion.svg
            viewBox="0 0 800 60"
            className="h-full w-[200%]"
            preserveAspectRatio="none"
            animate={{ x: [0, -400] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
        >
            <path d={ECG_TILE} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d={ECG_TILE} transform="translate(400,0)" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </motion.svg>
    </div>
);

const Pricing = () => {
    const { user, loading: isAuthLoading } = useAuth();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const isPlayBilling = isPlayBillingSupported();
    const [purchasingPlanId, setPurchasingPlanId] = useState<string | null>(null);
    const [isRestoring, setIsRestoring] = useState(false);
    const [paymentModalState, setPaymentModalState] = useState<'idle' | 'processing' | 'success' | 'failure'>('idle');
    const [upgradedPlanName, setUpgradedPlanName] = useState<string>('');
    const [paymentErrorMessage, setPaymentErrorMessage] = useState<string>('');
    const { measurementAllowed } = useConsent();
    const [isMonthly, setIsMonthly] = useState(true);
    const [activePlanId, setActivePlanId] = useState<string>('free');
    const [headerVisible, setHeaderVisible] = useState(true);
    const lastScrollY = useRef(0);

    const { data: playOfferings } = useQuery({
        queryKey: ['playBillingOfferings'],
        queryFn: () => getPlayBillingOfferings(),
        enabled: isPlayBilling,
        staleTime: 5 * 60 * 1000,
    });

    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY;
            setHeaderVisible(currentScrollY < lastScrollY.current || currentScrollY < 10);
            lastScrollY.current = currentScrollY;
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const cardRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
    const trackRef = useRef<HTMLDivElement | null>(null);

    const { data: fetchedPlans, isLoading: arePlansLoading } = useQuery<SupabasePlan[]>({
        queryKey: ['pricingPlans'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('pricing_plans')
                .select('*')
                .order('order', { ascending: true });
            if (error) throw new Error('Could not load pricing plans.');
            return data || [];
        },
    });

    const { data: quotaPolicies, isLoading: areQuotaPoliciesLoading } = useQuery<AiFeaturePolicy[]>({
        queryKey: ['pricingQuotaPolicies'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('ai_feature_policies')
                .select('plan, feature, enabled, daily_requests')
                .in('feature', ['reference', 'reference-explain', 'reference-summary']);
            if (error) throw new Error('Could not load plan limits.');
            return data || [];
        },
    });

    const { data: profile, isLoading: isProfileLoading } = useQuery<{ plan: string } | null>({
        queryKey: ['profile-plan', user?.id],
        queryFn: async () => {
            if (!user?.id) return null;
            const { data, error } = await supabase
                .from('profiles')
                .select('plan')
                .eq('id', user.id)
                .maybeSingle();
            if (error) return null;
            return data;
        },
        enabled: !!user?.id,
    });

    const currentUserPlan = profile?.plan?.toLowerCase() || 'free';

    const plans: GroupedPlan[] = useMemo(() => {
        if (!fetchedPlans) return [];
        const quotaLabel = (planName: string, feature: string, label: string) => {
            const policy = quotaPolicies?.find((item) => item.plan === planName && item.feature === feature);
            if (!policy || !policy.enabled || policy.daily_requests === 0) return null;
            return `${policy.daily_requests === null ? 'Unlimited' : policy.daily_requests} ${label} daily`;
        };
        const cloudQuotaFeatures = (planName: string) => [
            `${planName === 'free' ? 50 : 'Unlimited'} MCQ submissions${planName === 'free' ? ' daily' : ''}`,
            quotaLabel(planName, 'reference', 'book references'),
            quotaLabel(planName, 'reference-explain', 'option explains'),
            quotaLabel(planName, 'reference-summary', 'AI summaries'),
        ].filter((feature): feature is string => Boolean(feature));
        const grouped: { [key: string]: GroupedPlan } = {};
        fetchedPlans.forEach((p) => {
            if (!grouped[p.name]) {
                const displayName = p.name.toLowerCase() === 'iconic' 
                    ? 'Iconic' 
                    : p.name.toLowerCase() === 'premium' 
                    ? 'Premium' 
                    : p.display_name;

                grouped[p.name] = {
                    name: p.name,
                    display: displayName,
                    id: p.name,
                    popular: p.is_popular,
                    monthly: {
                        PKR: { price: '', originalPrice: null, features: [] },
                        USD: { price: '', originalPrice: null, features: [] },
                    },
                    yearly: {
                        PKR: { price: '', originalPrice: null, features: [] },
                        USD: { price: '', originalPrice: null, features: [] },
                    },
                };
            }
            const filteredFeatures = p.features.filter(
                (f) => !f.toLowerCase().includes('ad')
            );
            const priceDetails = {
                price: p.name === 'free' ? '0' : p.price.toString(),
                originalPrice: p.original_price ? p.original_price.toString() : null,
                features: [...cloudQuotaFeatures(p.name), ...filteredFeatures],
            };
            if (p.type === 'monthly') {
                grouped[p.name].monthly[p.currency as 'PKR' | 'USD'] = priceDetails;
            } else if (p.type === 'yearly') {
                grouped[p.name].yearly[p.currency as 'PKR' | 'USD'] = priceDetails;
            }
        });
        Object.values(grouped).forEach((plan) => {
            if (plan.name === 'free') {
                plan.yearly.PKR = plan.yearly.PKR.features.length ? plan.yearly.PKR : plan.monthly.PKR;
                plan.yearly.USD = plan.yearly.USD.features.length ? plan.yearly.USD : plan.monthly.USD;
            }
        });

        const executivePlan: GroupedPlan = {
            name: 'executive',
            display: 'Executive',
            id: 'executive',
            popular: false,
            contactOnly: true,
            monthly: {
                PKR: {
                    price: '',
                    originalPrice: null,
                    features: [
                        'Premium-level access with custom exemptions',
                        'Admin-managed allowances for your team or institute',
                        'Priority onboarding and support',
                        'Custom quote based on your requirements',
                    ],
                },
                USD: { price: '', originalPrice: null, features: [] },
            },
            yearly: {
                PKR: {
                    price: '',
                    originalPrice: null,
                    features: [
                        'Premium-level access with custom exemptions',
                        'Admin-managed allowances for your team or institute',
                        'Priority onboarding and support',
                        'Custom quote based on your requirements',
                    ],
                },
                USD: { price: '', originalPrice: null, features: [] },
            },
        };

        return [...Object.values(grouped), executivePlan].sort((a, b) => {
            if (a.id === 'executive') return 1;
            if (b.id === 'executive') return -1;
            const orderA = fetchedPlans.find((p) => p.name === a.name)?.order || 99;
            const orderB = fetchedPlans.find((p) => p.name === b.name)?.order || 99;
            return orderA - orderB;
        });
    }, [fetchedPlans, quotaPolicies]);

    // Horizontal scroll-spy: which card is centered in the swipe track.
    // Root is the track itself (not the viewport), since cards sit side by side.
    useEffect(() => {
        if (!plans.length || !trackRef.current) return;
        const observers: IntersectionObserver[] = [];
        plans.forEach((plan) => {
            const el = cardRefs.current[plan.id];
            if (!el) return;
            const observer = new IntersectionObserver(
                ([entry]) => {
                    if (entry.isIntersecting) setActivePlanId(plan.id);
                },
                { root: trackRef.current, threshold: 0.6 }
            );
            observer.observe(el);
            observers.push(observer);
        });
        return () => observers.forEach((o) => o.disconnect());
    }, [plans]);

    const scrollToPlan = (id: string) => {
        cardRefs.current[id]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    };

    const handlePlayPurchase = async (plan: GroupedPlan) => {
        if (!isPlayBillingSupported()) {
            toast({
                title: 'Google Play Store Required',
                description: 'Google Play Billing is available directly within the Medmacs Android app.',
                variant: 'destructive',
            });
            return;
        }

        if (!user) {
            toast({
                title: 'Authentication Required',
                description: 'Please sign in or create an account to upgrade.',
                variant: 'destructive',
            });
            navigate('/login');
            return;
        }

        const billingPeriod = isMonthly ? 'monthly' : 'yearly';
        const pkg = findPackageForPlan(playOfferings ?? null, plan.id, billingPeriod);

        if (!pkg) {
            toast({
                title: 'Package Unavailable',
                description: 'Google Play subscription package is being configured. Please try again shortly.',
                variant: 'destructive',
            });
            return;
        }

        setUpgradedPlanName(plan.display);
        setPaymentErrorMessage('');
        setPaymentModalState('processing');
        setPurchasingPlanId(plan.id);
        try {
            const result = await purchasePlayBillingPackage(pkg, plan.display, billingPeriod);
            if (result.success) {
                if (user?.id) {
                    localStorage.removeItem(`medmacs_profile_cache_${user.id}`);
                    localStorage.removeItem(`medmacs:mcq-plan:${user.id}`);
                }
                await Promise.all([
                    queryClient.invalidateQueries({ queryKey: ['profile-plan'] }),
                    queryClient.invalidateQueries({ queryKey: ['dashboard-entry-profile'] }),
                    queryClient.invalidateQueries({ queryKey: ['mcq-profile-plan'] }),
                    queryClient.invalidateQueries({ queryKey: ['past-paper-profile-plan'] }),
                    queryClient.invalidateQueries({ queryKey: ['user-stats'] }),
                    queryClient.invalidateQueries({ queryKey: ['pricingPlans'] }),
                ]);
                await queryClient.refetchQueries({ queryKey: ['profile-plan'] });
                await queryClient.refetchQueries({ queryKey: ['dashboard-entry-profile'] });
                setPaymentModalState('success');
            } else if (result.userCancelled) {
                // User dismissed the native Google Play bottom sheet
                setPaymentModalState('idle');
            } else {
                setPaymentErrorMessage(result.error || 'Unable to complete purchase via Google Play.');
                setPaymentModalState('failure');
            }
        } catch (err: any) {
            setPaymentErrorMessage(err?.message || 'Unable to complete transaction.');
            setPaymentModalState('failure');
        } finally {
            setPurchasingPlanId(null);
        }
    };

    const handleRestorePurchases = async () => {
        setIsRestoring(true);
        try {
            const res = await restorePlayBillingPurchases();
            if (res.success && res.hasActiveSubscription) {
                if (user?.id) {
                    localStorage.removeItem(`medmacs_profile_cache_${user.id}`);
                    localStorage.removeItem(`medmacs:mcq-plan:${user.id}`);
                }
                await Promise.all([
                    queryClient.invalidateQueries({ queryKey: ['profile-plan'] }),
                    queryClient.invalidateQueries({ queryKey: ['dashboard-entry-profile'] }),
                    queryClient.invalidateQueries({ queryKey: ['mcq-profile-plan'] }),
                    queryClient.invalidateQueries({ queryKey: ['past-paper-profile-plan'] }),
                ]);
                await queryClient.refetchQueries({ queryKey: ['profile-plan'] });
                await queryClient.refetchQueries({ queryKey: ['dashboard-entry-profile'] });
                toast({
                    title: 'Purchases Restored! 🎉',
                    description: 'Your previous subscription has been successfully restored.',
                });
            } else if (res.success) {
                toast({
                    title: 'No Purchases Found',
                    description: 'No active Google Play subscriptions were found for this Google account.',
                });
            } else {
                toast({
                    title: 'Restore Failed',
                    description: res.error || 'Failed to restore purchases.',
                    variant: 'destructive',
                });
            }
        } finally {
            setIsRestoring(false);
        }
    };

    if (isAuthLoading || arePlansLoading) {
        return <PageSkeleton />;
    }

    return (
        <div className="min-h-screen w-full bg-gradient-to-br from-teal-50 via-white to-cyan-50 dark:from-[#0a2e2e] dark:via-[#0f172a] dark:to-[#020617] relative overflow-x-hidden selection:bg-[#2dd4bf]/30 text-slate-900 dark:text-white transition-colors duration-300">
            <Seo title="Pricing Plans" />

            {/* Ambient background: soft glow + faint monitor-grid, no more random confetti icons */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
                <motion.div
                    animate={{ x: [0, 100, 0], y: [0, 50, 0] }}
                    transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
                    className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] rounded-full bg-teal-300/20 dark:bg-[#2dd4bf]/15 blur-[100px]"
                />
                <motion.div
                    animate={{ x: [0, -120, 0], y: [0, 80, 0] }}
                    transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
                    className="absolute bottom-[10%] -right-[10%] w-[60%] h-[60%] rounded-full bg-sky-300/20 dark:bg-[#0ea5e9]/15 blur-[100px]"
                />
                <div
                    className="absolute inset-0 opacity-[0.035] dark:opacity-[0.05] text-slate-900 dark:text-white"
                    style={{
                        backgroundImage:
                            'repeating-linear-gradient(0deg, currentColor, currentColor 1px, transparent 1px, transparent 24px), repeating-linear-gradient(90deg, currentColor, currentColor 1px, transparent 1px, transparent 24px)',
                    }}
                />
            </div>

            {/* Header — unchanged structure */}
            <div
                className={`fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-[#07171f]/75 backdrop-blur-2xl border-b border-slate-200/70 dark:border-white/10 pt-[env(safe-area-inset-top)] transition-transform duration-300 ${headerVisible ? 'translate-y-0' : '-translate-y-full'}`}
            >
                <div className="container mx-auto grid h-14 max-w-2xl grid-cols-[1fr_auto_1fr] items-center px-5">
                    <img src="/lovable-uploads/bf69a7f7-550a-45a1-8808-a02fb889f8c5.png" alt="Medmacs" className="h-9 w-9 object-contain" />
                    <h1 className="brand-wordmark text-xl text-slate-950 dark:text-white">Pricing</h1>
                    <div aria-hidden="true" />
                </div>
            </div>

            <main className="relative z-10 pt-[calc(env(safe-area-inset-top)+4.25rem)] pb-[calc(env(safe-area-inset-bottom)+2rem)]">
                <div className="container mx-auto px-5 lg:px-8 pt-10 max-w-2xl">
                    <motion.div
                        className="text-center mb-6"
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    >
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-500/10 dark:bg-white/10 border border-teal-500/20 dark:border-white/10 backdrop-blur-md mb-5">
                            <motion.span
                                animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }}
                                transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
                                className="w-1.5 h-1.5 rounded-full bg-teal-500 dark:bg-[#2dd4bf]"
                            />
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-teal-700 dark:text-[#2dd4bf]">Medmacs Plans</span>
                        </div>
                        <h1 className="text-4xl md:text-6xl font-black tracking-tight text-slate-900 dark:text-white mb-4 leading-[0.95]">
                            Choose Your <br /><span className="text-teal-600 dark:text-[#2dd4bf]">Plan</span>
                        </h1>
                        <p className="text-slate-500 dark:text-white/50 font-medium max-w-xl mx-auto mb-6 text-sm">
                            High-performance tools for future medical professionals.
                        </p>
                    </motion.div>

                    {/* Signature: heartbeat line dividing hero from plan selection */}
                    <div className="h-8 -mx-5 mb-6 text-teal-500/50 dark:text-[#2dd4bf]/40">
                        <EcgLine className="h-full w-full" />
                    </div>

                    <div className="flex items-center p-1 bg-muted/80 backdrop-blur-md rounded-2xl border border-border shadow-sm max-w-xs mx-auto mb-8">
                        <button
                            onClick={() => setIsMonthly(true)}
                            className={`flex-1 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 active:scale-95 ${isMonthly ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            Monthly
                        </button>
                        <button
                            onClick={() => setIsMonthly(false)}
                            className={`flex-1 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 active:scale-95 ${!isMonthly ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            Yearly
                        </button>
                    </div>
                </div>

                {/* Swipeable plan carousel — native mobile pattern instead of a long vertical stack */}
                <div
                    ref={trackRef}
                    className="flex gap-4 overflow-x-auto snap-x snap-mandatory px-5 pt-5 pb-4 [&::-webkit-scrollbar]:hidden"
                    style={{ scrollbarWidth: 'none' }}
                >
                    {plans.map((plan, index) => {
                        const style = planStyles[plan.id] || planStyles.free;
                        const currentPlanDetails = isMonthly ? plan.monthly.PKR : plan.yearly.PKR;
                        const displayPrice = plan.id === 'free' ? '0' : currentPlanDetails.price;
                        const originalPrice = plan.id === 'free' ? null : currentPlanDetails.originalPrice;
                        const isUserOnPaidPlan = currentUserPlan !== 'free';
                        const isFreePlanAndPaidUser = plan.id === 'free' && isUserOnPaidPlan;
                        const isExecutivePlan = plan.contactOnly || plan.id === 'executive';
                        const isActive = activePlanId === plan.id;
                        const playPackage = isPlayBilling
                            ? findPackageForPlan(playOfferings ?? null, plan.id, isMonthly ? 'monthly' : 'yearly')
                            : null;

                        return (
                            <motion.div
                                key={plan.id}
                                ref={(el) => { cardRefs.current[plan.id] = el; }}
                                initial={{ opacity: 0, y: 24 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.35, delay: index * 0.06 }}
                                className={`relative rounded-3xl ${style.cardBg} ${style.border} text-card-foreground flex flex-col p-6 shrink-0 snap-center w-[85vw] max-w-sm transition-all duration-300 ${isActive ? 'scale-100 opacity-100 shadow-xl shadow-black/5 ring-1 ring-primary/20' : 'scale-[0.97] opacity-80 shadow-sm'}`}
                            >
                                {plan.popular && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20">
                                        <Badge className="bg-teal-600 hover:bg-teal-600 text-white border-0 uppercase text-[10px] tracking-widest font-bold px-3 py-1 shadow-md shadow-teal-600/30">
                                            Most Popular
                                        </Badge>
                                    </div>
                                )}

                                <div className="flex items-center gap-3.5 pb-4">
                                    <div className={`p-2.5 rounded-2xl shrink-0 ${style.iconBg}`}>
                                        {style.icon}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h2 className="text-xl font-bold tracking-tight text-foreground truncate">
                                            {plan.display}
                                        </h2>
                                        <div className={`h-1 w-8 ${style.accentColor} rounded-full mt-1.5`} />
                                    </div>
                                </div>

                                <div className="pb-4 pt-1 border-b border-border/50">
                                    {isExecutivePlan ? (
                                        <div>
                                            <div className="text-2xl font-bold tracking-tight text-foreground">Custom Quote</div>
                                            <div className="mt-0.5 text-xs text-muted-foreground font-medium uppercase tracking-wider">Contact sales team</div>
                                        </div>
                                    ) : (
                                        <div className="flex items-baseline gap-1">
                                            {originalPrice && (
                                                <span className="text-xs text-muted-foreground line-through font-mono mr-1">
                                                    Rs.{Number(originalPrice).toLocaleString()}
                                                </span>
                                            )}
                                            <span className="text-sm font-semibold text-muted-foreground font-mono">Rs.</span>
                                            <span className="text-3xl font-extrabold tracking-tight text-foreground font-mono">
                                                {Number(displayPrice).toLocaleString()}
                                            </span>
                                            <span className="text-xs text-muted-foreground font-medium font-mono ml-1">
                                                /{isMonthly ? 'mo' : 'yr'}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <div className="py-5 flex-1">
                                    <ul className="space-y-3">
                                        {currentPlanDetails.features.map((feature, idx) => (
                                            <li key={idx} className="flex items-start gap-2.5 text-sm leading-snug">
                                                <CheckCircle2 className={`h-4 w-4 shrink-0 ${style.checkColor} mt-0.5`} />
                                                <span className="text-foreground/80">{feature}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <div className="pt-2">
                                    {isExecutivePlan ? (
                                        <Link to="/contact-us?subject=executive-plan" className="block">
                                            <Button className={`w-full rounded-2xl h-12 uppercase font-black text-xs tracking-wider transition-all duration-200 active:scale-[0.98] ${style.buttonClass}`}>
                                                Contact Sales
                                            </Button>
                                        </Link>
                                    ) : currentUserPlan === plan.id ? (
                                        <Button disabled className="w-full bg-muted border border-border/60 text-muted-foreground rounded-2xl h-12 uppercase font-bold text-xs tracking-wider">
                                            Active Plan ✓
                                        </Button>
                                    ) : isFreePlanAndPaidUser ? (
                                        <Button disabled className="w-full bg-muted/50 border border-border/40 text-muted-foreground/60 rounded-2xl h-12 uppercase font-bold text-xs tracking-wider">
                                            You are on a paid plan
                                        </Button>
                                    ) : plan.id === 'free' ? (
                                        <Link to="/dashboard" className="block">
                                            <Button className={`w-full rounded-2xl h-12 uppercase font-black text-xs tracking-wider transition-all duration-200 active:scale-[0.98] ${style.buttonClass}`}>
                                                Continue with Free
                                            </Button>
                                        </Link>
                                    ) : (
                                        <Button
                                            onClick={() => handlePlayPurchase(plan)}
                                            disabled={purchasingPlanId === plan.id}
                                            className={`w-full rounded-2xl h-12 uppercase font-black text-xs tracking-wider transition-all duration-200 active:scale-[0.98] ${style.buttonClass}`}
                                        >
                                            {purchasingPlanId === plan.id ? (
                                                <span className="flex items-center justify-center gap-2">
                                                    <Loader2 className="w-4 h-4 animate-spin" /> Processing...
                                                </span>
                                            ) : (
                                                'Upgrade via Google Play →'
                                            )}
                                        </Button>
                                    )}
                                </div>
                            </motion.div>
                        );
                    })}
                </div>

                {/* Dot pagination — tap to jump to a plan */}
                <div className="flex items-center justify-center gap-2 mt-2 mb-10">
                    {plans.map((plan) => (
                        <button
                            key={plan.id}
                            onClick={() => scrollToPlan(plan.id)}
                            aria-label={`Show ${plan.display} plan`}
                            className={`h-2 rounded-full transition-all duration-300 ${activePlanId === plan.id ? 'w-6 bg-teal-500 dark:bg-[#2dd4bf]' : 'w-2 bg-slate-300 dark:bg-white/20'}`}
                        />
                    ))}
                </div>

                <div className="flex justify-center mb-6 px-5">
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={isRestoring}
                        onClick={handleRestorePurchases}
                        className="rounded-full border-teal-500/30 dark:border-white/20 text-xs font-semibold hover:bg-teal-500/10 text-teal-700 dark:text-teal-300"
                    >
                        {isRestoring ? (
                            <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                        ) : (
                            <RotateCcw className="w-3.5 h-3.5 mr-2" />
                        )}
                        Restore Google Play Purchases
                    </Button>
                </div>

                <div className="container mx-auto px-5 lg:px-8 max-w-2xl space-y-4 text-center">
                    <p className="text-[10px] text-slate-400 dark:text-white/35 uppercase tracking-[0.4em] font-black">
                        All prices in PKR · Secure Google Play checkout · Cancel anytime
                    </p>
                    <p className="mx-auto max-w-md text-xs font-semibold leading-relaxed text-slate-500 dark:text-white/45">
                        Payments and subscriptions are managed securely via Google Play Store. For assistance, contact{' '}
                        <a href="mailto:billing@medmacs.app" className="text-teal-600 dark:text-[#2dd4bf] underline underline-offset-4">
                            billing@medmacs.app
                        </a>
                    </p>
                </div>
            </main>

            {/* PAYMENT PROCESSING & SUCCESS BOTTOM SHEET MODAL */}
            <Dialog open={paymentModalState !== 'idle'} onOpenChange={(open) => !open && setPaymentModalState('idle')}>
                <DialogContent className={cn(
                    "sm:max-w-md bg-card border-t sm:border border-border transition-all duration-300 overflow-hidden shadow-2xl z-[100]",
                    "fixed bottom-0 top-auto translate-y-0 rounded-t-3xl rounded-b-none max-w-full sm:max-w-md border-x-0 border-b-0 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
                )}>
                    {/* Visual Sheet Handle Bar */}
                    <div className="w-12 h-1.5 bg-muted-foreground/30 rounded-full mx-auto mt-1 mb-2" />

                    <div className="flex flex-col items-center justify-center text-center px-4 pb-2">
                        {paymentModalState === 'processing' && (
                            <div className="flex flex-col items-center justify-center space-y-3 animate-in fade-in zoom-in-95 duration-200 w-full">
                                <div className="w-36 h-36 flex items-center justify-center my-[-10px]">
                                    <LottiePlayer 
                                        animationData={paymentProcessingAnim} 
                                        loop={true} 
                                        autoplay={true} 
                                        style={{ width: 140, height: 140 }}
                                    />
                                </div>
                                <DialogTitle className="text-xl font-bold text-foreground">Authorizing Payment</DialogTitle>
                                <DialogDescription className="text-sm text-muted-foreground px-2 leading-relaxed">
                                    Connecting to Google Play. Please complete the purchase confirmation on your device.
                                </DialogDescription>
                            </div>
                        )}
                        {paymentModalState === 'success' && (
                            <div className="flex flex-col items-center justify-center space-y-3 animate-in fade-in zoom-in-95 duration-300 w-full">
                                <div className="w-40 h-40 flex items-center justify-center my-[-15px]">
                                    <LottiePlayer 
                                        animationData={paymentSuccessAnim} 
                                        loop={true} 
                                        autoplay={true} 
                                        style={{ width: 160, height: 160 }}
                                    />
                                </div>
                                <DialogTitle className="text-2xl font-black text-foreground">Payment Successful! 🎉</DialogTitle>
                                <DialogDescription className="text-sm text-muted-foreground max-w-xs leading-relaxed">
                                    Achievement Unlocked! Your account has been upgraded to <strong className="text-teal-600 dark:text-[#2dd4bf] font-bold">{upgradedPlanName}</strong>.
                                </DialogDescription>
                                <Button 
                                    className="mt-4 w-full bg-teal-600 hover:bg-teal-700 text-white font-bold h-12 shadow-lg rounded-xl text-base active:scale-95 transition-transform" 
                                    onClick={() => navigate('/dashboard')}
                                >
                                    Continue to Dashboard →
                                </Button>
                            </div>
                        )}
                        {paymentModalState === 'failure' && (
                            <div className="flex flex-col items-center justify-center space-y-3 animate-in fade-in zoom-in-95 duration-300 w-full py-2">
                                <div className="w-36 h-36 flex items-center justify-center my-[-10px]">
                                    <LottiePlayer 
                                        animationData={paymentFailAnim} 
                                        loop={false} 
                                        autoplay={true} 
                                        style={{ width: 140, height: 140 }}
                                    />
                                </div>
                                <DialogTitle className="text-xl font-bold text-foreground">Transaction Incomplete</DialogTitle>
                                <DialogDescription className="text-sm text-destructive px-4 font-medium text-center">
                                    {paymentErrorMessage || "Something went wrong during payment."}
                                </DialogDescription>
                                <div className="flex gap-3 w-full mt-4">
                                    <Button variant="outline" className="flex-1 rounded-xl h-11" onClick={() => setPaymentModalState('idle')}>
                                        Dismiss
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default Pricing;
