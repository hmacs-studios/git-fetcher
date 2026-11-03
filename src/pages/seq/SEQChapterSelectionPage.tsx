import { useState, useEffect, useLayoutEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight, RefreshCw, WifiOff } from 'lucide-react';
import { fetchSEQChaptersBySubject, fetchSEQSubjectById, SEQChapter, SEQSubject } from '@/utils/mcqData';
import { MCQPageLayout } from '@/pages/mcq/MCQPageLayout';
import AppTransitionScreen from '@/components/AppTransitionScreen';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CollaborateModal } from '@/components/CollaborateModal';
import { SelectionBackdrop } from '@/components/selection/SelectionBackdrop';
import { SelectionRow } from '@/components/selection/SelectionRow';
import { rowEntrance } from '@/components/selection/motion';

const ChapterRowSkeleton = () => (
  <div className="flex animate-pulse items-center gap-4 py-4 pl-4 pr-3">
    <div className="min-w-0 flex-1 space-y-2">
      <div className="h-2.5 w-1/5 rounded-full bg-muted" />
      <div className="h-3.5 w-2/3 rounded-full bg-muted" />
    </div>
    <div className="h-3 w-10 shrink-0 rounded-full bg-muted" />
  </div>
);

const SEQChapterSelectionPage = () => {
  useLayoutEffect(() => {
    requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    });
  }, []);

  const { subjectId } = useParams<{ subjectId: string }>();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [allChapters, setAllChapters] = useState<SEQChapter[]>([]);
  const [loadingChapters, setLoadingChapters] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [selectedChapter, setSelectedChapter] = useState<SEQChapter | null>(null);
  const [subject, setSubject] = useState<SEQSubject | null>(null);
  const [showCollaborateModal, setShowCollaborateModal] = useState(false);

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile', 'seq-chapter-select'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from('profiles').select('plan').eq('id', user.id).maybeSingle();
      return data;
    },
    enabled: true
  });

  useEffect(() => {
    const loadData = async () => {
      if (!subjectId || profileLoading) return;

      setLoadingChapters(true);
      setLoadError(false);

      try {
        const [subjectData, chapters] = await Promise.all([
          fetchSEQSubjectById(subjectId),
          fetchSEQChaptersBySubject(subjectId)
        ]);

        if (subjectData) {
          setSubject(subjectData);
        }
        setAllChapters(chapters);
      } catch (error) {
        console.error('Unable to load SEQ chapters:', error);
        setLoadError(true);
      } finally {
        setLoadingChapters(false);
        setLoading(false);
      }
    };

    if (!profileLoading) {
      loadData();
    }
  }, [profileLoading, retryKey, subjectId]);

  const handleContinue = () => {
    if (selectedChapter && subjectId) {
      navigate(`/seqs/quiz/${subjectId}/${selectedChapter.id}`);
    }
  };

  if (profileLoading || loading) {
    return <AppTransitionScreen />;
  }

  if (!subject) {
    return (
      <MCQPageLayout backTo="/seqs">
        <SelectionBackdrop />
        <div className="relative z-10 text-center py-20">
          <p className="font-semibold text-foreground">We are not fully available in your institute yet.</p>
          <p className="mt-2 text-sm text-muted-foreground">Help us bring SEQ content to your campus.</p>
          <div className="mt-5 flex flex-col sm:flex-row justify-center gap-3">
            <Button asChild variant="outline"><Link to="/contact-us?subject=campus-collaboration">Request campus collaboration</Link></Button>
            <Button onClick={() => setShowCollaborateModal(true)}>Become Medmacs Ambassador</Button>
          </div>
          <Button onClick={() => navigate('/seqs')} variant="ghost" className="mt-4">Go Back</Button>
          <CollaborateModal open={showCollaborateModal} onOpenChange={setShowCollaborateModal} />
        </div>
      </MCQPageLayout>
    );
  }

  return (
    <MCQPageLayout backTo="/seqs">
      <SelectionBackdrop active={Boolean(selectedChapter)} accent="amber" />

      <div className="relative z-10 mx-auto w-full max-w-2xl px-4 sm:px-0">
        <div className="py-5">
          <p className="truncate text-[10px] font-bold uppercase tracking-[0.25em] text-amber-600/90 dark:text-amber-500/90">{subject?.name}</p>
          <h2 className="font-['Bricolage_Grotesque'] mt-1.5 text-2xl font-bold uppercase italic leading-none tracking-[-0.03em] text-foreground sm:text-[1.75rem]">
            Select <span className="text-amber-600 dark:text-amber-400">Chapter</span>
          </h2>
          <p className="mt-2 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground/60">
            {profile?.plan === 'free' ? 'Free daily limits apply' : 'Unlimited premium access'}
          </p>
        </div>

        <div className="pb-32">
          {loadingChapters ? (
            <div className="divide-y divide-border/50 border-y border-border/50">
              {Array.from({ length: 8 }).map((_, i) => <ChapterRowSkeleton key={i} />)}
            </div>
          ) : loadError ? (
            <div className="border-y border-border/50 px-4 py-14 text-center">
              <WifiOff className="mx-auto h-7 w-7 text-muted-foreground/50" />
              <h3 className="mt-4 text-sm font-bold text-foreground">Connection failure</h3>
              <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-muted-foreground">We could not connect to the content server. Check your connection and try again.</p>
              <Button type="button" variant="outline" className="mt-5 rounded-md" onClick={() => setRetryKey(value => value + 1)}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Try again
              </Button>
            </div>
          ) : allChapters.length === 0 ? (
            <div className="border-y border-border/50 px-4 py-14 text-center">
              <p className="font-semibold text-foreground">We are not fully available in your institute yet.</p>
              <p className="mt-2 text-sm text-muted-foreground">Help us bring chapter-wise SEQ content to your campus.</p>
              <div className="mt-5 flex flex-col sm:flex-row justify-center gap-3">
                <Button asChild variant="outline"><Link to="/contact-us?subject=campus-collaboration">Request campus collaboration</Link></Button>
                <Button onClick={() => setShowCollaborateModal(true)}>Become Medmacs Ambassador</Button>
              </div>
              <CollaborateModal open={showCollaborateModal} onOpenChange={setShowCollaborateModal} />
            </div>
          ) : (
            <div className="divide-y divide-border/50 border-y border-border/50">
              {allChapters.map((ch, idx) => {
                const isComingSoon = (ch.seq_count || 0) === 0;
                const isSelected = selectedChapter?.id === ch.id;

                return (
                  <motion.div
                    key={ch.id}
                    custom={idx}
                    variants={reduceMotion ? undefined : rowEntrance}
                    initial={reduceMotion ? false : 'hidden'}
                    animate={reduceMotion ? false : 'visible'}
                  >
                    <SelectionRow
                      accent="amber"
                      eyebrow={`Chapter ${ch.chapter_number || idx + 1}`}
                      title={ch.name}
                      selected={isSelected}
                      disabled={isComingSoon}
                      accentLayoutId="seq-chapter-accent"
                      onSelect={() => setSelectedChapter(ch)}
                      meta={
                        isComingSoon ? (
                          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/60">
                            Coming soon
                          </span>
                        ) : undefined
                      }
                      trailing={
                        isComingSoon ? undefined : (
                          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/60">
                            {ch.seq_count} Qs
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
              © 2026 Medmacs
            </p>
          </footer>
        </div>
      </div>

      <AnimatePresence>
        {selectedChapter && (
          <motion.div
            initial={{ opacity: 0, y: 80 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 80 }}
            transition={{ type: 'spring', damping: 26, stiffness: 340 }}
            className="pointer-events-none fixed bottom-0 left-0 right-0 z-50 flex justify-center bg-gradient-to-t from-background via-background/95 to-transparent px-4 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-8"
          >
            <div className="pointer-events-auto w-full max-w-2xl">
              <Button
                onClick={handleContinue}
                 className="group h-12 w-full rounded-md bg-amber-500 text-xs font-bold uppercase tracking-[0.18em] text-white transition-all duration-200 hover:bg-amber-600 active:scale-[0.98]"
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

export default SEQChapterSelectionPage;
