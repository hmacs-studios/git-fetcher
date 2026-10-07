import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowRight, BookOpen, ChevronLeft, ChevronRight, RotateCcw, Sparkles, Target, XCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { CorrectionMCQModal } from './CorrectionMCQModal';
import { fetchReferenceSnippet } from './personalizationUtils';
import { MistakeChapter, MistakeSubject, WrongAttempt } from './types';
import { parseBoldText } from '@/utils/format';
import { aiApiJson } from '@/utils/aiApi';

type MistakeBookProps = {
  subjects: MistakeSubject[];
  isPremium: boolean;
};

const MistakeChapterRow = ({ chapter, onClick }: { chapter: MistakeChapter; onClick: () => void }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex w-full items-center justify-between gap-4 p-4 text-left transition-colors duration-200 hover:bg-primary/5"
    >
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <div className="flex shrink-0 items-center justify-center text-rose-600 transition-colors group-hover:text-primary">
          <Target className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Chapter {chapter.number}</p>
          <h3 className="text-base font-black uppercase italic leading-snug tracking-normal text-foreground group-hover:text-primary transition-colors truncate">
            {chapter.name}
          </h3>
          <p className="text-xs font-bold leading-snug text-rose-600 dark:text-rose-400 mt-0.5">
            {chapter.attempts.length} {chapter.attempts.length === 1 ? 'Mistake' : 'Mistakes'}
          </p>
        </div>
      </div>
      <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-muted/55 text-foreground/70 transition-all hover:bg-primary hover:text-white">
        <ArrowRight className="w-4 h-4" />
      </div>
    </button>
  );
};

