
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Target, TrendingUp, Flame, Clock } from 'lucide-react';
import { useEffect, useState } from 'react';

interface ProgressTrackerProps {
  userId?: string;
}

const CountUpNumber = ({ target, suffix = '', duration = 1000 }: { target: number; suffix?: string; duration?: number }) => {
  const [count, setCount] = useState(0);
  const [isAnimating, setIsAnimating] = useState(true);

  useEffect(() => {
    setCount(0);
    setIsAnimating(true);
    const startTime = Date.now();
    const startValue = 0;
    const endValue = target;

    const animate = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startValue + (endValue - startValue) * easeOut);
      setCount(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setIsAnimating(false);
      }
    };

    requestAnimationFrame(animate);
  }, [target, duration]);

  if (isAnimating) {
    return (
      <div className="h-8 w-16 bg-muted rounded animate-pulse mx-auto" />
    );
  }

  return <>{count}{suffix}</>;
};

export const ProgressTracker = ({ userId }: ProgressTrackerProps) => {
  const { data: analytics, isLoading } = useQuery({
    queryKey: ['user-answers-progress', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await (supabase as any).rpc('medmacs_learning_analytics', { p_period_days: 30 });
      if (error) throw error;
      return data;
    },
    enabled: !!userId
  });

  const totalQuestions = Number(analytics?.attempts || 0);
  const overallAccuracy = Number(analytics?.accuracy_percent || 0);
  const avgTime = Number(analytics?.average_time_seconds || 0);
  const currentStreak = Number(analytics?.current_streak_days || 0);

  const stats = [
    { label: 'Total Practice', value: totalQuestions, icon: Target, tint: 'from-blue-500/12 via-indigo-500/6 to-transparent', iconColor: 'text-blue-500' },
    { label: 'Accuracy', value: overallAccuracy, suffix: '%', icon: TrendingUp, tint: 'from-emerald-500/12 via-teal-500/6 to-transparent', iconColor: 'text-emerald-500' },
    { label: 'Current Streak', value: currentStreak, suffix: ' days', icon: Flame, tint: 'from-orange-500/12 via-red-500/6 to-transparent', iconColor: 'text-orange-500' },
    { label: 'Avg Time', value: avgTime, suffix: 's', icon: Clock, tint: 'from-rose-500/12 via-pink-500/6 to-transparent', iconColor: 'text-rose-500' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {stats.map((stat) => (
        <div key={stat.label} className={`relative overflow-hidden rounded-[1.5rem] border border-border/60 bg-gradient-to-br ${stat.tint} backdrop-blur-sm shadow-sm p-3 sm:p-4 text-center`}>
          <div className="flex justify-center mb-2">
            <div className={`bg-background/70 p-2 rounded-xl border border-border/60 shadow-sm ${stat.iconColor}`}>
              <stat.icon className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-foreground">
            <CountUpNumber target={stat.value} suffix={stat.suffix} />
          </div>
          <div className="text-muted-foreground text-[10px] uppercase tracking-widest font-bold mt-1">{stat.label}</div>
        </div>
      ))}
    </div>
  );
};
