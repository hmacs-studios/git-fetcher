import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ArrowRight, Loader2, ChevronLeft, RotateCcw, History, Clock, BookOpen, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import Seo from "@/components/Seo";
import UpgradeAccountModal from "@/components/UpgradeAccountModal";
import { motion, AnimatePresence } from "framer-motion";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { fetchSubjects } from "@/utils/mcqData";
import { fetchCloudContent } from "@/utils/cloudContent";
import { CollaborateModal } from "@/components/CollaborateModal";
import { supabase } from "@/integrations/supabase/client";
import bookAnimationData from '@/assets/animations/Book.json';
import { LottiePlayer } from "@/components/LottiePlayer";
import { Badge } from "@/components/ui/badge";

interface MCQ {
  id: string;
  question: string;
  options: string[];
  correct_answer: string;
  explanation?: string;
  chapter_id: string;
}

interface Subject {
  id: string;
  name: string;
  year?: string;
  icon?: string;
  color?: string;
  institutes?: string[] | null;
}

interface FLPSessionData {
  shuffledMcqs: any[];
  currentQuestionIndex: number;
  userAnswers: Record<string, string | null>;
  totalTimeLeft: number;
  subjectName?: string;
  sessionId?: string;
  savedAt: number;
}

const FLP_STORAGE_KEY = 'flp_session';

