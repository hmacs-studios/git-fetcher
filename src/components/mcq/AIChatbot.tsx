import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Copy, Send, X, WifiOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { aiApiJson, aiApiOrigin } from '@/utils/aiApi';
import { isAiPolicyNotice } from '@/utils/aiPolicyNotice';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
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

interface AIChatbotProps {
  isOpen: boolean;
  onClose: () => void;
  questionContext?: string;
  explanationContext?: string;
  currentAnswer?: string | null;
  correctAnswer?: string;
  userPlan?: string;
  isHidden?: boolean;
  onOpen: () => void;
  onQuestionHelp?: () => void;
  isOnline?: boolean;
  prefillPrompt?: string;
}

export const AIChatbot: React.FC<AIChatbotProps> = ({
  isOpen,
  onClose,
  questionContext,
  explanationContext,
  currentAnswer,
  correctAnswer,
  userPlan: _userPlan,
  isHidden = false,
  onOpen,
  onQuestionHelp,
  isOnline = true,
  prefillPrompt = ''
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [revealingMessageIndex, setRevealingMessageIndex] = useState<number | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesScrollAreaRef = useRef<HTMLDivElement>(null);
  const pullStartYRef = useRef<number | null>(null);
  const pullStartedAtTopRef = useRef(false);
  const pullDeltaYRef = useRef(0);

  const scrollToBottom = () => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); };
  useEffect(() => { scrollToBottom(); }, [messages]);

  useEffect(() => {
    if (isOpen && prefillPrompt) setInput(prefillPrompt);
  }, [isOpen, prefillPrompt]);


  const sendMessage = async (message: string) => {
    if (!message.trim() || isLoading) return;
    if (!isOnline) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'This feature is not available offline. Connect to the internet and try again.',
        timestamp: new Date().toISOString(),
      }]);
      return;
    }
    const userMessage: Message = { role: 'user', content: message.trim(), timestamp: new Date().toISOString() };
    const responseIndex = messages.length + 1;
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    try {
      let composedPrompt = message.trim();
      if (questionContext) {
        composedPrompt = `MCQ Question: ${questionContext}\nCorrect Answer: ${correctAnswer}\nUser Selected: ${currentAnswer || 'None'}\nExplanation Provided: ${explanationContext}\n\nUser Query: ${message.trim()}`;
      }
      const data = await aiApiJson<{ answer?: string }>('ai/study-chat', { question: composedPrompt }, {});
      const answer = data.answer || 'Sorry, I could not generate a response.';
      setRevealingMessageIndex(responseIndex);
      setMessages(prev => [...prev, { role: 'assistant', content: answer, timestamp: new Date().toISOString() }]);
    } catch (error: any) {
      setRevealingMessageIndex(responseIndex);
      setMessages(prev => [...prev, { role: 'assistant', content: error?.message || `Sorry, there was an error connecting to the AI service. Please check if the server at ${aiApiOrigin} is running and try again.`, timestamp: new Date().toISOString() }]);
    } finally { setIsLoading(false); }
  };

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); sendMessage(input); };
  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    window.setTimeout(() => setCopiedIndex(null), 2000);
  };
  const getMessagesViewport = () => (
    messagesScrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLDivElement | null
  );

  const handleMessagesTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    const viewport = getMessagesViewport();
    pullStartYRef.current = event.touches[0]?.clientY ?? null;
    pullDeltaYRef.current = 0;
    pullStartedAtTopRef.current = Boolean(viewport && viewport.scrollTop <= 0);
  };

  const handleMessagesTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (pullStartYRef.current === null || !pullStartedAtTopRef.current) return;
    const viewport = getMessagesViewport();
    if (!viewport || viewport.scrollTop > 0) {
      pullStartedAtTopRef.current = false;
      return;
    }

    pullDeltaYRef.current = (event.touches[0]?.clientY ?? pullStartYRef.current) - pullStartYRef.current;
  };

  const handleMessagesTouchEnd = () => {
    if (pullStartedAtTopRef.current && pullDeltaYRef.current > 90) {
      onClose();
    }
    pullStartYRef.current = null;
    pullStartedAtTopRef.current = false;
    pullDeltaYRef.current = 0;
  };

  const handleQuestionHelp = () => {
    if (!questionContext) return;
    if (!isOnline) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'This feature is not available offline. Connect to the internet and try again.',
        timestamp: new Date().toISOString(),
      }]);
      return;
    }
    onQuestionHelp?.();
    sendMessage(`Explain this MCQ:\n${questionContext}\nExplanation: ${explanationContext}`);
  };

  return (
    <>
      <AnimatePresence>
        {!isHidden && (
          <motion.div
            className="fixed bottom-6 right-4 z-50 flex items-center justify-center"
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            initial={{ opacity: 0, scale: 0.5, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5, y: 20 }}
          >
            {/* Periodic 12-second pulse glow when question hasn't been attempted */}
            {!currentAnswer && (
              <motion.div
                className="absolute -inset-2.5 rounded-full bg-primary/50 blur-md pointer-events-none"
                animate={{
                  scale: [1, 1.45, 1],
                  opacity: [0, 0.9, 0],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  repeatDelay: 10.5,
                  ease: 'easeInOut',
                }}
              />
            )}

            {/* External circle wrapper with prominent shadow & gradient border */}
            <div className="relative p-1 rounded-full bg-gradient-to-br from-primary via-blue-500 to-indigo-600 shadow-2xl shadow-primary/50 border-2 border-white/60 dark:border-zinc-800">
              <Button
                type="button"
                onClick={onOpen}
                className="w-14 h-14 rounded-full bg-background p-1.5 shadow-inner ring-2 ring-primary/40 hover:ring-primary hover:bg-primary/5 transition-all flex items-center justify-center cursor-pointer"
                aria-label="Ask Dr. Ahroid"
              >
                <img
                  src="/lovable-uploads/Mascot-mini.png"
                  alt="Dr. Ahroid"
                  className="w-full h-full object-contain rounded-full drop-shadow-sm"
                />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-50 flex flex-col overflow-hidden border border-border/40 bg-background/95 shadow-2xl backdrop-blur-2xl sm:inset-auto sm:bottom-4 sm:right-4 sm:h-[540px] sm:w-[26rem] sm:rounded-2xl"
          >
            {/* Edge-to-edge header with fade — no colored bar, content fades into status bar */}
            <div className="relative flex-shrink-0">
              {/* Fade overlay at top for status bar blend */}
              <div className="absolute top-0 left-0 right-0 h-[env(safe-area-inset-top,0px)] bg-gradient-to-b from-background to-transparent z-10 pointer-events-none" />

              <div className="flex items-center justify-between border-b border-border/40 px-4 pb-3 pt-[calc(env(safe-area-inset-top,0px)+12px)]">
                <div className="flex items-center space-x-2">
                  <div className="h-9 w-9 overflow-hidden">
                    <img src="/lovable-uploads/Mascot-mini.png" alt="Dr. Ahroid" className="h-full w-full object-contain" />
                  </div>
                  <div>
                    <span className="font-['Syne'] text-sm font-extrabold tracking-[-0.03em] text-foreground">Dr. <span className="text-primary">Ahroid</span></span>
                    <p className="text-[10px] text-muted-foreground">AI Study Assistant</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 rounded-lg p-0 text-muted-foreground hover:bg-muted hover:text-foreground">
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>

            <>
              {/* Messages */}
              <ScrollArea
                ref={messagesScrollAreaRef}
                className="flex-1 overscroll-contain px-4 py-4"
                onTouchStart={handleMessagesTouchStart}
                onTouchMove={handleMessagesTouchMove}
                onTouchEnd={handleMessagesTouchEnd}
                onTouchCancel={handleMessagesTouchEnd}
              >
                {!isOnline ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-12">
                    <div className="w-16 h-16 rounded-full bg-amber-500/10 backdrop-blur-lg flex items-center justify-center mb-4">
                      <WifiOff className="w-8 h-8 text-amber-600 dark:text-amber-300" />
                    </div>
                    <p className="text-sm font-bold text-foreground">This feature is not available offline.</p>
                    <p className="text-xs text-muted-foreground mt-1">Connect to the internet and try again.</p>
                  </div>
                ) : messages.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center py-12 text-center">
                      <div className="mb-4 h-16 w-16 overflow-hidden">
                        <img src="/lovable-uploads/Mascot-mini.png" alt="Dr. Ahroid" className="h-full w-full object-contain" />
                      </div>
                      <p className="font-['Syne'] text-base font-extrabold tracking-[-0.03em] text-foreground">Ask me anything</p>
                      <p className="text-xs text-muted-foreground mt-1">I'm Dr. Ahroid, your MBBS tutor.</p>
                    </div>
                  ) : (
                    <div className="w-full space-y-5">
                      {messages.map((message, index) => (
                        <div key={index} className={`flex w-full ${message.role === 'user' ? 'justify-end' : isAiPolicyNotice(message.content) ? 'justify-center' : 'justify-start'}`}>
                          {message.role !== 'user' && isAiPolicyNotice(message.content) ? (
                            <div className="max-w-[88%] text-center">
                              <p className="text-xs font-bold leading-relaxed text-muted-foreground">{message.content}</p>
                              <a href="/pricing" className="mt-2 inline-flex text-xs font-black uppercase tracking-widest text-primary underline underline-offset-4">
                                View upgrade options
                              </a>
                            </div>
                          ) : message.role === 'user' ? (
                            <div className="flex max-w-[86%] flex-col items-end">
                              <div className="rounded-2xl rounded-br-sm bg-slate-200 px-4 py-3 text-sm text-slate-900 shadow-md shadow-black/5 dark:bg-slate-700 dark:text-slate-50 dark:shadow-black/20">
                                <div className="whitespace-pre-wrap break-words leading-relaxed">{message.content}</div>
                              </div>
                              <div className="mt-1 flex items-center gap-1.5 pr-1 text-muted-foreground">
                                <span className="text-[9px] font-bold">
                                  {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <span aria-hidden="true" className="h-0.5 w-0.5 rounded-full bg-current opacity-50" />
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(message.content, index)}
                                  className="flex h-6 items-center gap-1 rounded-md px-1.5 text-[9px] font-bold transition-colors hover:bg-muted hover:text-foreground"
                                  aria-label="Copy your message"
                                >
                                  {copiedIndex === index ? 'Copied' : <><Copy className="h-3 w-3" /> Copy</>}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="w-full">
                              <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
                                <WordRevealMessage
                                  text={message.content}
                                  animate={revealingMessageIndex === index}
                                  onComplete={() => setRevealingMessageIndex(current => current === index ? null : current)}
                                />
                              </div>
                              {shouldShowCreatorInstagramCta(message.content) && (
                                <InstagramCreatorCta />
                              )}
                              <div className="mt-1.5 flex items-center gap-1.5 text-muted-foreground">
                                <span className="text-[9px] font-bold">
                                  {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <span aria-hidden="true" className="h-0.5 w-0.5 rounded-full bg-current opacity-50" />
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(message.content, index)}
                                  className="flex h-6 items-center gap-1 rounded-md px-1.5 text-[9px] font-bold transition-colors hover:bg-muted hover:text-foreground"
                                  aria-label="Copy Dr. Ahroid's response"
                                >
                                  {copiedIndex === index ? 'Copied' : <><Copy className="h-3 w-3" /> Copy</>}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                      {isLoading && (
                        <div className="flex justify-start" role="status" aria-label="Dr. Ahroid is thinking">
                          <motion.img
                            src="/favicon.png"
                            alt=""
                            aria-hidden="true"
                            animate={{ y: [0, -7, 0] }}
                            transition={{ duration: 0.75, repeat: Infinity, ease: 'easeInOut' }}
                            className="h-7 w-7 rounded-md object-cover"
                          />
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
              </ScrollArea>

              {/* Help button */}
              {questionContext && (
                <div className="flex-shrink-0 border-t border-border/30 px-3 py-2">
                  <Button variant="outline" size="sm" onClick={handleQuestionHelp} disabled={!isOnline} className="h-9 w-full rounded-xl border-border/50 bg-background/40 font-['Syne'] text-xs backdrop-blur-lg">
                    Help with current question
                  </Button>
                </div>
              )}

              {/* Input */}
              <div className="flex-shrink-0 border-t border-border/30 px-3 py-3 pb-[calc(env(safe-area-inset-bottom)+12px)] sm:pb-3">
                <form
                  onSubmit={handleSubmit}
                  className="flex min-h-14 items-center gap-2 rounded-2xl border border-border/70 bg-card p-1.5 shadow-lg shadow-black/[0.04] transition-all focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/10"
                >
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={isOnline ? 'Ask Dr. Ahroid anything medical...' : 'Connect to internet to use AI chat'}
                    disabled={isLoading || !isOnline}
                    className="h-11 flex-1 rounded-none border-0 bg-transparent px-3 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                  <Button type="submit" disabled={isLoading || !isOnline || !input.trim()} size="sm" className="h-10 w-10 shrink-0 rounded-xl bg-primary p-0 shadow-md shadow-primary/20 hover:bg-primary/90">
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            </>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
