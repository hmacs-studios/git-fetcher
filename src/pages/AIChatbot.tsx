import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from 'next-themes';
import { Send, Mic, MicOff, LockKeyhole, MessageSquare, Menu, Copy, Clock, Plus, PlusCircle, Trash2, Loader2, Volume2, Sparkles } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import Seo from '@/components/Seo';
import { notifyAchievementProgress } from '@/components/profile/AchievementBadges';
import { motion } from 'framer-motion';
import { aiApiStream, type AiStreamStatus } from '@/utils/aiApi';
import { transcribeAudio, synthesizeSpeech, splitSpeechText, getBestAudioMimeType, createSilenceDetector, type SilenceDetectorController } from '@/utils/cloudSpeech';
import { isAiPolicyNotice } from '@/utils/aiPolicyNotice';
import BrandedLoader from '@/components/BrandedLoader';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ChatMessage {
  sender: 'user' | 'ai';
  text: string;
  time: string;
}

interface SavedChat {
  id: string;
  created_at: string;
  messages: any;
  session_name?: string;
}

import { renderAiMessageText } from '@/utils/format';
import { InstagramCreatorCta, shouldShowCreatorInstagramCta } from '@/components/ai/InstagramCreatorCta';

const WordRevealMessage = ({
  text,
  animate,
  onComplete,
}: {
  text: string;
  animate: boolean;
  onComplete: () => void;
}) => {
  const words = React.useMemo(() => text.match(/\S+\s*/g) ?? [text], [text]);
  const [visibleWords, setVisibleWords] = useState(animate ? 1 : words.length);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisibleWords(words.length);
      onCompleteRef.current();
      return;
    }

    setVisibleWords(1);
    const interval = window.setInterval(() => {
      setVisibleWords((current) => {
        const next = Math.min(current + 1, words.length);
        if (next === words.length) {
          window.clearInterval(interval);
          onCompleteRef.current();
        }
        return next;
      });
    }, 34);

    return () => window.clearInterval(interval);
  }, [animate, words.length]);

  return <>{renderAiMessageText(words.slice(0, visibleWords).join(''))}</>;
};

const fallbackSuggestions = [
  'Osteomyelitis',
  'Types of MI',
  'Azithromycin SE',
  'McBurney point',
  'Explain nephrotic syndrome',
  'Causes of clubbing',
  'Brachial plexus summary',
  'Insulin mechanism',
  'Tetralogy of Fallot',
  'Appendicitis signs',
  'Shock types',
  'Antibiotic resistance',
];

