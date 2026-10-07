// @ts-nocheck
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, BookOpen, Brain, ChevronLeft, ChevronRight, Loader2, Lock, Sparkles, Wand2 } from 'lucide-react';
import Seo from '@/components/Seo';
import PageSkeleton from '@/components/skeletons/PageSkeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MCQPageLayout } from '@/pages/mcq/MCQPageLayout';
import { fetchChaptersBySubject, fetchMCQsByChapter, fetchSubjects, Chapter, MCQ, Subject } from '@/utils/mcqData';
import { isAiLimitError } from '@/components/dashboard/personalization/FlashcardLimitModal';
import { fetchReferenceSnippet } from '@/components/dashboard/personalization/personalizationUtils';
import { recordGeneratedFlashcards } from '@/components/profile/AchievementBadges';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { aiApiJson } from '@/utils/aiApi';
import { InteractiveFlashcard } from '@/components/dashboard/personalization/InteractiveFlashcard';

type Flashcard = {
  front: string;
  back: string;
  source: string;
};

type LearningScope =
  | { type: 'chapter'; subject: Subject; chapter: Chapter }
  | { type: 'subject'; subject: Subject; chapters: Chapter[] };

const SubjectCardSkeleton = () => (
  <div className="relative overflow-hidden rounded-3xl bg-white/5 dark:bg-white/[0.035] backdrop-blur-xl p-6 animate-pulse border border-border/40">
    <div className="flex items-center gap-4">
      <div className="w-16 h-16 rounded-2xl bg-muted" />
      <div className="flex-1 space-y-2">
        <div className="h-5 w-1/3 bg-muted rounded-full" />
        <div className="h-3 w-2/3 bg-muted rounded-full" />
      </div>
    </div>
  </div>
);

const ChapterCardSkeleton = () => (
  <div className="relative overflow-hidden rounded-2xl bg-white/5 dark:bg-white/[0.035] backdrop-blur-xl p-4 animate-pulse border border-border/30">
    <div className="flex items-center gap-4">
      <div className="w-12 h-12 rounded-xl bg-muted" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-1/4 bg-muted rounded-full" />
        <div className="h-3 w-3/4 bg-muted rounded-full" />
      </div>
    </div>
  </div>
);

import { LottiePlayer } from '@/components/LottiePlayer';
import bouncingDotsAnimationData from '@/assets/animations/bouncing-dots-loading.json';

const FlashcardLottieLoader = () => (
  <div className="flex flex-col items-center justify-center py-12 space-y-3">
    <div className="w-24 h-24 flex items-center justify-center">
      <LottiePlayer animationData={bouncingDotsAnimationData} loop autoplay style={{ width: '100%', height: '100%' }} />
    </div>
    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground animate-pulse">
      Generating AI Flashcards…
    </p>
  </div>
);

const buildFallbackCards = (mcqs: MCQ[], batchIndex: number, batchSize = 5): Flashcard[] => {
  const start = batchIndex * batchSize;
  const selected = mcqs.slice(start, start + batchSize);
  const source = selected.length ? selected : mcqs.slice(0, batchSize);

  return source.map((mcq, index) => ({
    front: mcq.question,
    back: mcq.explanation || `Correct answer: ${mcq.correct_answer}`,
    source: `Card ${start + index + 1}`,
  }));
};

