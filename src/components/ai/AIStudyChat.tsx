import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Send, MessageSquare, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import { Message, ChatSession, ChatSessionInsert, ChatSessionUpdate } from '@/types/ai';
import { notifyAchievementProgress } from '@/components/profile/AchievementBadges';
import { aiApiStream, type AiStreamStatus } from '@/utils/aiApi';
import { renderAiMessageText } from '@/utils/format';
import { InstagramCreatorCta, shouldShowCreatorInstagramCta } from '@/components/ai/InstagramCreatorCta';
import { isAiPolicyNotice } from '@/utils/aiPolicyNotice';
import { useNavigate } from 'react-router-dom';

export const AIStudyChat = () => {
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState<AiStreamStatus | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!isLoading) setLoadingStatus(null);
  }, [isLoading]);

  useEffect(() => {
    if (user) loadSessions();
  }, [user]);

  const loadSessions = async () => {
    try {
      setIsLoadingSessions(true);
      const { data, error } = await supabase
        .from('ai_chat_sessions')
        .select('*')
        .eq('user_id', user?.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const formatted: ChatSession[] = data.map(session => ({
        ...session,
        messages: Array.isArray(session.messages)
          ? session.messages.map((m: any) => ({
              role: m.role,
              content: m.content,
              timestamp: m.timestamp
            }))
          : []
      }));

      setSessions(formatted);
      if (formatted.length) {
        setCurrentSession(formatted[0]);
        setMessages(formatted[0].messages);
      }
    } catch (e: any) {
      console.error('Error loading sessions:', e);
      toast({ title: 'Error', description: 'Failed to load sessions', variant: 'destructive' });
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const createNewSession = async () => {
    try {
      const newSession: ChatSessionInsert = {
        user_id: user!.id,
        session_name: `Study Session ${new Date().toLocaleDateString()}`,
        messages: []
      };
      const { data, error } = await supabase
        .from('ai_chat_sessions')
        .insert([newSession])
        .select()
        .single();
      if (error) throw error;

      const formatted: ChatSession = { ...data, messages: [] };
      setCurrentSession(formatted);
      setMessages([]);
      setSessions(prev => [formatted, ...prev]);
      notifyAchievementProgress('ai_chat_session');
      toast({ title: 'New Session', description: 'Started a new study session' });
    } catch (e: any) {
      console.error('Error creating session:', e);
      toast({ title: 'Error', description: 'Failed to create session', variant: 'destructive' });
    }
  };

  const saveSession = async (msgs: Message[]) => {
    if (!currentSession) return;
    try {
      const upd: ChatSessionUpdate = { messages: msgs, updated_at: new Date().toISOString() };
      const { error } = await supabase
        .from('ai_chat_sessions')
        .update(upd)
        .eq('id', currentSession.id);
      if (error) throw error;
    } catch (e) {
      console.error('Error saving session:', e);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading || !currentSession) return;

    const userMsg: Message = { role: 'user', content: input.trim(), timestamp: new Date().toISOString() };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setInput('');
    setIsLoading(true);
    setLoadingStatus(null);

    try {
      let streamedAnswer = '';
      const assistantIndex = newMsgs.length;
      const data = await aiApiStream('ai/study-chat', {
        topic: currentSession.session_name,
        question: userMsg.content,
      }, {
        onStatus: (status) => { setLoadingStatus(status); },
        onDelta: (text) => {
          streamedAnswer += text;
          setMessages((prev) => {
            const updated = [...prev];
            if (updated[assistantIndex]) {
              updated[assistantIndex] = { ...updated[assistantIndex], content: streamedAnswer };
            } else {
              updated.push({ role: 'assistant', content: streamedAnswer, timestamp: new Date().toISOString() });
            }
            return updated;
          });
        },
      }, {});

      const answer = data.answer || streamedAnswer;
      const aiMsg: Message = { role: 'assistant', content: answer, timestamp: new Date().toISOString() };
      const final = [...newMsgs, aiMsg];
      setMessages(final);
      await saveSession(final);
    } catch (e: any) {
      console.error('Error sending message:', e);
      setMessages([...newMsgs, {
        role: 'assistant',
        content: e.message || 'Failed to send message',
        timestamp: new Date().toISOString(),
      }]);
      toast({ title: 'Error', description: e.message || 'Failed to send message', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const selectSession = (s: ChatSession) => {
    setCurrentSession(s);
    setMessages(s.messages);
  };

  if (isLoadingSessions) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="ml-2">Loading chat sessions...</span>
      </div>
    );
  }

  return (
    <>
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[600px]">
      {/* Sidebar */}
      <Card className="lg:col-span-1">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Study Sessions</CardTitle>
            <Button size="sm" variant="outline" onClick={createNewSession}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            <div className="p-4 space-y-2">
              {sessions.map(s => (
                <Button
                  key={s.id}
                  variant={s.id === currentSession?.id ? 'default' : 'ghost'}
                  className="w-full justify-start text-left"
                  onClick={() => selectSession(s)}
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  <span className="truncate">{s.session_name}</span>
                </Button>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Chat Area */}
      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle>AI Medical Study Assistant</CardTitle>
        </CardHeader>
        <CardContent className="p-0 flex flex-col h-[500px]">
          <ScrollArea className="flex-1 p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Start a conversation!</p>
              </div>
            ) : (
              messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex ${m.role === 'user' ? 'justify-end' : isAiPolicyNotice(m.content) ? 'justify-center' : 'justify-start'}`}
                >
                  {m.role !== 'user' && isAiPolicyNotice(m.content) ? (
                    <div className="max-w-md text-center">
                      <p className="text-xs font-bold leading-relaxed text-gray-500">{m.content}</p>
                      <a href="/pricing" className="mt-2 inline-flex text-xs font-black uppercase tracking-widest text-blue-600 underline underline-offset-4">
                        View upgrade options
                      </a>
                    </div>
                  ) : (
                  <div
                    className={`max-w-[80%] p-3 rounded-lg ${
                      m.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{m.role === 'user' ? m.content : renderAiMessageText(m.content)}</div>
                    {m.role !== 'user' && shouldShowCreatorInstagramCta(m.content) && (
                      <InstagramCreatorCta />
                    )}
                    <p className={`text-xs mt-1 ${m.role === 'user' ? 'text-blue-100' : 'text-gray-500'}`}>
                      {new Date(m.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                  )}
                </div>
              ))
            )}
            {isLoading && (
              <div className="flex justify-start">
                <div className="space-y-2">
                  <div className="flex items-center gap-3" role="status" aria-label={loadingStatus?.text || 'Working'}>
                    <motion.img
                      src="/favicon.png"
                      alt=""
                      aria-hidden="true"
                      animate={{ y: [0, -7, 0] }}
                      transition={{ duration: 0.75, repeat: Infinity, ease: 'easeInOut' }}
                      className="h-7 w-7 rounded-md object-cover"
                    />
                    {loadingStatus?.text ? (
                      <motion.span
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-sm font-medium text-gray-500"
                      >
                        {loadingStatus.text}
                      </motion.span>
                    ) : null}
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </ScrollArea>

          <div className="border-t p-4">
            <div className="flex space-x-2">
              <Input
                className="flex-1"
                placeholder="Ask a medical question…"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && sendMessage()}
                disabled={isLoading || !currentSession}
              />
              <Button onClick={sendMessage} disabled={isLoading || !input.trim() || !currentSession}>
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
    </>
  );
};