const DrSultanChat: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();
  const location = useLocation();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [apiLoading, setApiLoading] = useState(false);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [recordingWaveform, setRecordingWaveform] = useState<number[]>(() => Array(14).fill(0));
  const [isRecordingLocked, setIsRecordingLocked] = useState(false);
  const [isTranscribingAudio, setIsTranscribingAudio] = useState(false);
  const [playingAudioIndex, setPlayingAudioIndex] = useState<number | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [suggestionTick, setSuggestionTick] = useState(0);
  const [revealingMessageIndex, setRevealingMessageIndex] = useState<number | null>(null);
  const [loadingStatus, setLoadingStatus] = useState<AiStreamStatus | null>(null);

  const [showScrollFade, setShowScrollFade] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const silenceDetectorRef = useRef<SilenceDetectorController | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const playbackRequestRef = useRef(0);
  const recordingPointerIdRef = useRef<number | null>(null);
  const recordingStartYRef = useRef(0);
  const recordingLockedRef = useRef(false);
  const recordingStartedAtRef = useRef<number | null>(null);
  const swipeStartRef = useRef<{ x: number; y: number; canOpen: boolean; canClose: boolean } | null>(null);

  const updateScrollFade = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    setShowScrollFade(el.scrollHeight - el.scrollTop - el.clientHeight > 8);
  };

  const handleTouchStart = (event: React.TouchEvent) => {
    if (window.innerWidth >= 1024 || event.touches.length !== 1) return;

    const touch = event.touches[0];
    // Keep the Android system-gesture edge free; open from the adjacent inner zone.
    const isInDrawerOpenZone = touch.clientX >= 40 && touch.clientX <= 120;
    swipeStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      canOpen: !isSidebarOpen && isInDrawerOpenZone,
      canClose: isSidebarOpen && touch.clientX <= 352,
    };
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start || event.changedTouches.length !== 1) return;

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    const isHorizontalSwipe = Math.abs(deltaX) >= 64 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2;

    if (!isHorizontalSwipe) return;
    if (start.canOpen && deltaX > 0) setIsSidebarOpen(true);
    if (start.canClose && deltaX < 0) setIsSidebarOpen(false);
  };

  useEffect(() => {
    const prefilledText = location.state?.prefilledText;
    if (prefilledText) {
      setInputMessage(prefilledText);
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  // --- 1. DATA FETCHING ---
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*').eq('id', user?.id).maybeSingle();
      return data;
    },
    enabled: !!user?.id
  });

  const { data: chatHistory, isLoading: chatHistoryLoading } = useQuery({
    queryKey: ['chatHistory', user?.id],
    queryFn: async (): Promise<SavedChat[]> => {
      const { data, error } = await supabase
        .from('ai_chat_sessions')
        .select('*')
        .eq('user_id', user?.id)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id
  });

  const { data: chatSuggestions = fallbackSuggestions } = useQuery({
    queryKey: ['aiChatSuggestions'],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await (supabase.from('ai_chat_suggestions') as any)
        .select('prompt')
        .eq('is_active', true)
        .order('order_index', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Unable to load AI chat suggestions', error);
        return fallbackSuggestions;
      }

      const prompts = (data || [])
        .map((item: any) => String(item.prompt || '').trim())
        .filter(Boolean);

      return prompts.length >= 4 ? prompts : fallbackSuggestions;
    },
    staleTime: 1000 * 60 * 5,
  });

  const canUseChat = !!user?.id;
  const visibleSuggestions = React.useMemo(() => {
    const source = chatSuggestions.length >= 4 ? chatSuggestions : fallbackSuggestions;
    const start = suggestionTick % source.length;

    return Array.from({ length: Math.min(4, source.length) }, (_, index) => source[(start + index) % source.length]);
  }, [chatSuggestions, suggestionTick]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setSuggestionTick((tick) => tick + 1);
    }, 30000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!apiLoading) setLoadingStatus(null);
  }, [apiLoading]);

  // --- 2. MUTATIONS ---
  const deleteSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase.from('ai_chat_sessions').delete().eq('id', sessionId);
      if (error) throw error;
    },
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['chatHistory'] });
      if (deletedId === currentSessionId) startNewChat();
      setSessionToDelete(null);
    },
  });

  // --- 3. CORE LOGIC ---
  const syncChatToDb = async (updatedMessages: ChatMessage[], sessionId: string | null) => {
    if (!user?.id || updatedMessages.length === 0) return;

    const recordToSave = updatedMessages.slice(-50);
    const firstUserMsg = updatedMessages.find(m => m.sender === 'user')?.text || "New Chat";
    // Updated: Session name limit increased to 200 characters
    const sessionName = firstUserMsg.substring(0, 200);

    try {
      if (sessionId) {
        await supabase
          .from('ai_chat_sessions')
          .update({ messages: recordToSave, updated_at: new Date().toISOString() })
          .eq('id', sessionId);
      } else {
        const { data, error } = await supabase
          .from('ai_chat_sessions')
          .insert([{
            user_id: user.id,
            messages: recordToSave,
            session_name: sessionName
          }])
          .select().single();

        if (error) throw error;
        if (data) {
          setCurrentSessionId(data.id);
          notifyAchievementProgress('ai_chat_session');
        }
      }
      queryClient.invalidateQueries({ queryKey: ['chatHistory'] });
    } catch (err) {
      console.error("Sync Error:", err);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedInput = inputMessage.trim();
    if (!trimmedInput || apiLoading || !canUseChat) return;

    const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: ChatMessage = { sender: 'user', text: trimmedInput, time: ts };

    const messagesWithUser = [...messages, userMsg];
    setMessages(messagesWithUser);
    setInputMessage('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = '40px';
    }
    setApiLoading(true);
    setLoadingStatus(null);
    const assistantIndex = messagesWithUser.length;
    setRevealingMessageIndex(assistantIndex);

    // Provide preceding context (last 8 messages) so LLM maintains continuous conversation
    const historyTurns = messages.slice(-8).map((m) => ({
      sender: m.sender === 'user' ? ('user' as const) : ('ai' as const),
      text: m.text,
    }));

    try {
      let streamedAnswer = '';
      const payload = await aiApiStream('ai/study-chat', {
        question: trimmedInput,
        history: historyTurns,
      }, {
        onStatus: (status) => { setLoadingStatus(status); },
        onDelta: (text) => {
          streamedAnswer += text;
          setMessages((prev) => {
            const updated = [...prev];
            if (updated[assistantIndex]) {
              updated[assistantIndex] = { ...updated[assistantIndex], text: streamedAnswer };
            } else {
              updated.push({ sender: 'ai', text: streamedAnswer, time: ts });
            }
            return updated;
          });
        },
      }, {});

      const aiResponseText = typeof payload.answer === 'object'
        ? JSON.stringify(payload.answer, null, 2)
        : (payload.answer || streamedAnswer || 'I am sorry, I could not process that.');

      const aiMsg: ChatMessage = {
        sender: 'ai',
        text: aiResponseText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      const finalMessages = [...messagesWithUser];
      if (finalMessages[assistantIndex]) {
        finalMessages[assistantIndex] = aiMsg;
      } else {
        finalMessages.push(aiMsg);
      }
      setRevealingMessageIndex(assistantIndex);
      setMessages(finalMessages);
      await syncChatToDb(finalMessages, currentSessionId);
    } catch (err: any) {
      setRevealingMessageIndex(assistantIndex);
      setMessages((prev) => {
        const updated = [...prev];
        if (updated[assistantIndex]) {
          updated[assistantIndex] = {
            sender: 'ai',
            text: err?.message || "Connection error. Please try again.",
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          };
        } else {
          updated.push({
            sender: 'ai',
            text: err?.message || "Connection error. Please try again.",
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          });
        }
        return updated;
      });
    } finally {
      setApiLoading(false);
    }
  };

  const startNewChat = () => {
    setMessages([]);
    setRevealingMessageIndex(null);
    setCurrentSessionId(null);
    setIsSidebarOpen(false);
  };

  const loadSession = (chat: SavedChat) => {
    setMessages(Array.isArray(chat.messages) ? chat.messages : []);
    setRevealingMessageIndex(null);
    setCurrentSessionId(chat.id);
    setIsSidebarOpen(false);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    const raf = requestAnimationFrame(updateScrollFade);
    return () => cancelAnimationFrame(raf);
  }, [messages, apiLoading]);

  const isPremium = profile?.plan === 'premium';

  const stopRecording = () => {
    silenceDetectorRef.current?.stop();
    silenceDetectorRef.current = null;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecordingLocked(false);
    recordingLockedRef.current = false;
  };

  const startRecording = async (pointerId?: number, startY?: number) => {
    if (!isPremium) {
      toast({
        title: "Premium Feature 👑",
        description: "Voice Assistant is exclusively available for Premium subscribers. Upgrade to speak with Dr. Ahroid!",
        variant: "destructive",
      });
      return;
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast({
          title: "Microphone Not Supported",
          description: "Your browser does not support audio recording.",
          variant: "destructive",
        });
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      const mimeType = getBestAudioMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      // Voice clips are intentionally bounded for predictable transcription latency.
      silenceDetectorRef.current = createSilenceDetector(stream, {
        silenceDurationMs: 1600,
        maxDurationMs: 20000,
        onSilence: () => {
          if (!recordingLockedRef.current && mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
          }
        },
        onMaxDuration: () => {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
          }
          toast({
            title: "Maximum recording length reached",
            description: "Voice messages can be up to 20 seconds.",
          });
        },
        onWaveformChange: (levels) => {
          const currentLevel = levels.reduce((sum, level) => sum + level, 0) / levels.length;
          setRecordingWaveform((previous) => [...previous.slice(1), currentLevel]);
        },
      });

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const recordedDurationMs = recordingStartedAtRef.current
          ? Date.now() - recordingStartedAtRef.current
          : 0;
        recordingStartedAtRef.current = null;
        setIsRecordingAudio(false);
        setRecordingWaveform(Array(14).fill(0));
        silenceDetectorRef.current?.stop();
        silenceDetectorRef.current = null;
        stream.getTracks().forEach(track => track.stop());

        if (audioChunksRef.current.length === 0) return;
        if (recordedDurationMs < 500) {
          audioChunksRef.current = [];
          toast({
            title: "Recording too short",
            description: "Hold the microphone for at least half a second.",
            variant: "destructive",
          });
          return;
        }
        const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        
        setIsTranscribingAudio(true);
        try {
          const transcribedText = await transcribeAudio(audioBlob);
          if (transcribedText) {
            setInputMessage((prev) => (prev ? `${prev} ${transcribedText}` : transcribedText));
            if (textareaRef.current) {
              textareaRef.current.focus();
              setTimeout(() => {
                if (textareaRef.current) {
                  textareaRef.current.style.height = 'auto';
                  textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
                }
              }, 50);
            }
          }
        } catch (err: any) {
          console.error("Transcription error:", err);
          toast({
            title: "Voice Transcription Failed",
            description: err?.message || "Could not transcribe audio. Please try again.",
            variant: "destructive",
          });
        } finally {
          setIsTranscribingAudio(false);
        }
      };

      recorder.start(250);
      recordingStartedAtRef.current = Date.now();
      recordingPointerIdRef.current = pointerId ?? null;
      recordingStartYRef.current = startY ?? 0;
      setRecordingWaveform(Array(14).fill(0));
      setIsRecordingLocked(false);
      recordingLockedRef.current = false;
      setIsRecordingAudio(true);
    } catch (err: any) {
      console.error("Mic permission error:", err);
      silenceDetectorRef.current?.stop();
      silenceDetectorRef.current = null;
      setIsRecordingAudio(false);
      toast({
        title: "Microphone Access Denied",
        description: err?.name === "NotAllowedError"
          ? "Microphone permission is blocked. Allow it in Android Settings, then reopen the app."
          : err?.name === "NotFoundError"
          ? "No microphone was found on this device."
          : err?.message || "The microphone could not be started.",
        variant: "destructive",
      });
    }
  };

  const handleMicPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    if (isRecordingAudio) {
      if (isRecordingLocked) stopRecording();
      return;
    }
    void startRecording(event.pointerId, event.clientY);
  };

  const handleMicPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!isRecordingAudio || isRecordingLocked || event.pointerId !== recordingPointerIdRef.current) return;
    if (recordingStartYRef.current - event.clientY >= 72) {
      setIsRecordingLocked(true);
      recordingLockedRef.current = true;
    }
  };

  const handleMicPointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.pointerId !== recordingPointerIdRef.current) return;
    recordingPointerIdRef.current = null;
    if (!isRecordingLocked) stopRecording();
  };

  const handlePlayVoice = async (text: string, index: number) => {
    if (!isPremium) {
      toast({
        title: "Premium Feature 👑",
        description: "Read-aloud voice is exclusively available for Premium subscribers.",
        variant: "destructive",
      });
      return;
    }

    if (playingAudioIndex === index) {
      playbackRequestRef.current += 1;
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current.currentTime = 0;
        currentAudioRef.current = null;
      }
      setPlayingAudioIndex(null);
      return;
    }

    try {
      const requestId = ++playbackRequestRef.current;
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current.currentTime = 0;
        currentAudioRef.current = null;
      }
      setPlayingAudioIndex(index);
      const sentences = splitSpeechText(text).map((sentence) => sentence.replace(/[.!?]+$/, '').trim());
      const audioPromises = new Map<number, Promise<string>>();
      const synthesizeSentence = (sentenceIndex: number) => {
        const existing = audioPromises.get(sentenceIndex);
        if (existing) return existing;
        const promise = synthesizeSpeech(sentences[sentenceIndex]);
        audioPromises.set(sentenceIndex, promise);
        return promise;
      };
      const playSentence = async (sentenceIndex: number): Promise<void> => {
        if (requestId !== playbackRequestRef.current || sentenceIndex >= sentences.length) {
          setPlayingAudioIndex(null);
          currentAudioRef.current = null;
          return;
        }
        const audioUrl = await synthesizeSentence(sentenceIndex);
        if (requestId !== playbackRequestRef.current) {
          return;
        }
        // Prepare the next sentence while this one is playing.
        if (sentenceIndex + 1 < sentences.length) {
          void synthesizeSentence(sentenceIndex + 1).catch(() => {});
        }
        const audio = new Audio(audioUrl);
        currentAudioRef.current = audio;
        audio.onended = () => {
          void playSentence(sentenceIndex + 1);
        };
        audio.onerror = () => {
          setPlayingAudioIndex(null);
          currentAudioRef.current = null;
        };
        await audio.play();
      };
      await playSentence(0);
    } catch (err: any) {
      console.error("TTS playback error:", err);
      setPlayingAudioIndex(null);
      toast({
        title: "Voice Synthesis Failed",
        description: err?.message || "Could not synthesize audio.",
        variant: "destructive",
      });
    }
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  if (authLoading) return <BrandedLoader fullscreen />;

  return (
    <div
      className="fixed inset-0 w-full flex overflow-hidden bg-[#F8FAFC] dark:bg-gray-950"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <Seo title="Dr. Ahroid | AI Tutor" />

      {/* DELETE MODAL */}
      <AlertDialog open={!!sessionToDelete} onOpenChange={() => setSessionToDelete(null)}>
        <AlertDialogContent className="rounded-3xl border-border bg-background">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-black italic uppercase">Delete Session?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">This session and all its messages will be permanently removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-2xl">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => sessionToDelete && deleteSessionMutation.mutate(sessionToDelete)} className="bg-destructive hover:bg-destructive/90 rounded-2xl font-bold">Delete Session</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* SIDEBAR */}
      <aside className={`fixed lg:relative z-50 w-80 h-full bg-gradient-to-b from-pink-50 via-white to-pink-100/70 dark:from-purple-950 dark:via-zinc-900 dark:to-purple-950/60 border-r border-border transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 flex flex-col shadow-xl`}>
        <div
          className="px-6 pb-5 border-b flex justify-between items-center"
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
        >
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-1">Study History</span>
            <span className="font-['Syne'] text-xl font-extrabold leading-none tracking-[-0.035em]">Your <span className="text-primary">Chats</span></span>
          </div>
          <Button variant="ghost" size="icon" onClick={startNewChat} className="rounded-xl hover:bg-primary/10 hover:text-primary"><PlusCircle className="w-6 h-6" /></Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {chatHistoryLoading ? (
            Array.from({ length: 6 }).map((_, index) => (
              <div
                key={`chat-skeleton-${index}`}
                className="rounded-2xl border-2 border-transparent p-4"
                aria-hidden="true"
              >
                <div className="h-4 w-4/5 animate-pulse rounded-md bg-muted" />
                <div className="mt-3 flex items-center gap-2">
                  <div className="h-3 w-3 animate-pulse rounded-full bg-muted" />
                  <div className="h-2.5 w-24 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))
          ) : chatHistory?.map((chat) => (
            <div key={chat.id} className="group relative">
              <button
                onClick={() => loadSession(chat)}
                className={`relative w-full overflow-hidden text-left p-4 rounded-2xl transition-all duration-300 border-2 ${currentSessionId === chat.id
                  ? 'bg-gradient-to-br from-primary/15 via-pink-400/10 to-purple-500/10 border-primary/50 shadow-lg shadow-primary/10'
                  : 'border-transparent hover:bg-secondary/50 hover:border-border/60'
                  }`}
              >
                {currentSessionId === chat.id && (
                  <motion.span
                    layoutId="activeChatIndicator"
                    className="absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-primary via-pink-400 to-purple-500"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <div className={`font-bold text-sm truncate uppercase tracking-tight mb-1 transition-colors ${currentSessionId === chat.id ? 'text-primary' : 'text-foreground'}`}>
                  {chat.session_name || "New Conversation"}
                </div>
                <div className={`flex items-center gap-2 transition-opacity ${currentSessionId === chat.id ? 'opacity-80' : 'opacity-60'}`}>
                  <Clock className={`w-3 h-3 ${currentSessionId === chat.id ? 'text-primary' : ''}`} />
                  <span className="text-[10px] font-bold uppercase">{new Date(chat.created_at).toLocaleDateString()}</span>
                </div>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setSessionToDelete(chat.id); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-2 hover:text-destructive transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {!chatHistoryLoading && (!chatHistory || chatHistory.length === 0) && (
            <div className="text-center py-10 px-6">
              <div className="w-12 h-12 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center opacity-40">
                <MessageSquare className="w-6 h-6" />
              </div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest leading-relaxed">No sessions found.<br />Start a new conversation</p>
            </div>
          )}
        </div>

        <div className="p-4 border-t bg-gradient-to-t from-pink-100/80 to-transparent dark:from-purple-950/70 dark:to-transparent">
          <Button variant="outline" className="h-12 w-full justify-start gap-3 rounded-xl border-border font-['Syne'] shadow-sm transition-colors hover:border-primary hover:bg-primary/5" onClick={startNewChat}>
            <PlusCircle className="w-4 h-4 text-primary" />
            <span className="text-xs font-bold">New conversation</span>
          </Button>
        </div>
      </aside>

      {/* MAIN CHAT AREA */}
      <main className="flex-1 flex flex-col min-h-0 relative">
        <div
          className="sticky top-0 z-30 w-full bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl border-b border-border px-4 sm:px-6 py-4 flex items-center justify-between"
          style={{
            paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)',
            paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)',
          }}
        >
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="h-11 w-11 lg:hidden rounded-xl" onClick={() => setIsSidebarOpen(true)} aria-label="Open chat history">
              <Menu className="w-6 h-6" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 shrink-0 overflow-hidden">
                <img src="/lovable-uploads/Mascot-mini.png" alt="Dr. Ahroid" className="h-full w-full object-contain" />
              </div>
              <div className="flex flex-col">
                <CardTitle className="font-['Syne'] text-lg font-extrabold tracking-[-0.035em]">Dr. <span className="text-primary">Ahroid</span></CardTitle>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-[10px] text-green-500 font-black uppercase tracking-[0.2em]">Always Online</span>
                </div>
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 rounded-xl hover:bg-primary/10 hover:text-primary"
            onClick={startNewChat}
            aria-label="Start a new chat"
            title="New chat"
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>

        <div
          ref={scrollContainerRef}
          onScroll={updateScrollFade}
          style={showScrollFade ? {
            maskImage: 'linear-gradient(to bottom, #000 calc(100% - 120px), transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, #000 calc(100% - 120px), transparent 100%)',
          } : undefined}
          className="flex-1 flex flex-col overflow-y-auto px-4 lg:px-12 py-8 scroll-smooth custom-scrollbar"
        >
          <div className="max-w-4xl w-full mx-auto flex flex-col flex-1 pt-4">
            {messages.length === 0 && !apiLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-8 mt-auto mb-auto">
                <div className="relative mb-6">
                  <div className="relative h-20 w-20 overflow-hidden">
                    <img src="/lovable-uploads/bf69a7f7-550a-45a1-8808-a02fb889f8c5.png" alt="Medmacs" className="h-full w-full object-contain" />
                  </div>
                </div>
                <h2 className="mb-2 font-['Syne'] text-2xl font-extrabold tracking-[-0.04em]">Your AI <span className="text-primary">Mentor</span></h2>
                <p className="text-sm text-muted-foreground font-medium max-w-sm mb-6">Ask about anatomy, pharmacology, procedures, or test cases.</p>
                {canUseChat && (
                  <div className="grid grid-cols-2 gap-2 w-full max-w-md">
                    {visibleSuggestions.map(q => (
                      <button
                        key={q}
                        onClick={() => setInputMessage(q)}
                        className="rounded-xl border border-border/60 bg-white p-3 text-center font-sans text-xs font-semibold shadow-sm transition-colors hover:border-primary/50 hover:bg-primary/5 dark:bg-zinc-900"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-6 flex flex-col w-full">
                {messages.map((msg, i) => (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={i}
                    className={`flex w-full ${msg.sender === 'user' ? 'justify-end' : isAiPolicyNotice(msg.text) ? 'justify-center' : 'justify-start'}`}
                  >
                    {msg.sender !== 'user' && isAiPolicyNotice(msg.text) ? (
                      <div className="max-w-md px-4 py-2 text-center">
                        <p className="text-xs font-bold leading-relaxed text-muted-foreground">{msg.text}</p>
                        <Link to="/pricing" className="mt-2 inline-flex text-xs font-black uppercase tracking-widest text-primary underline underline-offset-4">
                          View upgrade options
                        </Link>
                      </div>
                    ) : msg.sender === 'user' ? (
                      <div className="flex max-w-[88%] flex-col items-end sm:max-w-[72%]">
                        <div className="rounded-2xl rounded-br-sm bg-slate-200 px-4 py-3 text-slate-900 shadow-md shadow-black/5 dark:bg-slate-700 dark:text-slate-50 dark:shadow-black/20 sm:px-5 sm:py-3.5">
                          <div className="whitespace-pre-wrap text-[15px] font-medium leading-relaxed">
                            {msg.text}
                          </div>
                        </div>
                        <div className="mt-1.5 flex items-center gap-1.5 pr-1 text-muted-foreground">
                          <span className="text-[9px] font-bold uppercase tracking-[0.08em]">{msg.time}</span>
                          <span aria-hidden="true" className="h-0.5 w-0.5 rounded-full bg-current opacity-50" />
                          <button
                            type="button"
                            onClick={() => copyToClipboard(msg.text, i)}
                            aria-label="Copy your message"
                            className="flex h-6 items-center gap-1 rounded-md px-1.5 text-[9px] font-bold uppercase tracking-wider transition-colors hover:bg-muted hover:text-foreground"
                          >
                            {copiedIndex === i ? 'Copied' : <><Copy className="h-3 w-3" /> Copy</>}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="w-full max-w-3xl">
                        <div className="min-w-0">
                          <div className="whitespace-pre-wrap text-[15px] font-medium leading-relaxed text-foreground">
                            <WordRevealMessage
                              text={msg.text}
                              animate={revealingMessageIndex === i}
                              onComplete={() => setRevealingMessageIndex(current => current === i ? null : current)}
                            />
                          </div>
                          {shouldShowCreatorInstagramCta(msg.text) && (
                            <InstagramCreatorCta />
                          )}
                          <div className="mt-2 flex items-center gap-1.5 text-muted-foreground">
                            <span className="text-[9px] font-bold uppercase tracking-[0.08em]">{msg.time}</span>
                            <span aria-hidden="true" className="h-0.5 w-0.5 rounded-full bg-current opacity-50" />
                            <button
                              type="button"
                              onClick={() => copyToClipboard(msg.text, i)}
                              aria-label="Copy Dr. Ahroid's response"
                              className="flex h-6 items-center gap-1 rounded-md px-1.5 text-[9px] font-bold uppercase tracking-wider transition-colors hover:bg-muted hover:text-foreground"
                            >
                              {copiedIndex === i ? 'Copied' : <><Copy className="h-3 w-3" /> Copy</>}
                            </button>
                            {isPremium && (
                              <>
                                <span aria-hidden="true" className="h-0.5 w-0.5 rounded-full bg-current opacity-50" />
                                <button
                                  type="button"
                                  onClick={() => handlePlayVoice(msg.text, i)}
                                  aria-label="Listen to voice output"
                                  title="Listen to answer"
                                  className={`flex h-6 items-center gap-1 rounded-md px-1.5 text-[9px] font-bold uppercase tracking-wider transition-colors hover:bg-muted hover:text-foreground ${
                                    playingAudioIndex === i ? 'text-primary font-black animate-pulse' : ''
                                  }`}
                                >
                                  {playingAudioIndex === i ? (
                                    <><Loader2 className="h-3 w-3 animate-spin text-primary" /> Speaking</>
                                  ) : (
                                    <><Volume2 className="h-3 w-3" /> Listen</>
                                  )}
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}

                {apiLoading && (
                  <div className="w-full max-w-3xl">
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex w-full items-center gap-3"
                      role="status"
                      aria-label={loadingStatus?.text || 'Working'}
                    >
                      <motion.img
                        src="/favicon.png"
                        alt=""
                        aria-hidden="true"
                        animate={{ y: [0, -7, 0] }}
                        transition={{ duration: 0.75, repeat: Infinity, ease: 'easeInOut' }}
                        className="h-7 w-7 rounded-md object-cover"
                      />
                      {loadingStatus?.text ? (
                        <motion.p
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-[15px] font-medium leading-relaxed text-muted-foreground/70"
                        >
                          {loadingStatus.text}
                        </motion.p>
                      ) : null}
                    </motion.div>
                  </div>
                )}
              </div>
            )}
            <div ref={messagesEndRef} className="h-4 flex-shrink-0" />
          </div>
        </div>

        <footer className="relative p-4 lg:px-8 lg:py-5">
          <motion.div
            aria-hidden="true"
            initial={{ opacity: 0, y: 56 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="pointer-events-none absolute inset-x-0 bottom-0 top-[-96px] z-0 bg-gradient-to-t from-pink-200/80 via-pink-100/30 to-transparent dark:from-purple-900/60 dark:via-purple-800/20 dark:to-transparent"
          />
          <div className="relative z-10 max-w-4xl mx-auto mb-[max(0px,env(safe-area-inset-bottom))]">
            {profileLoading ? (
              <div className="flex h-16 items-center justify-center rounded-2xl bg-secondary/30 animate-pulse">
                <p className="text-sm text-muted-foreground">Loading...</p>
              </div>
            ) : (
              <>
                <form
                  onSubmit={handleSendMessage}
                  onFocus={() => setIsInputFocused(true)}
                  onBlur={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsInputFocused(false);
                  }}
                  className="group relative flex items-end gap-2 rounded-2xl border border-border/40 bg-transparent px-3.5 py-2.5 transition-colors duration-300"
                >
                  <motion.span
                    aria-hidden="true"
                    initial={false}
                    animate={{ opacity: isInputFocused ? 0.75 : 0, scale: isInputFocused ? 1 : 0.94 }}
                    transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                    className="pointer-events-none absolute -inset-1 -z-10 rounded-[1.35rem] bg-gradient-to-r from-pink-400/40 via-primary/50 to-purple-500/40 blur-lg dark:from-purple-500/50 dark:via-primary/50 dark:to-pink-500/50"
                  />
                  <motion.span
                    aria-hidden="true"
                    initial={false}
                    animate={{
                      opacity: isInputFocused ? 1 : 0,
                      backgroundPosition: isInputFocused ? ['130% 50%', '-30% 50%'] : '130% 50%',
                    }}
                    transition={{
                      opacity: { duration: 0.35, ease: 'easeOut' },
                      backgroundPosition: { duration: 2.4, repeat: isInputFocused ? Infinity : 0, ease: 'linear' },
                    }}
                    className="pointer-events-none absolute -inset-px rounded-2xl p-px"
                    style={{
                      backgroundImage: 'linear-gradient(110deg, transparent 25%, hsl(var(--primary)) 45%, #ec4899 55%, transparent 75%)',
                      backgroundSize: '220% 100%',
                      WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                      WebkitMaskComposite: 'xor',
                      mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                      maskComposite: 'exclude',
                    }}
                  />
                  <div className="relative z-10 flex-1 flex items-center">
                    <textarea
                      ref={textareaRef}
                      placeholder={isRecordingAudio || isTranscribingAudio || apiLoading ? '' : "Ask Dr. Ahroid anything medical..."}
                      value={inputMessage}
                      rows={1}
                      onChange={e => {
                        setInputMessage(e.target.value);
                        e.target.style.height = 'auto';
                        e.target.style.height = `${Math.min(Math.max(e.target.scrollHeight, 40), 160)}px`;
                      }}
                      onKeyDown={e => {
                        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                          e.preventDefault();
                          if (!apiLoading && inputMessage.trim()) {
                            handleSendMessage(e);
                          }
                        }
                      }}
                      disabled={apiLoading || isTranscribingAudio}
                      className="w-full resize-none border-0 bg-transparent py-1.5 pl-1 pr-10 text-sm font-medium shadow-none outline-none placeholder:text-muted-foreground/70 focus:ring-0 max-h-40 overflow-y-auto"
                    />
                    {(isRecordingAudio || isTranscribingAudio || apiLoading) && (
                      <div className="pointer-events-none absolute inset-0 flex items-center gap-2 overflow-hidden pl-1 pr-10 text-sm font-medium">
                        {isRecordingAudio ? (
                          <span
                            role="status"
                            aria-label="Recording"
                            className="flex items-center gap-2 text-rose-500 dark:text-rose-400"
                          >
                            <span className="flex h-5 min-w-0 flex-1 items-center justify-end gap-0.5 overflow-hidden" aria-hidden="true">
                              {recordingWaveform.map((level, bar) => (
                                <span
                                  key={bar}
                                  className="min-w-0 flex-1 rounded-full bg-current transition-[height] duration-75"
                                  style={{
                                    height: `${Math.max(3, Math.round(level * 22))}px`,
                                  }}
                                />
                              ))}
                            </span>
                          </span>
                        ) : isTranscribingAudio ? (
                          <span
                            role="status"
                            aria-live="polite"
                            className="flex items-center gap-2 text-amber-500 drop-shadow-[0_0_6px_rgba(245,158,11,0.45)] animate-pulse dark:text-amber-400"
                          >
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Processing audio...
                          </span>
                        ) : (
                          <span className="flex items-center gap-2 text-primary">
                            <Sparkles className="h-3.5 w-3.5 animate-spin" />
                            {loadingStatus?.text || "Finding results..."}
                          </span>
                        )}
                      </div>
                    )}
                  <button
                    type="button"
                    onPointerDown={handleMicPointerDown}
                    onPointerMove={handleMicPointerMove}
                    onPointerUp={handleMicPointerUp}
                    onPointerCancel={stopRecording}
                    disabled={isTranscribingAudio || apiLoading || Boolean(inputMessage.trim())}
                    aria-label="Use voice input"
                    className={`touch-none select-none absolute right-1 bottom-1 rounded-lg p-2 transition-all ${
                      isRecordingAudio
                        ? 'bg-destructive text-white animate-pulse shadow-md shadow-destructive/30'
                        : isTranscribingAudio
                        ? 'cursor-not-allowed bg-amber-500/70 text-white opacity-70'
                        : 'text-muted-foreground hover:bg-primary/10 hover:text-primary active:scale-95'
                    } ${isTranscribingAudio || inputMessage.trim() ? 'cursor-not-allowed opacity-50' : ''}`}
                    title={
                      isTranscribingAudio
                        ? "Processing audio..."
                        : inputMessage.trim()
                        ? "Clear the text to use voice input"
                        : isRecordingAudio
                        ? isRecordingLocked ? "Locked recording. Tap to send" : "Hold to speak. Drag up to lock"
                        : "Tap and hold to speak"
                    }
                  >
                    {isTranscribingAudio ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isRecordingAudio ? (
                      isRecordingLocked ? <LockKeyhole className="h-4 w-4" /> :
                      <MicOff className="h-4 w-4" />
                    ) : (
                      <Mic className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <Button
                  type="submit"
                  disabled={apiLoading || !inputMessage.trim()}
                  size="icon"
                  className="relative z-10 h-10 w-10 shrink-0 rounded-xl bg-primary shadow-md shadow-primary/20 transition-all hover:bg-primary/90 active:scale-95"
                >
                  <Send className="h-4 w-4 text-white" />
                </Button>
              </form>
            </>
          )}
          <p className="mt-3 text-center font-['Syne'] text-[9px] font-bold tracking-wide text-muted-foreground/45">Dr Ahroid is trained on syllabus course.</p>
        </div>
        </footer>
      </main>

      {isSidebarOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
};

export default DrSultanChat;
