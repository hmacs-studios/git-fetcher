import { useState, useEffect, useLayoutEffect } from 'react';
import { Link, useLocation, useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Play, Clock, Zap, ArrowLeft, ArrowRight, CheckCircle, Target, Timer } from 'lucide-react';
import { fetchChapterById, fetchSubjectById, Subject, Chapter } from '@/utils/mcqData';
import { MCQPageLayout } from './MCQPageLayout';
import { useAuth } from '@/hooks/useAuth';
import { prepareMCQQuiz } from '@/features/mcq/quizBootstrap';

interface TimerPreset {
  value: number;
  label: string;
  sublabel: string;
  icon: React.ReactNode;
  description: string;
  accentColor: string;
  bgClass: string;
}

const timerPresets: TimerPreset[] = [
  {
    value: 0,
    label: 'No Timer',
    sublabel: 'Relaxed',
    icon: <CheckCircle className="w-5 h-5" />,
    description: 'Study at your own pace. No time pressure.',
    accentColor: 'text-slate-500',
    bgClass: 'bg-slate-500',
  },
  {
    value: 15,
    label: '15 sec',
    sublabel: 'Rapid Fire',
    icon: <Timer className="w-5 h-5" />,
    description: 'Quick recall. Ideal for high-yield facts.',
    accentColor: 'text-emerald-500',
    bgClass: 'bg-emerald-500',
  },
  {
    value: 30,
    label: '30 sec',
    sublabel: 'Focused',
    icon: <Timer className="w-5 h-5" />,
    description: 'Standard Medical exam timing per question.',
    accentColor: 'text-blue-500',
    bgClass: 'bg-blue-500',
  },
  {
    value: 45,
    label: '45 sec',
    sublabel: 'Balanced',
    icon: <Timer className="w-5 h-5" />,
    description: 'Comfortable pace with mild pressure.',
    accentColor: 'text-indigo-500',
    bgClass: 'bg-indigo-500',
  },
  {
    value: 60,
    label: '60 sec',
    sublabel: 'Deliberate',
    icon: <Timer className="w-5 h-5" />,
    description: 'Think carefully before selecting an answer.',
    accentColor: 'text-purple-500',
    bgClass: 'bg-purple-500',
  },
  {
    value: 90,
    label: '90 sec',
    sublabel: 'Extended',
    icon: <Timer className="w-5 h-5" />,
    description: 'Complex scenario-based questions.',
    accentColor: 'text-rose-500',
    bgClass: 'bg-rose-500',
  },
  {
    value: 120,
    label: '120 sec',
    sublabel: 'In-Depth',
    icon: <Timer className="w-5 h-5" />,
    description: 'Maximum time for complex case analysis.',
    accentColor: 'text-amber-500',
    bgClass: 'bg-amber-500',
  },
];

