import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, CheckCircle2, Crown, Zap, Star, Shield, BriefcaseBusiness } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Seo from '@/components/Seo';
import PageSkeleton from '@/components/skeletons/PageSkeleton';
import { useConsent } from '@/components/consent/ConsentProvider';
import { trackMetaAddToCart } from '@/utils/metaAppEvents';
import { trackGoogleAddToCart } from '@/utils/googleAnalytics';

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

// Fixed, saturated identity per plan — intentionally constant across light/dark,
// the way a lab-result card keeps its color coding regardless of the room lighting.
const planStyles: { [key: string]: { gradient: string; accent: string; icon: any; ring: string } } = {
    free: {
        gradient: 'from-slate-700 via-slate-800 to-slate-950',
        accent: 'bg-slate-200',
        icon: <Shield className="w-7 h-7 text-slate-100" />,
        ring: 'ring-slate-400/40',
    },
    premium: {
        gradient: 'from-teal-700 via-cyan-800 to-slate-950',
        accent: 'bg-cyan-200',
        icon: <Star className="w-7 h-7 text-cyan-100" />,
        ring: 'ring-cyan-300/45',
    },
    iconic: {
        gradient: 'from-[#0f766e] via-[#0e7490] to-[#1e3a8a]',
        accent: 'bg-amber-300',
        icon: <Crown className="w-7 h-7 text-amber-200" />,
        ring: 'ring-amber-300/50',
    },
    pro: {
        gradient: 'from-emerald-500 via-teal-600 to-cyan-700',
        accent: 'bg-emerald-200',
        icon: <Zap className="w-7 h-7 text-emerald-100" />,
        ring: 'ring-emerald-300/50',
    },
    executive: {
        gradient: 'from-slate-950 via-cyan-950 to-teal-900',
        accent: 'bg-amber-300',
        icon: <BriefcaseBusiness className="w-7 h-7 text-amber-200" />,
        ring: 'ring-amber-300/50',
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
    const { measurementAllowed } = useConsent();
    const [isMonthly, setIsMonthly] = useState(true);
    const [activePlanId, setActivePlanId] = useState<string>('free');
    const [headerVisible, setHeaderVisible] = useState(true);
    const lastScrollY = useRef(0);

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
                grouped[p.name] = {
                    name: p.name,
                    display: p.display_name,
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
                <div className="container mx-auto px-5 h-14 flex justify-between items-center max-w-2xl">
                    <Link to="/dashboard">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="w-10 h-10 p-0 rounded-full text-slate-500 dark:text-white/70 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 active:scale-90 transition-transform"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <div className="flex items-center gap-2">
                        <img src="/lovable-uploads/bf69a7f7-550a-45a1-8808-a02fb889f8c5.png" alt="Logo" className="w-7 h-7" />
                        <span className="text-lg font-black text-slate-900 dark:text-white">Pricing</span>
                    </div>
                    <div className="w-10" />
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

                    <div className="flex items-center p-1.5 bg-slate-100 dark:bg-white/10 backdrop-blur-2xl rounded-2xl border border-slate-200 dark:border-white/10 shadow-lg shadow-black/5 max-w-xs mx-auto mb-8">
                        <button
                            onClick={() => setIsMonthly(true)}
                            className={`flex-1 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 active:scale-95 ${isMonthly ? 'bg-white text-teal-700 dark:text-[#0f766e] shadow-md' : 'text-slate-400 dark:text-white/50'}`}
                        >
                            Monthly
                        </button>
                        <button
                            onClick={() => setIsMonthly(false)}
                            className={`flex-1 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 active:scale-95 ${!isMonthly ? 'bg-white text-teal-700 dark:text-[#0f766e] shadow-md' : 'text-slate-400 dark:text-white/50'}`}
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

                        return (
                            <motion.div
                                key={plan.id}
                                ref={(el) => { cardRefs.current[plan.id] = el; }}
                                initial={{ opacity: 0, y: 32 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.45, delay: index * 0.08 }}
                                className={`relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br ${style.gradient} text-white shadow-2xl shadow-black/20 dark:shadow-black/40 flex flex-col p-2 ring-4 shrink-0 snap-center w-[85vw] max-w-sm transition-all duration-500 ${isActive ? `${style.ring} scale-100 opacity-100` : 'ring-transparent scale-[0.96] opacity-70'}`}
                            >
                                <div
                                    className="absolute inset-0 opacity-10"
                                    style={{
                                        backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 20px, rgba(255,255,255,0.4) 20px, rgba(255,255,255,0.4) 40px)`,
                                        maskImage: 'radial-gradient(circle at center, black 30%, transparent 80%)',
                                    }}
                                />

                                {plan.popular && (
                                    <motion.div
                                        animate={{ boxShadow: ['0px 0px 0px rgba(255,255,255,0)', '0px 0px 20px rgba(255,255,255,0.4)', '0px 0px 0px rgba(255,255,255,0)'] }}
                                        transition={{ duration: 2, repeat: Infinity }}
                                        className="absolute top-3 left-1/2 -translate-x-1/2 z-20 rounded-full"
                                    >
                                        <Badge className="bg-white/20 backdrop-blur-md text-white border-white/20 uppercase text-[9px] tracking-[0.18em] font-bold px-3 py-1 shadow-lg">
                                            Most Popular
                                        </Badge>
                                    </motion.div>
                                )}

                                <div className="relative z-10 bg-white/10 backdrop-blur-md rounded-[2.3rem] border border-white/10 shadow-inner flex flex-col h-full">
                                    <div className={`flex items-center gap-4 p-6 pb-4 ${plan.popular ? 'pt-12' : ''}`}>
                                        <motion.div
                                            animate={{ y: [0, -5, 0] }}
                                            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: index * 0.3 }}
                                            className="relative bg-white/15 p-3 rounded-2xl backdrop-blur-md border border-white/20 shrink-0"
                                        >
                                            {style.icon}
                                        </motion.div>
                                        <div className="flex-1 min-w-0">
                                            <h2 className="text-xl font-black italic uppercase tracking-tighter drop-shadow-md truncate">
                                                {plan.display}
                                            </h2>
                                            <div className={`h-1 w-10 ${style.accent} rounded-full mt-1.5`} />
                                        </div>
                                    </div>

                                    {/* Price as a clinical readout — monospace, labeled like a lab result */}
                                    <div className="px-6 pb-4">
                                        {isExecutivePlan ? (
                                            <div>
                                                <div className="text-3xl font-black tracking-tight">Custom Quote</div>
                                                <div className="mt-1 text-[10px] opacity-65 font-bold uppercase tracking-widest">Contact sales</div>
                                            </div>
                                        ) : (
                                            <div className="flex items-baseline gap-1">
                                                {originalPrice && (
                                                    <span className="text-xs opacity-50 line-through font-mono mr-1">Rs.{originalPrice}</span>
                                                )}
                                                <span className="text-sm font-bold opacity-80 font-mono">Rs.</span>
                                                <span className="text-4xl font-black tracking-tight font-mono">{displayPrice}</span>
                                                <span className="text-[10px] opacity-60 font-bold uppercase tracking-widest font-mono ml-1">/{isMonthly ? 'mo' : 'yr'}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="px-6 pb-2 flex-1">
                                        <ul className="space-y-3">
                                            {currentPlanDetails.features.map((feature, idx) => (
                                                <li key={idx} className="flex items-start gap-3 text-sm font-semibold leading-snug">
                                                    <CheckCircle2 className={`h-5 w-5 shrink-0 ${style.accent.replace('bg-', 'text-')} opacity-90 mt-0.5`} />
                                                    <span className="text-white/90">{feature}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    <div className="p-4 pt-5">
                                        {isExecutivePlan ? (
                                            <Link to="/contact-us?subject=executive-plan" className="block">
                                                <Button className="w-full bg-white text-slate-900 hover:bg-white/90 active:scale-[0.98] transition-all duration-200 rounded-2xl h-14 uppercase font-black text-xs tracking-widest shadow-2xl">
                                                    Contact Sales
                                                </Button>
                                            </Link>
                                        ) : currentUserPlan === plan.id ? (
                                            <Button disabled className="w-full bg-white/10 border border-white/20 text-white rounded-2xl h-14 uppercase font-bold text-xs tracking-widest">
                                                Active Plan ✓
                                            </Button>
                                        ) : isFreePlanAndPaidUser ? (
                                            <Button disabled className="w-full bg-white/5 border border-white/10 text-white/40 rounded-2xl h-14 uppercase font-bold text-xs tracking-widest">
                                                You are on a paid plan
                                            </Button>
                                        ) : (
                                            <Link
                                                to={plan.id === 'free' ? '/dashboard' : '/checkout'}
                                                className="block"
                                                onClick={() => {
                                                    if (plan.id === 'free') return;
                                                    const selectedPlan = {
                                                        planId: plan.id,
                                                        planName: plan.display,
                                                        price: Number(displayPrice.replace(/,/g, '')) || 0,
                                                        billingPeriod: isMonthly ? 'monthly' : 'yearly',
                                                    } as const;
                                                    void trackMetaAddToCart({
                                                        ...selectedPlan,
                                                        marketingConsent: measurementAllowed,
                                                    });
                                                    trackGoogleAddToCart({
                                                        ...selectedPlan,
                                                        analyticsConsent: measurementAllowed,
                                                    });
                                                }}
                                                state={plan.id === 'free' ? undefined : {
                                                    planName: plan.display,
                                                    price: displayPrice,
                                                    duration: isMonthly ? 'Monthly' : 'Yearly',
                                                    validity: isMonthly ? 'monthly' : 'yearly',
                                                    currency: 'PKR',
                                                    planId: plan.id,
                                                }}
                                            >
                                                <Button className="w-full bg-white text-slate-900 hover:bg-white/90 active:scale-[0.98] transition-all duration-200 rounded-2xl h-14 uppercase font-black text-xs tracking-widest shadow-2xl">
                                                    {plan.id === 'free' ? 'Continue with Free' : 'Upgrade Now →'}
                                                </Button>
                                            </Link>
                                        )}
                                    </div>
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

                <div className="container mx-auto px-5 lg:px-8 max-w-2xl space-y-4 text-center">
                    <p className="text-[10px] text-slate-400 dark:text-white/35 uppercase tracking-[0.4em] font-black">
                        All prices in PKR · Secure checkout · Cancel anytime
                    </p>
                    <p className="mx-auto max-w-md text-xs font-semibold leading-relaxed text-slate-500 dark:text-white/45">
                        International payments are not yet supported. For further details contact us at{' '}
                        <a href="mailto:billing@medmacs.app" className="text-teal-600 dark:text-[#2dd4bf] underline underline-offset-4">
                            billing@medmacs.app
                        </a>
                    </p>
                </div>
            </main>
        </div>
    );
};

export default Pricing;
