import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trophy } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import Seo from '@/components/Seo';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { useAchievementData } from '@/components/profile/AchievementBadges';
import { BADGE_DEFINITIONS, BADGE_GROUP_ORDER, defaultStats, sortEarnedFirst, type BadgeGroup } from '@/components/profile/badgeDefinitions';
import { BadgeMedallion } from '@/components/profile/BadgeMedallion';
import { AchievementBadgesSkeleton } from '@/components/profile/AchievementBadgesSkeleton';
import { BadgeDetailSheet, BadgeGrid, useBadgeDetail } from '@/components/profile/BadgeGrid';

type BadgeFilter = 'all' | 'unlocked' | 'locked';

const FILTERS: Array<{ id: BadgeFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'unlocked', label: 'Unlocked' },
  { id: 'locked', label: 'Locked' },
];

const BadgesPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, isLoading } = useAchievementData(user?.id);
  const { activeBadge, isOpen, openBadge, closeBadge } = useBadgeDetail();
  const [filter, setFilter] = useState<BadgeFilter>('all');

  const stats = data?.stats || defaultStats;
  const earnedBadgeIds = data?.earnedBadgeIds || [];
  const earnedSet = useMemo(() => new Set(earnedBadgeIds), [earnedBadgeIds]);

  const groups = useMemo(() => {
    return BADGE_GROUP_ORDER.map((group) => {
      const groupBadges = BADGE_DEFINITIONS.filter((badge) => badge.group === group);
      const earnedCount = groupBadges.filter((badge) => earnedSet.has(badge.id)).length;
      const filtered = groupBadges.filter((badge) => {
        if (filter === 'unlocked') return earnedSet.has(badge.id);
        if (filter === 'locked') return !earnedSet.has(badge.id);
        return true;
      });

      return {
        group: group as BadgeGroup,
        earnedCount,
        total: groupBadges.length,
        badges: sortEarnedFirst(filtered, earnedSet),
      };
    }).filter((section) => section.badges.length > 0);
  }, [earnedSet, filter]);

  const total = BADGE_DEFINITIONS.length;
  const earnedCount = earnedBadgeIds.length;
  const progress = Math.round((earnedCount / total) * 100);
  const filterCounts: Record<BadgeFilter, number> = {
    all: total,
    unlocked: earnedCount,
    locked: total - earnedCount,
  };

  return (
    <div className="dashboard-modern-font relative flex h-[100dvh] w-full flex-col overflow-hidden bg-background bg-mesh text-foreground">
      <Seo title="Badges" description="Every Medmacs achievement badge, what it takes to unlock it, and everything you have earned so far." />

      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="absolute -bottom-24 -left-32 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <header className="fixed inset-x-0 top-0 z-50 border-b border-border/30 bg-background/80 pt-[env(safe-area-inset-top)] backdrop-blur-2xl">
        <div className="mx-auto grid h-14 max-w-3xl grid-cols-[1fr_auto_1fr] items-center px-4">
          <img src="/lovable-uploads/bf69a7f7-550a-45a1-8808-a02fb889f8c5.png" alt="Medmacs" className="h-9 w-9 object-contain" />
          <h1 className="brand-wordmark text-xl text-foreground">Badges</h1>
          <div aria-hidden="true" />
        </div>
      </header>

      <main className="no-scrollbar relative z-10 mx-auto w-full max-w-3xl flex-1 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-[calc(env(safe-area-inset-top)+4.5rem)]">
        {isLoading ? (
          <AchievementBadgesSkeleton count={12} />
        ) : (
          <>
            <section className="mb-6 rounded-3xl border border-border/40 bg-card/70 p-5 shadow-sm backdrop-blur-xl">
              <div className="flex items-center gap-4">
                <BadgeMedallion shape="rosette" tone="amber" icon={Trophy} earned={earnedCount > 0} showLock={false} className="h-16 w-16" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Your collection</p>
                  <div className="mt-0.5 flex items-baseline gap-1.5">
                    <span className="text-2xl font-black leading-none text-foreground">{earnedCount}</span>
                    <span className="text-sm font-bold text-muted-foreground">/ {total} unlocked</span>
                  </div>
                  <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                      className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                  { label: 'Progress', value: `${progress}%` },
                  { label: 'Points', value: stats.points.toLocaleString() },
                  { label: 'Streak', value: `${stats.currentStreak}d` },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl bg-muted/50 px-3 py-2.5 text-center">
                    <p className="text-sm font-black leading-none text-foreground">{item.value}</p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{item.label}</p>
                  </div>
                ))}
              </div>
            </section>

            <div className="no-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4">
              {FILTERS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setFilter(option.id)}
                  aria-pressed={filter === option.id}
                  className={cn(
                    'shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-black uppercase tracking-wider transition-colors',
                    filter === option.id
                      ? 'border-transparent bg-primary text-primary-foreground'
                      : 'border-border/50 bg-card/60 text-muted-foreground active:bg-muted',
                  )}
                >
                  {option.label}
                  <span className={cn('ml-1.5 font-bold', filter === option.id ? 'text-primary-foreground/70' : 'text-muted-foreground/60')}>
                    {filterCounts[option.id]}
                  </span>
                </button>
              ))}
            </div>

            {groups.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border/60 px-6 py-12 text-center">
                <p className="text-sm font-bold text-foreground">
                  {filter === 'unlocked' ? 'No badges unlocked yet' : 'Every badge is unlocked'}
                </p>
                <p className="mt-1 text-xs font-medium text-muted-foreground">
                  {filter === 'unlocked' ? 'Solve MCQs, keep a streak, and they will start landing here.' : 'Nothing left to chase — outstanding work.'}
                </p>
              </div>
            ) : (
              <div className="space-y-7">
                {groups.map((section) => (
                  <section key={section.group}>
                    <div className="mb-3 flex items-baseline justify-between px-1">
                      <h2 className="text-xs font-black uppercase tracking-[0.16em] text-foreground">{section.group}</h2>
                      <span className="text-[11px] font-bold text-muted-foreground">
                        {section.earnedCount}/{section.total}
                      </span>
                    </div>
                    <BadgeGrid
                      badges={section.badges}
                      earnedIds={earnedSet}
                      activeBadgeId={isOpen ? activeBadge?.id : null}
                      onSelect={openBadge}
                    />
                  </section>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <BadgeDetailSheet
        badge={activeBadge}
        earned={activeBadge ? earnedSet.has(activeBadge.id) : false}
        open={isOpen}
        onClose={closeBadge}
      />
    </div>
  );
};

export default BadgesPage;