const generateFlashcards = async (scopeLabel: string, mcqs: MCQ[], batchIndex: number, batchSize = 5): Promise<Flashcard[]> => {
  const start = batchIndex * batchSize;
  const selected = mcqs.slice(start, start + batchSize);
  const source = selected.length ? selected : mcqs.slice(0, batchSize);
  const references = await Promise.all(source.map(mcq => fetchReferenceSnippet(mcq.question)));

  const prompt = `Create exactly ${source.length} concise MBBS flashcards for ${scopeLabel}.
Use the MCQs, explanations, and reference snippets. Make every card high-yield, clinically useful, and exam-ready.
Return only JSON: {"cards":[{"front":"...","back":"...","source":"..."}]}.

Items:
${source.map((mcq, index) => `
${index + 1}. Question: ${mcq.question}
Correct answer: ${mcq.correct_answer}
Explanation: ${mcq.explanation || 'None'}
Reference: ${references[index] || 'No reference retrieved'}
`).join('\n')}`;

  const data = await aiApiJson<{ answer?: string }>('ai/study-chat', { question: prompt }, {});
  const answer = data.answer || '';
  const jsonMatch = answer.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('AI response was not JSON');
  const parsed = JSON.parse(jsonMatch[0]);
  const cards = Array.isArray(parsed.cards) ? parsed.cards : [];

  const normalizedCards = cards
    .filter((card: any) => card.front && card.back)
    .slice(0, batchSize)
    .map((card: any, index: number) => ({
      front: String(card.front),
      back: String(card.back),
      source: card.source ? String(card.source) : `AI card ${start + index + 1}`,
    }));

  return normalizedCards;
};

