import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Clock, Users, Zap } from 'lucide-react';
import { shouldBotAnswerCorrectly } from '@/utils/gameController';

interface Question {
  id: string;
  question: string;
  options: string[];
  correct_answer: string;
  explanation?: string;
}

interface Participant {
  id: string;
  user_id: string;
  username: string;
  team: number | null;
  score: number | null;
  is_bot?: boolean | null;
  bot_accuracy?: number | null;
}

interface AnswerEvent {
  id: string;
  battle_room_id: string;
  user_id: string;
  username: string;
  team: number | null;
  question_index: number;
  question_id: string | null;
  selected_answer: string | null;
  is_correct: boolean;
  points_awarded?: number | null;
  response_time_ms: number;
  submitted_at: string;
}

interface RapidFireRoom {
  id: string;
  room_code: string;
  battle_type: 'rapid_fire';
  status: 'waiting' | 'in_progress' | 'completed';
  host_id: string | null;
  current_question: number | null;
  question_started_at: string | null;
  time_per_question: number | null;
  total_questions: number | null;
  win_target: number | null;
  negative_marking?: boolean | null;
  winner_user_id: string | null;
  winner_team: number | null;
  paused_at: string | null;
  started_at?: string | null;
  created_at?: string | null;
  subject: string | null;
  questions: Question[] | null;
  battle_participants: Participant[];
}

interface RapidFireGameProps {
  roomData: RapidFireRoom;
  userId: string;
  onGameComplete: (results: any) => void;
}

const getQuestionStartedAt = (room: RapidFireRoom) => {
  const timestamp = room.question_started_at || room.started_at || room.created_at;
  return timestamp ? new Date(timestamp).getTime() : Date.now();
};

const getQuestionDuration = (room: RapidFireRoom) => Math.max(20, room.time_per_question || 20);

