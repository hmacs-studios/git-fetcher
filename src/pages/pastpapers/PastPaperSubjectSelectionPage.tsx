import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, RefreshCw, Target, WifiOff } from 'lucide-react';
import { fetchChaptersBySubject, fetchSubjects, getStoredScopeKey, readCachedChapters, readCachedSubjects, Subject } from '@/utils/mcqData';
import { useAuth } from '@/hooks/useAuth';
import { MCQPageLayout } from '@/pages/mcq/MCQPageLayout';
import AppTransitionScreen from '@/components/AppTransitionScreen';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import Seo from '@/components/Seo';
import { getOfflineChapterSummaries, subscribeOfflineChapterChanges } from '@/utils/offlineChapters';
import DoctorMascotLoader from '@/components/loader/DoctorMascotLoader';
import { SelectionBackdrop } from '@/components/selection/SelectionBackdrop';
import { SelectionRow } from '@/components/selection/SelectionRow';
import { rowEntrance, iconBounce } from '@/components/selection/motion';

const SubjectRowSkeleton = () => (
  <div className="flex animate-pulse items-center gap-4 py-4 pl-4 pr-3">
    <div className="h-6 w-6 shrink-0 rounded-md bg-muted" />
    <div className="min-w-0 flex-1 space-y-2">
      <div className="h-3.5 w-1/3 rounded-full bg-muted" />
      <div className="h-3 w-2/3 rounded-full bg-muted" />
    </div>
  </div>
);

