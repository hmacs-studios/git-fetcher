import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Gift, Copy, Users, Share2, CheckCircle2, ChevronLeft, UserPlus, Sparkles, HeartHandshake } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import Seo from '@/components/Seo';

interface ReferredUser {
  id: string;
  full_name: string | null;
  username: string | null;
  updated_at: string | null;
}

const easing = [0.25, 0.1, 0.25, 1] as const;

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: easing } },
};

const ReferralSkeleton = () => (
  <div className="rounded-2xl border border-border/40 bg-card p-5">
    <div className="flex items-center gap-4">
      <div className="h-12 w-12 rounded-2xl bg-muted animate-pulse" />
      <div className="flex-1 space-y-2.5">
        <div className="h-4 w-36 rounded-full bg-muted animate-pulse" />
        <div className="h-3 w-24 rounded-full bg-muted/60 animate-pulse" />
      </div>
    </div>
  </div>
);

const Referrals = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const mainRef = useRef<HTMLDivElement>(null);

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile-referral-code', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase.from('profiles').select('referral_code').eq('id', user.id).maybeSingle();
      if (error) return null;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: referredUsers, isLoading: referredLoading } = useQuery<ReferredUser[]>({
    queryKey: ['referredUsers', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, username, updated_at')
        .eq('referred_by', user.id)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data as ReferredUser[];
    },
    enabled: !!user?.id,
  });

  const referralCode = profile?.referral_code || '------';
  const referralCount = referredUsers?.length || 0;
  const shareUrl = `${window.location.origin}/signup?ref=${referralCode}`;

  const copyCode = () => {
    if (!profile?.referral_code) return;
    navigator.clipboard.writeText(referralCode);
    setCopied(true);
    toast({ title: 'Copied!', description: 'Referral code copied to clipboard.' });
    setTimeout(() => setCopied(false), 2500);
  };

  if (!user) {
    return (
      <div className="dashboard-modern-font min-h-screen w-full bg-background">
        <Seo title="Referrals" description="Invite friends and earn rewards on Medmacs App." canonical="https://medmacs.app/referrals" />
        <div className="flex min-h-screen items-center justify-center p-6">
          <div className="w-full max-w-sm text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <Gift className="h-8 w-8 text-primary" />
            </div>
            <h2 className="mb-2 text-2xl font-black text-foreground">Sign in to Refer</h2>
            <p className="mb-8 text-sm text-muted-foreground">Log in to access your referral code and track invites.</p>
            <Button asChild className="h-12 w-full rounded-2xl font-black">
              <Link to="/login">Go to Login</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-modern-font min-h-screen w-full bg-background" ref={mainRef}>
      <Seo title="Referrals" description="Invite friends and earn rewards on Medmacs App." canonical="https://medmacs.app/referrals" />

      {/* Ambient orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 top-1/4 h-72 w-72 rounded-full bg-primary/10 blur-[100px]" />
        <div className="absolute -right-32 top-1/3 h-64 w-64 rounded-full bg-emerald-500/10 blur-[100px]" />
        <div className="absolute bottom-0 left-1/3 h-56 w-56 rounded-full bg-sky-500/10 blur-[100px]" />
      </div>

      {/* Fixed glass header */}
      <header className="fixed left-0 right-0 top-0 z-50 border-b border-border/30 bg-background/80 pt-[env(safe-area-inset-top)] backdrop-blur-2xl">
        <div className="flex h-14 items-center justify-between px-5">
          <Link to="/profile" className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted/60 text-muted-foreground transition-colors hover:bg-muted">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2.5">
            <img src="/lovable-uploads/bf69a7f7-550a-45a1-8808-a02fb889f8c5.png" alt="Medmacs" className="h-6 w-6" />
            <span className="text-sm font-extrabold text-foreground tracking-tight">Referrals</span>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted/60">
            <Gift className="h-4 w-4 text-primary" />
          </div>
        </div>
      </header>

      {/* Scrollable content */}
      <div className="px-5 pt-[calc(env(safe-area-inset-top)+3.5rem)] pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto max-w-2xl py-6">
          {/* Headline */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8 text-center">
            <span className="mb-3 inline-block rounded-full bg-primary/10 px-4 py-1 text-[10px] font-extrabold uppercase tracking-widest text-primary">
              Refer & Earn
            </span>
            <h1 className="text-3xl font-black tracking-tight text-foreground uppercase italic sm:text-4xl md:text-5xl">
              Invite Friends<span className="text-primary">.</span>
            </h1>
            <p className="mt-3 text-sm font-medium text-muted-foreground">
              Share your code and earn rewards when your friends join Medmacs
            </p>
          </motion.div>

          {profileLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 2 }).map((_, i) => <ReferralSkeleton key={i} />)}
            </div>
          ) : (
            <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-5">
              {/* Referral Code Card */}
              <motion.div variants={itemVariants}>
                <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 text-white shadow-2xl shadow-emerald-500/20">
                  <div className="absolute -bottom-6 -right-6 opacity-[0.12]">
                    <HeartHandshake className="h-32 w-32" />
                  </div>
                  <div className="relative z-10 p-6">
                    <div className="mb-1 flex items-center gap-2">
                      <Gift className="h-5 w-5 text-emerald-200" />
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-200">
                        Your Code
                      </span>
                    </div>

                    <div className="mt-3 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={copyCode}
                        disabled={!profile?.referral_code}
                        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm border-2 border-white/20 transition-colors hover:bg-white/20 active:scale-95"
                      >
                        {copied ? (
                          <CheckCircle2 className="h-6 w-6 text-emerald-300" />
                        ) : (
                          <Copy className="h-6 w-6 text-white" />
                        )}
                      </button>
                      <div className="flex-1 rounded-2xl bg-white/10 backdrop-blur-sm px-5 py-3.5 border border-white/15">
                        <span className="text-2xl font-black tracking-[0.3em] select-all sm:text-3xl">
                          {referralCode}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(shareUrl);
                          toast({ title: 'Link copied!', description: 'Share this link with your friends.' });
                        }}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-white/20 active:scale-95"
                      >
                        <Share2 className="h-4 w-4" />
                        Share Referral Link
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Stats + Referred Users */}
              <motion.div variants={itemVariants}>
                <div className="rounded-2xl border border-border/40 bg-card p-5 shadow-sm">
                  <div className="mb-5 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-black text-foreground">{referralCount}</p>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {referralCount === 1 ? 'Person Referred' : 'People Referred'}
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-border/40 pt-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
                        Referred Friends
                      </h3>
                      {referredUsers && referredUsers.length > 0 && (
                        <span className="text-[10px] font-bold text-muted-foreground">{referredUsers.length}</span>
                      )}
                    </div>

                    {referredLoading ? (
                      <div className="space-y-2.5">
                        {Array.from({ length: 3 }).map((_, i) => <ReferralSkeleton key={i} />)}
                      </div>
                    ) : referredUsers && referredUsers.length > 0 ? (
                      <AnimatePresence mode="popLayout">
                        <div className="space-y-2">
                          {referredUsers.map((referred, idx) => (
                            <motion.div
                              key={referred.id}
                              initial={{ opacity: 0, y: 12 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: idx * 0.04 }}
                              className="flex items-center gap-3 rounded-xl bg-muted/40 p-3.5 transition-colors hover:bg-muted/60"
                            >
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20">
                                <UserPlus className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-bold text-foreground">
                                  {referred.full_name || referred.username || 'Anonymous'}
                                </p>
                                {referred.username && (
                                  <p className="truncate text-xs text-muted-foreground">@{referred.username}</p>
                                )}
                              </div>
                              <Badge
                                variant="outline"
                                className="shrink-0 rounded-full border-emerald-200 bg-emerald-500/10 px-3 text-[10px] font-extrabold uppercase tracking-widest text-emerald-600 dark:border-emerald-800 dark:text-emerald-400"
                              >
                                Joined
                              </Badge>
                            </motion.div>
                          ))}
                        </div>
                      </AnimatePresence>
                    ) : (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.97 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="py-10 text-center"
                      >
                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/5">
                          <UserPlus className="h-7 w-7 text-primary/40" />
                        </div>
                        <h4 className="mb-1 text-base font-black text-foreground">No referrals yet</h4>
                        <p className="mx-auto max-w-[240px] text-sm text-muted-foreground">
                          Share your code and start building your network
                        </p>
                      </motion.div>
                    )}
                  </div>
                </div>
              </motion.div>

              {/* Info footer */}
              <motion.div variants={itemVariants} className="pb-4 text-center">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-4 py-2">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    More rewards coming soon
                  </span>
                </div>
              </motion.div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Referrals;
