
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
  const { data: answers, isLoading } = useQuery({
    queryKey: ['user-answers-progress', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('user_answers')
        .select('is_correct, time_taken, created_at')
        .eq('user_id', userId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId
  });

  const totalQuestions = answers?.length || 0;
  const totalCorrect = answers?.filter(a => a.is_correct).length || 0;
  const overallAccuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

  // Average time
  const timeTakenArr = answers?.filter(a => a.time_taken != null).map(a => a.time_taken) || [];
  const avgTime = timeTakenArr.length > 0 ? Math.round(timeTakenArr.reduce((s, t) => s + t, 0) / timeTakenArr.length) : 0;

  // Calculate current streak (consecutive days with MCQ practice)
  const calculateCurrentStreak = (answersData: any[]) => {
    if (!answersData || answersData.length === 0) return 0;
    
    const answerDates = [...new Set(answersData.map(a => {
      const date = new Date(a.created_at);
      return date.toLocaleDateString("en-US", { timeZone: "Asia/Karachi" });
    }))];

    if (answerDates.length === 0) return 0;

    const today = new Date();
    const todayPKT = new Date(today.toLocaleString("en-US", { timeZone: "Asia/Karachi" }));
    todayPKT.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(todayPKT);
    yesterday.setDate(yesterday.getDate() - 1);

    const dateObjects = answerDates.map(d => {
      const [month, day, year] = d.split('/');
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }).sort((a, b) => b.getTime() - a.getTime());

    const mostRecent = dateObjects[0];
    const isToday = mostRecent.getTime() === todayPKT.getTime();
    const isYesterday = mostRecent.getTime() === yesterday.getTime();

    if (!isToday && !isYesterday) return 0;

    let streak = 1;
    let currentDate = new Date(mostRecent);

    for (let i = 1; i < dateObjects.length; i++) {
      const prevDate = new Date(dateObjects[i]);
      const expectedPrevDate = new Date(currentDate);
      expectedPrevDate.setDate(expectedPrevDate.getDate() - 1);

      if (prevDate.getTime() === expectedPrevDate.getTime()) {
        streak++;
        currentDate = prevDate;
      } else {
        break;
      }
    }

    return streak;
  };

  const currentStreak = calculateCurrentStreak(answers || []);

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
