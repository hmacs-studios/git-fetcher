import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Target, BookOpen, TrendingUp, TrendingDown, Lock, Loader2, BarChart3, ChevronRight
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ProfileDropdown } from '@/components/ProfileDropdown';
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, Tooltip,
  AreaChart, Area
} from 'recharts';
import Seo from '@/components/Seo';

interface SubjectAnalytics {
  subject_id: string;
  subject_name: string;
  total: number;
  correct: number;
  accuracy: number;
  chapters: ChapterAnalytics[];
  color: string;
}

interface ChapterAnalytics {
  chapter_id: string;
  chapter_name: string;
  total: number;
  correct: number;
  accuracy: number;
  history: { date: string; accuracy: number }[];
}

interface AnswerWithMcq {
  is_correct: boolean;
  created_at: string;
  mcq_id: string;
  mcqs: {
    id: string;
    chapter_id: string;
    chapters: {
      id: string;
      name: string;
      subject_id: string;
      subjects: {
        id: string;
        name: string;
        year: string;
        program_code: string | null;
        color: string | null;
      };
    };
  } | null;
}

interface UserProfile {
  plan: string | null;
  year: string | null;
  program_code: string | null;
}

const DetailedAnalytics = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const profileData = profile as unknown as UserProfile | null;
  const userPlan = profileData?.plan?.toLowerCase() || 'free';
  const isPremium = userPlan === 'premium' || userPlan === 'iconic';
  const userYear = profileData?.year || null;

  const { data: analytics, isLoading } = useQuery<SubjectAnalytics[]>({
    queryKey: ['detailed-analytics', user?.id, profileData?.program_code, userYear],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data: answersRaw, error } = await supabase
        .from('user_answers')
        .select('is_correct, created_at, mcq_id, mcqs(id, chapter_id, chapters(id, name, subject_id, subjects(id, name, year, program_code, color)))')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error || !answersRaw) return [];

      const answers = answersRaw as unknown as AnswerWithMcq[];
      const subjectMap: Record<string, SubjectAnalytics> = {};

      for (const ans of answers) {
        const mcq = ans.mcqs;
        if (!mcq?.chapters?.subjects) continue;

        const subject = mcq.chapters.subjects;
        const chapter = mcq.chapters;

        if (userYear && subject.year && subject.year !== userYear) continue;
        if ((subject.program_code || 'mbbs') !== (profileData?.program_code || 'mbbs')) continue;

        if (!subjectMap[subject.id]) {
          subjectMap[subject.id] = {
            subject_id: subject.id,
            subject_name: subject.name,
            total: 0,
            correct: 0,
            accuracy: 0,
            chapters: [],
            color: subject.color || '#3B82F6',
          };
        }

        subjectMap[subject.id].total++;
        if (ans.is_correct) subjectMap[subject.id].correct++;

        let chap = subjectMap[subject.id].chapters.find(c => c.chapter_id === chapter.id);
        if (!chap) {
          chap = { chapter_id: chapter.id, chapter_name: chapter.name, total: 0, correct: 0, accuracy: 0, history: [] };
          subjectMap[subject.id].chapters.push(chap);
        }

        chap.total++;
        if (ans.is_correct) chap.correct++;

        // Tracking history for line chart (daily average or rolling)
        const dateKey = new Date(ans.created_at).toLocaleDateString();
        const existingDay = chap.history.find(h => h.date === dateKey);
        if (existingDay) {
          // Update day average
          const dayAnswers = answers.filter(a =>
            new Date(a.created_at).toLocaleDateString() === dateKey &&
            a.mcqs?.chapters?.id === chapter.id
          );
          const dayCorrect = dayAnswers.filter(a => a.is_correct).length;
          existingDay.accuracy = Math.round((dayCorrect / dayAnswers.length) * 100);
        } else {
          chap.history.push({ date: dateKey, accuracy: ans.is_correct ? 100 : 0 });
        }
      }

      const result = Object.values(subjectMap).map(s => ({
        ...s,
        accuracy: s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0,
        chapters: s.chapters.map(c => ({
          ...c,
          accuracy: c.total > 0 ? Math.round((c.correct / c.total) * 100) : 0,
          history: c.history.slice(-10), // Keep last 10 days
        })).sort((a, b) => b.total - a.total),
      }));

      return result.sort((a, b) => b.total - a.total);
    },
    enabled: !!user?.id,
  });

  const strongest = analytics?.filter(s => s.total >= 100).sort((a, b) => b.accuracy - a.accuracy)?.[0] || null;
  const weakest = analytics?.filter(s => (s.total - s.correct) >= 30).sort((a, b) => a.accuracy - b.accuracy)?.[0] || null;
  const strongestChapter = analytics?.flatMap(s => s.chapters).filter(c => c.total >= 100).sort((a, b) => b.accuracy - a.accuracy)?.[0] || null;
  const weakestChapter = analytics?.flatMap(s => s.chapters).filter(c => (c.total - c.correct) >= 30).sort((a, b) => a.accuracy - b.accuracy)?.[0] || null;

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-sm font-bold text-muted-foreground">Preparing your report, stay tuned...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Please sign in to view analytics.</p>
      </div>
    );
  }

  const visibleSubjects = isPremium ? analytics : analytics?.slice(0, 3);
  const hiddenCount = !isPremium && analytics ? Math.max(analytics.length - 3, 0) : 0;

  return (
    <div className="min-h-screen w-full bg-background">
      <Seo title="Detailed Analytics" description="Subject and topic-wise performance analysis" />

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/40 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        <div className="container mx-auto px-4 lg:px-8 py-4 flex justify-between items-center max-w-7xl">
          <div className="flex items-center space-x-3">
            <Button variant="ghost" size="sm" className="w-9 h-9 p-0 hover:scale-110" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <img src="/lovable-uploads/bf69a7f7-550a-45a1-8808-a02fb889f8c5.png" alt="Logo" className="w-8 h-8" />
            <span className="text-xl font-bold text-foreground">Analytics</span>
          </div>
          <div className="flex items-center space-x-4">
            {userYear && (
              <Badge className="bg-primary/10 text-primary border-0 text-xs font-bold">{userYear} Year</Badge>
            )}
            {user ? <ProfileDropdown /> : <Link to="/login"><Button size="sm">Sign In</Button></Link>}
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 lg:px-8 py-12 lg:py-16 max-w-7xl">
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-5xl font-black tracking-tight text-foreground mb-4 italic uppercase mt-[var(--header-height)]">
            Your <span className="text-primary">Performance</span>
          </h1>
          <p className="text-muted-foreground font-medium max-w-xl mx-auto uppercase text-xs tracking-[0.2em]">
            Subject & topic-wise breakdown for {userYear ? `${userYear} Year MBBS` : 'your year'}
          </p>
        </div>

        {/* Strengths & Weaknesses */}
        {(strongest || weakest || strongestChapter || weakestChapter) && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10 max-w-6xl mx-auto">
            {strongest && (
              <Card className="border border-emerald-500/20 bg-emerald-500/5">
                <CardContent className="p-4">
                  <TrendingUp className="w-5 h-5 text-emerald-500 mb-2" />
                  <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Strongest Subject</p>
                  <p className="text-sm font-black text-foreground mt-1 truncate">{strongest.subject_name}</p>
                  <p className="text-xs text-muted-foreground">{strongest.accuracy}% · {strongest.total} Qs</p>
                </CardContent>
              </Card>
            )}
            {weakest && (
              <Card className="border border-destructive/20 bg-destructive/5">
                <CardContent className="p-4">
                  <TrendingDown className="w-5 h-5 text-destructive mb-2" />
                  <p className="text-[10px] font-bold text-destructive uppercase tracking-wider">Weakest Subject</p>
                  <p className="text-sm font-black text-foreground mt-1 truncate">{weakest.subject_name}</p>
                  <p className="text-xs text-muted-foreground">{weakest.accuracy}% · {weakest.total} Qs</p>
                </CardContent>
              </Card>
            )}
            {strongestChapter && (
              <Card className="border border-emerald-500/20 bg-emerald-500/5">
                <CardContent className="p-4">
                  <TrendingUp className="w-5 h-5 text-emerald-500 mb-2" />
                  <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Strongest Topic</p>
                  <p className="text-sm font-black text-foreground mt-1 truncate">{strongestChapter.chapter_name}</p>
                  <p className="text-xs text-muted-foreground">{strongestChapter.accuracy}% · {strongestChapter.total} Qs</p>
                </CardContent>
              </Card>
            )}
            {weakestChapter && (
              <Card className="border border-destructive/20 bg-destructive/5">
                <CardContent className="p-4">
                  <TrendingDown className="w-5 h-5 text-destructive mb-2" />
                  <p className="text-[10px] font-bold text-destructive uppercase tracking-wider">Weakest Topic</p>
                  <p className="text-sm font-black text-foreground mt-1 truncate">{weakestChapter.chapter_name}</p>
                  <p className="text-xs text-muted-foreground">{weakestChapter.accuracy}% · {weakestChapter.total} Qs</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Subject List */}
        <div className="max-w-6xl mx-auto">
          <h2 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" /> Subject-wise Performance
          </h2>

          {(!analytics || analytics.length === 0) && (
            <Card className="border border-border/40 bg-card/80 p-8 text-center">
              <BookOpen className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No data yet. Start attempting MCQs to see your analysis!</p>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {visibleSubjects?.map((subject, idx) => (
              <SubjectCard key={subject.subject_id} subject={subject} isPremium={isPremium} index={idx} />
            ))}
          </div>

          {/* Locked content for free users */}
          {!isPremium && hiddenCount > 0 && (
            <div className="relative mt-3">
              <div className="space-y-3 opacity-30 blur-[2px] pointer-events-none">
                {analytics?.slice(3, 5).map((subject) => (
                  <Card key={subject.subject_id} className="border border-border/40 bg-card/80 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-foreground">{subject.subject_name}</p>
                        <p className="text-xs text-muted-foreground">{subject.total} questions</p>
                      </div>
                      <span className="text-lg font-black">{subject.accuracy}%</span>
                    </div>
                  </Card>
                ))}
              </div>
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-t from-background via-background/80 to-transparent rounded-2xl">
                <Lock className="w-8 h-8 text-muted-foreground mb-3" />
                <p className="text-sm font-bold text-foreground mb-1">Unlock Full Analytics</p>
                <p className="text-xs text-muted-foreground mb-4 text-center px-8">
                  {hiddenCount} more subject{hiddenCount > 1 ? 's' : ''} and all topic breakdowns
                </p>
                <Button
                  onClick={() => navigate('/pricing')}
                  className="bg-primary text-primary-foreground rounded-2xl h-10 px-6 font-bold text-sm"
                >
                  Upgrade Now
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

const SubjectCard = ({ subject, isPremium, index }: { subject: SubjectAnalytics; isPremium: boolean; index: number }) => {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();

  const data = [
    { name: 'Correct', value: subject.correct },
    { name: 'Incorrect', value: subject.total - subject.correct },
  ];

  const COLORS = [subject.color || '#3B82F6', '#E2E8F0'];

  const handleToggle = () => {
    if (!isPremium) {
      navigate('/pricing');
      return;
    }
    setExpanded(!expanded);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.1 }}
    >
      <Card className="border border-border/40 bg-card/80 backdrop-blur-xl overflow-hidden hover:shadow-xl transition-all duration-300 group rounded-[2rem]">
        <div className="p-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            {/* Donut Chart Section */}
            <div className="relative w-32 h-32 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={38}
                    outerRadius={50}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center flex-col">
                <span className="text-xl font-black text-foreground leading-none">{subject.accuracy}%</span>
                <span className="text-[10px] font-bold text-muted-foreground uppercase mt-1">Accuracy</span>
              </div>
            </div>

            {/* Content Section */}
            <div className="flex-1 min-w-0 text-center sm:text-left">
              <h3 className="text-lg font-black text-foreground mb-1 group-hover:text-primary transition-colors truncate">
                {subject.subject_name}
              </h3>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 mt-3">
                <div className="text-center sm:text-left">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Questions Solved</p>
                  <p className="text-sm font-black text-foreground">{subject.total}</p>
                </div>
                <div className="text-center sm:text-left">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Correct Answers</p>
                  <p className="text-sm font-black text-emerald-500">{subject.correct}</p>
                </div>
                <div className="text-center sm:text-left">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Overall Accuracy</p>
                  <p className="text-sm font-black text-primary">{subject.accuracy}%</p>
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleToggle}
                className="mt-4 w-full sm:w-auto rounded-xl bg-muted/50 hover:bg-muted text-xs font-bold uppercase tracking-wider gap-2 px-6"
              >
                {isPremium ? (
                  <>
                    {expanded ? 'Hide Breakdown' : 'View Topic Breakdown'}
                    <ChevronRight className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-90' : ''}`} />
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5 mr-1" />
                    Unlock Topics
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {expanded && isPremium && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-muted/30 border-t border-border/30"
            >
              <div className="p-6 space-y-6">
                <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Topic Trends (Last 10 Days)</h4>

                <div className="grid grid-cols-1 gap-4">
                  {subject.chapters.map((ch) => (
                    <Card key={ch.chapter_id} className="border border-border/20 bg-background/50 p-4 rounded-2xl">
                      <div className="flex flex-col md:flex-row items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <h5 className="text-xs font-bold text-foreground truncate">{ch.chapter_name}</h5>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase">{ch.accuracy}% Accuracy</span>
                            <span className="text-[10px] text-muted-foreground decoration-dot">•</span>
                            <span className="text-[10px] font-bold text-muted-foreground uppercase">{ch.total} Questions</span>
                          </div>
                        </div>

                        {/* Chapter Line Chart */}
                        <div className="w-full md:w-48 h-12">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={ch.history}>
                              <defs>
                                <linearGradient id={`colorAcc-${ch.chapter_id}`} x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor={subject.color} stopOpacity={0.8} />
                                  <stop offset="95%" stopColor={subject.color} stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <Area
                                type="monotone"
                                dataKey="accuracy"
                                stroke={subject.color}
                                fillOpacity={1}
                                fill={`url(#colorAcc-${ch.chapter_id})`}
                                strokeWidth={2}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </Card>
                  ))}

                  {subject.chapters.length === 0 && (
                    <div className="py-8 text-center">
                      <p className="text-xs text-muted-foreground">No chapter data currently available.</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
};

export default DetailedAnalytics;
