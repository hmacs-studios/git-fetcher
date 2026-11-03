import { useState, useEffect, useLayoutEffect } from 'react';
import { Link, useLocation, useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Play, Clock, Zap, ArrowLeft, ArrowRight, CheckCircle, Target, Timer } from 'lucide-react';
import { fetchChapterById, fetchSubjectById, Subject, Chapter } from '@/utils/mcqData';
import { MCQPageLayout } from '@/pages/mcq/MCQPageLayout';
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
    description: 'Standard exam timing per question.',
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
];

const PastPaperSettingsPage = () => {
  useLayoutEffect(() => {
    requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    });
  }, []);

  const { subjectId, chapterId } = useParams<{ subjectId: string; chapterId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const routeState = location.state as { subject?: Subject; chapter?: Chapter } | null;
  const routeChapter = routeState?.chapter?.content_type === 'past_paper'
    ? routeState.chapter
    : null;
  const [subject, setSubject] = useState<Subject | null>(routeState?.subject || null);
  const [chapter, setChapter] = useState<Chapter | null>(routeChapter);
  const [loading, setLoading] = useState(!routeState?.subject || !routeChapter);
  const [timePerQuestion, setTimePerQuestion] = useState(0);

  useEffect(() => {
    const loadData = async () => {
      if (!subjectId || !chapterId) return;
      if (routeState?.subject && routeChapter) return;

      const [subjectData, chapterData] = await Promise.all([
        fetchSubjectById(subjectId),
        fetchChapterById(chapterId, subjectId),
      ]);

      if (subjectData) setSubject(subjectData);
      // Do not let a regular question-bank chapter be opened through a
      // manually entered Past Papers URL.
      if (chapterData?.subject_id === subjectId && chapterData.content_type === 'past_paper') {
        setChapter(chapterData);
      }
      
      setLoading(false);
    };
    
    loadData();
  }, [subjectId, chapterId, routeChapter, routeState?.subject]);

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
    if (subjectId && chapterId && chapter?.content_type === 'past_paper') {
      navigate(`/mcqs/quiz/${subjectId}/${chapterId}?timer=${timePerQuestion > 0}&time=${timePerQuestion}`, {
        state: { subject, chapter },
      });
    }
  };

  if (!loading && (!subject || !chapter)) {
    return (
      <MCQPageLayout backTo="/past-papers">
        <div className="text-center py-20">
          <p className="text-muted-foreground">Subject or paper not found</p>
          <Button onClick={() => navigate('/past-papers')} className="mt-4">Go Back</Button>
        </div>
      </MCQPageLayout>
    );
  }

  return (
    <MCQPageLayout backTo={subjectId ? `/past-papers/chapter/${subjectId}` : '/past-papers'} showHeader={false} showBackButton={false} scrollable>
      <header className="absolute inset-x-0 top-0 z-50 border-b border-border/60 bg-background/88 px-4 pb-3 pt-[calc(env(safe-area-inset-top,0px)+10px)] backdrop-blur-2xl">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <Link
            to={subjectId ? `/past-papers/chapter/${subjectId}` : '/past-papers'}
            aria-label="Back to papers"
            className="flex h-11 w-11 shrink-0 items-center justify-start active:scale-95"
          >
            <img src="/lovable-uploads/bf69a7f7-550a-45a1-8808-a02fb889f8c5.png" alt="Medmacs" className="h-9 w-9 object-contain" />
          </Link>

          <div className="min-w-0 text-center">
            <h1 className="brand-wordmark max-w-full truncate text-xl text-foreground">Past Papers and Re-calls</h1>
          </div>

          <Link
            to="/detailed-analytics"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-all hover:bg-primary hover:text-white active:scale-95"
            aria-label="Open analytics"
          >
            <Target className="h-5 w-5" />
          </Link>
        </div>
      </header>

      <div className="relative z-20 shrink-0 bg-background/80 px-4 backdrop-blur-md sm:px-0 pt-[calc(env(safe-area-inset-top,0px)+84px)]">
        <div className="max-w-4xl mx-auto px-4 sm:px-0">
          <div className="py-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="brand-display text-2xl leading-tight tracking-[-0.035em] text-foreground sm:text-3xl">
                Paper <span className="live-gradient-text">Settings</span>
              </h2>
              <Button asChild variant="outline" className="h-9 shrink-0 rounded-full px-3">
                <Link to={subjectId ? `/past-papers/chapter/${subjectId}` : '/past-papers'}>
                  <ArrowLeft className="mr-1.5 h-4 w-4" />
                  Change Paper
                </Link>
              </Button>
            </div>
            <div className="mt-2 flex flex-col items-center gap-1">
              <p className="text-muted-foreground text-sm font-bold uppercase tracking-widest">
                {subject?.name} • Paper {chapter?.chapter_number}
              </p>
              <p className="text-muted-foreground/60 text-[10px] font-medium uppercase tracking-[0.2em]">
                Configure your past paper attempt
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
                Paper {chapter?.chapter_number} — {chapter?.name}
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
                transition={{ delay: 0.1 + idx * 0.03 }}
                onClick={() => setTimePerQuestion(preset.value)}
                className={`relative flex items-center gap-4 rounded-2xl border-2 p-4 cursor-pointer transition-all ${
                  isSelected
                    ? 'border-primary bg-primary/10 shadow-lg shadow-primary/5'
                    : 'border-border/60 bg-card/60 hover:border-primary/40 hover:bg-card'
                }`}
              >
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center text-white ${preset.bgClass} shadow-md`}
                >
                  {preset.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-bold text-base text-foreground">{preset.label}</p>
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-foreground/5 text-muted-foreground">
                      {preset.sublabel}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-1">
                    {preset.description}
                  </p>
                </div>
                {isSelected && (
                  <motion.div
                    layoutId="activeTimer"
                    className="w-2.5 h-2.5 rounded-full bg-primary"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', damping: 26, stiffness: 340 }}
          className="fixed bottom-0 left-0 right-0 z-50 flex justify-center bg-gradient-to-t from-background via-background/95 to-transparent px-4 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-8 pointer-events-none"
        >
          <div className="w-full max-w-4xl pointer-events-auto">
            <Button
              onClick={handleStartQuiz}
              className="w-full h-14 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-primary/25 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
              size="lg"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>Start Attempt</span>
            </Button>
          </div>
        </motion.div>
      </AnimatePresence>
    </MCQPageLayout>
  );
};

export default PastPaperSettingsPage;