export const RapidFireGame = ({ roomData, userId, onGameComplete }: RapidFireGameProps) => {
  const { toast } = useToast();
  const [room, setRoom] = useState<RapidFireRoom>(roomData);
  const [events, setEvents] = useState<AnswerEvent[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [answerState, setAnswerState] = useState<{ correct: boolean; correctAnswer: string } | null>(null);
  const [lastPoints, setLastPoints] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(getQuestionDuration(roomData));
  const [nextQuestionCountdown, setNextQuestionCountdown] = useState<number | null>(null);
  const [showCorrectFlash, setShowCorrectFlash] = useState(false);
  const [showNegativeFlash, setShowNegativeFlash] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRankingOpen, setIsRankingOpen] = useState(false);
  const [scorePulses, setScorePulses] = useState<{ id: string; username: string; points: number }[]>([]);
  const completeRef = useRef(false);
  const botAnswerRef = useRef<Set<string>>(new Set());
  const advanceInFlightRef = useRef(false);
  const seenEventIdsRef = useRef<Set<string>>(new Set());
  const hasLoadedEventsRef = useRef(false);

  const isHost = room.host_id === userId;
  const questionIndex = room.current_question || 0;
  const questions = Array.isArray(room.questions) ? room.questions : [];
  const currentQuestion = questions[questionIndex];
  const questionEvents = events.filter(event => event.question_index === questionIndex);
  const currentUserEvent = questionEvents.find(event => event.user_id === userId);
  const firstCorrectEvent = questionEvents.find(event => event.is_correct);
  const activeParticipants = room.battle_participants || [];
  const currentUserParticipant = activeParticipants.find(participant => participant.user_id === userId);
  const winTarget = room.win_target || Math.max(questions.length, 20) * 100;
  const questionDuration = getQuestionDuration(room);
  const isPaused = Boolean(room.paused_at);

  const playerRows = useMemo(() => {
    const map = new Map<string, {
      userId: string;
      username: string;
      team: number | null;
      correct: number;
      points: number;
      attempts: number;
      totalResponse: number;
      fastest: number | null;
    }>();

    activeParticipants.forEach(participant => {
      map.set(participant.user_id, {
        userId: participant.user_id,
        username: participant.username,
        team: participant.team,
        correct: 0,
        points: 0,
        attempts: 0,
        totalResponse: 0,
        fastest: null,
      });
    });

    events.forEach(event => {
      const row = map.get(event.user_id) || {
        userId: event.user_id,
        username: event.username,
        team: event.team,
        correct: 0,
        points: 0,
        attempts: 0,
        totalResponse: 0,
        fastest: null,
      };
      row.attempts += 1;
      row.totalResponse += event.response_time_ms || 0;
      row.points += event.points_awarded || 0;
      if (event.is_correct) {
        row.correct += 1;
        row.fastest = row.fastest === null ? event.response_time_ms : Math.min(row.fastest, event.response_time_ms);
      }
      map.set(event.user_id, row);
    });

    return Array.from(map.values()).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.correct !== a.correct) return b.correct - a.correct;
      const aAvg = a.attempts ? a.totalResponse / a.attempts : Number.MAX_SAFE_INTEGER;
      const bAvg = b.attempts ? b.totalResponse / b.attempts : Number.MAX_SAFE_INTEGER;
      return aAvg - bAvg;
    });
  }, [activeParticipants, events]);

  const fetchRoom = async () => {
    const { data, error } = await supabase
      .from('battle_rooms')
      .select('*, battle_participants(id, user_id, username, team, score, is_bot, bot_accuracy)')
      .eq('id', roomData.id)
      .single();
    if (!error && data) setRoom(data as RapidFireRoom);
  };

  const fetchEvents = async () => {
    const { data, error } = await supabase
      .from('battle_answer_events')
      .select('*')
      .eq('battle_room_id', roomData.id)
      .order('submitted_at', { ascending: true });
    if (!error) setEvents((data || []) as AnswerEvent[]);
  };

  useEffect(() => {
    fetchRoom();
    fetchEvents();

    const roomChannel = supabase
      .channel(`rapid_fire_room_${roomData.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'battle_rooms', filter: `id=eq.${roomData.id}` }, fetchRoom)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'battle_participants', filter: `battle_room_id=eq.${roomData.id}` }, fetchRoom)
      .subscribe();

    const answerChannel = supabase
      .channel(`rapid_fire_answers_${roomData.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'battle_answer_events', filter: `battle_room_id=eq.${roomData.id}` }, fetchEvents)
      .subscribe();

    return () => {
      supabase.removeChannel(roomChannel);
      supabase.removeChannel(answerChannel);
    };
  }, [roomData.id]);

  useEffect(() => {
    setSelectedAnswer(null);
    setAnswerState(null);
    setLastPoints(null);
    setNextQuestionCountdown(null);
    setShowCorrectFlash(false);
    setShowNegativeFlash(false);
    setTimeLeft(questionDuration);
  }, [questionIndex, room.question_started_at, questionDuration]);

  useEffect(() => {
    if (!hasLoadedEventsRef.current) {
      seenEventIdsRef.current = new Set(events.map(event => event.id));
      hasLoadedEventsRef.current = true;
      return;
    }

    const newEvents = events.filter(event => !seenEventIdsRef.current.has(event.id));
    if (newEvents.length === 0) return;

    newEvents.forEach(event => seenEventIdsRef.current.add(event.id));
    const scoredEvents = newEvents
      .filter(event => Number(event.points_awarded || 0) !== 0)
      .slice(-4)
      .map(event => ({
        id: event.id,
        username: event.user_id === userId ? 'You' : event.username,
        points: Number(event.points_awarded || 0),
      }));

    if (scoredEvents.length === 0) return;

    setScorePulses(current => [...current, ...scoredEvents].slice(-4));
    scoredEvents.forEach(event => {
      window.setTimeout(() => {
        setScorePulses(current => current.filter(pulse => pulse.id !== event.id));
      }, 1800);
    });
  }, [events, userId]);

  useEffect(() => {
    if (!firstCorrectEvent) return;
    setShowCorrectFlash(true);
    const timeout = window.setTimeout(() => setShowCorrectFlash(false), 700);
    return () => window.clearTimeout(timeout);
  }, [firstCorrectEvent?.id]);

  useEffect(() => {
    if (room.status !== 'in_progress' || isPaused) return;

    const interval = setInterval(() => {
      const startedAt = getQuestionStartedAt(room);
      const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
      setTimeLeft(Math.max(0, questionDuration - elapsedSeconds));

      if (firstCorrectEvent) {
        const firstCorrectAt = new Date(firstCorrectEvent.submitted_at).getTime();
        const correctElapsedSeconds = Math.floor((Date.now() - firstCorrectAt) / 1000);
        setNextQuestionCountdown(Math.max(0, 10 - correctElapsedSeconds));
      } else {
        setNextQuestionCountdown(null);
      }
    }, 250);

    return () => clearInterval(interval);
  }, [room.question_started_at, questionDuration, room.status, isPaused, firstCorrectEvent?.submitted_at]);

  useEffect(() => {
    if (room.status !== 'in_progress' || isPaused || !currentQuestion || !currentUserParticipant) return;

    if (!room.question_started_at) {
      const timeout = setTimeout(() => initializeQuestionClock(), 250);
      return () => clearTimeout(timeout);
    }

    const elapsedMs = Date.now() - getQuestionStartedAt(room);
    const firstCorrectElapsedMs = firstCorrectEvent
      ? Date.now() - new Date(firstCorrectEvent.submitted_at).getTime()
      : 0;
    if (
      (firstCorrectEvent && firstCorrectElapsedMs >= 10_000)
      || (timeLeft <= 0 && elapsedMs >= questionDuration * 1000)
    ) {
      const timeout = setTimeout(() => advanceQuestion(), 0);
      return () => clearTimeout(timeout);
    }
  }, [
    room.status,
    room.question_started_at,
    isPaused,
    timeLeft,
    firstCorrectEvent?.submitted_at,
    activeParticipants.length,
    currentQuestion?.id,
    currentUserParticipant?.user_id
  ]);

  useEffect(() => {
    if (!isHost || room.status !== 'in_progress' || isPaused || !currentQuestion) return;

    const botParticipants = activeParticipants.filter(participant => participant.is_bot);
    const currentAnsweredBotIds = new Set(questionEvents.map(event => event.user_id));
    const timers = botParticipants.map(bot => {
      if (currentAnsweredBotIds.has(bot.user_id)) return null;
      const key = `${bot.user_id}:${questionIndex}`;
      if (botAnswerRef.current.has(key)) return null;
      botAnswerRef.current.add(key);

      const questionMs = questionDuration * 1000;
      const responseDelay = Math.max(4500, Math.min(questionMs - 1500, 4500 + Math.random() * questionMs * 0.65));
      return window.setTimeout(async () => {
        const willBeCorrect = shouldBotAnswerCorrectly(bot.bot_accuracy);
        const wrongOptions = currentQuestion.options.filter(option => option !== currentQuestion.correct_answer);
        const selectedAnswer = willBeCorrect
          ? currentQuestion.correct_answer
          : wrongOptions[Math.floor(Math.random() * wrongOptions.length)] || currentQuestion.options[0];

        await supabase.rpc('submit_rapid_fire_answer', {
          p_room_id: room.id,
          p_user_id: bot.user_id,
          p_question_index: questionIndex,
          p_question_id: currentQuestion.id,
          p_selected_answer: selectedAnswer,
          p_response_time_ms: Math.round(responseDelay),
        });
      }, responseDelay);
    }).filter(Boolean) as number[];

    return () => timers.forEach(timer => window.clearTimeout(timer));
  }, [isHost, room.status, isPaused, currentQuestion?.id, questionIndex, activeParticipants, room.id, questionDuration]);

  useEffect(() => {
    if (room.status !== 'completed' || completeRef.current) return;
    completeRef.current = true;
    onGameComplete({
      mode: 'rapid_fire',
      roomCode: room.room_code,
      winnerUserId: room.winner_user_id,
      winnerTeam: null,
      players: playerRows,
      teams: [],
      winTarget,
    });
  }, [room.status, room.winner_user_id, playerRows, winTarget, onGameComplete]);

  const completeRoom = async () => {
    const topPlayer = playerRows[0];
    const completedAt = new Date().toISOString();
    const { error } = await supabase
      .from('battle_rooms')
      .update({
        status: 'completed',
        winner_user_id: topPlayer?.userId || null,
        winner_team: null,
        ended_at: completedAt,
      })
      .eq('id', room.id);

    if (error) {
      console.error('RapidFireGame: Failed to complete room.', error);
      toast({
        title: "Result Stuck",
        description: error.message || "Could not open the Rapid Fire result page.",
        variant: "destructive",
      });
      return false;
    }

    setRoom(current => ({
      ...current,
      status: 'completed',
      winner_user_id: topPlayer?.userId || null,
      winner_team: null,
    }));
    return true;
  };

  const advanceQuestion = async () => {
    if (advanceInFlightRef.current) return;
    if (room.status !== 'in_progress') return;

    const elapsedMs = Date.now() - getQuestionStartedAt(room);
    const firstCorrectElapsedMs = firstCorrectEvent
      ? Date.now() - new Date(firstCorrectEvent.submitted_at).getTime()
      : 0;
    const canAdvanceAfterCorrect = Boolean(firstCorrectEvent && firstCorrectElapsedMs >= 10_000);
    const canAdvanceAfterFullTime = elapsedMs >= questionDuration * 1000;

    if (!canAdvanceAfterCorrect && !canAdvanceAfterFullTime) {
      setTimeLeft(Math.max(1, Math.ceil((questionDuration * 1000 - elapsedMs) / 1000)));
      return;
    }

    advanceInFlightRef.current = true;

    if (questionIndex + 1 >= questions.length) {
      await completeRoom();
      advanceInFlightRef.current = false;
      return;
    }

    const { error } = await supabase
      .from('battle_rooms')
      .update({
        current_question: questionIndex + 1,
        question_started_at: new Date().toISOString(),
      })
      .eq('id', room.id)
      .eq('status', 'in_progress')
      .eq('current_question', questionIndex);

    advanceInFlightRef.current = false;
    if (error) {
      console.error('RapidFireGame: Failed to advance question.', error);
      toast({
        title: "Question Stuck",
        description: error.message || "Could not advance the Rapid Fire question.",
        variant: "destructive",
      });
    } else {
      fetchRoom();
      fetchEvents();
    }
  };

  const initializeQuestionClock = async () => {
    if (room.question_started_at || advanceInFlightRef.current) return;
    advanceInFlightRef.current = true;

    const { error } = await supabase
      .from('battle_rooms')
      .update({
        question_started_at: new Date().toISOString(),
        current_question: questionIndex,
      })
      .eq('id', room.id)
      .eq('status', 'in_progress')
      .is('question_started_at', null);

    advanceInFlightRef.current = false;
    if (error) {
      console.error('RapidFireGame: Failed to initialize question clock.', error);
    } else {
      fetchRoom();
    }
  };

  const submitAnswer = async (answer: string) => {
    if (!currentQuestion || currentUserEvent || isSubmitting || isPaused) return;
    setSelectedAnswer(answer);
    setIsSubmitting(true);

    const responseTimeMs = Math.max(0, Date.now() - getQuestionStartedAt(room));
    const { data, error } = await supabase.rpc('submit_rapid_fire_answer', {
      p_room_id: room.id,
      p_user_id: userId,
      p_question_index: questionIndex,
      p_question_id: currentQuestion.id,
      p_selected_answer: answer,
      p_response_time_ms: responseTimeMs,
    });

    setIsSubmitting(false);
    if (error) {
      toast({ title: "Answer Not Saved", description: error.message, variant: "destructive" });
      return;
    }

    const result = data as any;
    if (!result?.accepted) {
      toast({ title: "Answer Ignored", description: result?.reason || "This answer was not accepted.", variant: "destructive" });
      return;
    }

    setAnswerState({ correct: Boolean(result.isCorrect), correctAnswer: result.correctAnswer });
    setLastPoints(Number(result.pointsAwarded ?? (result.isCorrect ? 100 : 0)));
    if (Number(result.pointsAwarded || 0) < 0) {
      setShowNegativeFlash(true);
      window.setTimeout(() => setShowNegativeFlash(false), 700);
    }
    fetchEvents();
  };

  if (!currentQuestion) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader><CardTitle>Preparing Rapid Fire...</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">Waiting for synchronized questions.</CardContent>
        </Card>
      </div>
    );
  }

  const progress = ((questionIndex + 1) / Math.max(questions.length, 1)) * 100;
  const currentUserRow = playerRows.find(row => row.userId === userId);
  const currentUserRank = playerRows.findIndex(row => row.userId === userId) + 1;
  const compactRankRows = currentUserRank > 3 && currentUserRow
    ? [...playerRows.slice(0, 3), currentUserRow]
    : playerRows.slice(0, 3);

  return (
    <div className="relative min-h-screen bg-background px-3 pb-[calc(env(safe-area-inset-bottom)+76px)] pt-[calc(env(safe-area-inset-top)+48px)] sm:px-4">
      {showCorrectFlash && (
        <div className="pointer-events-none fixed inset-0 z-50 bg-emerald-500/25 animate-pulse" />
      )}
      {showNegativeFlash && (
        <div className="pointer-events-none fixed inset-0 z-50 bg-red-500/25 animate-pulse" />
      )}
      <div className="fixed left-3 right-3 top-[calc(env(safe-area-inset-top)+8px)] z-40 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <img
            src="/favicon.png"
            alt="Medmacs"
            className="h-7 w-7 shrink-0 rounded-lg"
          />
          <div className="min-w-0 leading-none">
            <p className="truncate text-sm font-black tracking-tight text-foreground">Medmacs</p>
            <p className="mt-0.5 text-[10px] font-black uppercase tracking-widest text-primary">Rapid Fire</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Badge className={timeLeft <= 3 ? 'h-7 bg-destructive text-destructive-foreground border-0' : 'h-7'} variant={timeLeft <= 3 ? 'default' : 'outline'}>
            <Clock className="w-3 h-3 mr-1" /> {isPaused ? 'Paused' : `${timeLeft}s`}
          </Badge>
          <Badge className="h-7 border-primary/20 bg-card px-2 text-xs shadow-sm" variant="outline">
            {currentUserRow?.points || 0} pts
          </Badge>
          {lastPoints !== null && (
            <Badge className={`h-7 border-0 ${lastPoints < 0 ? 'bg-red-500/10 text-red-600' : 'bg-primary/10 text-primary'}`}>
              <Zap className="w-3 h-3 mr-1" /> {lastPoints > 0 ? `+${lastPoints}` : lastPoints}
            </Badge>
          )}
        </div>
      </div>

      {compactRankRows.length > 0 && (
        <button
          type="button"
          onClick={() => setIsRankingOpen(true)}
          className="fixed bottom-[calc(env(safe-area-inset-bottom)+34px)] right-3 z-40 w-44 rounded-xl border border-border/40 bg-background/92 p-2 text-left shadow-lg backdrop-blur transition active:scale-[0.98]"
        >
          <div className="mb-1 flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            <Users className="h-3 w-3 text-primary" /> Ranking
          </div>
          <div className="space-y-1">
            {compactRankRows.map((row, index) => {
              const rank = row.userId === userId ? currentUserRank : index + 1;
              const isCurrentUser = row.userId === userId;
              return (
              <div
                key={`${row.userId}-${rank}`}
                className={`flex items-center justify-between gap-2 rounded-md px-1.5 py-1 text-[11px] leading-none ${
                  isCurrentUser ? 'bg-primary/10 text-primary' : ''
                }`}
              >
                <span className="truncate font-semibold">#{rank} {isCurrentUser ? 'You' : row.username}</span>
                <span className="font-black">{row.points}</span>
              </div>
              );
            })}
          </div>
        </button>
      )}

      {scorePulses.length > 0 && (
        <div className="pointer-events-none fixed bottom-[calc(env(safe-area-inset-bottom)+62px)] left-3 z-30 flex w-44 flex-col items-start gap-1.5">
          {scorePulses.map(pulse => (
            <div
              key={pulse.id}
              className={`max-w-full rounded-full border px-2.5 py-1 text-[11px] font-black shadow-md backdrop-blur animate-in fade-in slide-in-from-bottom-2 ${
                pulse.points > 0
                  ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600'
                  : 'border-red-500/20 bg-red-500/10 text-red-600'
              }`}
            >
              <span className="inline-block max-w-[112px] truncate align-bottom">{pulse.username}</span>{' '}
              {pulse.points > 0 ? `+${pulse.points}` : pulse.points}
            </div>
          ))}
        </div>
      )}

      <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+29px)] left-3 z-40 flex items-center gap-2 rounded-xl border border-border/40 bg-background/82 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground shadow-lg backdrop-blur-md">
        <span>Question {questionIndex + 1}/{questions.length}</span>
        <span className="h-1 w-1 rounded-full bg-muted-foreground/50" />
        <span>{questionDuration}s max</span>
      </div>
      <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+12px)] left-3 right-3 z-40">
        <div className="rounded-full border border-border/40 bg-background/80 p-0.5 shadow-lg backdrop-blur-md">
          <Progress value={progress} className="h-3 rounded-full bg-muted/80" />
        </div>
      </div>

      <Drawer open={isRankingOpen} onOpenChange={setIsRankingOpen}>
        <DrawerContent className="max-h-[82vh]">
          <DrawerHeader className="pb-2 text-left">
            <DrawerTitle className="flex items-center gap-2 text-base font-black">
              <Users className="h-4 w-4 text-primary" /> Candidate Scores
            </DrawerTitle>
            <DrawerDescription>Live Rapid Fire ranking for everyone in this room.</DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-4">
            <div className="space-y-2">
              {playerRows.map((row, index) => {
                const isCurrentUser = row.userId === userId;
                return (
                  <div
                    key={row.userId}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
                      isCurrentUser
                        ? 'border-primary/25 bg-primary/10'
                        : 'border-border/40 bg-muted/20'
                    }`}
                  >
                    <span className="w-8 shrink-0 text-center text-sm font-black text-muted-foreground">#{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-foreground">{isCurrentUser ? 'You' : row.username}</p>
                      <p className="text-xs text-muted-foreground">{row.correct} correct</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-foreground">{row.points}</p>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">pts</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <DrawerClose asChild>
              <Button variant="outline" className="mt-4 h-11 w-full rounded-xl font-bold">
                Close
              </Button>
            </DrawerClose>
          </div>
        </DrawerContent>
      </Drawer>

      <div className="mx-auto flex min-h-[calc(100vh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-124px)] max-w-6xl flex-col gap-2">
        <div
          className={`overflow-hidden transition-all duration-500 ease-in-out ${
            nextQuestionCountdown !== null
              ? 'max-h-12 opacity-100 translate-y-0'
              : 'max-h-0 opacity-0 -translate-y-2'
          }`}
        >
          {nextQuestionCountdown !== null && (
            <div className="flex h-10 items-center justify-center rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-background via-emerald-500/20 to-background text-xs font-black uppercase tracking-widest text-emerald-600 shadow-sm transition-all duration-500">
              Next in <span className="mx-1.5 animate-pulse text-base tabular-nums">{nextQuestionCountdown}</span>s
            </div>
          )}
        </div>

        <div className="grid flex-1 gap-2 lg:grid-cols-[minmax(0,1fr)_240px]">
          <Card className="overflow-hidden border-border/40 bg-card shadow-sm">
            <CardHeader className="space-y-2 px-3 py-3 sm:px-4">
              {room.negative_marking && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="h-5 px-1.5 text-[10px]">Negative marking</Badge>
                </div>
              )}
              <CardTitle className="text-base leading-snug sm:text-lg">{currentQuestion.question}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 px-3 pb-3 sm:px-4">
              {currentQuestion.options.map((option, index) => {
                const isChosen = selectedAnswer === option || currentUserEvent?.selected_answer === option;
                return (
                  <Button
                    key={option}
                    variant="outline"
                    className={`h-auto min-h-11 w-full justify-start whitespace-normal rounded-xl border-border/50 bg-background px-3 py-2.5 text-left text-sm leading-snug hover:bg-primary/5 hover:border-primary/30 ${
                      isChosen ? 'border-primary bg-primary/5' : ''
                    }`}
                    disabled={Boolean(currentUserEvent) || isSubmitting || isPaused}
                    onClick={() => submitAnswer(option)}
                  >
                    <span className="mr-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-black text-muted-foreground">
                      {String.fromCharCode(65 + index)}
                    </span>
                    {option}
                  </Button>
                );
              })}
              {answerState && (
                <div className="rounded-xl bg-muted/30 px-3 py-2 text-xs font-semibold text-muted-foreground">
                  Answer locked. Points updated live.
                </div>
              )}
            </CardContent>
          </Card>

          <div className="hidden lg:block" />
        </div>
      </div>
    </div>
  );
};
