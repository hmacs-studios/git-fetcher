import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Clock, LogOut, ShieldAlert, Trophy, Users, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { shouldBotAnswerCorrectly } from '@/utils/gameController';
import { App } from '@capacitor/app';
import { fetchMCQsBySubject } from '@/utils/mcqData';

interface Participant {
  id: string;
  user_id: string;
  username: string;
  team: number | null;
  score: number;
  answers?: any[];
  is_finished?: boolean;
  is_bot?: boolean;
  bot_accuracy?: number | null;
}

interface Question {
  id: string;
  question: string;
  options: string[];
  correct_answer: string;
  explanation?: string;
}

interface BattleGameProps {
  roomData: {
    id: string;
    room_code: string;
    battle_type: '1v1' | '2v2' | 'ffa';
    max_players: number;
    time_per_question: number;
    total_questions: number;
    subject: string;
    host_id?: string;
    subject_id?: string;
    chapter_id?: string;
    battle_participants: Participant[];
  };
  userId: string;
  onGameComplete: (results: any) => void;
  onExit: () => void;
}

const normalizeOptions = (options: unknown) => {
  if (Array.isArray(options)) return options as string[];
  if (typeof options === 'string') {
    try {
      const parsed = JSON.parse(options);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

export const BattleGame = ({ roomData, userId, onGameComplete, onExit }: BattleGameProps) => {
  const { toast } = useToast();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(roomData.time_per_question);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [lastPoints, setLastPoints] = useState<number | null>(null);
  const [pointBursts, setPointBursts] = useState<{ id: number; points: number }[]>([]);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>(roomData.battle_participants || []);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [gameFinishedLocally, setGameFinishedLocally] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const botAnswerRef = useRef<Set<string>>(new Set());
  const finishInFlightRef = useRef(false);

  const isHost = roomData.host_id === userId;

  const leaderboard = useMemo(
    () => [...participants].sort((a, b) => (b.score || 0) - (a.score || 0)),
    [participants]
  );

  const teamLeaderboard = useMemo(() => {
    const map = new Map<number, { team: number; score: number; players: string[] }>();
    participants.forEach(participant => {
      if (!participant.team) return;
      const row = map.get(participant.team) || { team: participant.team, score: 0, players: [] };
      row.score += participant.score || 0;
      row.players.push(participant.username);
      map.set(participant.team, row);
    });
    return Array.from(map.values()).sort((a, b) => b.score - a.score);
  }, [participants]);

  const currentParticipant = participants.find(participant => participant.user_id === userId);
  const currentUserRank = leaderboard.findIndex(player => player.user_id === userId) + 1;
  const currentUserRow = leaderboard.find(player => player.user_id === userId);
  const compactRankRows = currentUserRank > 3 && currentUserRow
    ? [...leaderboard.slice(0, 3), currentUserRow]
    : leaderboard.slice(0, 3);

  useEffect(() => {
    document.body.dataset.battleGameActive = 'true';

    let listener: any = null;
    App.addListener('backButton', () => {
      setShowExitConfirm(true);
    }).then(handle => {
      listener = handle;
    });

    return () => {
      delete document.body.dataset.battleGameActive;
      listener?.remove?.();
    };
  }, []);

  const fetchParticipants = async () => {
    const { data, error } = await supabase
      .from('battle_participants')
      .select('id, user_id, username, team, score, answers, is_finished, is_bot, bot_accuracy')
      .eq('battle_room_id', roomData.id);

    if (!error && data) {
      setParticipants((data || []) as Participant[]);
      const me = data.find(participant => participant.user_id === userId);
      if (me) setScore(me.score || 0);
    }
  };

  useEffect(() => {
    loadQuestionsFromDatabase();
    fetchParticipants();

    const channel = supabase
      .channel(`battle_game_participants_${roomData.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'battle_participants', filter: `battle_room_id=eq.${roomData.id}` }, fetchParticipants)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomData.id, roomData.subject_id, roomData.total_questions]);

  const loadQuestionsFromDatabase = async () => {
    try {
      setIsLoading(true);

      if (!roomData.subject_id) {
        loadSampleQuestions();
        return;
      }

      const mcqs = await fetchMCQsBySubject(roomData.subject_id);

      if (!mcqs || mcqs.length === 0) {
        loadSampleQuestions();
        return;
      }

      const transformedQuestions = mcqs.map(mcq => ({
        id: mcq.id,
        question: mcq.question,
        options: normalizeOptions(mcq.options),
        correct_answer: mcq.correct_answer,
        explanation: mcq.explanation || undefined,
      }));

      setQuestions(transformedQuestions.sort(() => Math.random() - 0.5).slice(0, roomData.total_questions));
    } catch (error) {
      console.error('Error loading battle questions:', error);
      loadSampleQuestions();
    } finally {
      setIsLoading(false);
    }
  };

  const loadSampleQuestions = () => {
    setQuestions([
      {
        id: 'sample_1',
        question: 'What is the powerhouse of the cell?',
        options: ['Nucleus', 'Mitochondria', 'Ribosome', 'Golgi apparatus'],
        correct_answer: 'Mitochondria',
        explanation: 'Mitochondria produce ATP.',
      },
      {
        id: 'sample_2',
        question: 'Which organ system transports blood throughout the body?',
        options: ['Respiratory system', 'Digestive system', 'Circulatory system', 'Nervous system'],
        correct_answer: 'Circulatory system',
        explanation: 'The circulatory system transports blood.',
      },
      {
        id: 'sample_3',
        question: 'What is the basic unit of heredity?',
        options: ['Chromosome', 'Gene', 'DNA', 'Protein'],
        correct_answer: 'Gene',
        explanation: 'A gene is the basic unit of heredity.',
      },
    ].slice(0, roomData.total_questions));
  };

  useEffect(() => {
    if (!isLoading && !gameFinishedLocally) startTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentQuestionIndex, isLoading, gameFinishedLocally]);

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeLeft(roomData.time_per_question);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          handleAnswerSubmit(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    if (isLoading || gameFinishedLocally || !isHost || questions.length === 0) return;

    const currentQuestion = questions[currentQuestionIndex];
    if (!currentQuestion) return;

    const botParticipants = participants.filter(participant => participant.is_bot);
    const timers = botParticipants.map(bot => {
      const key = `${bot.user_id}:${currentQuestionIndex}`;
      if (botAnswerRef.current.has(key)) return null;
      botAnswerRef.current.add(key);

      const questionMs = roomData.time_per_question * 1000;
      const responseDelay = Math.max(700, Math.min(questionMs - 600, 900 + Math.random() * questionMs * 0.7));
      return window.setTimeout(async () => {
        const willBeCorrect = shouldBotAnswerCorrectly(bot.bot_accuracy);
        const wrongOptions = currentQuestion.options.filter(option => option !== currentQuestion.correct_answer);
        const selected = willBeCorrect
          ? currentQuestion.correct_answer
          : wrongOptions[Math.floor(Math.random() * wrongOptions.length)] || currentQuestion.options[0];
        const remainingSeconds = Math.max(0, roomData.time_per_question - Math.round(responseDelay / 1000));
        const points = willBeCorrect ? 100 + remainingSeconds * 2 : 0;

        const { data: participantData } = await supabase
          .from('battle_participants')
          .select('score, answers')
          .eq('battle_room_id', roomData.id)
          .eq('user_id', bot.user_id)
          .single();

        const existingAnswers = (participantData?.answers as any[]) || [];
        if (existingAnswers.some(answer => answer.questionId === currentQuestion.id)) return;

        await supabase
          .from('battle_participants')
          .update({
            score: (participantData?.score || 0) + points,
            answers: [...existingAnswers, {
              questionId: currentQuestion.id,
              question: currentQuestion.question,
              selectedAnswer: selected,
              correctAnswer: currentQuestion.correct_answer,
              isCorrect: willBeCorrect,
              timeLeft: remainingSeconds,
              points,
            }],
          })
          .eq('battle_room_id', roomData.id)
          .eq('user_id', bot.user_id);
      }, responseDelay);
    }).filter(Boolean) as number[];

    return () => timers.forEach(timer => window.clearTimeout(timer));
  }, [currentQuestionIndex, isLoading, gameFinishedLocally, isHost, questions, participants, roomData.id, roomData.time_per_question]);

  const handleAnswerSelect = (answer: string) => {
    if (selectedAnswer !== null) return;
    setSelectedAnswer(answer);
    setTimeout(() => handleAnswerSubmit(answer), 350);
  };

  const handleAnswerSubmit = async (answer: string | null) => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!questions[currentQuestionIndex]) return;

    const currentQuestion = questions[currentQuestionIndex];
    const isCorrect = answer === currentQuestion.correct_answer;
    const questionScore = isCorrect ? 100 + Math.max(0, timeLeft) * 2 : 0;
    setLastPoints(questionScore);
    const burstId = Date.now();
    setPointBursts(prev => [...prev, { id: burstId, points: questionScore }]);
    window.setTimeout(() => {
      setPointBursts(prev => prev.filter(burst => burst.id !== burstId));
    }, 900);

    try {
      const { data: participantData, error: fetchError } = await supabase
        .from('battle_participants')
        .select('score, answers')
        .eq('battle_room_id', roomData.id)
        .eq('user_id', userId)
        .single();

      if (fetchError) throw fetchError;

      const existingAnswers = (participantData?.answers as any[]) || [];
      const updatedScore = (participantData?.score || 0) + questionScore;
      setScore(updatedScore);

      const { error: updateError } = await supabase
        .from('battle_participants')
        .update({
          score: updatedScore,
          answers: [...existingAnswers, {
            questionId: currentQuestion.id,
            question: currentQuestion.question,
            selectedAnswer: answer,
            correctAnswer: currentQuestion.correct_answer,
            isCorrect,
            timeLeft,
            points: questionScore,
          }],
        })
        .eq('battle_room_id', roomData.id)
        .eq('user_id', userId);

      if (updateError) throw updateError;
      fetchParticipants();
    } catch (error: any) {
      toast({ title: 'Answer Not Saved', description: error.message, variant: 'destructive' });
    }

    setTimeout(() => {
      if (currentQuestionIndex + 1 >= questions.length) {
        finishGame();
      } else {
        setCurrentQuestionIndex(prev => prev + 1);
        setSelectedAnswer(null);
        setLastPoints(null);
      }
    }, 850);
  };

  const finishGame = async () => {
    if (finishInFlightRef.current) return;
    finishInFlightRef.current = true;
    setGameFinishedLocally(true);

    try {
      const { error: finishError } = await supabase
        .from('battle_participants')
        .update({ is_finished: true })
        .eq('battle_room_id', roomData.id)
        .eq('user_id', userId);

      if (finishError) {
        console.error('BattleGame: Failed to mark participant as finished.', finishError);
      }

      const { data: latestParticipants, error } = await supabase
        .from('battle_participants')
        .select('user_id, username, team, score, answers')
        .eq('battle_room_id', roomData.id);

      if (error) {
        console.error('BattleGame: Failed to fetch final participants. Using local results.', error);
      }

      const sourceParticipants = error ? participants : (latestParticipants || participants);
      const rows = (sourceParticipants || []).map((participant: any) => ({
        ...participant,
        score: participant.user_id === userId ? Math.max(participant.score || 0, score) : participant.score || 0,
        correctAnswers: ((participant.answers as any[]) || []).filter(answer => answer.isCorrect).length,
      }));
      const rankings = [...rows].sort((a, b) => b.score - a.score);
      const playerRank = rankings.findIndex(player => player.user_id === userId) + 1;
      const me = rankings.find(player => player.user_id === userId);
      const totalCorrect = me?.correctAnswers || 0;
      const finalScore = me?.score || score;
      const accuracyPercentage = questions.length ? (totalCorrect / questions.length) * 100 : 0;

      const teamRankings = Array.from(rows.reduce((map: Map<number, any>, participant: any) => {
        if (!participant.team) return map;
        const row = map.get(participant.team) || { team: participant.team, score: 0, players: [] };
        row.score += participant.score || 0;
        row.players.push(participant.username);
        map.set(participant.team, row);
        return map;
      }, new Map()).values()).sort((a: any, b: any) => b.score - a.score);

      const results = {
        finalScore,
        totalQuestions: questions.length,
        correctAnswers: totalCorrect,
        accuracy: accuracyPercentage,
        rank: playerRank || 1,
        roomCode: roomData.room_code,
        battleType: roomData.battle_type,
        rankings,
        teamRankings,
        answers: (me?.answers as any[]) || [],
      };

      onGameComplete(results);

      const { error: resultError } = await supabase
        .from('battle_results')
        .upsert({
          battle_room_id: roomData.id,
          user_id: userId,
          final_score: finalScore,
          rank: results.rank,
          total_correct: totalCorrect,
          total_questions: questions.length,
          accuracy_percentage: accuracyPercentage,
          time_bonus: finalScore - (totalCorrect * 100),
        }, { onConflict: 'battle_room_id,user_id' });

      if (resultError) {
        throw resultError;
      }
    } catch (error: any) {
      toast({ title: 'Results Not Saved', description: error.message, variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background p-6 text-center">
        <div>
          <div className="mx-auto mb-5 h-12 w-12 rounded-2xl bg-primary/10 animate-pulse" />
          <h2 className="text-2xl font-black text-foreground">Loading Questions</h2>
          <p className="mt-2 text-sm text-muted-foreground">Fetching questions from {roomData.subject}</p>
        </div>
      </div>
    );
  }

  if (gameFinishedLocally) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background p-6 text-center">
        <div>
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <Trophy className="h-7 w-7" />
          </div>
          <h2 className="text-2xl font-black text-foreground">
            Battle Complete
          </h2>
          <p className="mt-2 text-lg font-semibold text-foreground">Final Score: {score}</p>
          <p className="text-muted-foreground mt-2">Calculating rankings...</p>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
  const currentTeamScore = currentParticipant?.team
    ? teamLeaderboard.find(team => team.team === currentParticipant.team)?.score || 0
    : null;

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-background px-3 pb-[calc(env(safe-area-inset-bottom)+76px)] pt-[calc(env(safe-area-inset-top)+48px)] sm:px-4">
      <div className="fixed left-3 right-3 top-[calc(env(safe-area-inset-top)+8px)] z-[130] flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <img
            src="/favicon.png"
            alt="Medmacs"
            className="h-7 w-7 shrink-0 rounded-lg"
          />
          <div className="min-w-0 leading-none">
            <p className="truncate text-sm font-black tracking-tight text-foreground">Medmacs</p>
            <p className="mt-0.5 text-[10px] font-black uppercase tracking-widest text-primary">
              {roomData.battle_type === '1v1' ? '1v1 Battle' : roomData.battle_type === '2v2' ? '2v2 Team Battle' : 'Free For All'}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Badge className={timeLeft <= 5 ? 'h-7 bg-destructive text-destructive-foreground border-0' : 'h-7'} variant={timeLeft <= 5 ? 'default' : 'outline'}>
            <Clock className="w-3 h-3 mr-1" /> {timeLeft}s
          </Badge>
          <Badge className="h-7 border-primary/20 bg-card px-2 text-xs shadow-sm" variant="outline">
            {score} pts
          </Badge>
          {lastPoints !== null && (
            <Badge className="h-7 border-0 bg-primary/10 text-primary">
              <Zap className="w-3 h-3 mr-1" /> +{lastPoints}
            </Badge>
          )}
        </div>
      </div>

      <AnimatePresence>
        {pointBursts.map(burst => (
          <motion.div
            key={burst.id}
            initial={{ opacity: 0, scale: 0.85, x: 0, y: 0 }}
            animate={{ opacity: [0, 1, 1, 0], scale: [0.85, 1.12, 1, 0.85], x: 120, y: -150 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.85, ease: 'easeOut' }}
            className="fixed right-20 top-[48%] z-[140] rounded-full bg-primary px-4 py-2 text-lg font-black text-primary-foreground shadow-2xl shadow-primary/30"
          >
            +{burst.points}
          </motion.div>
        ))}
      </AnimatePresence>

      <div className="mx-auto flex min-h-[calc(100vh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-124px)] max-w-6xl flex-col gap-2">
        <div className="mb-2 flex items-center gap-2">
          <Badge variant="secondary" className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest">
            {roomData.battle_type.toUpperCase()}
          </Badge>
          <Badge variant="outline" className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest">
            {roomData.subject}
          </Badge>
          {currentTeamScore !== null && (
            <Badge variant="outline" className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest">
              Team {currentParticipant?.team}: {currentTeamScore}
            </Badge>
          )}
        </div>

        <motion.div
          key={currentQuestion.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="space-y-3"
        >
          <section className="rounded-2xl border border-border/40 bg-card px-3 py-3 shadow-sm sm:px-4">
            <h1 className="text-base font-black leading-snug text-foreground sm:text-lg">
              {currentQuestion.question}
            </h1>
          </section>

          <section className="space-y-2">
            {currentQuestion.options.map((option, index) => {
              const letters = ['A', 'B', 'C', 'D'];
              const isSelected = selectedAnswer === option;

              return (
                <motion.button
                  key={option}
                  type="button"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                  onClick={() => handleAnswerSelect(option)}
                  disabled={selectedAnswer !== null}
                  className={`flex min-h-11 w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all ${
                    isSelected
                      ? 'border-primary bg-primary/10 text-primary shadow-lg shadow-primary/10'
                      : 'border-border/60 bg-background text-foreground hover:border-primary/40 hover:bg-primary/5'
                  }`}
                >
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black ${
                    isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  }`}>
                    {letters[index]}
                  </span>
                  <span className="text-sm font-semibold leading-snug">{option}</span>
                </motion.button>
              );
            })}
          </section>
        </motion.div>
      </div>

      {compactRankRows.length > 0 && (
        <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+34px)] right-3 z-[130] w-44 rounded-xl border border-border/40 bg-background/92 p-2 shadow-lg backdrop-blur">
          <div className="mb-1 flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            <Users className="h-3 w-3 text-primary" /> Ranking
          </div>
          <div className="space-y-1">
            {compactRankRows.map((player, index) => {
              const rank = player.user_id === userId ? currentUserRank : index + 1;
              const isCurrentUser = player.user_id === userId;
              return (
                <div
                  key={`${player.user_id}-${rank}`}
                  className={`flex items-center justify-between gap-2 rounded-md px-1.5 py-1 text-[11px] leading-none ${
                    isCurrentUser ? 'bg-primary/10 text-primary' : ''
                  }`}
                >
                  <span className="truncate font-semibold">#{rank} {isCurrentUser ? 'You' : player.username}</span>
                  <span className="font-black">{player.score || 0}</span>
                </div>
              );
            })}
          </div>
          {roomData.battle_type === '2v2' && teamLeaderboard.length > 0 && (
            <div className="mt-1.5 grid grid-cols-2 gap-1 border-t border-border/40 pt-1.5">
              {teamLeaderboard.slice(0, 2).map(team => (
                <div key={team.team} className="rounded-md bg-muted/35 px-1.5 py-1 text-center text-[10px] leading-none">
                  <span className="font-black">T{team.team}</span>
                  <span className="ml-1 font-bold text-primary">{team.score}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+29px)] left-3 z-[130] flex items-center gap-2 rounded-xl border border-border/40 bg-background/82 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground shadow-lg backdrop-blur-md">
        <span>Question {currentQuestionIndex + 1}/{questions.length}</span>
        <span className="h-1 w-1 rounded-full bg-muted-foreground/50" />
        <span>{roomData.time_per_question}s max</span>
      </div>
      <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+12px)] left-3 right-3 z-[130]">
        <div className="rounded-full border border-border/40 bg-background/80 p-0.5 shadow-lg backdrop-blur-md">
          <Progress value={progress} className="h-3 rounded-full bg-muted/80" />
        </div>
      </div>

      {showExitConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 p-5 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-border/40 bg-background p-5 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-black text-foreground">Exit battle?</h2>
                <p className="text-xs text-muted-foreground">Your current battle progress may be lost.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="rounded-2xl" onClick={() => setShowExitConfirm(false)}>
                Stay
              </Button>
              <Button variant="destructive" className="rounded-2xl" onClick={onExit}>
                <LogOut className="mr-2 h-4 w-4" />
                Exit
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
