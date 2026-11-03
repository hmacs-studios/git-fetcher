import { lazy, Suspense, useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { MCQPageLayout } from '@/pages/mcq/MCQPageLayout';
import { Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { fetchSEQByChapter, evaluateSEQAnswer, saveSEQAnswer, getUserSEQAnswersByChapter, getFirstUnattemptedSEQIndex, SEQ, SEQEvaluationResult } from '@/utils/mcqData';
import { SEQQuizSkeleton, SEQResultSkeleton } from '@/components/skeletons/SEQSkeleton';
import { 
  Clock, CheckCircle, XCircle, Bot, BookOpen, Loader2, 
  ArrowRight, AlertCircle, Sparkles, ThumbsUp, ThumbsDown, Mail,
  FlaskConical, List, X
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { supabase } from '@/integrations/supabase/client';

const LazyAIChatbot = lazy(() =>
  import('@/components/mcq/AIChatbot').then((module) => ({ default: module.AIChatbot })),
);

type SEQBetaBannerSettings = {
  enabled: boolean;
  version: string;
  message: string;
  report_label?: string;
};

const parseSEQBetaBannerSettings = (value: string | null | undefined): SEQBetaBannerSettings | null => {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Partial<SEQBetaBannerSettings>;
    if (!parsed.enabled || !parsed.version || !parsed.message) return null;

    return {
      enabled: true,
      version: parsed.version,
      message: parsed.message,
      report_label: parsed.report_label || 'Report an issue',
    };
  } catch {
    return null;
  }
};


const SEQQuizPage = () => {
  useLayoutEffect(() => {
    requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    });
  }, []);

  const { subjectId, chapterId } = useParams<{ subjectId: string; chapterId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { planTier } = useFeatureAccess('ai_tutor');
  const { toast } = useToast();
  const startTimeRef = useRef<number>(Date.now());
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [currentSEQ, setCurrentSEQ] = useState<SEQ | null>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isLoadingSEQs, setIsLoadingSEQs] = useState(true);
  const [result, setResult] = useState<SEQEvaluationResult | null>(null);
  const [allSEQs, setAllSEQs] = useState<SEQ[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [showEvaluatingSkeleton, setShowEvaluatingSkeleton] = useState(false);
  const [previousAnswers, setPreviousAnswers] = useState<Record<string, {
    userAnswer: string;
    isCorrect: boolean;
    satisfactionIndex: number;
    correctedAnswer: string;
    explanation: string;
    createdAt: string;
  }>>({});
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);
  const [showAiLocked, setShowAiLocked] = useState(false);
  const [chatPrefillPrompt, setChatPrefillPrompt] = useState('');
  const [betaBannerDismissal, setBetaBannerDismissal] = useState<{ version: string; dismissed: boolean } | null>(null);
  const evaluationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const betaBannerQuery = useQuery<SEQBetaBannerSettings | null>({
    queryKey: ['seq-beta-banner'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('setting_value')
        .eq('setting_name', 'seq_beta_banner')
        .maybeSingle();

      if (error) return null;
      return parseSEQBetaBannerSettings(data?.setting_value);
    },
    staleTime: 1000 * 60 * 2,
  });

  const betaBanner = betaBannerQuery.data;
  const betaBannerStorageKey = betaBanner ? `seq-beta-banner-dismissed:${betaBanner.version}` : null;
  const isBetaBannerVisible = Boolean(
    betaBanner?.enabled
    && betaBannerStorageKey
    && betaBannerDismissal?.version === betaBanner.version
    && !betaBannerDismissal.dismissed,
  );

  useEffect(() => {
    if (!betaBannerStorageKey) {
      setBetaBannerDismissal(null);
      return;
    }

    setBetaBannerDismissal({
      version: betaBanner!.version,
      dismissed: window.localStorage.getItem(betaBannerStorageKey) === 'true',
    });
  }, [betaBanner?.version, betaBannerStorageKey]);

  const dismissBetaBanner = () => {
    if (betaBannerStorageKey) window.localStorage.setItem(betaBannerStorageKey, 'true');
    if (betaBanner) setBetaBannerDismissal({ version: betaBanner.version, dismissed: true });
  };

  useEffect(() => {
    const loadSEQs = async () => {
      if (!chapterId || !user?.id) return;
      setIsLoadingSEQs(true);
      const seqs = await fetchSEQByChapter(chapterId);
      
      const prevAnswers = await getUserSEQAnswersByChapter(user.id, chapterId);
      setPreviousAnswers(prevAnswers);
      
      if (seqs.length > 0) {
        setAllSEQs(seqs);
        const firstUnattemptedIndex = await getFirstUnattemptedSEQIndex(user.id, chapterId, seqs);
        
        if (firstUnattemptedIndex < seqs.length) {
          setCurrentIndex(firstUnattemptedIndex);
          setCurrentSEQ(seqs[firstUnattemptedIndex]);
        } else {
          setCurrentIndex(0);
          setCurrentSEQ(seqs[0]);
          if (seqs[0].id && prevAnswers[seqs[0].id]) {
            setUserAnswer(prevAnswers[seqs[0].id].userAnswer);
            setResult({
              is_correct: prevAnswers[seqs[0].id].isCorrect,
              satisfaction_index: prevAnswers[seqs[0].id].satisfactionIndex,
              corrected_answer: prevAnswers[seqs[0].id].correctedAnswer,
              explanation: prevAnswers[seqs[0].id].explanation
            });
          }
        }
      }
      setIsLoadingSEQs(false);
    };
    loadSEQs();
  }, [chapterId, user?.id]);

  const evaluateMutation = useMutation({
    mutationFn: async ({ userAnswer, question, broadAnswer, accurateAnswer, keywords }: { userAnswer: string; question: string; broadAnswer: string; accurateAnswer: string; keywords?: string[] | string | null }) => {
      const evaluation = await evaluateSEQAnswer(userAnswer, question, broadAnswer, accurateAnswer, Array.isArray(keywords) ? keywords : (keywords ? [keywords] : []));
      return evaluation;
    },
    onSuccess: async (evaluation) => {
      if (evaluationTimeoutRef.current) {
        clearTimeout(evaluationTimeoutRef.current);
        evaluationTimeoutRef.current = null;
      }
      setResult(evaluation);
      setIsEvaluating(false);
      setShowEvaluatingSkeleton(false);

      if (user && currentSEQ) {
        const timeTaken = Math.round((Date.now() - startTimeRef.current) / 1000);
        await saveSEQAnswer(
          currentSEQ.id,
          userAnswer,
          evaluation.is_correct,
          evaluation.satisfaction_index,
          evaluation.corrected_answer,
          evaluation.explanation,
          '',
          timeTaken
        );
      }
    },
    onError: () => {
      if (evaluationTimeoutRef.current) {
        clearTimeout(evaluationTimeoutRef.current);
        evaluationTimeoutRef.current = null;
      }
      setIsEvaluating(false);
      setShowEvaluatingSkeleton(false);
      setShowErrorModal(true);
    }
  });

  useEffect(() => {
    if (currentSEQ && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [currentSEQ]);

  const handleSubmit = async () => {
    if (!currentSEQ || !userAnswer.trim() || isEvaluating) return;
    
    if (textareaRef.current) {
      textareaRef.current.blur();
    }
    
    setIsEvaluating(true);
    setShowEvaluatingSkeleton(true);
    startTimeRef.current = Date.now();
    
    evaluationTimeoutRef.current = setTimeout(() => {
      setShowErrorModal(true);
      setIsEvaluating(false);
      setShowEvaluatingSkeleton(false);
    }, 15000);
    
    evaluateMutation.mutate({
      userAnswer,
      question: currentSEQ.question,
      broadAnswer: currentSEQ.broad_answer || currentSEQ.model_answer,
      accurateAnswer: currentSEQ.model_answer,
      keywords: currentSEQ.keywords
    });
  };

  const handleNext = () => {
    let nextIndex = currentIndex + 1;
    
    while (nextIndex < allSEQs.length && previousAnswers[allSEQs[nextIndex].id]) {
      nextIndex++;
    }
    
    if (nextIndex < allSEQs.length) {
      const seq = allSEQs[nextIndex];
      const prevAnswer = previousAnswers[seq.id];
      
      setCurrentIndex(nextIndex);
      setCurrentSEQ(seq);
      
      if (prevAnswer) {
        setUserAnswer(prevAnswer.userAnswer);
        setResult({
          is_correct: prevAnswer.isCorrect,
          satisfaction_index: prevAnswer.satisfactionIndex,
          corrected_answer: prevAnswer.correctedAnswer,
          explanation: prevAnswer.explanation
        });
      } else {
        setUserAnswer('');
        setResult(null);
      }
      
      startTimeRef.current = Date.now();
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    } else {
      navigate('/seqs');
    }
  };

  const handleBack = () => {
    if (subjectId && chapterId) {
      navigate(`/seqs/chapter/${subjectId}`);
    } else {
      navigate('/seqs');
    }
  };

  const handleSelectFromDrawer = (index: number) => {
    const seq = allSEQs[index];
    const prevAnswer = previousAnswers[seq.id];
    
    setCurrentIndex(index);
    setCurrentSEQ(seq);
    setIsDrawerOpen(false);
    
    if (prevAnswer) {
      setUserAnswer(prevAnswer.userAnswer);
      setResult({
        is_correct: prevAnswer.isCorrect,
        satisfaction_index: prevAnswer.satisfactionIndex,
        corrected_answer: prevAnswer.correctedAnswer,
        explanation: prevAnswer.explanation
      });
    } else {
      setUserAnswer('');
      setResult(null);
    }
    
    startTimeRef.current = Date.now();
  };

  const getSatisfactionBadge = (index: number) => {
    if (index >= 80) return { bg: 'bg-green-500', text: 'text-green-500', label: 'Excellent' };
    if (index >= 50) return { bg: 'bg-primary', text: 'text-primary', label: 'Good' };
    return { bg: 'bg-red-500', text: 'text-red-500', label: 'Needs Work' };
  };

  const truncateText = (text: string, maxLength: number = 80) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  if (authLoading || isLoadingSEQs) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-background text-foreground">
        <header className="relative z-50 border-b border-border/40 bg-background/95 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur-xl sm:px-6">
          <div className="relative mx-auto grid w-full max-w-4xl grid-cols-[1fr_auto_1fr] items-center">
            <Skeleton className="h-9 w-9 rounded-xl" />
            <h1 className="brand-wordmark text-xl text-foreground">Short Questions</h1>
            <Skeleton className="justify-self-end h-9 w-9 rounded-xl" />
          </div>
        </header>
        <main className="relative z-10 flex-1 overflow-y-auto overscroll-contain">
          <SEQQuizSkeleton />
        </main>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background p-4 text-center">
        <Card className="w-full max-w-md bg-card/90 backdrop-blur-sm border-border shadow-lg p-6">
          <CardHeader className="mb-4">
            <Lock className="w-16 h-16 mx-auto text-primary mb-4" />
            <CardTitle className="text-2xl font-bold text-foreground">Access Restricted</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-6">Please log in to access the SEQ practice section.</p>
            <Button asChild className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-2 px-4 rounded-lg shadow-md">
              <Link to="/login">Go to Login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!subjectId || !chapterId || !currentSEQ) {
    return (
      <MCQPageLayout backTo="/seqs">
        <div className="text-center py-20">
          <p className="text-muted-foreground">No SEQ found for this chapter.</p>
          <Button onClick={() => navigate('/seqs')} className="mt-4 bg-primary hover:bg-primary/90">
            Go Back
          </Button>
        </div>
      </MCQPageLayout>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-background text-foreground">
      <header className="relative z-50 border-b border-border/40 bg-background/95 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur-xl sm:px-6">
        <div className="relative mx-auto grid w-full max-w-4xl grid-cols-[1fr_auto_1fr] items-center">
          <div className="flex min-w-0 items-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsDrawerOpen(true)}
              className="h-9 w-9 shrink-0 rounded-xl"
              aria-label="Open question map"
            >
              <List className="h-5 w-5" />
            </Button>
          </div>
          <h1 className="brand-wordmark text-xl text-foreground">Short Questions</h1>
          <div aria-hidden="true" />
        </div>
      </header>

      <AnimatePresence initial={false}>
        {isBetaBannerVisible && betaBanner && (
          <motion.aside
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="relative z-40 overflow-hidden border-b border-primary/15 bg-primary/[0.06]"
            aria-label="Short Questions beta notice"
          >
            <div className="mx-auto flex w-full max-w-4xl items-start gap-3 px-4 py-2.5 sm:px-6">
              <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <p className="min-w-0 flex-1 text-xs leading-relaxed text-foreground/80 sm:text-sm">
                <span className="font-bold text-foreground">Beta:</span>{' '}
                {betaBanner.message}{' '}
                <button
                  type="button"
                  onClick={() => navigate('/contact-us?subject=seq-beta-feedback')}
                  className="font-bold text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  {betaBanner.report_label}
                </button>
              </p>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={dismissBetaBanner}
                className="-mr-2 -mt-1 h-9 w-9 shrink-0 rounded-lg text-muted-foreground hover:text-foreground"
                aria-label="Dismiss beta notice"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isDrawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDrawerOpen(false)}
              className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed left-0 top-0 bottom-0 z-[80] w-80 max-w-[85vw] bg-background border-r border-border shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div>
                  <h2 className="text-lg font-black uppercase italic tracking-tight text-foreground">
                    All <span className="text-primary">Questions</span>
                  </h2>
                  <p className="text-xs text-muted-foreground">{allSEQs.length} questions in this set</p>
                </div>
                <Button
                  onClick={() => setIsDrawerOpen(false)}
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {allSEQs.map((seq, index) => {
                  const prevAnswer = previousAnswers[seq.id];
                  const isActive = currentIndex === index;
                  const badge = prevAnswer ? getSatisfactionBadge(prevAnswer.satisfactionIndex) : null;

                  return (
                    <motion.button
                      key={seq.id}
                      onClick={() => handleSelectFromDrawer(index)}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.02 }}
                      className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                        isActive
                          ? 'border-primary bg-primary/5'
                          : 'border-border/50 bg-card hover:border-primary/30 hover:bg-primary/5'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${
                          isActive
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground leading-snug line-clamp-2">
                            {truncateText(seq.question, 70)}
                          </p>
                          {badge && (
                            <div className="flex items-center gap-2 mt-2">
                              <div className={`w-2 h-2 rounded-full ${badge.bg}`} />
                              <span className={`text-xs font-bold ${badge.text}`}>
                                {prevAnswer?.satisfactionIndex}% {badge.label}
                              </span>
                            </div>
                          )}
                          {!badge && (
                            <span className="text-xs text-muted-foreground mt-1 block">Not attempted</span>
                          )}
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              <div className="p-4 border-t border-border bg-muted/30">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{Object.keys(previousAnswers).length} attempted</span>
                  <span>{allSEQs.length - Object.keys(previousAnswers).length} remaining</span>
                </div>
                <Progress 
                  value={(Object.keys(previousAnswers).length / allSEQs.length) * 100} 
                  className="h-2 mt-2 bg-muted"
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <main className="relative z-10 mx-auto flex w-full max-w-4xl flex-1 flex-col overflow-y-auto overscroll-contain">
      <div className="pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="border-b border-border/40 px-4 py-3 text-center sm:px-6"
        >
          <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.3em] text-primary">
            Question {currentIndex + 1} of {allSEQs.length}
          </span>
          <Progress value={((currentIndex + 1) / allSEQs.length) * 100} className="h-1 bg-primary/10" />
        </motion.div>

        <AnimatePresence mode="wait">
          {isEvaluating ? (
            <motion.div
              key="evaluating"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <section className="px-5 pt-6 sm:px-8">
                  <p className="mb-3 text-[11px] font-black uppercase tracking-[0.16em] text-primary">Question {currentIndex + 1}</p>
                  <p className="text-lg font-semibold leading-relaxed text-foreground sm:text-xl">
                    {currentSEQ.question}
                  </p>
              </section>
              <div className="flex justify-center py-12">
                <div className="text-center">
                  <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
                  <p className="text-lg font-bold text-primary">Checking your answer...</p>
                  <p className="text-sm text-muted-foreground mt-2">This may take a few seconds</p>
                </div>
              </div>
            </motion.div>
          ) : !result ? (
            <motion.div
              key="question"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="space-y-6"
            >
              <section className="px-5 pt-6 sm:px-8">
                  <p className="mb-3 text-[11px] font-black uppercase tracking-[0.16em] text-primary">Question {currentIndex + 1}</p>
                  <p className="text-lg font-semibold leading-relaxed text-foreground sm:text-xl">
                    {currentSEQ.question}
                  </p>
              </section>

              {currentSEQ?.id && previousAnswers[currentSEQ.id] && (
                <section className="mx-5 border-t border-border/50 pt-5 sm:mx-8">
                    <div className="flex items-center justify-between">
                      <p className="flex items-center gap-2 text-sm font-black uppercase italic text-primary">
                        <Clock className="w-4 h-4" />
                        Previous Attempt
                      </p>
                      <Badge className={`${
                        previousAnswers[currentSEQ.id].satisfactionIndex >= 80 
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : previousAnswers[currentSEQ.id].satisfactionIndex >= 50
                          ? 'bg-primary/10 text-primary'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        {previousAnswers[currentSEQ.id].satisfactionIndex}% Match
                      </Badge>
                    </div>
                  <div className="space-y-3 pt-3">
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {previousAnswers[currentSEQ.id].userAnswer}
                    </p>
                    {previousAnswers[currentSEQ.id].correctedAnswer && (
                      <div>
                        <p className="text-xs font-bold text-muted-foreground mb-1">Suggested Improvement:</p>
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          {previousAnswers[currentSEQ.id].correctedAnswer}
                        </p>
                      </div>
                    )}
                  </div>
                </section>
              )}

              <div className="mx-5 space-y-2 pt-3 sm:mx-8">
                <label className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  {currentSEQ?.id && previousAnswers[currentSEQ.id] ? 'Update Your Answer' : 'Your Answer'}
                </label>
                <Textarea
                  ref={textareaRef}
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  placeholder="Write your answer here..."
                  className="min-h-[160px] resize-none rounded-none border-0 border-b-2 border-border bg-transparent px-0 py-3 text-lg shadow-none focus-visible:border-primary focus-visible:ring-0"
                  disabled={isEvaluating}
                />
              </div>

              <div className="mx-5 flex justify-end gap-4 pb-8 sm:mx-8">
                {currentSEQ?.id && previousAnswers[currentSEQ.id] && (
                  <Button
                    onClick={() => {
                      toast({
                        title: "Already Attempted",
                        description: "You've already attempted this question. Update your answer above and resubmit.",
                        variant: "default",
                      });
                    }}
                    variant="outline"
                    className="border-primary/30 text-primary hover:bg-primary/5"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    View Previous
                  </Button>
                )}
                <Button
                  onClick={handleSubmit}
                  disabled={!userAnswer.trim() || isEvaluating}
                  className="h-12 rounded-xl bg-primary px-7 font-black uppercase tracking-wider text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/90"
                >
                  {isEvaluating ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Evaluating...
                    </>
                  ) : (
                    <>
                      Submit Answer
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          ) : showEvaluatingSkeleton ? (
            <>
              <div className="mx-3 pt-4 sm:mx-6">
                <div className="max-w-4xl mx-auto px-4 sm:px-0">
                  <div className="pt-4 pb-3">
                    <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-foreground uppercase italic leading-none text-center">
                      Your <span className="text-primary">Result</span>
                    </h2>
                    <p className="text-muted-foreground text-sm font-medium mt-2 max-w-lg mx-auto text-center">
                      AI is evaluating your answer...
                    </p>
                  </div>
                </div>
                <div className="h-4 bg-gradient-to-b from-background/80 to-transparent pointer-events-none" />
              </div>
              <motion.div
                key="evaluating-skeleton"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              >
                <SEQResultSkeleton />
              </motion.div>
            </>
          ) : showErrorModal ? (
            <>
              <div className="mx-3 pt-4 sm:mx-6">
                <div className="max-w-4xl mx-auto px-4 sm:px-0">
                  <div className="pt-4 pb-3">
                    <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-foreground uppercase italic leading-none text-center">
                      Evaluation <span className="text-primary">Issue</span>
                    </h2>
                    <p className="text-muted-foreground text-sm font-medium mt-2 max-w-lg mx-auto text-center">
                      We couldn't evaluate your answer right now
                    </p>
                  </div>
                </div>
                <div className="h-4 bg-gradient-to-b from-background/80 to-transparent pointer-events-none" />
              </div>
              <motion.div
                key="error-state"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="max-w-4xl mx-auto px-4 sm:px-0 pb-32 space-y-6"
              >
                <Card className="border-2 border-red-200 dark:border-red-800 shadow-lg bg-red-50/50 dark:bg-red-900/10">
                  <CardContent className="pt-6">
                    <div className="flex flex-col items-center text-center space-y-4">
                      <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                        <AlertCircle className="w-8 h-8 text-red-500" />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-foreground mb-1">Something went wrong</h3>
                        <p className="text-sm text-muted-foreground">
                          We're having trouble evaluating your answer. This could be due to a temporary network issue or high server load.
                        </p>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
                        <Button
                          onClick={() => {
                            setShowErrorModal(false);
                            setIsEvaluating(false);
                            setUserAnswer('');
                            setResult(null);
                            if (textareaRef.current) {
                              textareaRef.current.focus();
                            }
                          }}
                          className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-xs tracking-wider rounded-xl"
                        >
                          Try Again
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => navigate('/dashboard')}
                          className="flex-1 border-primary/30 text-primary hover:bg-primary/5 font-bold rounded-xl"
                        >
                          Go to Dashboard
                        </Button>
                      </div>
                      <a 
                        href="mailto:hi@medmacs.app" 
                        className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                      >
                        <Mail className="w-4 h-4" />
                        Contact us: hi@medmacs.app
                      </a>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </>
          ) : (
            <>
              <div className="mx-3 pt-4 sm:mx-6">
                <div className="max-w-4xl mx-auto px-4 sm:px-0">
                  <div className="pt-4 pb-3">
                    <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-foreground uppercase italic leading-none text-center">
                      Your <span className="text-primary">Result</span>
                    </h2>
                    <p className="text-muted-foreground text-sm font-medium mt-2 max-w-lg mx-auto text-center">
                      Your answer is being evaluated against the reference answer
                    </p>
                  </div>
                </div>
                <div className="h-4 bg-gradient-to-b from-background/80 to-transparent pointer-events-none" />
              </div>

              <motion.div
                key="result"
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -20 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="max-w-4xl mx-auto px-4 sm:px-0 pb-32 space-y-6"
              >
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                >
                  <section className="px-5 sm:px-8">
                <div className="pb-4">
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div className="relative w-28 h-28 shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'score', value: result.satisfaction_index },
                              { name: 'remaining', value: 100 - result.satisfaction_index }
                            ]}
                            cx="50%"
                            cy="50%"
                            innerRadius={32}
                            outerRadius={44}
                            paddingAngle={4}
                            dataKey="value"
                            stroke="none"
                          >
                            <Cell fill={result.satisfaction_index >= 80 ? '#22c55e' : result.satisfaction_index >= 50 ? '#f97316' : '#ef4444'} />
                            <Cell fill="#e5e7eb" />
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex items-center justify-center flex-col">
                        <span className="text-2xl font-black text-foreground leading-none">{result.satisfaction_index}%</span>
                        <span className="text-[9px] font-bold text-muted-foreground uppercase">Score</span>
                      </div>
                    </div>
                    
                    <div className="flex-1 text-center sm:text-left">
                      <CardTitle className="text-lg font-black uppercase italic flex items-center gap-2 justify-center sm:justify-start">
                        {result.is_correct ? (
                          <>
                            <CheckCircle className="w-6 h-6 text-green-500" />
                            <span className="text-green-600">Correct!</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-6 h-6 text-red-500" />
                            <span className="text-red-600">Needs Improvement</span>
                          </>
                        )}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">
                        Evaluated against the reference answer
                      </p>
                    </div>
                  </div>
                </div>
                <div className="space-y-5 border-t border-border/50 pt-5">
                  <div>
                    <h4 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary" />
                      Accurate Answer
                    </h4>
                    <p className="leading-relaxed text-muted-foreground">
                      {result.corrected_answer}
                    </p>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
                      <Bot className="w-4 h-4 text-primary" />
                      Evaluation Details
                    </h4>
                    <p className="leading-relaxed text-muted-foreground">
                      {result.explanation}
                    </p>
                  </div>

                </div>
                </section>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                  className="mx-5 flex justify-end gap-4 sm:mx-8"
                >
                  <Button
                    onClick={() => {
                      setUserAnswer('');
                      setResult(null);
                      startTimeRef.current = Date.now();
                      if (textareaRef.current) {
                        textareaRef.current.focus();
                      }
                    }}
                    variant="outline"
                    className="border-primary/30 text-primary hover:bg-primary/5"
                  >
                    Try Again
                  </Button>
                  <Button
                    onClick={handleNext}
                    className="h-12 rounded-xl bg-primary px-8 font-black uppercase tracking-wider text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/90"
                  >
                    {currentIndex + 1 < allSEQs.length ? 'Next Question' : 'Finish'}
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </motion.div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
      </main>

      <AnimatePresence>
        {showAiLocked && (
          <motion.div
            className="fixed inset-0 z-[200] flex items-end justify-center bg-black/55 p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowAiLocked(false)}
          >
            <motion.section
              role="dialog"
              aria-modal="true"
              aria-labelledby="seq-ai-lock-title"
              className="w-full max-w-md rounded-2xl bg-background p-6 shadow-2xl"
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Bot className="h-5 w-5" />
                </div>
                <Button variant="ghost" size="icon" onClick={() => setShowAiLocked(false)} className="h-10 w-10 rounded-xl" aria-label="Close Doctor AI access notice">
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <h2 id="seq-ai-lock-title" className="mt-4 text-xl font-black tracking-tight text-foreground">Doctor AI is ready to help</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Ask for real-time guidance on this question with Doctor AI. This feature is available on Iconic and Premium plans.</p>
              <Button onClick={() => navigate('/pricing')} className="mt-5 h-11 w-full rounded-xl bg-primary font-bold text-primary-foreground hover:bg-primary/90">
                View plans
              </Button>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>

      {currentSEQ && (
        <Suspense fallback={null}>
          <LazyAIChatbot
            isOpen={isChatbotOpen}
            onClose={() => setIsChatbotOpen(false)}
            questionContext={currentSEQ.question}
            explanationContext={currentSEQ.explanation || ''}
            currentAnswer={userAnswer}
            correctAnswer={result ? currentSEQ.model_answer : undefined}
            userPlan={planTier}
            isOnline={navigator.onLine}
            prefillPrompt={chatPrefillPrompt}
            onOpen={() => setIsChatbotOpen(true)}
            onQuestionHelp={() => undefined}
          />
        </Suspense>
      )}
    </div>
  );
};

export default SEQQuizPage;