const MCQSettingsPage = () => {
  useLayoutEffect(() => {
    requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    });
  }, []);

  const { subjectId, chapterId } = useParams<{ subjectId: string; chapterId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = location.state as { subject?: Subject; chapter?: Chapter } | null;
  const [subject, setSubject] = useState<Subject | null>(() => routeState?.subject ?? null);
  const [chapter, setChapter] = useState<Chapter | null>(() => routeState?.chapter ?? null);
  const [loading, setLoading] = useState(() => !routeState?.subject || !routeState?.chapter);
  const [timePerQuestion, setTimePerQuestion] = useState(0);

  const selectedPreset = timerPresets.find(p => p.value === timePerQuestion) ?? timerPresets[0];

  useEffect(() => {
    const loadData = async () => {
      if (!subjectId || !chapterId) return;
      if (routeState?.subject?.id === subjectId && routeState?.chapter?.id === chapterId) {
        setLoading(false);
        return;
      }
      
      setLoading(true);
      
      const [subjectData, chapterData] = await Promise.all([
        fetchSubjectById(subjectId),
        fetchChapterById(chapterId, subjectId),
      ]);

      if (subjectData) setSubject(subjectData);
      if (chapterData) setChapter(chapterData);
      
      setLoading(false);
    };
    
    loadData();
  }, [subjectId, chapterId, routeState?.chapter, routeState?.subject]);

  useEffect(() => {
    if (loading || !chapterId || !user?.id) return;
    void Promise.all([
      import('@/pages/mcq/MCQQuizPage'),
      prepareMCQQuiz({
        chapterId,
        userId: user.id,
      }),
    ]).catch(() => undefined);
  }, [chapterId, loading, user?.id]);

  const handleStartQuiz = () => {
    if (subjectId && chapterId) {
      navigate(`/mcqs/quiz/${subjectId}/${chapterId}?timer=${timePerQuestion > 0}&time=${timePerQuestion}`, {
        state: { subject, chapter },
      });
    }
  };

  if (!loading && (!subject || !chapter)) {
    return (
      <MCQPageLayout backTo="/mcqs">
        <div className="text-center py-20">
          <p className="text-muted-foreground">Subject or chapter not found</p>
          <Button onClick={() => navigate('/mcqs')} className="mt-4">Go Back</Button>
        </div>
      </MCQPageLayout>
    );
  }

  return (
    <MCQPageLayout backTo={subjectId ? `/mcqs/chapter/${subjectId}` : '/mcqs'} showHeader={false} showBackButton={false} scrollable>
      <header className="absolute inset-x-0 top-0 z-50 border-b border-border/60 bg-background/88 px-4 pb-3 pt-[calc(env(safe-area-inset-top,0px)+10px)] backdrop-blur-2xl">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <Link
            to={subjectId ? `/mcqs/chapter/${subjectId}` : '/mcqs'}
            aria-label="Back to chapters"
            className="flex h-11 w-11 shrink-0 items-center justify-start active:scale-95"
          >
            <img src="/lovable-uploads/bf69a7f7-550a-45a1-8808-a02fb889f8c5.png" alt="Medmacs" className="h-9 w-9 object-contain" />
          </Link>

          <div className="min-w-0 text-center">
            <h1 className="brand-wordmark max-w-full truncate text-xl text-foreground">MCQs Practice</h1>
          </div>

          <Link
            to="/detailed-analytics"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-all hover:bg-primary hover:text-white active:scale-95"
            aria-label="Open MCQ practice analytics"
          >
            <Target className="h-5 w-5" />
          </Link>
        </div>
      </header>

      <div className="z-40 -mx-3 shrink-0 bg-gradient-to-b from-background via-background to-background/95 px-3 pt-[calc(env(safe-area-inset-top,0px)+84px)] sm:mx-0 sm:px-0">
        <div className="max-w-4xl mx-auto px-4 sm:px-0">
          <div className="py-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-['Bricolage_Grotesque'] text-2xl font-extrabold leading-tight tracking-[-0.035em] text-foreground sm:text-3xl">
                Test <span className="text-primary">Settings</span>
              </h2>
            </div>
            <div className="mt-2 flex flex-col items-center gap-1">
              <p className="text-muted-foreground text-sm font-bold uppercase tracking-widest">
                {subject?.name} • Chapter {chapter?.chapter_number}
              </p>
              <p className="text-muted-foreground/60 text-[10px] font-medium uppercase tracking-[0.2em]">
                Configure your practice session
              </p>
            </div>
          </div>
        </div>
        <div className="h-4 bg-gradient-to-b from-background/40 dark:from-background/10 to-transparent pointer-events-none" />
      </div>

      <div className="no-scrollbar mx-auto min-h-0 w-full max-w-4xl flex-1 overflow-y-auto px-4 pb-32 sm:px-0">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.05 }}
          className="relative overflow-hidden rounded-3xl border-2 border-primary/20 bg-primary/5 p-5 mb-8"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-[60px] -mr-16 -mt-16 pointer-events-none" />
          <div className="flex items-center gap-5 relative z-10">
            <div className="w-16 h-16 rounded-2xl bg-primary text-white flex items-center justify-center shadow-xl shadow-primary/30 text-2xl">
              {subject?.icon || <Zap className="w-7 h-7" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-1">Ready to Start</p>
              <h3 className="text-xl font-black uppercase italic tracking-normal leading-snug text-foreground">{subject?.name}</h3>
              <p className="text-muted-foreground text-xs font-medium leading-snug break-words">
                Chapter {chapter?.chapter_number} — {chapter?.name}
              </p>
            </div>
            <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center shrink-0">
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex items-center gap-2 mb-5"
        >
          <Clock className="w-4 h-4 text-primary" />
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Timer Per Question</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {timerPresets.map((preset, idx) => {
            const isSelected = preset.value === timePerQuestion;
            return (
              <motion.div
                key={preset.value}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 + idx * 0.04 }}
                whileHover={{ scale: 1.02, x: 5 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setTimePerQuestion(preset.value)}
                className={`group cursor-pointer relative overflow-hidden rounded-2xl border-2 p-4 transition-all duration-300 ${
                  isSelected
                    ? 'border-primary bg-primary/5 shadow-xl shadow-primary/10'
                    : 'border-border/40 bg-white/5 dark:bg-white/[0.035] backdrop-blur-xl hover:border-primary/30 hover:bg-primary/5'
                }`}
              >
                {isSelected && (
                  <div className="absolute top-0 right-0 w-24 h-24 bg-primary/20 blur-[50px] -mr-12 -mt-12 pointer-events-none" />
                )}

                <div className="flex items-center gap-4 relative z-10">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                    isSelected
                      ? 'bg-primary text-white shadow-lg shadow-primary/30'
                      : 'bg-muted/50 text-foreground/70'
                  }`}>
                    {preset.value === 0
                      ? <CheckCircle className="w-5 h-5" />
                      : <Timer className="w-5 h-5" />
                    }
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className={`text-sm font-black uppercase italic tracking-normal leading-snug transition-colors ${
                        isSelected ? 'text-primary' : 'text-foreground'
                      }`}>
                        {preset.label}
                      </h3>
                      {isSelected && (
                        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                      )}
                    </div>
                    <p className="text-muted-foreground text-xs font-medium leading-relaxed line-clamp-1">
                      {preset.description}
                    </p>
                  </div>

                  <div className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                    isSelected
                      ? 'bg-primary/10 text-primary'
                      : 'bg-muted/50 text-muted-foreground/60 opacity-0 group-hover:opacity-100'
                  }`}>
                    {preset.sublabel}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={selectedPreset.value}
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            className="flex items-center justify-center gap-3 py-3 px-5 rounded-2xl bg-muted/30 border border-border/40 mb-2"
          >
            <div className={`w-2 h-2 rounded-full ${selectedPreset.bgClass} ${selectedPreset.value > 0 ? 'animate-pulse' : ''}`} />
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">
              {selectedPreset.value === 0
                ? 'No time limit — study at your own pace'
                : `${selectedPreset.value}s per question — ${selectedPreset.sublabel} mode`
              }
            </p>
          </motion.div>
        </AnimatePresence>

        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="pointer-events-none fixed bottom-0 left-0 right-0 z-50 flex justify-center px-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-6"
        >
          <div className="w-full max-w-md pointer-events-auto">
            <Button
              onClick={handleStartQuiz}
              className="w-full bg-primary hover:bg-primary/90 text-white shadow-2xl shadow-primary/40 rounded-2xl h-16 uppercase font-black text-sm tracking-[0.2em] group transition-all"
              size="lg"
            >
              <Play className="w-5 h-5 mr-2" />
              Start Quiz
              <motion.div
                animate={{ x: [0, 5, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="ml-2"
              >
                <ArrowRight className="w-5 h-5" />
              </motion.div>
            </Button>
          </div>
        </motion.div>

      </div>
      <footer className="shrink-0 py-2 text-center opacity-40">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">© 2026 Medmacs • MCQ Practice System</p>
      </footer>
    </MCQPageLayout>
  );
};

export default MCQSettingsPage;
