import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Gift, Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Seo from '@/components/Seo';

const RedeemCode = () => {
    const { user } = useAuth();
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const successModalRef = useRef(null);
    const [activatedPlan, setActivatedPlan] = useState("");
    const [days, setDays] = useState(0);
    const headerRef = useRef<HTMLDivElement>(null);
    const lastScrollY = useRef(0);
    const [headerVisible, setHeaderVisible] = useState(true);

    const { data: profile, refetch } = useQuery({
        queryKey: ['profile', user?.id],
        queryFn: async () => {
            if (!user?.id) return null;
            const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
            return data;
        },
        enabled: !!user?.id
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

    const handleRedeem = async () => {
        if (!code.trim()) { setErrorMsg("Enter a valid code"); return; }
        if (profile?.plan && profile.plan.toLowerCase() !== "free") {
            setErrorMsg("You are already a paid user and cannot avail this offer now.");
            return;
        }
        setErrorMsg('');
        setLoading(true);
        const { data, error } = await supabase.rpc('use_redeem_code', { code_input: code.trim(), uid: user.id });
        if (error || !data?.[0]?.success) { setErrorMsg("Invalid, expired, or fully used code."); setLoading(false); return; }
        const { plan, duration_days } = data[0];
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + duration_days);
        await supabase.from('profiles').update({ plan, plan_expiry_date: expiry.toISOString() }).eq('id', user.id);
        setActivatedPlan(plan);
        setDays(duration_days);
        successModalRef.current?.showModal();
        setCode('');
        setLoading(false);
        refetch();
    };

    return (
        <div className="dashboard-modern-font min-h-screen w-full bg-background bg-mesh text-foreground relative overflow-x-hidden">
            <Seo title="Redeem Code" />

            <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
                <div className="absolute -top-32 -left-32 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
                <div className="absolute top-1/2 -right-32 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
            </div>

            <dialog ref={successModalRef} className="w-[calc(100vw-2rem)] max-w-sm rounded-3xl border border-border bg-card p-6 text-card-foreground shadow-2xl backdrop:bg-background/80 backdrop:backdrop-blur-sm">
                <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-primary/10"><Sparkles className="h-6 w-6 text-primary" /></div>
                <h3 className="text-xl font-black">Congratulations!</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Your <b className="text-foreground">{activatedPlan}</b> plan is activated for <b className="text-foreground">{days}</b> days.
                </p>
                <div className="mt-5">
                    <Button onClick={() => successModalRef.current.close()} className="w-full rounded-xl h-11 font-bold">Continue</Button>
                </div>
            </dialog>

            <div
                ref={headerRef}
                className={`fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-2xl border-b border-border/30 pt-[env(safe-area-inset-top)] transition-transform duration-300 ${headerVisible ? 'translate-y-0' : '-translate-y-full'}`}
            >
                <div className="container mx-auto grid h-14 max-w-7xl grid-cols-[1fr_auto_1fr] items-center px-5">
                    <img src="/lovable-uploads/bf69a7f7-550a-45a1-8808-a02fb889f8c5.png" alt="Medmacs" className="h-9 w-9 object-contain" />
                    <h1 className="brand-wordmark text-xl text-foreground">Redeem Code</h1>
                    <div aria-hidden="true" />
                </div>
            </div>

            <main className="relative z-10 container mx-auto px-5 py-8 max-w-md mt-[var(--header-height)]">
                <div className="mb-8 flex flex-col items-center text-center">
                    <div className="inline-flex items-center space-x-2 bg-primary/10 rounded-full px-4 py-1.5 mb-4 border border-primary/15">
                        <Sparkles className="w-3.5 h-3.5 text-primary" />
                        <span className="text-primary text-[10px] font-bold uppercase tracking-widest">Access code</span>
                    </div>
                    <div className="relative inline-flex mb-5">
                        <div className="absolute inset-0 bg-primary blur-2xl opacity-20 rounded-full" />
                        <div className="relative bg-primary p-5 rounded-3xl shadow-xl shadow-primary/20">
                            <Gift className="w-9 h-9 text-primary-foreground" />
                        </div>
                    </div>
                    <h1 className="text-3xl font-black text-foreground tracking-tight">
                        Redeem Access Code
                    </h1>
                    <p className="text-muted-foreground text-sm mt-2">Enter your code to activate the associated offer.</p>
                </div>

                <div className="relative overflow-hidden rounded-3xl border border-border/50 bg-card/90 shadow-xl shadow-black/5 backdrop-blur-xl">
                    <div className="h-1 w-full bg-gradient-to-r from-primary/30 via-primary to-primary/30" />
                    <div className="relative z-10 p-6 space-y-5">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Enter promo code</p>
                            <Input
                                placeholder="ABCD-1234"
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground/60 rounded-xl h-12 text-center text-lg font-mono uppercase tracking-widest focus-visible:ring-primary"
                            />
                        </div>
                        {errorMsg && <p className="rounded-xl border border-destructive/15 bg-destructive/10 px-3 py-2.5 text-destructive text-xs text-center font-medium">{errorMsg}</p>}
                        <Button onClick={handleRedeem} disabled={loading}
                            className="w-full transition-all rounded-xl h-12 font-black text-xs tracking-wide shadow-lg shadow-primary/15">
                            {loading ? "Processing..." : "Redeem Code"}
                        </Button>
                    </div>
                </div>

                <section className="mt-5 rounded-2xl border border-border/40 bg-card/60 p-4 text-left shadow-sm backdrop-blur-sm">
                    <h2 className="text-xs font-black text-foreground">Before you redeem</h2>
                    <div className="mt-3 space-y-3">
                        {[
                            ['1', 'Enter the code exactly as it was shared with you.'],
                            ['2', 'Redemption offers can only be applied while your current plan is Free.'],
                            ['3', 'Eligible access is activated immediately after successful verification.'],
                        ].map(([step, text]) => (
                            <div key={step} className="flex items-start gap-3">
                                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-black text-primary">{step}</span>
                                <p className="text-[11px] leading-5 text-muted-foreground">{text}</p>
                            </div>
                        ))}
                    </div>
                </section>

                <footer className="pb-4 pt-8 text-center">
                    <p className="text-[10px] font-medium text-muted-foreground">A Project by Hmacs Studios.</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">© 2026 Hmacs Studios. All rights reserved</p>
                </footer>
            </main>
        </div>
    );
};

export default RedeemCode;
