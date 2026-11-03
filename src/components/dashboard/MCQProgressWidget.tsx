import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Clock, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { memo, useEffect, useMemo, useState } from 'react';
import { MCQProgressSkeleton } from '../skeletons/MCQProgressSkeleton';
import { isSubjectVisibleForInstitute } from '@/utils/subjectVisibility';

const formatTimeAgo = (timestamp?: string | null): string => {
  if (!timestamp) return 'recently';
  const past = new Date(timestamp).getTime();
  if (Number.isNaN(past)) return 'recently';
  const diffSec = Math.floor((Date.now() - past) / 1000);
  if (diffSec < 45) return 'just now';

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths} mo ago`;

  const diffYears = Math.floor(diffDays / 365);
  return `${diffYears}y ago`;
};

// Defines the shape of the saved session per Subject/Chapter in localStorage
export interface SavedMCQSession {
  subjectId: string;
  chapterId: string;
  lastIndex: number;
  timestamp: string; // ISO string
}

interface MCQProgressSession extends SavedMCQSession {
  chapterName: string;
  subjectName: string;
  subjectColor: string;
  totalMCQs: number;
  completedMCQs: number;
  resumeIndex: number;
  percentage: number;
}

const GET_SAVED_SESSIONS = async (userId: string): Promise<SavedMCQSession[]> => {
  try {
    const localData = localStorage.getItem('mcq_saved_sessions');
    const localSessions: SavedMCQSession[] = localData ? JSON.parse(localData) : [];
    const { data, error } = await supabase
      .from('profiles')
      .select('in_progress_mcqs')
      .eq('id', userId)
      .single();

    if (error || !data?.in_progress_mcqs) {
      // Fallback to local storage if not found in db
      return localSessions;
    }

    const cloudSessions = Array.isArray(data.in_progress_mcqs)
      ? data.in_progress_mcqs as unknown as SavedMCQSession[]
      : [];
    const mergedByChapter = new Map<string, SavedMCQSession>();

    [...cloudSessions, ...localSessions]
      .filter(session => session?.chapterId && session?.subjectId)
      .sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')))
      .forEach((session) => {
        if (!mergedByChapter.has(session.chapterId)) mergedByChapter.set(session.chapterId, session);
      });

    return Array.from(mergedByChapter.values()).slice(0, 30);
  } catch {
    const localData = localStorage.getItem('mcq_saved_sessions');
    return localData ? JSON.parse(localData) : [];
  }
};

const DonutChart3D = memo(({ percentage, colorClass, gradientId }: { percentage: number, colorClass: string, gradientId: string }) => {
  const radius = 35;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative w-24 h-24 flex items-center justify-center shrink-0">
      <svg className="w-full h-full transform -rotate-90 relative z-10 drop-shadow-md" viewBox="0 0 100 100">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" className="stop-color-primary" stopColor="currentColor" />
            <stop offset="100%" className="stop-color-secondary" stopColor="white" stopOpacity="0.2" />
          </linearGradient>
        </defs>

        {/* Background Track */}
        <circle
          cx="50" cy="50" r={radius}
          fill="none"
          className="stroke-muted/30"
          strokeWidth="10"
        />

        {/* Progress Arc */}
        <circle
          cx="50" cy="50" r={radius}
          fill="none"
          className={colorClass}
          strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex items-center justify-center flex-col">
        <span className="text-lg font-black text-foreground drop-shadow-sm leading-none">{Math.round(percentage)}%</span>
      </div>
    </div>
  );
});

DonutChart3D.displayName = 'DonutChart3D';

export const MCQProgressWidget = () => {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SavedMCQSession[]>([]);
  const { data: userData } = useQuery({
    queryKey: ['userAuthSession'],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user;
    }
  });
  const { data: profileData, isLoading: profileLoading } = useQuery({
    queryKey: ['mcq-progress-profile', userData?.id],
    queryFn: async () => {
      if (!userData?.id) return null;
      const { data } = await supabase
        .from('profiles')
        .select('institute, year, program_code')
        .eq('id', userData.id)
        .maybeSingle();
      return data;
    },
    enabled: !!userData?.id,
  });

  useEffect(() => {
    if (userData?.id) {
      GET_SAVED_SESSIONS(userData.id).then(setSessions);
    } else {
      // If not logged in yet, try local storage
      const localData = localStorage.getItem('mcq_saved_sessions');
      setSessions(localData ? JSON.parse(localData) : []);
    }
  }, [userData?.id]);

  const { data: chaptersData, isLoading } = useQuery({
    queryKey: ['mcq-progress-chapters', sessions.map(s => s.chapterId), userData?.id, profileData?.institute, profileData?.program_code, profileData?.year],
    queryFn: async () => {
      if (sessions.length === 0) return [];
      const userInstitute = String(profileData?.institute || '').trim();
      const userYear = String(profileData?.year || '').trim();

      const chapterIds = [...new Set(sessions.map(s => s.chapterId))];
      const subjectIds = [...new Set(sessions.map(s => s.subjectId))];

      // Fetch chapter details for names and counts
      const [chaptersResult, subjectsResult] = await Promise.all([
        supabase
          .from('chapters')
          .select('id, name, subject_id, mcq_count')
          .in('id', chapterIds),
        supabase
          .from('subjects')
          .select('id, name, color, year, program_code, institutes')
          .in('id', subjectIds),
      ]);

      const { data: chapters, error: chError } = chaptersResult;
      const { data: subjects, error: subError } = subjectsResult;

      if (chError || subError) return [];

      const { data: resumeSnapshots, error: resumeError } = await supabase.rpc(
        'get_mcq_resume_snapshots',
        { p_chapter_ids: chapterIds },
      );

      // Create a lookup for snapshots by chapter_id
      const snapshotMap = new Map<string, { attempted_count: number; last_mcq_id: string | null; attempted_mcq_ids: string[] }>();
      (resumeSnapshots || []).forEach(snap => {
        if (snap?.chapter_id) {
          snapshotMap.set(snap.chapter_id, {
            attempted_count: Number(snap.attempted_count) || 0,
            last_mcq_id: snap.last_mcq_id,
            attempted_mcq_ids: Array.isArray(snap.attempted_mcq_ids) ? snap.attempted_mcq_ids : [],
          });
        }
      });

      // Fallback query if resume snapshots RPC fails
      let fallbackAttemptedCountMap = new Map<string, number>();
      if (resumeError) {
        const { data: userAnswersData } = await supabase
          .from('user_chapter_mcq_state')
          .select('chapter_id, attempted_count')
          .eq('user_id', userData?.id)
          .in('chapter_id', chapterIds);

        (userAnswersData || []).forEach(row => {
          fallbackAttemptedCountMap.set(row.chapter_id, Number(row.attempted_count) || 0);
        });
      }

      const chaptersById = new Map(chapters?.map(chapter => [chapter.id, chapter]) || []);
      const subjectsById = new Map(subjects?.map(subject => [subject.id, subject]) || []);

      return sessions.map(session => {
        const chapter = chaptersById.get(session.chapterId);
        const subject = subjectsById.get(session.subjectId);
        if (!chapter || !subject) return null;

        const subjectYear = String(subject.year || '').trim();
        // A null subject programme is intentionally used for shared/legacy and
        // specialised-test content. It must not be interpreted as MBBS, or a
        // saved FCPS session disappears as soon as this dashboard is opened.
        const subjectProgram = String(subject.program_code || '').trim().toLowerCase();
        const userProgram = String(profileData?.program_code || 'mbbs').trim().toLowerCase();
        const visibleForInstitute = isSubjectVisibleForInstitute(subject, userInstitute);
        const visibleForYear = !userYear || !subjectYear || subjectYear === userYear;
        const visibleForProgram = !subjectProgram || subjectProgram === userProgram;
        if (!visibleForInstitute || !visibleForYear || !visibleForProgram) return null;

        // Total MCQs in chapter
        const totalMCQs = Math.max(Number(chapter?.mcq_count) || 0, 1);

        // Accurate completed MCQs count from DB snapshot or session
        const snapshot = snapshotMap.get(session.chapterId);
        const snapshotCount = snapshot ? snapshot.attempted_count : (fallbackAttemptedCountMap.get(session.chapterId) ?? 0);
        
        // Take the highest reliable count between DB state and local session index
        const completedMCQs = Math.min(
          Math.max(snapshotCount, (Number(session.lastIndex) || 0) + 1),
          totalMCQs
        );

        // Resume at next question index
        const resumeIndex = Math.min(
          Math.max(Number(session.lastIndex) || 0, snapshotCount),
          Math.max(totalMCQs - 1, 0)
        );

        const percentage = totalMCQs > 0 ? Math.min((completedMCQs / totalMCQs) * 100, 100) : 0;

        return {
          ...session,
          chapterName: chapter?.name || 'Unknown Chapter',
          subjectName: subject?.name || 'Unknown Subject',
          subjectColor: subject?.color || 'bg-primary',
          totalMCQs,
          completedMCQs,
          resumeIndex,
          percentage
        };
      }).filter((s): s is NonNullable<typeof s> => Boolean(s))
        .filter(s => s.completedMCQs < s.totalMCQs) // Show incomplete sessions
        .slice(0, 30); // Display up to 30 active incomplete sessions in Dashboard
    },
    enabled: sessions.length > 0 && !!userData?.id && !profileLoading,
    staleTime: 1000 * 60 * 5,
  });

  const gradients = useMemo(() => [
    { text: 'text-rose-500 stroke-rose-500', bg: 'from-rose-500/10 to-pink-500/5', icon: 'text-rose-500', border: 'border-rose-500/30' },
    { text: 'text-blue-500 stroke-blue-500', bg: 'from-blue-500/10 to-indigo-500/5', icon: 'text-blue-500', border: 'border-blue-500/30' },
    { text: 'text-emerald-500 stroke-emerald-500', bg: 'from-emerald-500/10 to-teal-500/5', icon: 'text-emerald-500', border: 'border-emerald-500/30' },
    { text: 'text-amber-500 stroke-amber-500', bg: 'from-amber-500/10 to-orange-500/5', icon: 'text-amber-500', border: 'border-amber-500/30' },
    { text: 'text-violet-500 stroke-violet-500', bg: 'from-violet-500/10 to-purple-500/5', icon: 'text-violet-500', border: 'border-violet-500/30' },
  ], []);

  if (isLoading) return <MCQProgressSkeleton />;
  if (!chaptersData || chaptersData.length === 0) return null;

  const handleResume = (session: MCQProgressSession) => {
    navigate(`/mcqs/quiz/${session.subjectId}/${session.chapterId}`, {
      state: {
        autoResume: true,
        startIndex: session.resumeIndex
      }
    });
  };

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-4 h-4 text-orange-500" />
        <h2 className="text-sm font-bold text-foreground">Pick up where you left off</h2>
      </div>

      {/* Horizontally scrollable container */}
      <div className="flex gap-3 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide -mx-5 px-5" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {chaptersData.map((item, index) => {
          const visualStyle = gradients[index % gradients.length];
          const timeAgo = formatTimeAgo(item.timestamp);

          return (
            <motion.div
              key={`${item.subjectId}-${item.chapterId}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => handleResume(item)}
              className={`relative flex items-center justify-between gap-4 p-4 rounded-[1.8rem] bg-gradient-to-br ${visualStyle.bg} border border-border/40 bg-card/90 shadow-md shrink-0 w-[280px] snap-center cursor-pointer active:scale-[0.98] transition-transform will-change-transform`}
            >
              <div className="flex-1 min-w-0">
                <p className={`text-[10px] font-bold uppercase tracking-widest ${visualStyle.icon} truncate mb-1.5`}>
                  {item.subjectName}
                </p>
                <h3 className="text-sm font-black text-foreground line-clamp-2 leading-tight mb-2">
                  {item.chapterName}
                </h3>
                <div className="flex flex-col gap-1">
                  <div>
                    <span className={`text-xs font-semibold text-muted-foreground bg-background/50 border ${visualStyle.border} px-2 py-0.5 rounded-full whitespace-nowrap`}>
                      {item.completedMCQs} / {item.totalMCQs} completed
                    </span>
                  </div>
                  <span className="text-[11px] font-medium text-muted-foreground/75 px-0.5">
                    {timeAgo}
                  </span>
                </div>
              </div>

              <div className="relative">
                <DonutChart3D
                  percentage={item.percentage}
                  colorClass={visualStyle.text}
                  gradientId={`grad-${index}`}
                />
                <div className={`absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center shadow-lg`}>
                  <Play className={`w-3 h-3 ${visualStyle.icon} ml-0.5`} />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