const FLP = () => {
  const { user, loading: isAuthLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Wizard state
  const [wizardStep, setWizardStep] = useState(0); // 0=intro, 1=mcq count, 2=subject
  const [selectedMcqCount, setSelectedMcqCount] = useState<number | null>(null);
  const [isFetchingMcqs, setIsFetchingMcqs] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [selectedSubjectName, setSelectedSubjectName] = useState('');

  // Subject loading
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [showCollaborateModal, setShowCollaborateModal] = useState(false);

  const [savedSession, setSavedSession] = useState<FLPSessionData | null>(null);
  const [showResumeDialog, setShowResumeDialog] = useState(false);

  // DB Config State
  const [bypassSubject, setBypassSubject] = useState(false);
  const [customMcqCounts, setCustomMcqCounts] = useState<number[]>([100, 50, 30]);
  const [loadingConfig, setLoadingConfig] = useState(true);

  // Fetch FLP configuration based on user's institute
  useEffect(() => {
    if (!user) return;
    const fetchFlpConfig = async () => {
      setLoadingConfig(true);
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('institute')
          .eq('id', user.id)
          .maybeSingle();
        
        if (profile?.institute) {
          const { data: inst } = await supabase
            .from('institutes')
            .select('flp_config')
            .eq('code', profile.institute)
            .maybeSingle();
            
          if (inst?.flp_config) {
            const config = inst.flp_config as any;
            if (typeof config.bypass_subject === 'boolean') {
              setBypassSubject(config.bypass_subject);
            }
            if (Array.isArray(config.mcq_counts) && config.mcq_counts.length > 0) {
              setCustomMcqCounts(config.mcq_counts);
            }
          }
        }
      } catch (err) {
        console.error("Error loading FLP config", err);
      } finally {
        setLoadingConfig(false);
      }
    };
    fetchFlpConfig();
  }, [user]);

  useEffect(() => {
    if (user && wizardStep === 0) {
      try {
        const saved = localStorage.getItem(FLP_STORAGE_KEY);
        if (saved) {
          const sessionData: FLPSessionData = JSON.parse(saved);
          const hoursSinceSaved = (Date.now() - sessionData.savedAt) / (1000 * 60 * 60);
          if (hoursSinceSaved < 24) {
            setSavedSession(sessionData);
            setShowResumeDialog(true);
          } else {
            localStorage.removeItem(FLP_STORAGE_KEY);
          }
        }
      } catch (e) {
        console.error("Failed to load FLP session", e);
        localStorage.removeItem(FLP_STORAGE_KEY);
      }
    }
  }, [user, wizardStep]);

  // Fetching messages
  const fetchMessages = [
    "Hold tight, preparing your test...",
    "This will only take a moment...",
    "Almost there, stay ready!",
    "Nearly done, loading questions!",
  ];
  const [msgIdx, setMsgIdx] = useState(0);

  useEffect(() => {
    if (isFetchingMcqs) {
      const interval = setInterval(() => setMsgIdx((p) => (p + 1) % fetchMessages.length), 4000);
      return () => clearInterval(interval);
    }
  }, [isFetchingMcqs]);

  // Fetch subjects when reaching step 2
  useEffect(() => {
    if (wizardStep !== 2 || !user || bypassSubject) return;
    const loadSubjects = async () => {
      setLoadingSubjects(true);
      try {
        const data = await fetchSubjects();
        setSubjects(data);
      } catch (err) {
        toast({ title: "Failed to load subjects", variant: "destructive" });
      } finally {
        setLoadingSubjects(false);
      }
    };
    loadSubjects();
  }, [wizardStep, user, toast, bypassSubject]);

  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const selectBalancedMcqs = (allMcqs: MCQ[], targetCount: number): MCQ[] => {
    if (allMcqs.length <= targetCount) return shuffleArray(allMcqs);
    const byChapter: Record<string, MCQ[]> = {};
    allMcqs.forEach(m => {
      if (!byChapter[m.chapter_id]) byChapter[m.chapter_id] = [];
      byChapter[m.chapter_id].push(m);
    });
    const chapters = Object.keys(byChapter);
    const perChapter = Math.max(1, Math.floor(targetCount / chapters.length));
    let selected: MCQ[] = [];
    const remainingPool: MCQ[] = [];

    chapters.forEach(ch => {
      const shuffledCh = shuffleArray(byChapter[ch]);
      selected.push(...shuffledCh.slice(0, perChapter));
      remainingPool.push(...shuffledCh.slice(perChapter));
    });

    if (selected.length < targetCount) {
      const extraNeeded = targetCount - selected.length;
      selected.push(...shuffleArray(remainingPool).slice(0, extraNeeded));
    }

    return shuffleArray(selected).slice(0, targetCount);
  };

  const handleResumeSession = () => {
    if (!savedSession) return;
    setShowResumeDialog(false);
    navigate('/flp/test', {
      state: {
        mcqs: savedSession.shuffledMcqs,
        subjectName: savedSession.subjectName,
        sessionId: savedSession.sessionId,
      }
    });
  };

  const handleStartFresh = () => {
    try {
      localStorage.removeItem(FLP_STORAGE_KEY);
    } catch (e) {
      console.error("Failed to clear FLP session", e);
    }
    setSavedSession(null);
    setShowResumeDialog(false);
  };

  const handleStartTest = async () => {
    if (!user || selectedMcqCount === null) return;
    if (!bypassSubject && !selectedSubject) return;
    setIsFetchingMcqs(true);
    try {
      // Check limits and register session in database first
      const { data: sessionResult, error: sessionError } = await supabase.rpc(
        'initialize_flp_session',
        {
          p_subject_id: selectedSubject || null,
          p_mcq_count: selectedMcqCount,
          p_test_config_id: 'flp_weekly_test_id',
        }
      );

      if (sessionError) throw sessionError;

      const result = sessionResult as { allowed: boolean; error?: string; session_id?: string; resumed?: boolean } | null;
      if (result && !result.allowed) {
        setShowUpgradeModal(true);
        setIsFetchingMcqs(false);
        return;
      }

      console.log("[FLP handleStartTest] Starting MCQ fetch:", { bypassSubject, selectedSubject, selectedMcqCount });
      let mcqsData: MCQ[] = [];
      let subjectName = '';

      if (bypassSubject || !selectedSubject) {
        subjectName = 'All Subjects';
        const params: Record<string, string | number> = { limit: selectedMcqCount };
        console.log("[FLP handleStartTest] Fetching flp-questions for All Subjects:", params);
        mcqsData = (await fetchCloudContent<MCQ[]>('flp-questions', params)) || [];
      } else {
        const selectedSubjectRecord = subjects.find(subject => subject.id === selectedSubject);
        subjectName = selectedSubjectRecord?.name || '';
        const params: Record<string, string | number> = { subjectId: selectedSubject!, limit: selectedMcqCount };
        console.log("[FLP handleStartTest] Fetching flp-questions for specific subject:", params);
        mcqsData = (await fetchCloudContent<MCQ[]>('flp-questions', params)) || [];
      }

      console.log("[FLP handleStartTest] MCQs returned count:", mcqsData?.length, mcqsData);

      if (!mcqsData || mcqsData.length === 0) { console.warn("[FLP handleStartTest] No MCQs found"); toast({ title: "No MCQs Found" }); setIsFetchingMcqs(false); return; }
      if (mcqsData.length < selectedMcqCount) { console.warn(`[FLP handleStartTest] Not enough questions: got ${mcqsData.length}, needed ${selectedMcqCount}`); toast({ title: "Not Enough Questions", description: `Only ${mcqsData.length} available.` }); setIsFetchingMcqs(false); return; }
      
      const selectedMcqs = bypassSubject
        ? selectBalancedMcqs(mcqsData as MCQ[], selectedMcqCount)
        : shuffleArray(mcqsData as MCQ[]).slice(0, selectedMcqCount);

      console.log("[FLP handleStartTest] Selected balanced MCQs:", selectedMcqs?.length);
      navigate('/flp/test', { state: { mcqs: selectedMcqs, subjectName, sessionId: result?.session_id } });
    } catch (err) {
      console.error("[FLP handleStartTest] Error preparing test:", err);
      toast({ title: "Error", description: (err as any)?.message || "Failed to prepare test.", variant: "destructive" });
    } finally { setIsFetchingMcqs(false); }
  };

  if (isAuthLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">Loading FLP...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-slate-50 dark:bg-slate-950 font-['Inter']">
      <Seo title="Full-Length Papers (FLP)" description="Take comprehensive timed exams matching your syllabus." canonical="https://medmacs.app/flp" />

      <UpgradeAccountModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} onUpgradeClick={() => { setShowUpgradeModal(false); navigate("/pricing"); }} />

      <Sheet open={showResumeDialog} onOpenChange={setShowResumeDialog}>
        <SheetContent side="bottom" className="mx-auto max-h-[88dvh] overflow-y-auto rounded-t-[2.5rem] border-x border-t border-border/40 bg-background/95 p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] backdrop-blur-2xl sm:max-w-lg z-[300]" overlayClassName="z-[300]">
          <SheetHeader className="text-left">
            <SheetTitle className="text-2xl font-black italic tracking-tight text-slate-950 dark:text-white">Resume <span className="text-teal-500">Session?</span></SheetTitle>
            <SheetDescription className="text-muted-foreground font-medium py-2">
              You have an active FLP test session saved from earlier ({savedSession?.shuffledMcqs?.length || 0} questions). Would you like to resume where you left off or start fresh?
            </SheetDescription>
          </SheetHeader>
          <div className="flex gap-3 mt-6">
            <Button onClick={handleStartFresh} variant="outline" className="flex-1 rounded-2xl h-12 font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white border-transparent uppercase text-xs tracking-widest">
              <RotateCcw className="w-4 h-4 mr-2" /> Start Fresh
            </Button>
            <Button onClick={handleResumeSession} className="flex-1 rounded-2xl h-12 font-black bg-gradient-to-r from-[#2dd4bf] to-[#0ea5e9] text-white shadow-lg shadow-[#0ea5e9]/20 uppercase text-xs tracking-widest">
              <ArrowRight className="w-4 h-4 mr-2" /> Resume
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Fetching overlay - Bottom Pinned Sheet Modal */}
      <AnimatePresence>
        {isFetchingMcqs && (
          <Sheet open={true} onOpenChange={() => {}}>
            <SheetContent side="bottom" className="flex max-h-[85dvh] flex-col overflow-hidden rounded-t-[2.5rem] border-x border-t border-primary/20 bg-background/95 p-6 pb-[calc(2rem+env(safe-area-inset-bottom))] backdrop-blur-2xl z-[100] [&>button]:hidden animate-in slide-in-from-bottom duration-300">
              <SheetHeader className="mx-auto w-full max-w-md text-center">
                <div className="mx-auto mb-2 flex h-24 w-24 items-center justify-center">
                  <LottiePlayer
                    animationData={bookAnimationData}
                    loop={true}
                    autoplay={true}
                    className="w-full h-full"
                  />
                </div>
                <div className="flex items-center justify-center gap-2 mb-1">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                  </span>
                  <p className="text-[11px] font-black uppercase tracking-[0.24em] text-primary">Generating Exam</p>
                </div>
                <SheetTitle className="text-2xl font-extrabold tracking-tight brand-syne">
                  {fetchMessages[msgIdx]}
                </SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground">
                  Setting up your Full-Length Paper questions, timer, and options.
                </SheetDescription>
              </SheetHeader>

              {/* Full FLP Details Card */}
              <div className="mx-auto mt-5 w-full max-w-md rounded-2xl border border-border/40 bg-muted/40 p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-border/30">
                  <span className="text-xs font-semibold text-muted-foreground">Test Type</span>
                  <Badge variant="secondary" className="bg-primary/10 text-primary border-0 font-bold text-[11px]">
                    Full-Length Paper
                  </Badge>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center pt-1">
                  <div className="rounded-xl bg-background/80 p-2.5 border border-border/30">
                    <FileText className="w-4 h-4 mx-auto mb-1 text-primary" />
                    <p className="text-xs font-black text-foreground">{selectedMcqCount || 0}</p>
                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Questions</p>
                  </div>
                  <div className="rounded-xl bg-background/80 p-2.5 border border-border/30">
                    <Clock className="w-4 h-4 mx-auto mb-1 text-primary" />
                    <p className="text-xs font-black text-foreground">{selectedMcqCount ? selectedMcqCount : 0} min</p>
                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Duration</p>
                  </div>
                  <div className="rounded-xl bg-background/80 p-2.5 border border-border/30">
                    <BookOpen className="w-4 h-4 mx-auto mb-1 text-primary" />
                    <p className="text-xs font-black text-foreground truncate">{selectedSubject ? (subjects.find(s => s.id === selectedSubject)?.name || 'Subject') : 'All Subjects'}</p>
                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Scope</p>
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        )}
      </AnimatePresence>

      <main
        className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 pt-[max(18px,env(safe-area-inset-top))]"
      >
        <header className="flex items-center justify-between w-full shrink-0 mb-2">
          <div className="flex items-center gap-2.5">
            <span className="font-['Syne'] text-lg font-extrabold tracking-[-.045em]">
              <span className="bg-gradient-to-r from-[#2dd4bf] to-[#0ea5e9] bg-clip-text text-transparent">Medmacs</span>
              <span className="text-slate-950 dark:text-white">.app</span>
            </span>
          </div>
          <button
            onClick={() => {
              navigate('/dashboard');
            }}
            className="cursor-pointer rounded-full px-3 py-2 text-xs font-bold text-slate-400 dark:text-slate-500 transition-colors hover:text-slate-950 dark:hover:text-white flex items-center gap-0.5"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
        </header>

        <AnimatePresence mode="wait">
          <motion.section
            key={wizardStep}
            initial={{ opacity: 0, x: 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -28 }}
            transition={{ duration: .38, ease: [0.22, 1, 0.36, 1] }}
            className="relative flex min-h-0 flex-1 flex-col"
          >
            {/* STEP 0: Intro */}
            {wizardStep === 0 && (
              <div className="relative flex min-w-0 flex-1 flex-col items-center text-center pb-36">
                <div className="mx-auto max-w-sm px-2 pt-4 text-center">
                  <motion.h1
                    initial={{ opacity: 0, y: 18, filter: "blur(8px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    className="font-['Syne'] text-[clamp(1.7rem,6.4vw,2.2rem)] font-extrabold leading-[1.02] tracking-[-.05em] text-slate-950 dark:text-white"
                  >
                    Full-Length Papers
                  </motion.h1>
                  <motion.p
                    initial={{ opacity: 0, y: 14, filter: "blur(6px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    className="mx-auto mt-3 max-w-xs text-sm leading-6 text-slate-500 dark:text-slate-400"
                  >
                    Attempt complete timed exams covering your year's material. Analyze performance and study smarter.
                  </motion.p>
                </div>

                <div className="relative mx-auto mt-4 min-h-0 w-full max-w-sm flex-1 overflow-hidden flex items-center justify-center">
                  <img
                    src="/mascots/Mascot1.png"
                    alt="Dr Ahroid Intro"
                    className="h-52 sm:h-60 w-auto object-contain drop-shadow-2xl animate-[float_4s_ease-in-out_infinite]"
                  />
                </div>

                <div
                  className="fixed bottom-0 left-0 right-0 z-20 bg-background/95 backdrop-blur-xl border-t border-border/40 px-5 pt-3"
                  style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))' }}
                >
                  <div className="max-w-md mx-auto flex flex-col gap-2.5">
                    {user ? (
                      <>
                        <button
                          onClick={() => navigate('/flp-result')}
                          className="w-full cursor-pointer rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-3.5 text-sm font-bold text-slate-700 dark:text-slate-300 shadow-sm transition-transform active:scale-95 flex items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                          <History className="w-4 h-4 text-slate-500" /> View Past Attempts
                        </button>
                        <button
                          onClick={() => setWizardStep(1)}
                          className="w-full cursor-pointer rounded-2xl bg-gradient-to-r from-[#2dd4bf] to-[#0ea5e9] px-10 py-3.5 text-base font-extrabold text-white shadow-[0_12px_32px_rgba(14,165,233,.25)] transition-transform hover:scale-[1.01] active:scale-95 focus-visible:outline-none"
                        >
                          Get Started
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => setShowUpgradeModal(true)}
                          className="w-full py-3.5 bg-gradient-to-r from-[#2dd4bf] to-[#0ea5e9] text-white font-bold rounded-2xl shadow-lg active:scale-95 transition-transform text-base"
                        >
                          Upgrade Plan
                        </button>
                        <button
                          onClick={() => navigate("/dashboard")}
                          className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-3.5 text-sm font-semibold text-slate-950 dark:text-white shadow-sm transition-transform active:scale-95"
                        >
                          Dashboard
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 1: Choose Question Count */}
            {wizardStep === 1 && (
              <div className="relative flex min-w-0 flex-1 flex-col pt-4 pb-12">
                <button
                  onClick={() => setWizardStep(0)}
                  className="mb-4 flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-slate-900 dark:hover:text-white w-fit"
                >
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
                <h2 className="font-['Syne'] text-2xl font-extrabold text-slate-950 dark:text-white tracking-tight">
                  Choose Question Count
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Select how many questions you want in this full-length exam.
                </p>

                <div className="mt-6 flex flex-col gap-3.5">
                  {loadingConfig ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin text-[#2dd4bf]" />
                    </div>
                  ) : (
                    customMcqCounts.map((count) => (
                      <motion.button
                        key={count}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          setSelectedMcqCount(count);
                          if (bypassSubject) {
                            // If institute bypasses subject step, start test immediately
                            handleStartTest();
                          } else {
                            setWizardStep(2);
                          }
                        }}
                        className={`w-full cursor-pointer rounded-2xl border p-5 text-left transition-all flex items-center justify-between shadow-sm ${
                          selectedMcqCount === count
                            ? 'border-[#2dd4bf] bg-[#2dd4bf]/10 shadow-md ring-2 ring-[#2dd4bf]/30'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <div>
                          <p className="text-lg font-black text-slate-950 dark:text-white">{count} MCQs</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">~{count} minutes allocated</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[#2dd4bf]">Select</span>
                          <ArrowRight className="w-5 h-5 text-[#2dd4bf]" />
                        </div>
                      </motion.button>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* STEP 2: Choose Subject */}
            {wizardStep === 2 && !bypassSubject && (
              <div className="relative flex min-w-0 flex-1 flex-col pt-6 pb-28">
                <button
                  onClick={() => setWizardStep(1)}
                  className="mb-4 flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
                <h2 className="font-['Syne'] text-2xl font-extrabold text-slate-950 dark:text-white tracking-tight">
                  Select Subject
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Pick a specific subject or choose All Subjects for a mixed paper.
                </p>

                <div className="mt-6 flex flex-col gap-3 overflow-y-auto max-h-[calc(100vh-280px)] pr-1">
                  {/* All Subjects Option */}
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setSelectedSubject(null);
                      setSelectedSubjectName('All Subjects');
                    }}
                    className={`w-full cursor-pointer rounded-2xl border p-4 text-left transition-all flex items-center justify-between ${
                      selectedSubject === null
                        ? 'border-[#2dd4bf] bg-[#2dd4bf]/10 shadow-md'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <p className="text-base font-extrabold text-slate-950 dark:text-white">All Subjects (Mixed)</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Comprehensive paper covering full syllabus</p>
                    </div>
                  </motion.button>

                  {loadingSubjects ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-[#2dd4bf]" />
                    </div>
                  ) : (
                    subjects.map((subj) => (
                      <motion.button
                        key={subj.id}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          setSelectedSubject(subj.id);
                          setSelectedSubjectName(subj.name);
                        }}
                        className={`w-full cursor-pointer rounded-2xl border p-4 text-left transition-all flex items-center justify-between ${
                          selectedSubject === subj.id
                            ? 'border-[#2dd4bf] bg-[#2dd4bf]/10 shadow-md'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
                        }`}
                      >
                        <p className="text-sm font-bold text-slate-950 dark:text-white">{subj.name}</p>
                      </motion.button>
                    ))
                  )}

                  {/* Collaborator CTA */}
                  <div className="mt-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/50 p-4 text-center">
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">Want to add subjects or contribute questions?</p>
                    <Button onClick={() => setShowCollaborateModal(true)} variant="outline" className="border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-900 rounded-xl">
                      Become a Collaborator
                    </Button>
                  </div>
                  <CollaborateModal open={showCollaborateModal} onOpenChange={setShowCollaborateModal} />
                </div>

                <div
                  className="fixed bottom-0 left-0 right-0 z-20 bg-background/95 backdrop-blur-xl border-t border-border/40 px-5 pt-3"
                  style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))' }}
                >
                  <div className="max-w-md mx-auto">
                    <motion.button
                      whileTap={{ scale: 0.96 }}
                      onClick={handleStartTest}
                      disabled={isFetchingMcqs}
                      className="w-full cursor-pointer rounded-2xl bg-gradient-to-r from-[#2dd4bf] to-[#0ea5e9] py-4 text-base font-extrabold text-white shadow-lg active:scale-95 disabled:opacity-50"
                    >
                      {isFetchingMcqs ? (
                        <span className="flex items-center justify-center gap-2">
                          <Loader2 className="w-5 h-5 animate-spin" /> Starting...
                        </span>
                      ) : (
                        "Start FLP Test"
                      )}
                    </motion.button>
                  </div>
                </div>
              </div>
            )}
          </motion.section>
        </AnimatePresence>
      </main>
    </div>
  );
};

export default FLP;
