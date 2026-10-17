import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/hooks/useAuth';
import { MCQPageLayout } from '@/pages/mcq/MCQPageLayout';
import { Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchSEQByChapter, evaluateSEQAnswer, saveSEQAnswer, getUserSEQAnswersByChapter, getFirstUnattemptedSEQIndex, SEQ, SEQEvaluationResult } from '@/utils/mcqData';
import { useReferenceSearch } from '@/hooks/useReferenceSearch';
import { SEQQuizSkeleton, SEQResultSkeleton } from '@/components/skeletons/SEQSkeleton';
import { 
  Clock, CheckCircle, XCircle, Bot, BookOpen, Loader2, 
  ArrowRight, AlertCircle, Sparkles, ThumbsUp, ThumbsDown, Mail,
  List, X
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';


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
  const [references, setReferences] = useState('');
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
  const evaluationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile-plan', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase.from('profiles').select('plan').eq('id', user.id).maybeSingle();
      return data;
    },
    enabled: !!user?.id
  });

  const { search: searchReference, loading: isSearchingReference, data: referenceData } = useReferenceSearch();
  const referenceResults = referenceData?.results || [];

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

  useEffect(() => {
    if (currentSEQ?.question) {
      searchReference(currentSEQ.question, 3);
    }
  }, [currentSEQ?.id]);

  useEffect(() => {
    if (referenceResults.length > 0) {
      const refText = referenceResults.map((r: any) => {
        const bookInfo = r.book ? `[${r.book}${r.page ? `, p.${r.page}` : ''}]` : '';
        const content = r.text || r.content || "";
        return `${bookInfo}\n${content}`.trim();
      }).join("\n\n");
      setReferences(refText);
    }
  }, [referenceResults]);

  const evaluateMutation = useMutation({
    mutationFn: async ({ userAnswer, question }: { userAnswer: string; question: string }) => {
      const evaluation = await evaluateSEQAnswer(userAnswer, question, references);
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
      question: currentSEQ.question
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
    if (index >= 50) return { bg: 'bg-orange-500', text: 'text-orange-500', label: 'Good' };
    return { bg: 'bg-red-500', text: 'text-red-500', label: 'Needs Work' };
  };

  const truncateText = (text: string, maxLength: number = 80) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const getSatisfactionColor = (index: number) => {
    if (index >= 80) return 'text-green-500';
    if (index >= 50) return 'text-orange-500';
    return 'text-red-500';
  };

  const getSatisfactionBg = (index: number) => {
    if (index >= 80) return 'bg-green-500';
    if (index >= 50) return 'bg-orange-500';
    return 'bg-red-500';
  };

  if (authLoading || profileLoading || isLoadingSEQs) {
    return (
      <MCQPageLayout backTo="/seqs">
        <div className="max-w-4xl mx-auto">
          <SEQQuizSkeleton />
        </div>
      </MCQPageLayout>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background p-4 text-center">
        <Card className="w-full max-w-md bg-card/90 backdrop-blur-sm border-border shadow-lg p-6">
          <CardHeader className="mb-4">
            <Lock className="w-16 h-16 mx-auto text-orange-500 mb-4" />
            <CardTitle className="text-2xl font-bold text-foreground">Access Restricted</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-6">Please log in to access the SEQ practice section.</p>
            <Button asChild className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-lg shadow-md">
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
          <Button onClick={() => navigate('/seqs')} className="mt-4 bg-orange-500 hover:bg-orange-600">
            Go Back
          </Button>
        </div>
      </MCQPageLayout>
    );
  }

  return (
    <MCQPageLayout backAction={handleBack} backLabel="Back to Chapters">
      <Button
        onClick={() => setIsDrawerOpen(true)}
        className="fixed left-3 top-1/2 -translate-y-1/2 z-[60] h-12 w-12 p-0 rounded-full bg-orange-500 hover:bg-orange-600 shadow-lg shadow-orange-500/30 lg:left-4"
        size="icon"
      >
        <List className="w-5 h-5" />
      </Button>

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
                    All <span className="text-orange-500">Questions</span>
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
                          ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                          : 'border-border/50 bg-card hover:border-orange-300 hover:bg-orange-50/50 dark:hover:bg-orange-900/10'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${
                          isActive
                            ? 'bg-orange-500 text-white'
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

      <div className="max-w-4xl mx-auto">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-4"
        >
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-orange-500 mb-2 block">
            Question {currentIndex + 1} of {allSEQs.length}
          </span>
          <Progress value={((currentIndex + 1) / allSEQs.length) * 100} className="h-1 bg-orange-100 dark:bg-orange-900/30" />
        </motion.div>

        <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-md -mx-4 px-4 py-3 mb-4 pt-[env(safe-area-inset-top)]">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800">
              <BookOpen className="w-3 h-3 mr-1" />
              SEQ Practice
            </Badge>
            {profile?.plan === 'free' && (
              <Badge variant="outline" className="bg-amber-50 dark:bg-amber-900/20 text-amber-600 border-amber-200">
                <Sparkles className="w-3 h-3 mr-1" />
                Free Plan
              </Badge>
            )}
          </div>
        </div>

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
              <Card className="border-2 border-orange-200 dark:border-orange-800 shadow-lg">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-black uppercase italic text-foreground">
                    Question
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-lg font-medium text-foreground leading-relaxed">
                    {currentSEQ.question}
                  </p>
                </CardContent>
              </Card>
              <div className="flex justify-center py-12">
                <div className="text-center">
                  <Loader2 className="w-12 h-12 animate-spin text-orange-500 mx-auto mb-4" />
                  <p className="text-lg font-bold text-orange-600">AI is evaluating your answer...</p>
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
              <Card className="border-2 border-orange-200 dark:border-orange-800 shadow-lg">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-black uppercase italic text-foreground">
                    Question
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-lg font-medium text-foreground leading-relaxed">
                    {currentSEQ.question}
                  </p>
                </CardContent>
              </Card>

              {currentSEQ?.id && previousAnswers[currentSEQ.id] && (
                <Card className="border-2 border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-900/10">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-black uppercase italic text-orange-600 flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Previous Attempt
                      </CardTitle>
                      <Badge className={`${
                        previousAnswers[currentSEQ.id].satisfactionIndex >= 80 
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : previousAnswers[currentSEQ.id].satisfactionIndex >= 50
                          ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        {previousAnswers[currentSEQ.id].satisfactionIndex}% Match
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground leading-relaxed bg-white dark:bg-zinc-900 rounded-lg p-3 border border-border">
                      {previousAnswers[currentSEQ.id].userAnswer}
                    </p>
                    {previousAnswers[currentSEQ.id].correctedAnswer && (
                      <div>
                        <p className="text-xs font-bold text-muted-foreground mb-1">Suggested Improvement:</p>
                        <p className="text-sm text-muted-foreground leading-relaxed bg-white/50 dark:bg-zinc-900/50 rounded-lg p-3 border border-border/50">
                          {previousAnswers[currentSEQ.id].correctedAnswer}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              <div className="space-y-2">
                <label className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-orange-500" />
                  {currentSEQ?.id && previousAnswers[currentSEQ.id] ? 'Update Your Answer' : 'Your Answer'}
                </label>
                <Textarea
                  ref={textareaRef}
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  placeholder="Write your answer here..."
                  className="min-h-[200px] text-lg p-4 border-2 border-orange-200 dark:border-orange-800 focus:border-orange-500 focus:ring-orange-500"
                  disabled={isEvaluating}
                />
              </div>

              <div className="flex justify-end gap-4">
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
                    className="border-orange-300 text-orange-600 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    View Previous
                  </Button>
                )}
                <Button
                  onClick={handleSubmit}
                  disabled={!userAnswer.trim() || isEvaluating}
                  className="bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/30 rounded-2xl h-14 px-8 font-black uppercase tracking-wider"
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
              <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-md pt-[env(safe-area-inset-top)] -mx-3 sm:mx-0 px-3 sm:px-0">
                <div className="max-w-4xl mx-auto px-4 sm:px-0">
                  <div className="pt-4 pb-3">
                    <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-foreground uppercase italic leading-none text-center">
                      Your <span className="text-orange-500">Result</span>
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
              <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-md pt-[env(safe-area-inset-top)] -mx-3 sm:mx-0 px-3 sm:px-0">
                <div className="max-w-4xl mx-auto px-4 sm:px-0">
                  <div className="pt-4 pb-3">
                    <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-foreground uppercase italic leading-none text-center">
                      Evaluation <span className="text-orange-500">Issue</span>
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
                          className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-black uppercase text-xs tracking-wider rounded-xl"
                        >
                          Try Again
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => navigate('/dashboard')}
                          className="flex-1 border-orange-300 text-orange-600 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400 font-bold rounded-xl"
                        >
                          Go to Dashboard
                        </Button>
                      </div>
                      <a 
                        href="mailto:hi@medmacs.app" 
                        className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-orange-500 transition-colors"
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
              <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-md pt-[env(safe-area-inset-top)] -mx-3 sm:mx-0 px-3 sm:px-0">
                <div className="max-w-4xl mx-auto px-4 sm:px-0">
                  <div className="pt-4 pb-3">
                    <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-foreground uppercase italic leading-none text-center">
                      Your <span className="text-orange-500">Result</span>
                    </h2>
                    <p className="text-muted-foreground text-sm font-medium mt-2 max-w-lg mx-auto text-center">
                      AI has evaluated your answer based on book references
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
                  <Card className={`border-2 shadow-lg ${
                    result.is_correct 
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/10' 
                      : 'border-red-500 bg-red-50 dark:bg-red-900/10'
                  }`}>
                <CardHeader className="pb-4">
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
                        Based on book references and AI analysis
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-orange-500" />
                      Your Answer (Corrected)
                    </h4>
                    <p className="text-muted-foreground leading-relaxed bg-white dark:bg-gray-900 rounded-lg p-3 border border-border">
                      {result.corrected_answer}
                    </p>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
                      <Bot className="w-4 h-4 text-orange-500" />
                      AI Explanation
                    </h4>
                    <p className="text-muted-foreground leading-relaxed bg-white dark:bg-gray-900 rounded-lg p-3 border border-border">
                      {result.explanation}
                    </p>
                  </div>

                  {referenceResults.length > 0 && (
                    <div>
                      <h4 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-orange-500" />
                        Book References
                      </h4>
                      <div className="flex gap-3 overflow-x-auto pb-2">
                        {referenceResults.map((ref: any, idx: number) => (
                          <div
                            key={idx}
                            className="min-w-[240px] max-w-[240px] p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 shrink-0"
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="secondary" className="text-[10px] font-medium px-2 py-0.5 bg-orange-200 dark:bg-orange-800 text-orange-800 dark:text-orange-200">
                                {ref.book || 'Reference'}
                              </Badge>
                              {ref.page && (
                                <span className="text-[10px] text-muted-foreground ml-auto">p. {ref.page}</span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                              "{ref.content}"
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
                </Card>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                  className="flex justify-end gap-4"
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
                    className="border-orange-300 text-orange-600 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400"
                  >
                    Try Again
                  </Button>
                  <Button
                    onClick={handleNext}
                    className="bg-orange-500 hover:bg-orange-600 text-white shadow-lg rounded-2xl h-12 px-8 font-black uppercase tracking-wider"
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
    </MCQPageLayout>
  );
};

export default SEQQuizPage;
