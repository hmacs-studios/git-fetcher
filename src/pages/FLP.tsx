import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ArrowRight, ChevronLeft, ChevronRight, History, Clock, BookOpen, FileText } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useFlpAttempts } from "@/hooks/useFlpAttempts";
import { useToast } from "@/hooks/use-toast";
import Seo from "@/components/Seo";
import UpgradeAccountModal from "@/components/UpgradeAccountModal";
import { motion, AnimatePresence } from "framer-motion";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { discardFlpDraft, getActiveFlp, startFlp, type FlpDraft } from "@/utils/flpSession";
import { fetchFlpContent } from "@/utils/flpContent";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";

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

const FLP = () => {
  const { user, loading: isAuthLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Wizard state
  const [wizardStep, setWizardStep] = useState(0); // 0=intro, 1=mcq count, 2=subject
  const attempts = useFlpAttempts(user?.id, wizardStep === 0);
  const [selectedMcqCount, setSelectedMcqCount] = useState<number | null>(null);
  const [isFetchingMcqs, setIsFetchingMcqs] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [loadedQuestions, setLoadedQuestions] = useState(0);
  const startingRef = useRef(false);

  // Subject loading
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [subjectsError, setSubjectsError] = useState<string | null>(null);
  const [subjectRetry, setSubjectRetry] = useState(0);

  const [savedSession, setSavedSession] = useState<FlpDraft | null>(null);
  const [checkingSession, setCheckingSession] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [sessionRetry, setSessionRetry] = useState(0);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [discardError, setDiscardError] = useState<string | null>(null);

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
    if (!user?.id || wizardStep !== 0) return;
    let active = true;
    setCheckingSession(true);
    setSessionError(null);
    setSavedSession(null);
    getActiveFlp().then(draft => {
      if (active) setSavedSession(draft);
    }).catch(error => {
      if (active) setSessionError(error instanceof Error ? error.message : "Could not check your current paper.");
    }).finally(() => {
      if (active) setCheckingSession(false);
    });
    return () => { active = false; };
  }, [user?.id, wizardStep, sessionRetry]);

  useEffect(() => {
    if (wizardStep !== 2 || !user?.id || bypassSubject) return;
    const controller = new AbortController();
    setLoadingSubjects(true);
    setSubjectsError(null);
    setSelectedSubject(null);

    fetchFlpContent<Subject>("/subjects", { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) setSubjects(data);
    }).catch(error => {
      if (!controller.signal.aborted) setSubjectsError(error instanceof Error ? error.message : "Could not load subjects.");
    }).finally(() => {
      if (!controller.signal.aborted) setLoadingSubjects(false);
    });

    return () => controller.abort();
  }, [wizardStep, user?.id, bypassSubject, subjectRetry]);

  const openDraft = (draft: FlpDraft) => navigate('/flp/test', { state: { draft } });

  const handleDiscard = async () => {
    if (!savedSession || discarding) return;
    setDiscarding(true);
    setDiscardError(null);
    try {
      await discardFlpDraft(savedSession.sessionId);
      setSavedSession(null);
      setConfirmDiscard(false);
      setSessionRetry(retry => retry + 1);
      toast({ title: "Unfinished test discarded" });
    } catch (error) {
      setDiscardError(error instanceof Error ? error.message : "Could not discard this test. Please try again.");
    } finally {
      setDiscarding(false);
    }
  };

  const handleStartTest = async (count: number, subjectId: string | null) => {
    if (!user || startingRef.current || (!bypassSubject && !subjectId)) return;
    startingRef.current = true;
    setLoadedQuestions(0);
    setIsFetchingMcqs(true);

    try {
      const active = await getActiveFlp();
      if (active) {
        openDraft(active);
        return;
      }

      const params = new URLSearchParams({ limit: String(count) });
      if (subjectId) params.set("subjectId", subjectId);
      const mcqs = await fetchFlpContent<MCQ>("", {
        params,
        onProgress: loaded => setLoadedQuestions(Math.min(count, loaded)),
      });
      if (mcqs.length !== count) {
        throw new Error(`The server returned ${mcqs.length} of ${count} questions. Please try again.`);
      }

      const subjectName = subjectId ? subjects.find(subject => subject.id === subjectId)?.name : "All Subjects";
      openDraft(await startFlp(mcqs, subjectId, subjectName));
    } catch (error) {
      console.error("Error preparing FLP:", error);
      toast({
        title: "Could not start your FLP",
        description: (error as { message?: string })?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      startingRef.current = false;
      setIsFetchingMcqs(false);
    }
  };

  const count = selectedMcqCount ?? 0;
  const back = () => wizardStep === 0 ? navigate('/dashboard') : setWizardStep(wizardStep - 1);
  const choiceClass = (selected: boolean) =>
    `flex min-h-16 w-full items-center justify-between gap-4 rounded-2xl border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected
      ? 'border-primary bg-primary/10'
      : 'border-border bg-card hover:bg-muted/50'}`;

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <Seo title="Full-Length Papers (FLP)" description="Take comprehensive timed exams matching your syllabus." canonical="https://medmacs.app/flp" />
      <UpgradeAccountModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} onUpgradeClick={() => {
        setShowUpgradeModal(false);
        navigate("/pricing");
      }} />

      <AlertDialog open={confirmDiscard} onOpenChange={open => {
        if (!discarding) setConfirmDiscard(open);
      }}>
        <AlertDialogContent className="pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
          <AlertDialogHeader>
            <AlertDialogTitle>Discard this unfinished test?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the paper and its saved answers. You can start a new test afterward.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {discardError && <p role="alert" className="text-sm text-destructive">{discardError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={discarding}>Keep test</AlertDialogCancel>
            <AlertDialogAction disabled={discarding} onClick={event => {
              event.preventDefault();
              void handleDiscard();
            }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {discarding ? "Discarding…" : "Discard test"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Sheet open={isFetchingMcqs}>
        <SheetContent side="bottom" overlayClassName="z-[200]" className="z-[201] mx-auto rounded-t-3xl border-border bg-card pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:max-w-lg [&>button]:hidden">
          <SheetHeader className="text-left">
            <SheetTitle>{loadedQuestions === count && count > 0 ? "Assembling your paper" : "Preparing your paper"}</SheetTitle>
            <SheetDescription aria-live="polite" className="tabular-nums">
              {loadedQuestions} of {count} questions loaded
            </SheetDescription>
          </SheetHeader>
          <Progress aria-label="FLP questions loaded" value={count ? loadedQuestions / count * 100 : 0} className="mt-4 h-2" />
          <div aria-hidden="true" className="mt-5 space-y-2">
            <Skeleton className="h-4 w-3/4 motion-reduce:animate-none" />
            <Skeleton className="h-4 w-1/2 motion-reduce:animate-none" />
          </div>
        </SheetContent>
      </Sheet>

      <main className="mx-auto w-full max-w-2xl px-4 pb-8 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
        <header className="mb-6 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <Button variant="ghost" size="sm" onClick={back} className="justify-self-start rounded-xl">
            <ChevronLeft className="mr-1 h-4 w-4" /> Back
          </Button>
          <span className="brand-wordmark text-xl">Medmacs</span>
        </header>

        {isAuthLoading ? (
          <SettingsSkeleton label="Loading FLP settings" />
        ) : (
          <AnimatePresence mode="wait">
            <motion.section key={wizardStep} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }} className="space-y-5">
              <div className="rounded-3xl border border-border bg-card p-5 sm:p-7">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <FileText className="h-5 w-5" />
                </div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {wizardStep === 0 ? "Timed practice" : wizardStep === 1 ? "Paper setup · Length" : "Paper setup · Subject"}
                </p>
                <h1 className="brand-display text-2xl font-extrabold tracking-tight sm:text-3xl">
                  {wizardStep === 0 ? "Full-Length Papers" : wizardStep === 1 ? "Choose paper length" : "Choose a subject"}
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  {wizardStep === 0 ? "Take a timed paper from your syllabus and review your results after submitting."
                    : wizardStep === 1 ? "You’ll have one minute per question."
                    : `${count} questions · ${count} minutes. Select a subject to continue.`}
                </p>
              </div>

              {wizardStep === 0 && (
                <>
                  {sessionError && (
                    <p role="alert" className="text-sm text-muted-foreground">{sessionError}</p>
                  )}
                  <Button disabled={checkingSession} onClick={() => {
                    if (!user) navigate('/login');
                    else if (sessionError) setSessionRetry(retry => retry + 1);
                    else if (savedSession) openDraft(savedSession);
                    else setWizardStep(1);
                  }} className="w-full rounded-xl">
                    {!user ? "Sign in" : checkingSession ? "Checking your paper…" : sessionError
                      ? "Retry session check" : savedSession ? "Resume unsubmitted test" : "Start new test"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  {user && savedSession && (
                    <Button variant="outline" className="w-full rounded-xl text-destructive" onClick={() => {
                      setDiscardError(null);
                      setConfirmDiscard(true);
                    }}>
                      Discard unfinished test
                    </Button>
                  )}
                  {user && (
                    <section aria-labelledby="flp-attempts-title" className="space-y-3">
                      <h2 id="flp-attempts-title" className="flex items-center gap-2 text-base font-bold">
                        <History className="h-4 w-4 text-primary" aria-hidden="true" /> Past attempts
                      </h2>
                      {attempts.isLoading ? (
                        <SettingsSkeleton label="Loading past attempts" />
                      ) : attempts.isError ? (
                        <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
                          <p role="alert" className="text-sm text-muted-foreground">Could not load your past attempts.</p>
                          <Button variant="outline" size="sm" onClick={() => void attempts.refetch()}>Try again</Button>
                        </div>
                      ) : attempts.data?.length ? (
                        <ul className="space-y-2">
                          {attempts.data.map(attempt => (
                            <li key={attempt.id}>
                              <Link to={`/results/flp/${attempt.id}`} className={choiceClass(false)}>
                                <span>
                                  <span className="block text-sm font-bold">Scored {attempt.score} / {attempt.total_questions}</span>
                                  <time dateTime={attempt.completed_at} className="mt-1 block text-xs text-muted-foreground">
                                    {new Date(attempt.completed_at).toLocaleString(undefined, {
                                      dateStyle: "medium",
                                      timeStyle: "short",
                                    })}
                                  </time>
                                </span>
                                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                              </Link>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
                          Completed papers will appear here.
                        </p>
                      )}
                    </section>
                  )}
                </>
              )}

              {wizardStep === 1 && (
                loadingConfig ? <SettingsSkeleton label="Loading paper lengths" /> : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {customMcqCounts.map(length => (
                      <button type="button" key={length} className={choiceClass(count === length)} onClick={() => {
                        setSelectedMcqCount(length);
                        if (bypassSubject) void handleStartTest(length, null);
                        else {
                          setLoadingSubjects(true);
                          setWizardStep(2);
                        }
                      }}>
                        <span>
                          <span className="block font-bold">{length} questions</span>
                          <span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3.5 w-3.5" /> {length} minutes
                          </span>
                        </span>
                        <ArrowRight className="h-4 w-4 shrink-0 text-primary" />
                      </button>
                    ))}
                  </div>
                )
              )}

              {wizardStep === 2 && (
                loadingSubjects ? <SettingsSkeleton label="Loading subjects" /> : subjectsError ? (
                  <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
                    <p role="alert" className="text-sm text-muted-foreground">{subjectsError}</p>
                    <Button variant="outline" onClick={() => setSubjectRetry(retry => retry + 1)}>Try again</Button>
                  </div>
                ) : subjects.length === 0 ? (
                  <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
                    No FLP subjects are available for your current study path.
                  </p>
                ) : (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {subjects.map(subject => (
                        <button type="button" key={subject.id} className={choiceClass(selectedSubject === subject.id)}
                          aria-pressed={selectedSubject === subject.id} onClick={() => setSelectedSubject(subject.id)}>
                          <span className="flex min-w-0 items-center gap-3 text-sm font-semibold">
                            <BookOpen className="h-4 w-4 shrink-0 text-primary" /> {subject.name}
                          </span>
                        </button>
                      ))}
                    </div>
                    <Button className="w-full rounded-xl sm:w-auto" disabled={!selectedSubject || isFetchingMcqs}
                      onClick={() => void handleStartTest(count, selectedSubject)}>
                      Start paper <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </>
                )
              )}
            </motion.section>
          </AnimatePresence>
        )}
      </main>
    </div>
  );
};

function SettingsSkeleton({ label }: { label: string }) {
  return (
    <div role="status" className="grid gap-3 sm:grid-cols-2">
      <span className="sr-only">{label}</span>
      {[1, 2, 3, 4].map(row => (
        <Skeleton aria-hidden="true" key={row} className="h-16 rounded-2xl motion-reduce:animate-none" />
      ))}
    </div>
  );
}

export default FLP;
