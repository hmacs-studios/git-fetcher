// AITestGenerator.tsx

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Brain, Sparkles, CheckCircle, XCircle, Timer } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { aiApiJson } from '@/utils/aiApi';
import { isAiLimitError } from '@/components/dashboard/personalization/FlashcardLimitModal';
import { useNavigate } from 'react-router-dom';

interface Question {
  question: string;
  options: string[];
  answer: string;
  explanation: string;
}

export const AITestGenerator: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState('medium');
  const [questionCount, setQuestionCount] = useState(5);
  const [customPrompt, setCustomPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [savedTestId, setSavedTestId] = useState<string | null>(null);

  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [revealed, setRevealed] = useState<Record<number, boolean>>({}); // New: Track if answer is submitted
  const [testSubmitted, setTestSubmitted] = useState(false);

  // Timer State
  const [seconds, setSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    let interval: any = null;
    if (isActive) {
      interval = setInterval(() => setSeconds((s) => s + 1), 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isActive]);

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const { data: profile } = useQuery({
    queryKey: ['profile-name', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase.from('profiles').select('full_name, username').eq('id', user.id).maybeSingle();
      return data;
    },
    enabled: !!user?.id
  });

  const displayName = profile?.full_name || profile?.username || user?.email?.split('@')[0] || 'Student';

  const strip = (s: string) => s?.split(') ')[1]?.trim() || s?.trim();

  const handleGenerateTest = async () => {
    if (!user || !topic.trim()) {
      toast.error('Please enter a topic.');
      return;
    }
    setIsGenerating(true);
    try {
      const data = await aiApiJson<{ questions: any[] }>('ai/generate-test', {
        topic: topic.trim(),
        difficulty,
        count: questionCount,
        prompt: customPrompt.trim(),
      }, {});
      const { data: savedTest, error: saveError } = await supabase
        .from('ai_generated_tests')
        .insert({ user_id: user.id, topic, difficulty, questions: data.questions, total_questions: data.questions.length })
        .select().single();

      if (saveError) throw saveError;

      setSavedTestId(savedTest.id);
      setQuestions(data.questions);
      setCurrentIndex(0);
      setAnswers({});
      setRevealed({});
      setSeconds(0);
      setIsActive(true);
      setTestSubmitted(false);
      toast.success(`Generated ${data.questions.length} questions!`);
    } catch (e: any) {
      if (isAiLimitError(e)) {
        return;
      }
      toast.error(`Failed to generate: ${e.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSelect = (opt: string) => {
    if (revealed[currentIndex]) return;
    setAnswers((a) => ({ ...a, [currentIndex]: opt }));
  };

  const handleRevealAnswer = () => {
    setRevealed((prev) => ({ ...prev, [currentIndex]: true }));
  };

  const score = questions
    ? Object.entries(answers).reduce(
      (t, [idx, ans]) => strip(ans) === strip(questions[+idx].answer) ? t + 1 : t,
      0
    )
    : 0;

  const handleSubmitFinal = async () => {
    setIsActive(false);
    setTestSubmitted(true);
    if (savedTestId && questions && user) {
      const accuracy = Math.round((score / questions.length) * 100);
      await supabase.from('ai_generated_tests').update({ test_taken: true, score, accuracy }).eq('id', savedTestId);
    }
  };

  // ─── Final Results ────────────────────────────────────────────────────
  if (testSubmitted && questions) {
    return (
      <div className="max-w-xl mx-auto px-3">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="rounded-[2rem] bg-gradient-to-br from-primary/10 via-teal-500/5 to-emerald-500/10 backdrop-blur-2xl border border-primary/20 p-8 text-center space-y-6">
          <h2 className="text-2xl font-black">Test Completed!</h2>
          <div className="flex justify-around items-center">
            <div>
              <p className="text-4xl font-black text-primary">{score}/{questions.length}</p>
              <p className="text-xs text-muted-foreground uppercase">Score</p>
            </div>
            <div>
              <p className="text-4xl font-black text-teal-500">{formatTime(seconds)}</p>
              <p className="text-xs text-muted-foreground uppercase">Time</p>
            </div>
          </div>
          <div className="flex justify-center gap-3 pt-4">
            <Button onClick={() => setQuestions(null)} className="rounded-xl font-bold">New Test</Button>
            <Link to="/dashboard"><Button variant="outline" className="rounded-xl">Dashboard</Button></Link>
          </div>
        </motion.div>
      </div>
    );
  }

  // ─── Initial Form ─────────────────────────────────────────────────────
  if (!questions) {
    return (
      <div className="max-w-lg mx-auto px-3">
        {/* ... (Keep your existing Initial Form code here) ... */}
        <div className="relative z-10 bg-background/50 backdrop-blur-xl rounded-[1.5rem] border border-primary/10 p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-emerald-500 flex items-center justify-center">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-lg font-black">AI Test Generator</h2>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="font-bold">Topic</Label>
              <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Enter MCAT topic..." className="rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-bold">Difficulty</Label>
                <Select value={difficulty} onValueChange={setDifficulty}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="font-bold">Questions</Label>
                <Select value={questionCount.toString()} onValueChange={(v) => setQuestionCount(parseInt(v))}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[5, 10, 15].map(n => <SelectItem key={n} value={n.toString()}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={handleGenerateTest} disabled={isGenerating || !topic.trim()} className="w-full bg-gradient-to-r from-primary to-emerald-500 text-white rounded-2xl h-12 font-black uppercase text-xs tracking-widest shadow-xl">
              {isGenerating ? 'Generating...' : 'Generate AI Test'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Question View ────────────────────────────────────────────────────
  const q = questions[currentIndex]!;
  const userAns = answers[currentIndex];
  const isRevealed = revealed[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;

  return (
    <div className="max-w-2xl mx-auto px-3">
      {/* Progress & Timer Header */}
      <div className="mb-6 space-y-3">
        <div className="flex justify-between items-end">
          <div>
            <span className="text-2xl font-black text-primary">{currentIndex + 1}</span>
            <span className="text-muted-foreground font-bold">/{questions.length} Questions</span>
          </div>
          <div className="flex items-center gap-2 bg-muted/50 px-3 py-1 rounded-full border border-border/50">
            <Timer className="w-4 h-4 text-primary" />
            <span className="font-mono font-bold text-sm">{formatTime(seconds)}</span>
          </div>
        </div>
        {/* Bar Chart Progress */}
        <div className="h-2 w-full bg-muted rounded-full overflow-hidden border border-border/20">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            className="h-full bg-gradient-to-r from-primary to-emerald-500"
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
        >
          <div className="relative overflow-hidden rounded-[2rem] bg-background/50 backdrop-blur-2xl border border-primary/20 shadow-2xl p-6 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <Badge variant="outline" className="border-primary/20 text-primary bg-primary/5 px-3 py-1 ">
                <Sparkles className="w-3 h-3 mr-2" /> AI Generated
              </Badge>
              <span className="text-[10px] font-bold uppercase tracking-tighter text-muted-foreground">Medistics AI Engine v2</span>
            </div>

            <p className="text-lg sm:text-xl font-bold leading-tight mb-8 text-foreground">{q.question}</p>

            <div className="space-y-3">
              {q.options.map((opt) => {
                const isSel = userAns === opt;
                const isCorrect = strip(opt) === strip(q.answer);

                let optStyle = "w-full p-4 text-left rounded-2xl border transition-all flex items-center justify-between ";

                if (isRevealed) {
                  if (isCorrect) optStyle += "bg-emerald-500/10 border-emerald-500/50 text-emerald-700 dark:text-emerald-400";
                  else if (isSel && !isCorrect) optStyle += "bg-destructive/10 border-destructive/50 text-destructive";
                  else optStyle += "opacity-50 border-border";
                } else {
                  optStyle += isSel ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/50 bg-muted/20";
                }

                return (
                  <button key={opt} onClick={() => handleSelect(opt)} disabled={isRevealed} className={optStyle}>
                    <span className="font-medium text-sm sm:text-base">{opt}</span>
                    {isRevealed && isCorrect && <CheckCircle className="w-5 h-5 text-emerald-500" />}
                    {isRevealed && isSel && !isCorrect && <XCircle className="w-5 h-5 text-destructive" />}
                  </button>
                );
              })}
            </div>

            {isRevealed && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-6 p-5 bg-primary/5 rounded-2xl border border-primary/10">
                <h4 className="text-xs font-black uppercase text-primary mb-2">Explanation</h4>
                <p className="text-sm leading-relaxed text-muted-foreground">{q.explanation}</p>
              </motion.div>
            )}

            <div className="flex gap-3 mt-8">
              {!isRevealed ? (
                <Button
                  onClick={handleRevealAnswer}
                  disabled={!userAns}
                  className="w-full h-12 rounded-xl bg-primary font-bold shadow-lg shadow-primary/20"
                >
                  Submit Answer
                </Button>
              ) : (
                currentIndex < questions.length - 1 ? (
                  <Button onClick={() => setCurrentIndex(i => i + 1)} className="w-full h-12 rounded-xl bg-foreground text-background font-bold">
                    Next Question
                  </Button>
                ) : (
                  <Button onClick={handleSubmitFinal} className="w-full h-12 rounded-xl bg-gradient-to-r from-primary to-emerald-500 text-white font-bold">
                    Finish Test
                  </Button>
                )
              )}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Vibrant Best of Luck Message - Hide when question is selected or answered */}
      {!userAns && !isRevealed && (
        <div className="mt-10 text-center animate-pulse">
          <h3 className="text-xl font-black italic tracking-tight">
            Best of Luck,
            <span className="block text-3xl mt-1 bg-gradient-to-r from-pink-500 via-violet-500 to-cyan-500 bg-clip-text text-transparent drop-shadow-sm">
              {displayName}
            </span>
          </h3>
          <div className="mt-4 flex flex-col items-center opacity-40">
            <p className="text-[10px] font-medium">A Project by Hmacs Studios.</p>
            <p className="text-[10px]">© 2026 All rights reserved</p>
          </div>
        </div>
      )}
    </div>
  );
};
