import { FlpQuizLoading } from '@/components/FLPs/FlpQuizLoading';
import { saveFlpDraft } from '@/utils/flpSession';
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { ChevronLeft, PanelLeft, Clock, Menu, Zap, Loader2 } from 'lucide-react';
import { ProfileDropdown } from '@/components/ProfileDropdown';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { notifyAchievementProgress } from '@/components/profile/AchievementBadges';
import { matchesArchivedAttempt, readArchivedAttempt, writeAttemptData } from '@/utils/flpStorage';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";


interface MCQ {
  id: string;
  question: string;
  options: string[];
  correct_answer: string;
  explanation?: string;
  chapter_id: string;
}

interface ShuffledMCQ extends Omit<MCQ, 'options'> {
  shuffledOptions: string[];
  originalCorrectIndex: number;
}

interface QuizResultForDb {
  mcq_id: string;
  selectedAnswer: string | null;
  isCorrect: boolean;
  timeTaken: number;
}

interface FLPQuizProps {
  mcqs: MCQ[];
  onFinish: (score: number, totalQuestions: number) => void;
  timePerQuestion?: number;
  subjectName?: string;
  initialIndex?: number;
  initialAnswers?: Record<string, string | null>;
  initialTimeLeft?: number;
  sessionId?: string;
  deadline?: number;
}

const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

const FLP_STORAGE_KEY = 'flp_session';

interface FLPSessionData {
  shuffledMcqs: ShuffledMCQ[];
  currentQuestionIndex: number;
  userAnswers: Record<string, string | null>;
  totalTimeLeft: number;
  subjectName?: string;
  sessionId?: string;
  savedAt: number;
}

