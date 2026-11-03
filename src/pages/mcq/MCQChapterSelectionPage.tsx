import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, BookOpen, FileClock, Target, WifiOff } from 'lucide-react';
import { fetchChaptersBySubject, fetchSubjectById, Subject, Chapter } from '@/utils/mcqData';
import { MCQPageLayout } from './MCQPageLayout';
import { SelectionBackdrop } from '@/components/selection/SelectionBackdrop';
import { SelectionRow } from '@/components/selection/SelectionRow';
import { rowEntrance, titleSlide, iconBounce } from '@/components/selection/motion';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CollaborateModal } from '@/components/CollaborateModal';
import { ChapterDownloadButton } from '@/components/mcq/ChapterDownloadButton';
import { getOfflineChapterSummaries, subscribeOfflineChapterChanges } from '@/utils/offlineChapters';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { prepareMCQQuiz } from '@/features/mcq/quizBootstrap';
import { isConstrainedConnection } from '@/utils/networkQuality';
import DoctorMascotLoader from '@/components/loader/DoctorMascotLoader';

const ChapterProgressRing = ({
  attempted,
  total,
  isSelected,
  isLoading
}: {
  attempted: number;
  total: number;
  isSelected: boolean;
  isLoading: boolean;
}) => {
  const clampedAttempted = Math.min(attempted, total);
  const percentage = total > 0 ? Math.round((clampedAttempted / total) * 100) : 0;
  const radius = 15;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative h-9 w-9 shrink-0">
      <svg className="-rotate-90 h-9 w-9" viewBox="0 0 36 36" aria-hidden="true">
        <circle cx="18" cy="18" r={radius} fill="none" strokeWidth="3" className="stroke-border" />
        <motion.circle
          cx="18"
          cy="18"
          r={radius}
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: dashOffset }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
          className={`transition-colors duration-300 ${isSelected ? 'stroke-primary' : 'stroke-muted-foreground/50'}`}
        />
      </svg>
      {percentage === 100 && (
        <motion.div
          className="absolute inset-0 rounded-full"
          initial={{ boxShadow: '0 0 0 0 rgba(16,185,129,0)' }}
          animate={{ boxShadow: ['0 0 0 0 rgba(16,185,129,0)', '0 0 8px 2px rgba(16,185,129,0.2)', '0 0 0 0 rgba(16,185,129,0)'] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-[9px] font-bold transition-colors duration-300 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}>
          {isLoading ? '--' : `${percentage}`}
        </span>
      </div>
    </div>
  );
};

const ChapterRowSkeleton = () => (
  <div className="flex animate-pulse items-center gap-4 py-4 pl-4 pr-3">
    <div className="min-w-0 flex-1 space-y-2">
      <div className="h-2.5 w-1/5 rounded-full bg-muted" />
      <div className="h-3.5 w-2/3 rounded-full bg-muted" />
    </div>
    <div className="h-9 w-9 shrink-0 rounded-full bg-muted" />
    <div className="h-8 w-8 shrink-0 rounded-full bg-muted" />
  </div>
);

type ChapterTab = 'question_bank' | 'past_paper';

const getChapterContentType = (chapter: Chapter): ChapterTab => (
  chapter.content_type === 'past_paper' ? 'past_paper' : 'question_bank'
);

const MCQChapterSelectionPage = () => {
  useLayoutEffect(() => {
    requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    });
  }, []);

  const { subjectId } = useParams<{ subjectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const reduceMotion = useReducedMotion();
  const [allChapters, setAllChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [showCollaborateModal, setShowCollaborateModal] = useState(false);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState(() => typeof navigator !== 'undefined' ? !navigator.onLine : false);
  const [offlineChapterIds, setOfflineChapterIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<ChapterTab>('question_bank');

  const chaptersByType = useMemo(() => ({
    question_bank: allChapters.filter(chapter => getChapterContentType(chapter) === 'question_bank'),
    past_paper: allChapters.filter(chapter => getChapterContentType(chapter) === 'past_paper'),
  }), [allChapters]);
  const visibleChapters = chaptersByType[activeTab];

  const { data: profile } = useQuery({
    queryKey: ['mcq-profile-plan', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from('profiles').select('plan').eq('id', user.id).maybeSingle();
      return data;
    },
    enabled: Boolean(user?.id)
  });

  const { data: attemptedByChapter = {}, isLoading: progressLoading } = useQuery({
    queryKey: ['mcq-chapter-progress', user?.id, allChapters.map(ch => ch.id).join(',')],
    queryFn: async () => {
      if (allChapters.length === 0 || !user?.id) return {};

      const chapterIds = allChapters.map(ch => ch.id);

      const { data: compactProgress, error: compactProgressError } = await supabase
        .rpc('get_mcq_chapter_progress', { p_chapter_ids: chapterIds });
      if (!compactProgressError && compactProgress) {
        const progressRows = compactProgress as Array<{
          chapter_id: string;
          attempted_count: number;
        }>;
        return progressRows.reduce<Record<string, number>>((acc, row) => {
          acc[row.chapter_id] = Number(row.attempted_count || 0);
          return acc;
        }, {});
      }

      // Progress badges are non-blocking. Never scan the full answer history
      // when the compact projection is temporarily unavailable.
      return {};
    },
    enabled: Boolean(user?.id) && allChapters.length > 0 && !isOfflineMode
  });

  const loadData = useCallback(async () => {
    if (!subjectId) return;

    setLoading(true);
    setLoadError(false);
    try {
      const subjectPromise = fetchSubjectById(subjectId);
      const chaptersPromise = fetchChaptersBySubject(subjectId);

      const chapters = await chaptersPromise;
      setAllChapters(chapters);

      const subjectData = await subjectPromise;
      if (subjectData) setSubject(subjectData);
    } catch (error) {
      console.error('Unable to load MCQ chapters:', error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [subjectId]);

  const loadOfflineAvailability = useCallback(async () => {
    const summaries = await getOfflineChapterSummaries();
    setOfflineChapterIds(new Set(
      summaries
        .filter(summary => !subjectId || summary.subjectId === subjectId)
        .map(summary => summary.id),
    ));
  }, [subjectId]);

  useEffect(() => {
    const updateOnlineState = () => setIsOfflineMode(!navigator.onLine);
    const handleOnline = () => {
      updateOnlineState();
      loadData();
    };

    updateOnlineState();
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', updateOnlineState);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', updateOnlineState);
    };
  }, [loadData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    setActiveTab('question_bank');
    setSelectedChapter(null);
  }, [subjectId]);

  useEffect(() => {
    if (loading || loadError || allChapters.length === 0) return;
    if (chaptersByType.question_bank.length > 0) return;

    setActiveTab('past_paper');
    setSelectedChapter(null);
  }, [
    loading,
    loadError,
    allChapters.length,
    chaptersByType.question_bank.length,
  ]);

  useEffect(() => {
    loadOfflineAvailability();
    return subscribeOfflineChapterChanges(loadOfflineAvailability);
  }, [loadOfflineAvailability]);

  useEffect(() => {
    if (isOfflineMode && selectedChapter && !offlineChapterIds.has(selectedChapter.id)) {
      setSelectedChapter(null);
    }
  }, [isOfflineMode, offlineChapterIds, selectedChapter]);

  const handleContinue = () => {
    if (selectedChapter && subjectId && (!isOfflineMode || offlineChapterIds.has(selectedChapter.id))) {
      navigate(`/mcqs/settings/${subjectId}/${selectedChapter.id}`, {
        state: { subject, chapter: selectedChapter },
      });
    }
  };

  // Throttle speculative prefetches to avoid spawning dozens of concurrent
  // CapacitorHttp threads when the user scrolls through the chapter list.
  const prefetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup pending prefetch timer on unmount
  useEffect(() => {
    return () => {
      if (prefetchTimerRef.current) clearTimeout(prefetchTimerRef.current);
    };
  }, []);

  const prefetchChapter = useCallback((chapterId: string, speculative = false) => {
    if (!user?.id || isOfflineMode || (speculative && isConstrainedConnection())) return;

    if (speculative) {
      if (prefetchTimerRef.current) clearTimeout(prefetchTimerRef.current);
      prefetchTimerRef.current = setTimeout(() => {
        void prepareMCQQuiz({ chapterId, userId: user.id }).catch(() => undefined);
      }, 120);
      return;
    }

    void prepareMCQQuiz({ chapterId, userId: user.id }).catch(() => undefined);
  }, [user?.id, isOfflineMode]);

  const selectTab = (tab: ChapterTab) => {
    setActiveTab(tab);
    setSelectedChapter(null);
  };

  if (!subject && !loading) {
    return (
      <MCQPageLayout backTo="/mcqs">
        <SelectionBackdrop />
        <div className="relative z-10 py-20 text-center">
          <p className="font-semibold text-foreground">We are not fully available in your institute yet.</p>
          <p className="mt-2 text-sm text-muted-foreground">Help us bring Medmacs to your campus.</p>
          <div className="mt-5 flex flex-col sm:flex-row justify-center gap-3">
            <Button asChild variant="outline"><Link to="/contact-us?subject=campus-collaboration">Request campus collaboration</Link></Button>
            <Button onClick={() => setShowCollaborateModal(true)}>Become Medmacs Ambassador</Button>
          </div>
          <CollaborateModal open={showCollaborateModal} onOpenChange={setShowCollaborateModal} />
          <Button onClick={() => navigate('/mcqs')} variant="ghost" className="mt-4">Go Back</Button>
        </div>
      </MCQPageLayout>
    );
  }

  const planLabel = isOfflineMode
    ? 'Offline · downloaded only'
    : subject?.free_unlimited_access
      ? 'Free · no limits'
      : profile?.plan === 'free'
        ? 'Free daily limits apply'
        : 'Unlimited premium access';

  return (
    <MCQPageLayout backTo="/mcqs" showHeader={false} showBackButton={false} scrollable>
      <SelectionBackdrop active={Boolean(selectedChapter)} />
      {/* Glassmorphic Header */}
      <header className="absolute inset-x-0 top-0 z-50 px-4 pb-3 pt-[calc(env(safe-area-inset-top,0px)+10px)] backdrop-blur-2xl border-b border-border/60 bg-background/88">
        <div className="mx-auto flex items-center justify-between gap-3 max-w-4xl">
          <Link
            to="/mcqs"
            aria-label="Back to subjects"
            className="flex shrink-0 items-center justify-center bg-muted text-foreground transition active:scale-95 active:bg-primary active:text-primary-foreground h-11 w-11 rounded-2xl"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>

          <div className="min-w-0 text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-primary">{subject?.name || 'MCQ Subject'}</p>
            <h1 className="truncate text-lg font-black tracking-tight">Chapters</h1>
          </div>

          <Link
            to="/detailed-analytics"
            className="flex shrink-0 items-center justify-center bg-primary/10 text-primary transition-all hover:bg-primary hover:text-white h-11 w-11 rounded-2xl active:scale-95"
            aria-label="Open MCQ practice analytics"
          >
            <Target className="h-5 w-5" />
          </Link>
        </div>
      </header>

      <div className="relative z-20 -mx-3 shrink-0 bg-background/85 px-3 backdrop-blur-md sm:mx-0 sm:px-0 pt-[calc(env(safe-area-inset-top,0px)+84px)]">
        <div className="mx-auto max-w-2xl px-4 sm:px-0">
          <div className="flex items-end justify-between gap-4 py-5">
            <div className="min-w-0">
              <motion.p
                className="truncate text-[10px] font-bold uppercase tracking-[0.25em] text-primary/80"
                variants={reduceMotion ? undefined : titleSlide}
                initial="hidden"
                animate="visible"
              >
                {subject?.name}
              </motion.p>
              <motion.h2
                 className="brand-display mt-1.5 text-2xl uppercase italic leading-none tracking-[-0.03em] text-foreground sm:text-[1.75rem]"
                variants={reduceMotion ? undefined : titleSlide}
                initial="hidden"
                animate="visible"
                transition={{ delay: 0.15 }}
              >
                 Select <span className="text-primary">Chapter</span>
              </motion.h2>
              <motion.p
                className="mt-2 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground/60"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.4 }}
              >
                {planLabel}
              </motion.p>
            </div>
          </div>

          {/* Minimal underline tabs */}
          <div className="flex gap-6 border-b border-border/50" aria-label="Chapter content type">
            {([
              { id: 'question_bank' as ChapterTab, label: 'Question Bank', icon: BookOpen, count: chaptersByType.question_bank.length },
              { id: 'past_paper' as ChapterTab, label: 'Past Papers', icon: FileClock, count: chaptersByType.past_paper.length },
            ]).map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <motion.button
                  key={tab.id}
                  type="button"
                  onClick={() => selectTab(tab.id)}
                  className={`group relative flex items-center gap-2 pb-3 pt-1 text-[11px] font-bold uppercase tracking-[0.14em] transition-colors ${
                    isActive ? 'text-primary' : 'text-muted-foreground/70'
                  }`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: 0.3 }}
                >
                  <tab.icon className={`h-3.5 w-3.5 transition-transform duration-300 ${isActive ? 'scale-110' : ''}`} />
                  <span>{tab.label}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums transition-colors ${
                      isActive ? 'bg-primary/10 text-primary' : 'bg-foreground/[0.05] text-muted-foreground/50'
                    }`}
                  >
                    {tab.count}
                  </span>
                  {isActive && (
                    <motion.span
                      layoutId="activeChapterTab"
                      className="absolute -bottom-px left-0 right-0 h-[2px] bg-primary"
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    />
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="no-scrollbar relative z-10 min-h-0 flex-1 overflow-y-auto pb-36">
        <div className="mx-auto w-full max-w-2xl px-4 sm:px-0">
          {loading ? (
            <div className="py-8 flex flex-col items-center justify-center">
              <DoctorMascotLoader
                variant="inline"
                size="sm"
                label="Loading chapters..."
                showSubtext={true}
              />
            </div>
          ) : loadError ? (
            <div className="px-4 py-14 text-center">
              <WifiOff className="mx-auto h-7 w-7 text-muted-foreground/50" />
              <h3 className="mt-4 text-sm font-bold text-foreground">Connection failure</h3>
              <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-muted-foreground">We could not connect to the content server. Check your connection and try again.</p>
              <Button type="button" variant="outline" className="mt-5 rounded-full" onClick={loadData}>Try again</Button>
            </div>
          ) : allChapters.length === 0 ? (
            <div className="px-4 py-14 text-center">
              <p className="font-semibold text-foreground">We are not fully available in your institute yet.</p>
              <p className="mt-2 text-sm text-muted-foreground">Help us bring chapter-wise content to your campus.</p>
              <div className="mt-5 flex flex-col sm:flex-row justify-center gap-3">
                <Button asChild variant="outline"><Link to="/contact-us?subject=campus-collaboration">Request campus collaboration</Link></Button>
                <Button onClick={() => setShowCollaborateModal(true)}>Become Medmacs Ambassador</Button>
              </div>
              <CollaborateModal open={showCollaborateModal} onOpenChange={setShowCollaborateModal} />
            </div>
          ) : visibleChapters.length === 0 && activeTab === 'past_paper' ? (
            <div className="px-4 py-14 text-center">
              <FileClock className="mx-auto h-7 w-7 text-muted-foreground/50" />
              <h3 className="mt-4 text-sm font-bold text-foreground">Past papers are not ready for your institute</h3>
              <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-muted-foreground">
                Help us curate the papers students at your institute need most.
              </p>
              <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
                <Button asChild variant="outline">
                  <Link to="/contact-us?subject=campus-collaboration">Request campus collaboration</Link>
                </Button>
                <Button onClick={() => setShowCollaborateModal(true)}>Collaborate with Medmacs</Button>
              </div>
              <CollaborateModal open={showCollaborateModal} onOpenChange={setShowCollaborateModal} />
            </div>
          ) : visibleChapters.length === 0 ? (
            <div className="px-4 py-14 text-center">
              <p className="font-semibold text-foreground">Question Bank chapters are being prepared.</p>
              <p className="mt-2 text-sm text-muted-foreground">Please check back soon.</p>
            </div>
          ) : (
            <div key={activeTab} className="divide-y divide-border/50 border-b border-border/50">
              {visibleChapters.map((ch, idx) => {
                const isComingSoon = (ch.mcq_count || 0) === 0;
                const isLocked = ch.is_locked === true;
                const isSelected = selectedChapter?.id === ch.id;
                const isOfflineUnavailable = isOfflineMode && !offlineChapterIds.has(ch.id);
                const isDisabled = isComingSoon || isOfflineUnavailable || isLocked;
                const attemptedCount = attemptedByChapter[ch.id] || 0;
                const totalCount = ch.mcq_count || 0;

                return (
                  <motion.div
                    key={ch.id}
                    custom={idx}
                    variants={reduceMotion ? undefined : rowEntrance}
                    initial={reduceMotion ? false : 'hidden'}
                    animate={reduceMotion ? false : 'visible'}
                    className={cn(
                      'relative transition-shadow duration-300',
                      isSelected && !isDisabled && 'shadow-[0_0_20px_-4px_rgba(16,185,129,0.15)]'
                    )}
                  >
                    <SelectionRow
                      asDiv
                      eyebrow={
                        <motion.span
                          variants={reduceMotion ? undefined : iconBounce}
                          custom={idx}
                          initial="hidden"
                          animate="visible"
                          className="inline-block"
                        >
                          Chapter {ch.chapter_number || idx + 1}
                        </motion.span>
                      }
                      title={ch.name}
                      selected={isSelected}
                      disabled={isDisabled}
                      accentLayoutId="mcq-chapter-accent"
                      progress={!isDisabled && !isOfflineMode && totalCount > 0 ? attemptedCount / totalCount : undefined}
                      onSelect={() => {
                        prefetchChapter(ch.id);
                        setSelectedChapter(ch);
                      }}
                      onPointerEnter={() => !isDisabled && prefetchChapter(ch.id, true)}
                      onTouchStart={() => !isDisabled && prefetchChapter(ch.id, true)}
                      meta={
                        <>
                          {!isComingSoon && (
                            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/60">
                              {progressLoading || isOfflineMode
                                ? `${totalCount} MCQs`
                                : `${Math.min(attemptedCount, totalCount)}/${totalCount} done`}
                            </span>
                          )}
                          {isComingSoon && (
                            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/60">
                              Coming soon
                            </span>
                          )}
                          {isLocked && (
                            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-600 dark:text-amber-400">
                              {ch.lock_message || 'Locked'}
                            </span>
                          )}
                          {isOfflineUnavailable && (
                            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-600 dark:text-amber-400">
                              <WifiOff className="h-3 w-3" />
                              Not downloaded
                            </span>
                          )}
                          {offlineChapterIds.has(ch.id) && (
                            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-600 dark:text-emerald-400">
                              Offline ready
                            </span>
                          )}
                        </>
                      }
                      trailing={
                        isDisabled ? undefined : (
                          <span className="flex items-center gap-1.5">
                            {!isOfflineMode && (
                              <ChapterProgressRing
                                attempted={attemptedCount}
                                total={totalCount}
                                isSelected={isSelected}
                                isLoading={progressLoading}
                              />
                            )}
                            {subject && (
                              <ChapterDownloadButton subject={subject} chapter={ch} compact className="h-8 w-8 rounded-full" />
                            )}
                          </span>
                        )
                      }
                    />
                  </motion.div>
                );
              })}
            </div>
          )}

          <footer className="py-6 text-center">
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground/40">
              © 2026 Medmacs App
            </p>
          </footer>
        </div>
      </div>

      <AnimatePresence>
        {selectedChapter && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 340 }}
            className="pointer-events-none fixed bottom-0 left-0 right-0 z-50 flex justify-center bg-gradient-to-t from-background via-background/95 to-transparent px-4 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-8"
          >
            <div className="pointer-events-auto w-full max-w-2xl">
              <Button
                onClick={handleContinue}
                 className="group h-12 w-full rounded-md bg-teal-600 text-xs font-bold uppercase tracking-[0.18em] text-white transition-all duration-200 hover:bg-teal-700 active:scale-[0.98]"
                size="lg"
              >
                <span className="truncate">Start · {selectedChapter.name}</span>
                <ArrowRight className="ml-2 h-4 w-4 shrink-0 transition-transform duration-300 group-hover:translate-x-1" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </MCQPageLayout>
  );
};

export default MCQChapterSelectionPage;
