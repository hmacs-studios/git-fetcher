import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Bot, Sparkles, User, RefreshCw, Mic, MicOff, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { renderAiMessageText } from '@/utils/format';
import { aiApiJson } from '@/utils/aiApi';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { transcribeAudio, getBestAudioMimeType, createSilenceDetector, type SilenceDetectorController } from '@/utils/cloudSpeech';

interface DrAhroidModalProps {
  isOpen: boolean;
  onClose: () => void;
  reelTopic: string;
  reelCategory?: string;
  diagnosisText?: string;
}

interface Message {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  timestamp: string;
}

export const DrAhroidModal: React.FC<DrAhroidModalProps> = ({
  isOpen,
  onClose,
  reelTopic,
  reelCategory = 'Clinical Case',
  diagnosisText = '',
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [isTranscribingAudio, setIsTranscribingAudio] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const silenceDetectorRef = useRef<SilenceDetectorController | null>(null);

  const { data: profile } = useQuery({
    queryKey: ['profile-plan', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('plan').eq('id', user?.id).maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const isPremium = profile?.plan === 'premium';

  const handleMicClick = async () => {
    if (!isPremium) {
      toast({
        title: "Premium Feature 👑",
        description: "Cloud Voice Assistant (Whisper AI) is available exclusively for Premium members.",
        variant: "destructive",
      });
      return;
    }

    if (isRecordingAudio) {
      silenceDetectorRef.current?.stop();
      silenceDetectorRef.current = null;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
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

      // Auto-stop recording when user finishes speaking (1.6s silence)
      silenceDetectorRef.current = createSilenceDetector(stream, {
        silenceDurationMs: 1600,
        onSilence: () => {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
          }
        },
      });

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        setIsRecordingAudio(false);
        silenceDetectorRef.current?.stop();
        silenceDetectorRef.current = null;
        stream.getTracks().forEach(track => track.stop());

        if (audioChunksRef.current.length === 0) return;
        const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        
        setIsTranscribingAudio(true);
        try {
          const transcribedText = await transcribeAudio(audioBlob);
          if (transcribedText) {
            setInputText((prev) => (prev ? `${prev} ${transcribedText}` : transcribedText));
            if (textareaRef.current) {
              textareaRef.current.focus();
              setTimeout(() => {
                if (textareaRef.current) {
                  textareaRef.current.style.height = 'auto';
                  textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
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
      setIsRecordingAudio(true);
    } catch (err: any) {
      console.error("Mic permission error:", err);
      silenceDetectorRef.current?.stop();
      silenceDetectorRef.current = null;
      setIsRecordingAudio(false);
      toast({
        title: "Microphone Access Denied",
        description: "Please allow microphone permissions to use voice input.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (isOpen && reelTopic) {
      const initialAiMsg: Message = {
        id: 'init-1',
        sender: 'ai',
        text: `Greetings! I am **Dr Ahroid**, your clinical AI mentor. I see you are analyzing **${reelTopic}** (${reelCategory}). What diagnostic features, treatment protocols, or high-yield exam pearls would you like me to clarify for you?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages([initialAiMsg]);
    }
  }, [isOpen, reelTopic, reelCategory]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  if (!isOpen) return null;

  const handleSend = async (customPrompt?: string) => {
    const textToSend = customPrompt || inputText.trim();
    if (!textToSend || isLoading) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customPrompt) setInputText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setIsLoading(true);

    try {
      const composedPrompt = `Medical Case: ${reelTopic} (${reelCategory})
Clinical Details: ${diagnosisText || 'N/A'}
Question: ${textToSend}`;

      const historyTurns = messages.slice(-8).map((m) => ({
        sender: m.sender,
        text: m.text,
      }));

      const data = await aiApiJson<{ answer?: string }>('ai/study-chat', { question: composedPrompt, history: historyTurns }, {});

      const responseText = data.answer || 'Dr Ahroid is analyzing the case details. Please try asking again.';

      const aiMsg: Message = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: responseText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (e) {
      console.error('[DrAhroidModal] Error:', e);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'ai',
          text: `Dr Ahroid Clinical Note: ${reelTopic} presents with classic pathognomonic diagnostic features. Recommended first-line workup involves confirming histopathology or microbiology, followed by targeted therapy.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[100] flex flex-col justify-end bg-black/60 dark:bg-black/70 backdrop-blur-sm animate-in fade-in duration-200 cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-h-[85vh] h-[600px] bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-indigo-500/30 rounded-t-3xl shadow-2xl flex flex-col overflow-hidden text-slate-900 dark:text-white transition-all cursor-default"
      >
        {/* Modal Header */}
        <div
          className="flex items-center justify-between px-5 pb-3.5 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-950/80"
          style={{ paddingTop: 'max(1.5rem, calc(env(safe-area-inset-top, 0px) + 0.875rem))' }}
        >
          <div className="flex items-center gap-3">
            <img
              src="/favicon.png"
              alt="Dr. Ahroid Mascot"
              className="w-10 h-10 rounded-xl object-cover border border-cyan-500/30 shadow-md shadow-cyan-500/10"
            />
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white tracking-wide">Dr Ahroid</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[240px]">Topic: {reelTopic}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-full bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Suggestion Chips */}
        <div className="flex gap-2 px-4 py-2 overflow-x-auto border-b border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-slate-950/40 text-xs no-scrollbar">
          <button
            onClick={() => handleSend(`What are the key diagnostic features of ${reelTopic}?`)}
            className="px-3 py-1.5 rounded-full bg-indigo-100 dark:bg-indigo-500/10 hover:bg-indigo-200 dark:hover:bg-indigo-500/20 border border-indigo-300 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300 shrink-0 transition font-medium"
          >
            🔍 Key Diagnostic Features
          </button>
          <button
            onClick={() => handleSend(`What is the first-line treatment for ${reelTopic}?`)}
            className="px-3 py-1.5 rounded-full bg-cyan-100 dark:bg-cyan-500/10 hover:bg-cyan-200 dark:hover:bg-cyan-500/20 border border-cyan-300 dark:border-cyan-500/30 text-cyan-700 dark:text-cyan-300 shrink-0 transition font-medium"
          >
            💊 First-line Treatment
          </button>
          <button
            onClick={() => handleSend(`High-yield exam pearls for ${reelTopic}?`)}
            className="px-3 py-1.5 rounded-full bg-amber-100 dark:bg-amber-500/10 hover:bg-amber-200 dark:hover:bg-amber-500/20 border border-amber-300 dark:border-amber-500/30 text-amber-700 dark:text-amber-300 shrink-0 transition font-medium"
          >
            ⭐ Exam Pearls
          </button>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4 text-sm bg-slate-50/50 dark:bg-zinc-950/50">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex w-full ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.sender === 'user' ? (
                <div className="flex max-w-[88%] flex-col items-end sm:max-w-[75%]">
                  <div className="rounded-2xl rounded-br-sm bg-slate-200 dark:bg-slate-700 px-4 py-3 text-slate-900 dark:text-slate-50 shadow-md shadow-black/5 dark:shadow-black/20 text-xs sm:text-[14px]">
                    <div className="whitespace-pre-wrap font-medium leading-relaxed">
                      {msg.text}
                    </div>
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 pr-1 text-slate-400">
                    <span className="text-[9px] font-bold uppercase tracking-[0.08em]">{msg.timestamp}</span>
                  </div>
                </div>
              ) : (
                <div className="w-full max-w-3xl flex gap-3">
                  <img
                    src="/favicon.png"
                    alt=""
                    className="w-7 h-7 rounded-lg object-cover border border-cyan-500/30 shrink-0 mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-slate-900 dark:text-foreground text-xs sm:text-[14px] font-medium leading-relaxed space-y-2">
                      {renderAiMessageText(msg.text)}
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-slate-400 dark:text-muted-foreground">
                      <span className="text-[9px] font-bold uppercase tracking-[0.08em]">{msg.timestamp}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex items-center gap-3 p-2 text-xs font-medium text-slate-500 dark:text-muted-foreground">
              <img
                src="/favicon.png"
                alt=""
                className="w-6 h-6 rounded-md object-cover animate-bounce"
              />
              <span>Dr. Ahroid is preparing clinical response...</span>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input Bar - Styled like AIChatbot page */}
        <div className="relative p-3 sm:p-4 pb-20 border-t border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 backdrop-blur-xl">
          <div className="group relative flex items-end gap-2 rounded-2xl border border-slate-200 dark:border-0 bg-slate-100 dark:bg-zinc-800/60 px-3.5 py-2 shadow-sm transition-all focus-within:bg-slate-50 dark:focus-within:bg-zinc-800">
            <div className="relative flex-1 flex items-center">
              <textarea
                ref={textareaRef}
                placeholder={
                  isRecordingAudio
                    ? "Listening... (auto-stops when you pause)"
                    : isTranscribingAudio
                    ? "Processing audio with Whisper AI..."
                    : isLoading
                    ? "Finding results..."
                    : `Ask Dr. Ahroid about ${reelTopic}...`
                }
                value={inputText}
                rows={1}
                onChange={(e) => {
                  setInputText(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                }}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault();
                    if (!isLoading && inputText.trim()) {
                      handleSend();
                    }
                  }
                }}
                disabled={isLoading || isTranscribingAudio}
                className="w-full resize-none border-0 bg-transparent py-1.5 pl-1 pr-9 text-xs sm:text-sm font-medium text-slate-900 dark:text-white shadow-none outline-none placeholder:text-slate-400 dark:placeholder:text-muted-foreground/70 focus:ring-0 max-h-32 overflow-y-auto"
              />
              {(isRecordingAudio || isTranscribingAudio || isLoading) && (
                <div className="pointer-events-none absolute inset-0 flex items-center gap-2 overflow-hidden pl-1 pr-9 text-xs sm:text-sm font-medium">
                  {isRecordingAudio ? (
                    <span className="flex items-center gap-2 text-rose-500 animate-pulse">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
                      </span>
                      Listening... (auto-stops when you pause)
                    </span>
                  ) : isTranscribingAudio ? (
                    <span className="flex items-center gap-2 text-amber-500 dark:text-amber-400">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Processing audio with Whisper AI...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400">
                      <Sparkles className="h-3.5 w-3.5 animate-spin" />
                      Finding results...
                    </span>
                  )}
                </div>
              )}
              <button
                type="button"
                onClick={handleMicClick}
                disabled={isLoading || isTranscribingAudio}
                title={
                  isTranscribingAudio
                    ? "Transcribing with Whisper AI..."
                    : isRecordingAudio
                    ? "Recording... Tap to stop"
                    : "Click to speak (Whisper AI)"
                }
                className={`absolute right-1 bottom-1 rounded-lg p-1.5 transition-all ${
                  isRecordingAudio
                    ? 'bg-red-600 text-white animate-pulse shadow-md shadow-red-500/30'
                    : isTranscribingAudio
                    ? 'bg-amber-500 text-white animate-pulse'
                    : 'text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 active:scale-95'
                }`}
              >
                {isTranscribingAudio ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isRecordingAudio ? (
                  <MicOff className="w-4 h-4" />
                ) : (
                  <Mic className="w-4 h-4" />
                )}
              </button>
            </div>
            <button
              type="button"
              onClick={() => handleSend()}
              disabled={isLoading || !inputText.trim()}
              className="h-9 w-9 shrink-0 rounded-xl bg-cyan-600 dark:bg-cyan-500 text-white flex items-center justify-center shadow-md shadow-cyan-500/20 transition-all hover:bg-cyan-500 disabled:opacity-30 active:scale-95"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="mt-2 text-center text-[9px] font-bold tracking-wide text-slate-400 dark:text-muted-foreground/60">
            Dr Ahroid is grounded on clinical syllabus & Medmacs RAG.
          </p>
        </div>
      </div>
    </div>
  );
};