export const FLPQuiz = ({ mcqs, onFinish, timePerQuestion = 60, subjectName, initialIndex, initialAnswers, initialTimeLeft, sessionId, deadline }: FLPQuizProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [shuffledMcqs, setShuffledMcqs] = useState<ShuffledMCQ[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string | null>>({});
  const [totalTimeLeft, setTotalTimeLeft] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [isQuizEnded, setIsQuizEnded] = useState(false);
  const [currentTestResultId, setCurrentTestResultId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showUnattemptedDialog, setShowUnattemptedDialog] = useState(false);
  const [unattemptedCount, setUnattemptedCount] = useState(0);
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const lastScrollY = useRef(0);
  const [headerVisible, setHeaderVisible] = useState(true);
  const mainContentRef = useRef<HTMLDivElement>(null);
  const [isRestored, setIsRestored] = useState(false);
  const [isNewSession, setIsNewSession] = useState(false);
  const isSubmittingRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isInitializedRef = useRef(false);
  const displayedDeadline = useRef(deadline);

  const totalQuestions = shuffledMcqs.length;
  const totalTestTime = totalQuestions * timePerQuestion;

  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const currentMCQ = shuffledMcqs[currentQuestionIndex];
  const handleOptionSelect = (mcqId: string, selectedOption: string) => {
    if (isQuizEnded) return;
    setUserAnswers(prev => ({ ...prev, [mcqId]: selectedOption }));
  };
  const goToNextQuestion = () => {
    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      // Scroll to top when changing questions
      if (mainContentRef.current) {
        mainContentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };
  const goToPreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
      // Scroll to top when changing questions
      if (mainContentRef.current) {
        mainContentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };
  const goToQuestion = (index: number) => {
    setCurrentQuestionIndex(index);
    setIsDrawerOpen(false);
    // Scroll to top when changing questions
    if (mainContentRef.current) {
      mainContentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };
  const isQuestionAnswered = (mcqId: string) => userAnswers[mcqId] !== null && userAnswers[mcqId] !== undefined;
  const countUnattempted = () => shuffledMcqs ? shuffledMcqs.filter(mcq => !isQuestionAnswered(mcq.id)).length : 0;

  const submitTestToSupabase = async (autoSubmit: boolean = false) => {
    if (!user || !shuffledMcqs || isQuizEnded || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    if (timerRef.current) clearInterval(timerRef.current);

    let finalScore = 0;
    const questionsAttemptDetails: QuizResultForDb[] = [];
    shuffledMcqs.forEach(mcq => {
      const userAnswer = userAnswers[mcq.id] || null;
      const isCorrect = userAnswer === mcq.correct_answer;
      if (isCorrect) finalScore++;
      questionsAttemptDetails.push({ mcq_id: mcq.id, selectedAnswer: userAnswer, isCorrect, timeTaken: 0 });
    });
    const flpTestConfigId = 'flp_weekly_test_id';
    const resultData = { user_id: user.id, username: user.email ? user.email.split('@')[0] : 'unknown', score: finalScore, total_questions: totalQuestions, completed_at: new Date().toISOString(), test_config_id: flpTestConfigId, question_attempts: questionsAttemptDetails, status: 'completed' };
    try {
      let activeResultId = '';
      if (sessionId) {
        const { data: updatedRows, error: updateError } = await (supabase as any)
          .from('flp_user_attempts')
          .update({
            score: finalScore,
            completed_at: new Date().toISOString(),
            question_attempts: questionsAttemptDetails,
            status: 'completed'
          })
          .eq('id', sessionId)
          .eq('user_id', user.id)
          .select('id');
        if (updateError) throw updateError;
        if (!updatedRows || updatedRows.length === 0) {
          throw new Error('Failed to update test result: no rows affected.');
        }
        activeResultId = sessionId;
      } else {
        const { data: insertedResult, error: insertError } = await (supabase as any).from('flp_user_attempts').insert([resultData]).select('id').single();
        if (insertError) throw insertError;
        activeResultId = (insertedResult as any).id;

      }

      try {
        localStorage.removeItem(FLP_STORAGE_KEY);
      } catch (error) {
        console.warn('Could not clear the saved FLP session.', error);
      }

      const { data: profileBadges } = await (supabase as any).from('profiles').select('badges').eq('id', user.id).maybeSingle();
      const currentBadges = profileBadges?.badges || {};
      const currentStats = currentBadges.stats || {};
      await (supabase as any)
        .from('profiles')
        .update({
          badges: {
            ...currentBadges,
            stats: {
              ...currentStats,
              flpCompletionCount: Number(currentStats.flpCompletionCount || 0) + 1,
            },
            synced_at: new Date().toISOString(),
          },
        })
        .eq('id', user.id);
      notifyAchievementProgress('flp_completed');

      try {
        const review = {
          attempt_id: activeResultId,
          mcqs: shuffledMcqs.map(mcq => ({
            id: mcq.id,
            question: mcq.question,
            options: mcq.shuffledOptions,
            correct_answer: mcq.correct_answer,
            explanation: mcq.explanation,
            chapter_id: mcq.chapter_id,
          })),
          question_attempts: questionsAttemptDetails,
          score: finalScore,
          total_questions: totalQuestions,
          completed_at: resultData.completed_at,
        };
        await writeAttemptData(review);
        const archived = await readArchivedAttempt(activeResultId);
        if (!matchesArchivedAttempt(review, archived)) {
          throw new Error('Archived review could not be verified.');
        }

        const { error: archiveError } = await (supabase as any)
          .from('flp_user_attempts')
          .update({ review_archived_at: new Date().toISOString(), question_attempts: null })
          .eq('id', activeResultId)
          .eq('user_id', user.id)
          .select('id')
          .single();
        if (archiveError) throw archiveError;
      } catch (error) {
        console.warn('FLP archive was not finalized. Supabase review data remains available.', error);
      }

      setCurrentTestResultId(activeResultId);
      setIsQuizEnded(true);
      toast({ title: autoSubmit ? "Time's Up! Test Submitted." : "Test Submitted!", description: `You scored ${finalScore}/${totalQuestions}.`, duration: 3000 });
      navigate(`/results/flp/${activeResultId}`);
    } catch (err: any) {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
      toast({ title: "Submission Error", description: err.message, variant: "destructive" });
    }
  };

  const handleSubmitTest = () => {
    const unattempted = countUnattempted();
    if (unattempted > 0) { setUnattemptedCount(unattempted); setShowUnattemptedDialog(true); }
    else submitTestToSupabase();
  };
  const handleConfirmSubmission = () => { setShowUnattemptedDialog(false); submitTestToSupabase(); };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    const handleScroll = () => {
      if (mainContentRef.current) {
        const currentScrollY = mainContentRef.current.scrollTop;
        setHeaderVisible(currentScrollY < lastScrollY.current || currentScrollY < 10);
        lastScrollY.current = currentScrollY;
      }
    };

    const currentRef = mainContentRef.current;
    if (currentRef) {
      currentRef.addEventListener('scroll', handleScroll, { passive: true });
    }

    return () => {
      if (currentRef) {
        currentRef.removeEventListener('scroll', handleScroll);
      }
    };
  }, []);

  // Fixed back button handler - using dynamic import for Capacitor
  useEffect(() => {
    let backListener: any = null;
    let isMounted = true;

    const setupBackButtonListener = async () => {
      try {
        // Check if Capacitor is available
        const isCapacitor = typeof window !== 'undefined' && (window as any).Capacitor;

        if (isCapacitor) {
          // Dynamic import for Capacitor - only when needed
          const { App } = await import('@capacitor/app');
          if (!isMounted) return;

          backListener = await App.addListener('backButton', () => {
            if (!isQuizEnded) {
              setShowExitConfirm(true);
              return;
            }
            window.history.back();
          });
        } else {
          // Browser environment - use popstate event
          const handleBrowserBack = () => {
            if (!isQuizEnded) {
              setShowExitConfirm(true);
              return;
            }
            window.history.back();
          };

          window.addEventListener('popstate', handleBrowserBack);
          backListener = { remove: () => window.removeEventListener('popstate', handleBrowserBack) };
        }
      } catch (error) {
        console.log('Back button handling not available:', error);
      }
    };

    setupBackButtonListener();

    return () => {
      isMounted = false;
      if (backListener && typeof backListener.remove === 'function') {
        backListener.remove();
      }
    };
  }, [isQuizEnded]);

  useEffect(() => {
    if (mcqs && mcqs.length > 0 && !isInitializedRef.current) {
      isInitializedRef.current = true;
      const initialShuffled = mcqs.map(mcq => {
        const shuffledOptions = sessionId ? mcq.options : shuffleArray(mcq.options);
        const newCorrectIndex = shuffledOptions.indexOf(mcq.correct_answer);
        return { ...mcq, shuffledOptions, originalCorrectIndex: newCorrectIndex };
      });
      setShuffledMcqs(initialShuffled);
      setIsQuizEnded(false);
      setCurrentTestResultId(null);
      setIsRestored(true);
      
      if (initialIndex !== undefined && initialAnswers !== undefined && initialTimeLeft !== undefined) {
        setUserAnswers(initialAnswers);
        setCurrentQuestionIndex(initialIndex);
        setTotalTimeLeft(initialTimeLeft);
      } else {
        const initialUserAnswers: Record<string, string | null> = {};
        initialShuffled.forEach(mcq => { initialUserAnswers[mcq.id] = null; });
        setUserAnswers(initialUserAnswers);
        setCurrentQuestionIndex(0);
        const freshTotalTime = initialShuffled.length * timePerQuestion;
        setTotalTimeLeft(freshTotalTime);
        displayedDeadline.current ??= Date.now() + freshTotalTime * 1000;
      }
    }
  }, [mcqs, timePerQuestion]);

  useEffect(() => {
    if (!isInitializedRef.current) return;
    if (totalTimeLeft <= 0 && !isQuizEnded && totalQuestions > 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      submitTestToSupabase(true);
      return;
    }
    if (isQuizEnded || totalQuestions === 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => { setTotalTimeLeft(prevTime => prevTime - 1); }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [totalTimeLeft, isQuizEnded, totalQuestions]);

  useEffect(() => {
    const endsAt = displayedDeadline.current;
    if (!sessionId || !endsAt || !shuffledMcqs.length || isQuizEnded || isSubmittingRef.current) return;
    const savedAt = Date.now();
    void saveFlpDraft({
      sessionId, subjectName, currentQuestionIndex, userAnswers, deadline: endsAt, savedAt,
      mcqs: shuffledMcqs.map(({ shuffledOptions, originalCorrectIndex: _index, ...question }) => ({
        ...question, options: shuffledOptions,
      })),
    }).catch(error => console.warn('FLP progress was not synced.', error));
  }, [sessionId, subjectName, shuffledMcqs, currentQuestionIndex, userAnswers, isQuizEnded]);

  useEffect(() => {
    if (shuffledMcqs.length > 0 && !isQuizEnded && !isSubmittingRef.current && user) {
      const sessionData: FLPSessionData = {
        shuffledMcqs,
        currentQuestionIndex,
        userAnswers,
        totalTimeLeft,
        subjectName,
        sessionId,
        savedAt: Date.now(),
      };
      try {
        localStorage.setItem(FLP_STORAGE_KEY, JSON.stringify(sessionData));
      } catch (e) { console.error("Failed to save FLP session", e); }
    }
  }, [shuffledMcqs, currentQuestionIndex, userAnswers, totalTimeLeft, isQuizEnded, user]);

  useEffect(() => {
    if (shuffledMcqs.length > 0 && !isRestored) {
      try {
        localStorage.removeItem(FLP_STORAGE_KEY);
      } catch (e) { console.error("Failed to clear FLP session", e); }
    }
  }, [isRestored, shuffledMcqs.length]);

  if (shuffledMcqs.length === 0) return <FlpQuizLoading />;

  const displayUsername = user?.email ? user.email.split('@')[0] : 'User';

  // Keep the buttons mounted when the quiz timer updates.
  const renderQuestionMap = () => (
    <>
      <div className="grid grid-cols-5 gap-2.5 justify-items-center">
        {shuffledMcqs.map((mcq, index) => (
          <Button key={mcq.id} type="button" variant="outline"
            aria-current={currentQuestionIndex === index ? 'step' : undefined}
            className={`w-9 h-9 rounded-full p-0 text-xs font-black transition-all ${
              currentQuestionIndex === index
                ? 'bg-teal-500 text-white border-2 border-teal-500 shadow-md scale-105 hover:bg-teal-600'
                : isQuestionAnswered(mcq.id)
                  ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 border-2 border-slate-800 dark:border-slate-200 shadow-sm'
                  : 'bg-transparent border-2 border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-500'
            }`}
            onClick={() => goToQuestion(index)}>
            {index + 1}
          </Button>
        ))}
      </div>
      <div className="mt-6 text-xs text-muted-foreground space-y-2 border-t border-border/40 pt-4">
        <p className="flex items-center"><span className="inline-block w-3.5 h-3.5 rounded-full bg-teal-500 mr-2" />Current</p>
        <p className="flex items-center"><span className="inline-block w-3.5 h-3.5 rounded-full bg-slate-800 dark:bg-slate-200 mr-2" />Answered (OMR Shaded)</p>
        <p className="flex items-center"><span className="inline-block w-3.5 h-3.5 rounded-full bg-transparent border-2 border-slate-300 dark:border-slate-700 mr-2" />Unanswered</p>
      </div>
    </>
  );

  return (
    <div className="fixed inset-0 overflow-hidden overscroll-none bg-background flex flex-col h-screen">
      {/* Background decoration - fixed position so it doesn't scroll */}
      <div className="fixed top-[-20%] left-[-10%] w-[60%] h-[60%] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Header - fixed position */}
      <div className={`fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/40 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] transition-transform duration-300 ${headerVisible ? 'translate-y-0' : '-translate-y-full'}`}>
        <div className="container mx-auto px-4 py-3 flex justify-between items-center max-w-7xl">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="hidden lg:flex w-10 h-10 rounded-2xl bg-muted/40 hover:bg-muted/60" onClick={() => setIsPanelOpen(!isPanelOpen)}>
              <Menu className="h-5 w-5" />
            </Button>
            <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden w-10 h-10 rounded-2xl bg-muted/40 hover:bg-muted/60">
                  <PanelLeft className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" overlayClassName="z-[200]" className="z-[201] w-[300px] p-0 border-r border-border/40 bg-background/80 backdrop-blur-2xl flex flex-col">
                <SheetHeader className="p-6 border-b border-border/40">
                  <SheetTitle className="text-xl font-black italic tracking-tight">Question <span className="text-blue-600">Map</span></SheetTitle>
                </SheetHeader>
                <div className="min-h-0 flex-grow overflow-y-auto p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">{renderQuestionMap()}</div>
              </SheetContent>
            </Sheet>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg">
                <Zap className="w-4 h-4 text-white fill-white" />
              </div>
              <span className="text-lg font-black tracking-tight italic hidden sm:inline">Full-Length <span className="text-blue-600">Paper</span></span>
              <span className="text-lg font-black italic sm:hidden">FLP</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-muted/40 backdrop-blur-md px-4 py-1.5 rounded-2xl border border-border/40">
              <Clock className={`w-4 h-4 ${totalTimeLeft < 300 ? 'text-red-500 animate-pulse' : 'text-muted-foreground'}`} />
              <span className={`text-sm font-black tabular-nums ${totalTimeLeft < 300 ? 'text-red-500' : 'text-foreground'}`}>{formatTime(totalTimeLeft)}</span>
            </div>
            <ProfileDropdown />
          </div>
        </div>
      </div>

      <div className="flex flex-1 relative pt-[calc(env(safe-area-inset-top)+70px)] overflow-hidden h-full">
        {/* Desktop Panel */}
        <AnimatePresence>
          {isPanelOpen && (
            <motion.div
              initial={{ x: -288, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -288, opacity: 0 }}
              transition={{ duration: 0.4, ease: "circOut" }}
              className="hidden lg:flex flex-col w-72 bg-muted/5 backdrop-blur-xl border-r border-border/40 flex-shrink-0 absolute left-0 bottom-0 z-40"
              style={{ top: 'calc(env(safe-area-inset-top) + 70px)' }}
            >
              <div className="p-6 border-b border-border/40">
                <h2 className="text-xs font-black uppercase tracking-[0.3em] text-muted-foreground/60">Practice Navigator</h2>
              </div>
              <div className="min-h-0 flex-grow overflow-y-auto p-6">{renderQuestionMap()}</div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Content - Questions scrollable, header/footer fixed */}
        <main
          ref={mainContentRef}
          className={`flex-grow flex flex-col items-center px-4 pt-6 pb-[calc(env(safe-area-inset-bottom)+8px)] overflow-hidden w-full transition-all duration-500 ease-in-out ${isPanelOpen ? 'lg:pl-72' : ''}`}
          style={{ height: '100%' }}
        >
          <div className="w-full max-w-2xl flex flex-col h-full overflow-hidden">
            {/* Fixed Top Progress Header */}
            <div className="mb-6 w-full shrink-0">
              <div className="flex items-center justify-between mb-3">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">Progress</span>
                  <p className="text-sm font-black text-foreground mt-0.5">Question {currentQuestionIndex + 1} of {totalQuestions}</p>
                </div>
                {subjectName && (
                  <div className="bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-full">
                    <span className="text-[9px] font-black uppercase tracking-widest text-blue-500">{subjectName}</span>
                  </div>
                )}
              </div>
              <div className="w-full h-1.5 bg-muted/40 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-blue-600 to-indigo-600"
                  initial={{ width: 0 }}
                  animate={{ width: `${((currentQuestionIndex + 1) / totalQuestions) * 100}%` }}
                  transition={{ duration: 0.5, ease: "circOut" }}
                />
              </div>
            </div>

            {/* Scrollable Questions & Options container */}
            <div className="flex-1 overflow-y-auto pr-1 w-full min-h-0 mb-4">
              <AnimatePresence mode="wait">
                {currentMCQ && (
                  <motion.div
                    key={currentMCQ.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.25 }}
                    drag="x"
                    dragDirectionLock
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.18}
                    onDragEnd={(_, info) => {
                      const swipeThreshold = 45;
                      const swipeVelocity = 300;
                      if (info.offset.x < -swipeThreshold || info.velocity.x < -swipeVelocity) {
                        goToNextQuestion();
                      } else if (info.offset.x > swipeThreshold || info.velocity.x > swipeVelocity) {
                        goToPreviousQuestion();
                      }
                    }}
                    className="flex flex-col w-full touch-pan-y"
                  >
                    <h2 className="text-xl sm:text-2xl font-black text-foreground leading-[1.3] tracking-tight mb-8">
                      {currentMCQ.question}
                    </h2>

                    <div className="space-y-4 mb-4">
                      {currentMCQ.shuffledOptions.map((option, idx) => {
                        const isSelected = userAnswers[currentMCQ.id] === option;
                        return (
                          <motion.button
                            key={idx}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => handleOptionSelect(currentMCQ.id, option)}
                            className={`group relative w-full p-5 rounded-3xl text-left border-2 transition-all duration-300 ${isSelected
                                ? 'bg-blue-500/10 border-blue-500 shadow-[0_10px_30px_rgba(59,130,246,0.1)]'
                                : 'bg-muted/10 border-transparent hover:bg-muted/20 hover:border-muted'
                              }`}
                          >
                            <div className="flex items-center gap-4">
                              <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black transition-colors shrink-0 ${isSelected ? 'bg-blue-500 text-white' : 'bg-muted/20 text-muted-foreground'
                                }`}>
                                {String.fromCharCode(65 + idx)}
                              </span>
                              <span className={`text-base font-bold leading-snug transition-colors ${isSelected ? 'text-blue-600' : 'text-foreground/80'
                                }`}>
                                {option}
                              </span>
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Fixed Bottom Footer */}
            <div className="w-full shrink-0 border-t border-border/20 pt-4 pb-2 bg-background z-10">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  onClick={goToPreviousQuestion}
                  disabled={currentQuestionIndex === 0}
                  className="flex-1 max-w-[120px] rounded-2xl h-14 bg-muted/40 backdrop-blur-sm text-foreground font-bold hover:bg-muted/60 disabled:opacity-20 transition-all"
                >
                  <ChevronLeft className="w-5 h-5 mr-1" /> Back
                </Button>

                {currentQuestionIndex < totalQuestions - 1 ? (
                  <Button
                    onClick={goToNextQuestion}
                    className="flex-1 rounded-2xl h-14 bg-foreground text-background font-black uppercase text-xs tracking-[0.2em] shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    Next Question <ChevronLeft className="w-5 h-5 ml-1 rotate-180" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleSubmitTest}
                    disabled={isSubmitting}
                    className="flex-1 rounded-2xl h-14 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black uppercase text-xs tracking-[0.2em] shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-60 disabled:pointer-events-none"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      "Finish & Submit"
                    )}
                  </Button>
                )}
              </div>

              <div className="mt-4 text-center opacity-30">
                <div className="flex items-center justify-center gap-2">
                  <div className="h-px w-8 bg-muted-foreground/30" />
                  <p className="text-[10px] font-bold text-foreground uppercase tracking-widest">{displayUsername}</p>
                  <div className="h-px w-8 bg-muted-foreground/30" />
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      <AlertDialog open={showUnattemptedDialog} onOpenChange={setShowUnattemptedDialog}>
        <AlertDialogContent className="rounded-[2.5rem] p-8 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] border-border/40 bg-background/80 backdrop-blur-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-black italic tracking-tight">Unattempted <span className="text-red-500">Items</span></AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground font-medium py-2">
              You still have <span className="text-foreground font-black underline decoration-red-500/30 underline-offset-4">{unattemptedCount}</span> question(s) left. Finishing now will mark them as incorrect.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex gap-3 sm:gap-3 mt-4">
            <AlertDialogCancel className="flex-1 rounded-2xl h-12 font-bold bg-muted/20 border-transparent hover:bg-muted/40 uppercase text-xs tracking-widest">Keep Solving</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSubmission} className="flex-1 rounded-2xl h-12 font-black bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg shadow-rose-900/20 uppercase text-xs tracking-widest">Submit Anyway</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Sheet open={showExitConfirm} onOpenChange={setShowExitConfirm}>
        <SheetContent side="bottom" className="mx-auto max-h-[88dvh] overflow-y-auto rounded-t-[2.5rem] border-x border-t border-border/40 bg-background/95 p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] backdrop-blur-2xl sm:max-w-lg z-[300]" overlayClassName="z-[300]">
          <SheetHeader className="text-left">
            <SheetTitle className="text-2xl font-black italic tracking-tight text-slate-950 dark:text-white">Leave <span className="text-red-500">Test?</span></SheetTitle>
            <SheetDescription className="text-muted-foreground font-medium py-2">
              Are you sure you want to leave the test? Your current progress will not be saved for this session.
            </SheetDescription>
          </SheetHeader>
          <div className="flex gap-3 mt-6">
            <Button onClick={() => setShowExitConfirm(false)} variant="outline" className="flex-1 rounded-2xl h-12 font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white border-transparent uppercase text-xs tracking-widest">
              Continue Test
            </Button>
            <Button onClick={() => { setShowExitConfirm(false); navigate('/dashboard'); }} className="flex-1 rounded-2xl h-12 font-black bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg shadow-rose-900/20 uppercase text-xs tracking-widest">
              Leave Paper
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};