export const MistakeBook = ({ subjects, isPremium }: MistakeBookProps) => {
  const [activeChapter, setActiveChapter] = useState<MistakeChapter | null>(null);
  const [correctionChapter, setCorrectionChapter] = useState<MistakeChapter | null>(null);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [aiExplainTarget, setAiExplainTarget] = useState<WrongAttempt | null>(null);
  const [explanationTarget, setExplanationTarget] = useState<WrongAttempt | null>(null);
  const [aiExplanation, setAiExplanation] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const activeAttempt = activeChapter?.attempts[activeIndex];

  const openChapter = (chapter: MistakeChapter) => {
    setActiveChapter(chapter);
    setActiveIndex(0);
  };

  const goToAttempt = (direction: 1 | -1) => {
    if (!activeChapter) return;
    setActiveIndex(index => Math.min(activeChapter.attempts.length - 1, Math.max(0, index + direction)));
  };

  const startCorrectionSession = (chapter = activeChapter) => {
    if (!chapter) return;
    setCorrectionChapter(chapter);
    setActiveChapter(null);
    setCorrectionOpen(true);
  };

  const loadAiExplanation = async (attempt: WrongAttempt) => {
    setAiExplainTarget(attempt);
    setAiExplanation('');
    setAiLoading(true);
    try {
      const reference = await fetchReferenceSnippet(attempt.mcq.question);
      const data = await aiApiJson<{ explanation?: string }>('ai/mistake-explain', {
        question: attempt.mcq.question,
        selectedAnswer: attempt.selectedAnswer,
        correctAnswer: attempt.mcq.correctAnswer,
        explanation: attempt.mcq.explanation || '',
        reference,
      }, {});
      setAiExplanation(data.explanation || 'Explanation generated, but no text was returned.');
    } catch {
      setAiExplanation(attempt.mcq.explanation || `Correct answer: ${attempt.mcq.correctAnswer}`);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <>
      <div className="max-w-4xl mx-auto px-4 sm:px-0 pb-20 space-y-7">
        {subjects.map(subject => (
          <section key={subject.id} className="space-y-4">
            <div className="flex items-end justify-between gap-4 border-b border-border/40 pb-3">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-primary">Subject Segment</p>
                <h3 className="mt-1 text-xl font-black uppercase italic leading-tight tracking-normal text-foreground">
                  {subject.name}
                </h3>
              </div>
              <div className="shrink-0 text-right">
                <Badge className="border-0 bg-primary/10 text-primary">{subject.chapters.length} chapters</Badge>
                <p className="mt-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{subject.total} MCQs</p>
              </div>
            </div>

            <div className="overflow-hidden rounded-3xl border-2 border-border/40 bg-white/5 dark:bg-white/[0.035] backdrop-blur-xl divide-y divide-border/40 shadow-sm">
              {subject.chapters.map(chapter => (
                <MistakeChapterRow
                  key={chapter.id}
                  chapter={chapter}
                  onClick={() => openChapter({ ...chapter, subjectName: subject.name })}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      <Dialog open={!!activeChapter} onOpenChange={(open) => !open && setActiveChapter(null)}>
        <DialogContent className="fixed bottom-0 top-auto left-1/2 -translate-x-1/2 translate-y-0 max-w-2xl max-h-[85vh] overflow-hidden rounded-t-[2.5rem] rounded-b-none border-border/40 p-0 flex flex-col mb-0 pb-[env(safe-area-inset-bottom,0px)]">
          <DialogHeader className="shrink-0 border-b border-border/40 bg-background/55 dark:bg-white/[0.035] backdrop-blur-xl px-5 py-4 text-left">
            <DialogTitle className="flex items-center gap-2 text-base font-black">
              <BookOpen className="h-5 w-5 text-primary" />
              {activeChapter?.name}
            </DialogTitle>
            <DialogDescription>
              Chapter {activeChapter?.number} - swipe to review marked answers.
            </DialogDescription>
          </DialogHeader>

          {activeAttempt && (
            <div className="overflow-y-auto flex-1 p-4">
              <div className="mb-3 flex items-center justify-between">
                <Badge variant="secondary">{activeIndex + 1}/{activeChapter?.attempts.length}</Badge>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">{activeChapter?.subjectName}</span>
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={activeAttempt.id}
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.16}
                  onDragEnd={(_, info) => {
                    if (info.offset.x < -45 || info.velocity.x < -350) goToAttempt(1);
                    if (info.offset.x > 45 || info.velocity.x > 350) goToAttempt(-1);
                  }}
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -24 }}
                  transition={{ duration: 0.2 }}
                  className="rounded-3xl border border-border/40 bg-card p-4 shadow-sm"
                >
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-primary">Mistake Book MCQ</p>
                  <h3 className="mt-2 text-base font-black leading-relaxed text-foreground">{activeAttempt.mcq.question}</h3>

                  <div className="mt-4 grid gap-2">
                    <div className="rounded-2xl bg-red-500/10 p-3 ring-1 ring-red-500/15">
                      <div className="mb-1 flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-red-600 dark:text-red-300" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-red-700 dark:text-red-300">Marked Answer</p>
                      </div>
                      <p className="text-sm font-bold text-red-700 dark:text-red-200">{activeAttempt.selectedAnswer}</p>
                    </div>
                    <div className="rounded-2xl bg-emerald-500/10 p-3 ring-1 ring-emerald-500/15">
                      <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-300">Correct Answer</p>
                      <p className="mt-1 text-sm font-bold text-emerald-700 dark:text-emerald-200">{activeAttempt.mcq.correctAnswer}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setExplanationTarget(activeAttempt)}
                    className="mt-4 w-full rounded-2xl bg-muted/50 p-3 text-left transition-colors hover:bg-muted"
                  >
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Explanation</p>
                    <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-foreground">
                      {activeAttempt.mcq.explanation || 'No explanation provided.'}
                    </p>
                    <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-primary">Tap to expand</p>
                  </button>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      className="rounded-xl"
                      variant="default"
                      disabled={aiLoading}
                      onClick={() => loadAiExplanation(activeAttempt)}
                    >
                      <Sparkles className="mr-2 h-4 w-4" />
                      AI Explain
                    </Button>
                    <Button size="sm" variant="outline" className="rounded-xl" onClick={() => startCorrectionSession()}>
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Correct Question
                    </Button>
                  </div>
                </motion.div>
              </AnimatePresence>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button variant="outline" className="rounded-xl" disabled={activeIndex === 0} onClick={() => goToAttempt(-1)}>
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Previous
                </Button>
                <Button className="rounded-xl" disabled={!activeChapter || activeIndex === activeChapter.attempts.length - 1} onClick={() => goToAttempt(1)}>
                  Next
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!aiExplainTarget} onOpenChange={(open) => !open && setAiExplainTarget(null)}>
        <DialogContent className="fixed bottom-0 top-auto left-1/2 -translate-x-1/2 translate-y-0 max-w-lg max-h-[85vh] overflow-y-auto rounded-t-[2.5rem] rounded-b-none pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI Explain
            </DialogTitle>
            <DialogDescription>Premium revision for this mistake-book MCQ.</DialogDescription>
          </DialogHeader>
          {aiLoading ? (
            <div className="space-y-3 rounded-2xl bg-muted/60 p-4">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-11/12" />
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-3 w-9/10" />
              <Skeleton className="h-3 w-5/6" />
            </div>
          ) : (
            <div className="max-h-[55vh] overflow-y-auto rounded-2xl bg-muted/60 p-4 text-sm leading-relaxed text-foreground whitespace-pre-wrap">
              {parseBoldText(aiExplanation)}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!explanationTarget} onOpenChange={(open) => !open && setExplanationTarget(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Explanation
            </DialogTitle>
            <DialogDescription>
              {explanationTarget?.mcq.chapterName || 'Mistake Book MCQ'}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto rounded-2xl bg-muted/60 p-4 text-sm leading-relaxed text-foreground whitespace-pre-wrap">
            {parseBoldText(explanationTarget?.mcq.explanation || 'No explanation provided.')}
          </div>
        </DialogContent>
      </Dialog>

      <CorrectionMCQModal
        open={correctionOpen}
        chapter={correctionChapter}
        onOpenChange={setCorrectionOpen}
      />
    </>
  );
};