const LearnWithAIPage = () => {
  useLayoutEffect(() => {
    requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    });
  }, []);

  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(true);
  const [chaptersLoading, setChaptersLoading] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [selectedScope, setSelectedScope] = useState<LearningScope | null>(null);
  const [isHeadingStuck, setIsHeadingStuck] = useState(false);
  const stickyHeadingRef = useRef<HTMLDivElement>(null);
  const stickyHeadingStartTop = useRef<number | null>(null);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [flashcardSourceMcqs, setFlashcardSourceMcqs] = useState<MCQ[]>([]);
  const [activeCard, setActiveCard] = useState(0);
  const [batchIndex, setBatchIndex] = useState(0);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [flashcardModalOpen, setFlashcardModalOpen] = useState(false);
  const currentCard = flashcards[activeCard];

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile', user?.id, 'learn-ai'],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase.from('profiles').select('plan').eq('id', user.id).maybeSingle();
      if (error) return null;
      return data;
    },
    enabled: !!user?.id,
  });

  const userPlan = String(profile?.plan || 'free').toLowerCase();

  useEffect(() => {
    const loadSubjects = async () => {
      setSubjectsLoading(true);
      const data = await fetchSubjects();
      setSubjects(data);
      setSubjectsLoading(false);
    };
    loadSubjects();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (!stickyHeadingRef.current) return;
      if (stickyHeadingStartTop.current === null) {
        stickyHeadingStartTop.current = stickyHeadingRef.current.offsetTop;
      }
      setIsHeadingStuck(window.scrollY >= stickyHeadingStartTop.current - 1);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, []);

  const selectSubject = async (subject: Subject) => {
    setSelectedSubject(subject);
    setSelectedScope(null);
    setChaptersLoading(true);
    const data = await fetchChaptersBySubject(subject.id);
    setChapters(data);
    setChaptersLoading(false);
  };

  const resetToSubjects = () => {
    setSelectedSubject(null);
    setSelectedScope(null);
    setChapters([]);
  };

  const getScopeLabel = (scope = selectedScope) => {
    if (!scope) return 'Selected topic';
    if (scope.type === 'subject') return `${scope.subject.name} full subject`;
    return `${scope.subject.name} - ${scope.chapter.name}`;
  };

  const loadSourceMcqs = async (scope: LearningScope) => {
    if (scope.type === 'chapter') return fetchMCQsByChapter(scope.chapter.id);
    const chapterBatches = await Promise.all(scope.chapters.map(chapter => fetchMCQsByChapter(chapter.id)));
    return chapterBatches.flat();
  };

  const buildBatch = async (nextBatch = false, scope = selectedScope) => {
    if (!scope) return;
    const nextIndex = nextBatch ? batchIndex + 1 : 0;
    const requestedCount = 5;
    const allowedCount = requestedCount;

    setCardsLoading(true);
    setActiveCard(0);
    setFlashcardModalOpen(true);

    try {
      const sourceMcqs = nextBatch && flashcardSourceMcqs.length ? flashcardSourceMcqs : await loadSourceMcqs(scope);
      setFlashcardSourceMcqs(sourceMcqs);
      const cards = await generateFlashcards(getScopeLabel(scope), sourceMcqs, nextIndex, allowedCount);
      const nextCards = cards.length ? cards : buildFallbackCards(sourceMcqs, nextIndex, allowedCount);
      setFlashcards(nextCards);
      await recordGeneratedFlashcards(user?.id, nextCards.length);
      setBatchIndex(nextIndex);
    } catch (error) {
      if (isAiLimitError(error)) {
        setFlashcardModalOpen(false);
        return;
      }
      const sourceMcqs = flashcardSourceMcqs.length ? flashcardSourceMcqs : await loadSourceMcqs(scope);
      setFlashcardSourceMcqs(sourceMcqs);
      const nextCards = buildFallbackCards(sourceMcqs, nextIndex, allowedCount);
      setFlashcards(nextCards);
      await recordGeneratedFlashcards(user?.id, nextCards.length);
      setBatchIndex(nextIndex);
    } finally {
      setCardsLoading(false);
    }
  };

  const chooseScope = (scope: LearningScope) => {
    setSelectedScope(scope);
    setFlashcards([]);
    setFlashcardSourceMcqs([]);
    setBatchIndex(0);
    buildBatch(false, scope);
  };

  const isAllCardsCompleted = flashcards.length > 0 && activeCard >= flashcards.length;

  if (authLoading || profileLoading) return <PageSkeleton />;

  if (!user) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background/55 dark:bg-white/[0.035] backdrop-blur-xl p-4 text-center">
        <Card className="w-full max-w-md bg-card/60 dark:bg-white/[0.05] backdrop-blur-sm border-border shadow-lg p-6">
          <CardHeader className="mb-4">
            <Lock className="w-16 h-16 mx-auto text-primary mb-4" />
            <CardTitle className="text-2xl font-bold text-foreground">Access Restricted</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-6">Please log in to access AI learning.</p>
            <Button asChild className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-2 px-4 rounded-lg shadow-md">
              <Link to="/login">Go to Login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <MCQPageLayout backTo="/dashboard" showHeader showBackButton>
      <Seo title="Learn with Dr Ahroid" description="Generate AI flashcards from any subject or chapter on Medmacs App." canonical="https://medmacs.app/learn-with-ai" />

      <div className="text-center mb-6 sm:mb-8 animate-fade-in">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-normal leading-[1.08] text-foreground uppercase italic mb-3">
          Learn with <span className="text-primary">Dr Ahroid</span>
        </h1>
        <p className="text-muted-foreground text-xs uppercase tracking-[0.2em] max-w-2xl mx-auto px-4 sm:px-0">
          Generate flashcards from any subject or chapter
        </p>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-0 mb-6">
        <div className="rounded-3xl border border-primary/15 bg-primary/5 p-4 text-sm text-muted-foreground">
          Dr Ahroid flashcard access follows your current cloud AI policy.
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-4 px-4">
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-3 block">
          {selectedSubject ? 'Step 2 of 2' : 'Step 1 of 2'}
        </span>
      </motion.div>

      <div ref={stickyHeadingRef} className="sticky top-0 z-50 bg-background/45 dark:bg-background/20 backdrop-blur-xl pt-[env(safe-area-inset-top)] -mx-3 sm:mx-0 px-3 sm:px-0">
        <div className="max-w-4xl mx-auto px-4 sm:px-0">
          <motion.div
            animate={{ paddingTop: isHeadingStuck ? 10 : 16, paddingBottom: isHeadingStuck ? 10 : 12 }}
            transition={{ type: 'spring', stiffness: 260, damping: 30 }}
            className="overflow-visible"
          >
            <motion.div
              animate={{ height: isHeadingStuck ? 34 : 64 }}
              transition={{ type: 'spring', stiffness: 260, damping: 30 }}
              className="relative overflow-visible"
            >
              <motion.h2
                animate={{
                  left: isHeadingStuck ? '0%' : '50%',
                  x: isHeadingStuck ? '0%' : '-50%',
                  scale: isHeadingStuck ? 0.58 : 1
                }}
                transition={{ type: 'spring', stiffness: 260, damping: 28 }}
                className="absolute top-0 origin-left whitespace-nowrap pr-3 text-3xl sm:text-5xl font-black tracking-normal text-foreground uppercase italic leading-[1.08]"
              >
                Select <span className="live-gradient-text">{selectedSubject ? 'Chapter\u00A0' : 'Subject\u00A0'}</span>
              </motion.h2>
            </motion.div>
            <motion.p
              animate={{
                opacity: isHeadingStuck ? 0 : 1,
                y: isHeadingStuck ? -8 : 0,
                height: isHeadingStuck ? 0 : 'auto',
                marginTop: isHeadingStuck ? 0 : 8
              }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden text-muted-foreground text-sm font-medium max-w-lg mx-auto text-center"
            >
              {selectedSubject ? selectedSubject.name : 'Choose a subject first, then generate repeat flashcard batches.'}
            </motion.p>
          </motion.div>
        </div>
        <div className="h-4 bg-gradient-to-b from-background/40 dark:from-background/10 to-transparent pointer-events-none" />
      </div>

      {!selectedSubject ? (
        <div className="max-w-4xl mx-auto px-4 sm:px-0 pb-32 grid grid-cols-1 md:grid-cols-2 gap-4">
          {subjectsLoading ? (
            Array.from({ length: 4 }).map((_, i) => <SubjectCardSkeleton key={i} />)
          ) : (
            subjects.map((subject, index) => {
              const isSelected = selectedSubject?.id === subject.id;
              return (
                <motion.div
                  key={subject.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ scale: 1.02, y: -4 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => selectSubject(subject)}
                  className={`group cursor-pointer relative overflow-hidden rounded-3xl border-2 p-6 transition-all duration-300 ${
                    isSelected
                      ? 'border-primary bg-primary/5 shadow-2xl shadow-primary/10'
                      : 'border-border/40 bg-white/5 dark:bg-white/[0.035] backdrop-blur-xl hover:border-primary/30 hover:bg-primary/5'
                  }`}
                >
                  <div className="flex items-center gap-5 relative z-10">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-xl transition-transform duration-300 group-hover:scale-110 ${
                      isSelected ? 'bg-primary text-white' : 'bg-muted/50 text-foreground/70'
                    }`}>
                      {subject.icon || <Brain className="w-7 h-7" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl font-black uppercase italic tracking-normal leading-snug text-foreground">{subject.name}</h3>
                      <p className="text-muted-foreground text-xs font-medium leading-relaxed line-clamp-2">
                        {subject.description || `Generate focused flashcards from ${subject.name}.`}
                      </p>
                    </div>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-muted opacity-0 group-hover:opacity-100 transition-all">
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      ) : (
        <div className="max-w-4xl mx-auto px-4 sm:px-0 pb-32 grid grid-cols-1 md:grid-cols-2 gap-4">
          <motion.button
            type="button"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.02, x: 5 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => chooseScope({ type: 'subject', subject: selectedSubject, chapters })}
            disabled={chapters.length === 0}
            className="group relative overflow-hidden rounded-2xl border-2 border-primary/40 bg-primary/5 p-4 text-left transition-all duration-300 hover:border-primary"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-primary text-white shadow-lg shadow-primary/30">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-black uppercase italic tracking-normal leading-snug text-primary">Whole Subject</h3>
                <p className="text-muted-foreground text-xs font-medium leading-snug break-words">{selectedSubject.name} - all available chapters</p>
              </div>
              <Badge className="border-0 bg-primary/10 text-primary">{chapters.length}</Badge>
            </div>
          </motion.button>

          {chaptersLoading ? (
            Array.from({ length: 6 }).map((_, i) => <ChapterCardSkeleton key={i} />)
          ) : chapters.map((chapter, index) => {
            const isComingSoon = (chapter.mcq_count || 0) === 0;
            return (
              <motion.button
                key={chapter.id}
                type="button"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.03 }}
                whileHover={!isComingSoon ? { scale: 1.02, x: 5 } : {}}
                whileTap={isComingSoon ? {} : { scale: 0.98 }}
                onClick={() => !isComingSoon && chooseScope({ type: 'chapter', subject: selectedSubject, chapter })}
                disabled={isComingSoon}
                className={`group relative overflow-hidden rounded-2xl border-2 p-4 text-left transition-all duration-300 ${
                  isComingSoon ? 'opacity-50 cursor-not-allowed grayscale' : 'cursor-pointer'
                } border-border/40 bg-white/5 dark:bg-white/[0.035] backdrop-blur-xl hover:border-primary/30 hover:bg-primary/5`}
              >
                <div className="flex items-center gap-4 relative z-10">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-muted/50 text-foreground/70">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-black uppercase italic tracking-normal leading-snug text-foreground">{chapter.name}</h3>
                    <p className="text-muted-foreground text-xs font-medium leading-snug break-words">Chapter {chapter.chapter_number} - {chapter.mcq_count || 0} MCQs</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </motion.button>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {selectedSubject && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed bottom-0 left-0 right-0 p-6 pb-[env(safe-area-inset-bottom)] z-50 flex justify-center pointer-events-none"
          >
            <div className="w-full max-w-md pointer-events-auto">
              <Button
                onClick={resetToSubjects}
                variant="outline"
                className="w-full bg-background/95 backdrop-blur rounded-2xl h-12 uppercase font-black text-xs tracking-[0.2em]"
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back to Subjects
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={flashcardModalOpen} onOpenChange={setFlashcardModalOpen}>
        <DialogContent className="max-w-md p-0 border-none bg-transparent shadow-none [&>button]:hidden flex flex-col items-center justify-center">
          <DialogTitle className="sr-only">
            {getScopeLabel()}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Interactive AI flashcards batch
          </DialogDescription>

          {cardsLoading ? (
            <FlashcardLottieLoader />
          ) : isAllCardsCompleted ? (
            <div className="relative w-full max-w-md mx-auto aspect-[3/4.2] max-h-[520px] rounded-[2.5rem] p-6 flex flex-col justify-between bg-gradient-to-br from-indigo-700 via-purple-700 to-pink-700 text-white shadow-2xl font-rounded border border-white/20 select-none">
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="bg-white/20 text-white font-rounded font-bold border-white/20">
                  Batch Completed 🎉
                </Badge>
                <button
                  type="button"
                  onClick={() => setFlashcardModalOpen(false)}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 border border-white/20 hover:bg-white/20"
                >
                  <span className="text-sm font-bold">×</span>
                </button>
              </div>

              <div className="my-auto text-center space-y-4">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white shadow-xl">
                  <Sparkles className="h-8 w-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-2xl font-bold font-rounded">Batch {batchIndex + 1} Finished!</h3>
                  <p className="text-xs text-purple-100 font-medium">You've completed all {flashcards.length} AI cards for {getScopeLabel()}.</p>
                </div>
              </div>

              <div className="space-y-2.5 pt-2 border-t border-white/20">
                <Button className="w-full h-12 rounded-2xl font-black bg-white text-purple-950 hover:bg-purple-50 shadow-lg text-sm" onClick={() => buildBatch(true)} disabled={cardsLoading}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Next Batch
                </Button>
                <button
                  type="button"
                  onClick={() => setActiveCard(0)}
                  className="w-full text-center text-xs font-bold text-purple-200 hover:text-white py-1 underline underline-offset-4"
                >
                  Replay batch from Card 1
                </button>
              </div>
            </div>
          ) : currentCard ? (
            <div className="w-full space-y-3">
              <InteractiveFlashcard
                card={currentCard}
                currentIndex={activeCard}
                totalCards={flashcards.length}
                chapterName={getScopeLabel()}
                batchIndex={batchIndex}
                onClose={() => setFlashcardModalOpen(false)}
                onSwipeNext={() => setActiveCard((index) => index + 1)}
                onSwipePrev={() => setActiveCard((index) => Math.max(0, index - 1))}
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </MCQPageLayout>
  );
};

export default LearnWithAIPage;
