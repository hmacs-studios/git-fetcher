import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle2, ChevronRight, Loader2, RotateCcw, XCircle } from 'lucide-react';
import { notifyAchievementProgress } from '@/components/profile/AchievementBadges';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { MistakeChapter } from './types';
import { parseBoldText } from '@/utils/format';

type CorrectionMCQModalProps = {
  open: boolean;
  chapter: MistakeChapter | null;
  onOpenChange: (open: boolean) => void;
};

export const CorrectionMCQModal = ({ open, chapter, onOpenChange }: CorrectionMCQModalProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [startedAt, setStartedAt] = useState(Date.now());
  const [correctedMcqIds, setCorrectedMcqIds] = useState<Set<string>>(new Set());

  const attempts = chapter?.attempts || [];
  const activeAttempt = attempts[activeIndex];
  const options = useMemo(() => {
    if (!activeAttempt) return [];
    const baseOptions = activeAttempt.mcq.options?.length
      ? activeAttempt.mcq.options
      : [activeAttempt.selectedAnswer, activeAttempt.mcq.correctAnswer].filter(Boolean);
    return Array.from(new Set(baseOptions));
  }, [activeAttempt]);
  const isCorrect = selectedAnswer === activeAttempt?.mcq.correctAnswer;
  const completed = !attempts.some((attempt, index) => index > activeIndex && !correctedMcqIds.has(attempt.mcq.id));

  useEffect(() => {
    if (!open) return;
    setActiveIndex(0);
    setSelectedAnswer('');
    setSubmitted(false);
    setSaving(false);
    setCorrectedMcqIds(new Set());
    setStartedAt(Date.now());
  }, [open, chapter?.id]);

  const submitAnswer = async () => {
    if (!user?.id || !activeAttempt || !selectedAnswer || saving) return;
    setSaving(true);
    const timeTaken = Math.max(1, Math.floor((Date.now() - startedAt) / 1000));
    const correct = selectedAnswer === activeAttempt.mcq.correctAnswer;

    try {
      const { error } = await supabase.from('user_answers').insert({
        user_id: user.id,
        mcq_id: activeAttempt.mcq.id,
        selected_answer: selectedAnswer,
        is_correct: correct,
        time_taken: timeTaken,
        used_ai_help: false,
        correction_mode: true,
      });
      if (error) throw error;
      notifyAchievementProgress('correction_mcq');
      if (correct) {
        setCorrectedMcqIds(previous => new Set([...previous, activeAttempt.mcq.id]));
        queryClient.invalidateQueries({ queryKey: ['personalization-wrong-attempts', user.id] });
      }
      setSubmitted(true);
    } catch (error) {
      toast({ title: 'Answer Not Saved', description: error?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const goNext = () => {
    const nextIndex = attempts.findIndex((attempt, index) => index > activeIndex && !correctedMcqIds.has(attempt.mcq.id));
    if (completed || nextIndex === -1) {
      onOpenChange(false);
      return;
    }
    setActiveIndex(nextIndex);
    setSelectedAnswer('');
    setSubmitted(false);
    setStartedAt(Date.now());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="fixed bottom-0 top-auto left-1/2 -translate-x-1/2 translate-y-0 max-w-2xl max-h-[85vh] overflow-y-auto rounded-t-[2.5rem] rounded-b-none border-border/40 p-0 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]">
        <DialogHeader className="border-b border-border/40 bg-background/55 dark:bg-white/[0.035] backdrop-blur-xl px-5 py-4 text-left">
          <DialogTitle className="flex items-center gap-2 text-base font-black">
            <RotateCcw className="h-5 w-5 text-primary" />
            {chapter?.name || 'Correct MCQs'}
          </DialogTitle>
        </DialogHeader>

        {activeAttempt ? (
          <div className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <Badge variant="secondary">{activeIndex + 1}/{attempts.length}</Badge>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                {chapter?.subjectName || activeAttempt.mcq.subjectName}
              </span>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={activeAttempt.id}
                initial={{ opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -18 }}
                transition={{ duration: 0.18 }}
                className="rounded-3xl border border-border/40 bg-card p-4 shadow-sm"
              >
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-primary">Correction MCQ</p>
                <h3 className="mt-2 text-base font-black leading-relaxed text-foreground">{activeAttempt.mcq.question}</h3>

                <div className="mt-4 grid gap-2">
                  {options.map((option) => {
                    const isSelected = selectedAnswer === option;
                    const isRight = submitted && option === activeAttempt.mcq.correctAnswer;
                    const isWrong = submitted && isSelected && option !== activeAttempt.mcq.correctAnswer;

                    return (
                      <button
                        key={option}
                        type="button"
                        disabled={submitted || saving}
                        onClick={() => setSelectedAnswer(option)}
                        className={`flex min-h-12 items-center gap-3 rounded-2xl border p-3 text-left text-sm font-bold transition-all ${
                          isRight
                            ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'
                            : isWrong
                              ? 'border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-200'
                              : isSelected
                                ? 'border-primary bg-primary/10 text-foreground'
                                : 'border-border/50 bg-background hover:border-primary/40 hover:bg-primary/5'
                        }`}
                      >
                        {isRight ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : isWrong ? <XCircle className="h-4 w-4 shrink-0" /> : <span className="h-4 w-4 shrink-0 rounded-full border border-current/40" />}
                        <span className="leading-relaxed">{option}</span>
                      </button>
                    );
                  })}
                </div>

                {submitted && (
                  <div className={`mt-4 rounded-2xl p-3 ${isCorrect ? 'bg-emerald-500/10' : 'bg-amber-500/10'}`}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      {isCorrect ? 'Corrected' : 'Review'}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-foreground">
                      {parseBoldText(activeAttempt.mcq.explanation || `Correct answer: ${activeAttempt.mcq.correctAnswer}`)}
                    </p>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              {submitted ? (
                <Button className="rounded-xl" onClick={goNext}>
                  {completed ? 'Finish' : 'Next MCQ'}
                  {!completed && <ChevronRight className="ml-1 h-4 w-4" />}
                </Button>
              ) : (
                <Button className="rounded-xl" disabled={!selectedAnswer || saving} onClick={submitAnswer}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                  Submit Answer
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="p-4">
            <div className="rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground">
              No correction MCQs are available for this chapter.
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
