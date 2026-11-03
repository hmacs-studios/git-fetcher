import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ArrowRight, Gauge } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';

type UsageLimitsSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string;
  rawUserPlan: string;
  userPlanDisplayName: string;
};

type UsageBar = {
  percentage: number;
  color: string;
  reached: boolean;
  unlimited: boolean;
};

type UsageFeature = 'ai' | 'references' | 'explains' | 'analysis' | 'flp' | 'flashcards';

const usageBar = (used: number, limit: number | null): UsageBar => {
  if (limit == null || !Number.isFinite(limit)) return { percentage: 0, color: 'bg-primary', reached: false, unlimited: true };
  const percentage = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const color = percentage >= 100 ? 'bg-red-600 opacity-60' : percentage >= 90 ? 'bg-red-500' : percentage >= 76 ? 'bg-orange-500' : percentage >= 51 ? 'bg-yellow-500' : 'bg-primary';
  return { percentage, color, reached: percentage >= 100, unlimited: false };
};

export function UsageLimitsSheet({ open, onOpenChange, userId, rawUserPlan, userPlanDisplayName }: UsageLimitsSheetProps) {
  const [usagePeriod, setUsagePeriod] = useState<'daily' | 'monthly'>('daily');

  const { data: usageLimits, isLoading: usageLoading } = useQuery({
    queryKey: ['dashboard-ai-usage', userId, rawUserPlan],
    queryFn: async () => {
      if (!userId) return null;
      const now = new Date();
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const fallbacks = rawUserPlan === 'premium'
        ? { ai: [500, 15000], references: [1000, 30000], explains: [500, 15000] }
        : rawUserPlan === 'iconic'
          ? { ai: [100, 3000], references: [100, 3000], explains: [100, 3000] }
          : { ai: [5, 15], references: [5, 10], explains: [2, 10] };
      const features = ['study-chat', 'reference', 'reference-explain', 'analytics-plan'];
      const [policyResult, overrideResult, dailyResults, monthlyResults, dailyFlp, monthlyFlp, dailyCards, monthlyCards] = await Promise.all([
        (supabase.from('ai_feature_policies') as any).select('feature, daily_requests, monthly_requests, cooldown_days').eq('plan', rawUserPlan).in('feature', [...features, 'titration-flashcards']),
        (supabase.from('ai_user_overrides') as any).select('feature, daily_requests, monthly_requests, cooldown_days, expires_at').eq('user_id', userId),
        Promise.all(features.map(feature => (supabase.from('ai_usage_events') as any).select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('feature', feature).in('status', ['success', 'fallback']).gte('created_at', dayStart))),
        Promise.all(features.map(feature => (supabase.from('ai_usage_events') as any).select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('feature', feature).in('status', ['success', 'fallback']).gte('created_at', monthStart))),
        (supabase.from('flp_user_attempts') as any).select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('completed_at', dayStart),
        (supabase.from('flp_user_attempts') as any).select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('completed_at', monthStart),
        (supabase.from('ai_usage_events') as any).select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('feature', 'titration-flashcards').in('status', ['success', 'fallback']).gte('created_at', dayStart),
        (supabase.from('ai_usage_events') as any).select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('feature', 'titration-flashcards').in('status', ['success', 'fallback']).gte('created_at', monthStart),
      ]);
      const policyMap = Object.fromEntries((policyResult.data || []).map((policy: any) => [policy.feature, policy]));
      (overrideResult.data || [])
        .filter((override: any) => !override.expires_at || new Date(override.expires_at).getTime() > now.getTime())
        .forEach((override: any) => {
          policyMap[override.feature] = { ...(policyMap[override.feature] || {}), ...Object.fromEntries(Object.entries(override).filter(([, value]) => value != null)) };
        });
      const getLimit = (feature: string, period: 'daily' | 'monthly', fallback: number) => Number(policyMap[feature]?.[period === 'daily' ? 'daily_requests' : 'monthly_requests'] ?? fallback);
      const chatDailyLimit = Math.max(rawUserPlan === 'premium' ? 500 : rawUserPlan === 'iconic' ? 100 : 0, getLimit('study-chat', 'daily', fallbacks.ai[0]));
      const analysisCooldown = Math.max(1, Number(policyMap['analytics-plan']?.cooldown_days || (rawUserPlan === 'premium' ? 1 : rawUserPlan === 'iconic' ? 3 : 7)));
      return {
        daily: { ai: dailyResults[0].count || 0, references: dailyResults[1].count || 0, explains: dailyResults[2].count || 0, analysis: dailyResults[3].count || 0, flp: dailyFlp.count || 0, flashcards: dailyCards.count || 0 },
        monthly: { ai: monthlyResults[0].count || 0, references: monthlyResults[1].count || 0, explains: monthlyResults[2].count || 0, analysis: monthlyResults[3].count || 0, flp: monthlyFlp.count || 0, flashcards: monthlyCards.count || 0 },
        limits: {
          ai: { daily: chatDailyLimit, monthly: getLimit('study-chat', 'monthly', fallbacks.ai[1]) },
          references: { daily: getLimit('reference', 'daily', fallbacks.references[0]), monthly: getLimit('reference', 'monthly', fallbacks.references[1]) },
          explains: { daily: getLimit('reference-explain', 'daily', fallbacks.explains[0]), monthly: getLimit('reference-explain', 'monthly', fallbacks.explains[1]) },
          analysis: { daily: 1, monthly: Math.max(1, Math.floor(30 / analysisCooldown)), cooldownDays: analysisCooldown },
          flp: { daily: rawUserPlan === 'premium' ? null : rawUserPlan === 'iconic' ? 5 : 1, monthly: rawUserPlan === 'premium' || rawUserPlan === 'iconic' ? null : 20 },
          flashcards: { daily: getLimit('titration-flashcards', 'daily', rawUserPlan === 'premium' ? 300 : rawUserPlan === 'iconic' ? 50 : 0), monthly: getLimit('titration-flashcards', 'monthly', rawUserPlan === 'premium' ? 7500 : rawUserPlan === 'iconic' ? 1500 : 0) },
        },
      };
    },
    enabled: open && !!userId,
    staleTime: 60_000,
  });

  const usagePeriodHasAlert = (period: 'daily' | 'monthly') =>
    usageLimits && (['ai', 'references', 'explains', 'analysis', 'flp', 'flashcards'] as UsageFeature[]).some(
      key => usageBar((usageLimits[period] as Record<UsageFeature, number>)[key], (usageLimits.limits[key] as Record<string, number | null>)[period]).percentage >= 90
    );

  const featureItems: { key: UsageFeature; label: string }[] = [
    { key: 'ai', label: 'AI calls' },
    { key: 'references', label: 'Book references' },
    { key: 'explains', label: 'Option explains' },
    { key: 'analysis', label: 'Dr Ahroid analysis' },
    { key: 'flp', label: 'Full-Length Papers' },
    { key: 'flashcards', label: 'Smart Revision cards' },
  ];
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent data-usage-limits-sheet="true" side="bottom" className="flex max-h-[88dvh] flex-col overflow-hidden rounded-t-[2rem] border-x border-t border-primary/20 bg-background/95 pb-[calc(1.5rem+env(safe-area-inset-bottom))] backdrop-blur-2xl">
        <SheetHeader className="mx-auto w-full max-w-lg text-left">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25"><Gauge className="h-6 w-6" /></div>
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-primary">Account usage</p>
          <SheetTitle className="text-2xl font-extrabold tracking-tight brand-display">Usage Limits</SheetTitle>
          <SheetDescription>Track AI, references, explanations, and revision usage.</SheetDescription>
        </SheetHeader>
        <div className="mx-auto mt-5 flex min-h-0 w-full max-w-lg flex-1 flex-col space-y-4">
          <div className="flex items-center justify-between rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3">
            <span className="text-sm font-semibold text-muted-foreground">Current plan</span>
            <Badge className="bg-primary/15 text-primary">{userPlanDisplayName}</Badge>
          </div>
          {usageLoading ? (
            <div className="space-y-4 animate-pulse">
              <div className="grid grid-cols-2 gap-2 rounded-2xl bg-muted/40 p-1">
                <div className="h-9 rounded-xl bg-muted/60" />
                <div className="h-9 rounded-xl bg-muted/60" />
              </div>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="rounded-2xl border border-border/40 bg-card p-4 space-y-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1.5 w-1/2">
                        <div className="h-4 w-3/4 rounded-md bg-muted/70" />
                        <div className="h-3 w-1/2 rounded-md bg-muted/40" />
                      </div>
                      <div className="h-4 w-14 rounded-md bg-muted/70" />
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-muted/50" />
                    <div className="h-3 w-16 ml-auto rounded-md bg-muted/40" />
                  </div>
                ))}
              </div>
            </div>
          ) : usageLimits ? (
            <>
              <div className="grid grid-cols-2 gap-2 rounded-2xl bg-muted/50 p-1">
                {(['daily', 'monthly'] as const).map(period => (
                  <button key={period} onClick={() => setUsagePeriod(period)} className={`relative rounded-xl px-3 py-2.5 text-sm font-bold capitalize transition-colors ${usagePeriod === period ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}>
                    {period} usage {usagePeriodHasAlert(period) && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-background" />}
                  </button>
                ))}
              </div>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pr-1">
                {(() => {
                  const monthlyReached = usagePeriod === 'daily' && featureItems.some(
                    item => usageBar((usageLimits.monthly as Record<UsageFeature, number>)[item.key], (usageLimits.limits[item.key] as Record<string, number | null>).monthly).reached
                  );
                  const reset = usagePeriod === 'daily'
                    ? new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })
                    : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
                  return featureItems.map(item => {
                    const used = (usageLimits[usagePeriod] as Record<UsageFeature, number>)[item.key];
                    const limit = (usageLimits.limits[item.key] as Record<string, number | null>)[usagePeriod];
                    const bar = monthlyReached ? { percentage: 100, color: 'bg-red-600 opacity-60', reached: true, unlimited: false } : usageBar(used, limit);
                    return (
                      <div key={item.key} className={`rounded-2xl border border-border/50 bg-card p-4 shadow-sm ${bar.reached ? 'opacity-60' : ''}`}>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold text-foreground">{item.label}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {item.key === 'analysis' && usageLimits.limits.analysis.cooldownDays > 1
                                ? `Available every ${usageLimits.limits.analysis.cooldownDays} days`
                                : bar.unlimited ? 'No limit' : monthlyReached ? 'Monthly limit reached' : `Resets at ${reset}`}
                            </p>
                          </div>
                          <span className="text-sm font-black text-foreground">
                            {bar.reached ? (monthlyReached ? 'Monthly limit reached' : 'Limit reached') : bar.unlimited ? 'Unlimited' : `${used} / ${limit}`}
                          </span>
                        </div>
                        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted">
                          <div className={`h-full rounded-full transition-all ${bar.color}`} style={{ width: `${bar.percentage}%` }} />
                        </div>
                        <p className="mt-1.5 text-right text-[11px] font-bold text-muted-foreground">{Math.round(bar.percentage)}% used</p>
                      </div>
                    );
                  });
                })()}
              </div>
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-center">
                <p className="text-sm font-semibold text-foreground">Need more room to study?</p>
                <p className="mt-1 text-xs text-muted-foreground">Upgrade your plan for higher daily and monthly limits.</p>
                <Button asChild className="mt-3 w-full rounded-xl">
                  <Link to="/pricing" onClick={() => onOpenChange(false)}>Upgrade plan <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
              </div>
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
