import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Medal, School, Trophy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { DashboardProfile } from '../types';

type Props = { profile?: DashboardProfile | null };
type Ranking = { code: string; name: string; points: number; questions: number; correct: number };

const isMbbsYear = (year?: string | null) =>
  /^(1st|2nd|3rd|4th|5th)( year)?( mbbs)?$|^final year( mbbs)?$/i.test((year || '').trim());

export function StudentInstituteRankingCard({ profile }: Props) {
  const cardRef = useRef<HTMLElement>(null);
  const [hasEnteredViewport, setHasEnteredViewport] = useState(false);
  const userYear = profile?.year?.trim() || '';
  const instituteCode = profile?.institute?.trim() || '';
  const enabled = Boolean(profile?.id && instituteCode && isMbbsYear(userYear));

  useEffect(() => {
    const card = cardRef.current;
    if (!enabled || !card) return;
    if (typeof IntersectionObserver === 'undefined') {
      setHasEnteredViewport(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setHasEnteredViewport(true);
        observer.disconnect();
      }
    }, { rootMargin: '250px 0px' });
    observer.observe(card);
    return () => observer.disconnect();
  }, [enabled]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard-institute-rankings', profile?.id, 'all-mbbs-years'],
    enabled: enabled && hasEnteredViewport,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data: rows, error } = await (supabase as any)
        .rpc('get_dashboard_institute_rankings_24h');
      if (error) throw error;
      return (rows || []).map((row: any): Ranking => ({
        code: row.institute_code,
        name: row.institute_name || row.institute_code,
        points: Number(row.points || 0),
        questions: Number(row.questions || 0),
        correct: Number(row.correct_answers || 0),
      }));
    },
  });

  if (!enabled) return null;

  const rankings: Ranking[] = data || [];
  const currentInstituteRank = rankings.findIndex((entry) => entry.code === instituteCode) + 1;
  const visibleRankings = rankings.slice(0, 5);
  if (currentInstituteRank > 5) {
    const currentInstitute = rankings[currentInstituteRank - 1];
    if (currentInstitute) visibleRankings.splice(4, 1, currentInstitute);
  }

  return (
    <section ref={cardRef} className="mb-6 overflow-hidden rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/10 via-card to-indigo-500/5 shadow-sm shadow-violet-500/5">
      <div className="flex items-center justify-between gap-3 border-b border-violet-500/10 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-300">
            <Trophy className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-extrabold text-foreground">Institute Rankings</h2>
            <p className="text-[10px] font-medium text-muted-foreground">All MBBS years · last 24 hours</p>
          </div>
        </div>
        {currentInstituteRank > 0 && (
          <span className="rounded-full bg-violet-500/15 px-2.5 py-1 text-xs font-black text-violet-700 dark:text-violet-200">
            Your institute #{currentInstituteRank}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2 p-4" aria-label="Loading institute rankings">
          <div className="h-10 animate-pulse rounded-xl bg-muted/70" />
          <div className="h-10 animate-pulse rounded-xl bg-muted/50" />
        </div>
      ) : isError ? (
        <p className="px-4 py-5 text-center text-xs text-muted-foreground">Institute rankings are temporarily unavailable.</p>
      ) : visibleRankings.length ? (
        <ol className="space-y-1 p-2">
          {visibleRankings.map((entry) => {
            const rank = rankings.findIndex((item) => item.code === entry.code) + 1;
            const isCurrent = entry.code === instituteCode;
            return (
              <li key={entry.code} className={`flex items-center gap-3 rounded-xl px-3 py-2 ${isCurrent ? 'bg-violet-500/10 ring-1 ring-violet-500/20' : ''}`}>
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-black ${rank === 1 ? 'bg-amber-500/15 text-amber-600' : 'bg-background/70 text-muted-foreground'}`}>
                  {rank <= 3 ? <Medal className="h-4 w-4" /> : rank}
                </span>
                <School className="h-4 w-4 shrink-0 text-violet-500" />
                <span className="min-w-0 flex-1 truncate text-xs font-bold text-foreground">
                  {entry.name}
                  {isCurrent && <span className="ml-1.5 text-[9px] font-black uppercase text-violet-600 dark:text-violet-300">You</span>}
                </span>
                <span className="text-right">
                  <span className="block text-xs font-black text-foreground">{entry.points.toLocaleString()}</span>
                  <span className="block text-[9px] text-muted-foreground">{entry.questions} attempts</span>
                </span>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="px-4 py-5 text-center text-xs text-muted-foreground">No MBBS institute attempts in the last 24 hours.</p>
      )}
    </section>
  );
}