const PastPaperSubjectSelectionPage = () => {
  const pageScrollRef = useRef<HTMLDivElement>(null);
  const subjectRequestRef = useRef(0);

  useLayoutEffect(() => {
    requestAnimationFrame(() => {
      pageScrollRef.current?.scrollTo({ top: 0 });
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    });
  }, []);

  const [subjects, setSubjects] = useState<Subject[]>(readCachedSubjects);
  const [loading, setLoading] = useState(() => readCachedSubjects().length === 0);
  const [loadError, setLoadError] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState(() => typeof navigator !== 'undefined' ? !navigator.onLine : false);
  const [offlineSubjectIds, setOfflineSubjectIds] = useState<Set<string>>(new Set());
  const [subjectChapterCounts, setSubjectChapterCounts] = useState<Record<string, number | undefined>>(() =>
    Object.fromEntries(
      readCachedSubjects()
        .filter(subject => typeof subject.past_paper_chapter_count === 'number')
        .map(subject => [subject.id, subject.past_paper_chapter_count])
    )
  );

  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  const loadSubjects = useCallback(async () => {
    const requestId = ++subjectRequestRef.current;
    try {
      setLoadError(false);
      const [data, pastPaperChaptersRes] = await Promise.all([
        fetchSubjects(),
        supabase
          .from('chapters')
          .select('subject_id')
          .eq('content_type', 'past_paper')
          .limit(2000),
      ]);
      if (requestId !== subjectRequestRef.current) return;
      setSubjects(data);

      const countsBySubject: Record<string, number> = {};
      data.forEach(subject => {
        countsBySubject[subject.id] = 0;
      });

      if (pastPaperChaptersRes.data) {
        pastPaperChaptersRes.data.forEach((row: { subject_id: string }) => {
          if (row.subject_id) {
            countsBySubject[row.subject_id] = (countsBySubject[row.subject_id] || 0) + 1;
          }
        });
      }

      setSubjectChapterCounts(prev => ({
        ...prev,
        ...countsBySubject,
      }));
    } catch (error) {
      console.error('Unable to load past paper subjects:', error);
      if (requestId === subjectRequestRef.current) setLoadError(true);
    } finally {
      if (requestId === subjectRequestRef.current) setLoading(false);
    }
  }, []);


  const loadOfflineAvailability = useCallback(async () => {
    const summaries = await getOfflineChapterSummaries();
    setOfflineSubjectIds(new Set(summaries.map(summary => summary.subjectId)));
    if (isOfflineMode) {
      const offlineCounts: Record<string, number> = {};
      for (const summary of summaries) {
        if (summary.contentType === 'past_paper') {
          offlineCounts[summary.subjectId] = (offlineCounts[summary.subjectId] || 0) + 1;
        }
      }
      setSubjectChapterCounts(prev => ({ ...prev, ...offlineCounts }));
    }
  }, [isOfflineMode]);

  useEffect(() => {
    const updateOnlineState = () => setIsOfflineMode(!navigator.onLine);
    const handleOnline = () => {
      updateOnlineState();
      loadSubjects();
    };

    updateOnlineState();
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', updateOnlineState);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', updateOnlineState);
    };
  }, [loadSubjects]);

  useEffect(() => {
    loadOfflineAvailability();
    return subscribeOfflineChapterChanges(loadOfflineAvailability);
  }, [loadOfflineAvailability]);

  useEffect(() => {
    if (isOfflineMode && selectedSubject && !offlineSubjectIds.has(selectedSubject.id)) {
      setSelectedSubject(null);
    }
  }, [isOfflineMode, offlineSubjectIds, selectedSubject]);

  // If server explicitly confirms 0 chapters, clear selection
  useEffect(() => {
    if (selectedSubject) {
      const count = subjectChapterCounts[selectedSubject.id] ?? selectedSubject.past_paper_chapter_count;
      if (typeof count === 'number' && count === 0) {
        setSelectedSubject(null);
      }
    }
  }, [selectedSubject, subjectChapterCounts]);

  useEffect(() => {
    loadSubjects();
  }, [loadSubjects]);

  useEffect(() => {
    const channel = supabase
      .channel('past-paper-subject-access-flags')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'subjects' },
        () => {
          void loadSubjects();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadSubjects]);

  const handleContinue = () => {
    if (!selectedSubject) return;
    const chapterCount = subjectChapterCounts[selectedSubject.id] ?? selectedSubject.past_paper_chapter_count;
    const isExplicitlyEmpty = typeof chapterCount === 'number' && chapterCount === 0;
    if (!isExplicitlyEmpty && (!isOfflineMode || offlineSubjectIds.has(selectedSubject.id))) {
      navigate(`/past-papers/chapter/${selectedSubject.id}`);
    }
  };

  if (authLoading) {
    return <AppTransitionScreen />;
  }

  if (!user) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background/55 dark:bg-white/[0.035] backdrop-blur-xl p-4 text-center">
        <Card className="w-full max-w-md bg-card/60 dark:bg-white/[0.05] backdrop-blur-sm border-border shadow-lg p-6">
          <CardHeader className="mb-4">
            <Lock className="w-16 h-16 mx-auto text-primary mb-4" />
            <CardTitle className="text-2xl font-bold text-foreground">Access Restricted</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-6">Please log in to access the Past Papers & Recalls section.</p>
            <Button asChild className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-2 px-4 rounded-lg shadow-md">
              <Link to="/login">Go to Login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <MCQPageLayout
      backTo="/dashboard"
      showHeader={false}
      showBackButton={false}
      scrollable
      scrollRef={pageScrollRef}
    >
      <SelectionBackdrop active={Boolean(selectedSubject)} />
      <Seo title="Past Papers and Re-calls" description="Practice past papers and recalled exam questions with Medmacs." canonical="https://medmacs.app/past-papers" />

      {/* Glassmorphic Header */}
      <header className="absolute inset-x-0 top-0 z-30 px-4 pb-3 pt-[calc(env(safe-area-inset-top,0px)+10px)] backdrop-blur-2xl border-b border-border/60 bg-background/88">
        <div className="mx-auto flex items-center justify-between gap-3 max-w-4xl">
          <Link
            to="/dashboard"
            aria-label="Back to dashboard"
            className="flex h-11 w-11 shrink-0 items-center justify-start active:scale-95"
          >
            <img src="/lovable-uploads/bf69a7f7-550a-45a1-8808-a02fb889f8c5.png" alt="Medmacs" className="h-9 w-9 object-contain" />
          </Link>

          <div className="min-w-0 text-center">
            <h1 className="brand-wordmark max-w-full truncate text-xl text-foreground">Past Papers and Re-calls</h1>
          </div>

          <Link
            to="/detailed-analytics"
            className="flex shrink-0 items-center justify-center bg-primary/10 text-primary transition-all hover:bg-primary hover:text-white h-11 w-11 rounded-2xl active:scale-95"
            aria-label="Open analytics"
          >
            <Target className="h-5 w-5" />
          </Link>
        </div>
      </header>

      <div className="no-scrollbar relative z-10 min-h-0 flex-1 overflow-y-auto pb-36 pt-[calc(env(safe-area-inset-top,0px)+84px)]">
        <div className="mx-auto w-full max-w-2xl px-4 sm:px-0">
          <div className="text-center mb-8 px-4">
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-3 block">Step 1 of 3</span>
            <h2 className="font-['Bricolage_Grotesque'] px-1 text-3xl font-extrabold leading-tight tracking-[-0.045em] text-foreground sm:text-5xl">
              Select <span className="text-primary">Subject</span>
            </h2>
            <p className="text-muted-foreground text-sm font-medium mt-3 max-w-lg mx-auto text-center">
              Choose a subject to practice authentic past papers and recalled exam questions.
            </p>
          </div>
          {loading ? (
            <div className="py-6 flex flex-col items-center justify-center">
              <DoctorMascotLoader
                variant="inline"
                size="sm"
                label="Loading past paper subjects..."
                showSubtext={true}
              />
            </div>
          ) : subjects.length > 0 ? (
            <div className="divide-y divide-border/50 border-y border-border/50">
              {subjects.map((subject, index) => {
                const isSelected = selectedSubject?.id === subject.id;
                const isOfflineUnavailable = isOfflineMode && !offlineSubjectIds.has(subject.id);
                const chapterCount = subjectChapterCounts[subject.id] ?? subject.past_paper_chapter_count;
                // Only mark as Coming Soon if the count is explicitly known to be 0 (undefined means not provided by server yet)
                const hasZeroChapters = typeof chapterCount === 'number' && chapterCount === 0;
                const isDisabled = isOfflineUnavailable || hasZeroChapters;
                const metaLabels = [
                  subject.free_unlimited_access === true && (
                    <span key="free" className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-600 dark:text-emerald-400">
                      Free
                    </span>
                  ),
                  hasZeroChapters && (
                    <span key="empty" className="inline-flex items-center rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-amber-600 dark:text-amber-400 border border-amber-500/20">
                      Coming Soon
                    </span>
                  ),
                  isOfflineUnavailable && (
                    <span key="offline" className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-600 dark:text-amber-400">
                      <WifiOff className="h-3 w-3" />
                      Not downloaded
                    </span>
                  ),
                ].filter(Boolean);

                return (
                  <motion.div
                    key={subject.id}
                    custom={index}
                    variants={reduceMotion ? undefined : rowEntrance}
                    initial={reduceMotion ? false : 'hidden'}
                    animate={reduceMotion ? false : 'visible'}
                    className={cn(
                      'relative transition-shadow duration-300',
                      isSelected && 'shadow-[0_0_20px_-4px_rgba(16,185,129,0.15)]'
                    )}
                  >
                    <SelectionRow
                      leading={
                        <motion.span
                          variants={reduceMotion ? undefined : iconBounce}
                          custom={index}
                          initial="hidden"
                          animate="visible"
                          className="inline-block"
                        >
                          {subject.icon || '📚'}
                        </motion.span>
                      }
                      title={subject.name}
                      subtitle={hasZeroChapters ? 'No past paper chapters available yet' : (subject.description || undefined)}
                      selected={isSelected}
                      disabled={isDisabled}
                      accentLayoutId="past-paper-subject-accent"
                      onSelect={() => {
                        if (!isDisabled) setSelectedSubject(subject);
                      }}
                      meta={metaLabels.length > 0 ? metaLabels : undefined}
                    />
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="border-y border-border/50 px-4 py-14 text-center"
            >
              <motion.div
                animate={reduceMotion ? undefined : { y: [0, -4, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              >
                <WifiOff className="mx-auto h-7 w-7 text-muted-foreground/50" />
              </motion.div>
              <h3 className="mt-4 text-sm font-bold text-foreground">
                {loadError ? 'Connection failure' : 'No subjects available'}
              </h3>
              <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-muted-foreground">
                {loadError ? 'We could not connect to the content server. Check your connection and try again.' : 'No subjects are currently available for your institute.'}{' '}
                <a className="font-semibold underline underline-offset-2" href="mailto:hi@medmacs.app">
                  hi@medmacs.app
                </a>
                .
              </p>
              <Button type="button" variant="outline" className="mt-5 rounded-full" onClick={loadSubjects}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Try again
              </Button>
            </motion.div>
          )}

          <footer className="py-6 text-center">
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground/40">
              © 2026 Medmacs
            </p>
          </footer>
        </div>
      </div>

      <AnimatePresence>
        {selectedSubject && (
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
                <span className="truncate">Continue · {selectedSubject.name}</span>
                <ArrowRight className="ml-2 h-4 w-4 shrink-0" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </MCQPageLayout>
  );
};

export default PastPaperSubjectSelectionPage;
