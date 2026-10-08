import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Bot, Sparkles, User, RefreshCw } from 'lucide-react';

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
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

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
    setIsLoading(true);

    try {
      // 1. Fetch RAG Context from Medmacs RAG Engine (Port 8001)
      let ragContextText = '';
      try {
        const ragRes = await fetch(`http://161.118.227.79:8001/search?q=${encodeURIComponent(textToSend)}&top_k=2`, {
          signal: AbortSignal.timeout(2000),
        });
        if (ragRes.ok) {
          const ragData = await ragRes.json();
          if (ragData.results && ragData.results.length > 0) {
            ragContextText = ragData.results.map((r: any) => `[${r.province} Board - ${r.book} (p. ${r.page})]: ${r.content}`).join('\n\n');
          }
        }
      } catch (err) {
        console.log('[DrAhroidModal] Medmacs RAG fallback to clinical reel context:', err);
      }

      const promptContext = `You are Dr Ahroid, an elite medical board examiner and clinical professor for Medmacs.
STRICT GUIDELINES:
1. Focus strictly on clean, high-yield clinical medical knowledge.
2. NEVER mention meta references, internal database codes, source libraries (such as CDC or PHIL), resolution tags ('lores'), file formats ('.jpg'), or country names in topic headers.
3. Keep all disease titles and diagnostic explanations clean, concise, and professional.

Medical Case: "${reelTopic}" (${reelCategory})
Clinical Details: "${diagnosisText}"
${ragContextText ? `\nMedmacs Textbook RAG Knowledge Base:\n${ragContextText}\n` : ''}
Answer the user query concisely, accurately, with bulleted high-yield points and board examination pearls grounded in Medmacs RAG reference data.

User Question: ${textToSend}`;

      let responseText = '';
      const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer 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',
        },
        body: JSON.stringify({
          model: 'nvidia/nemotron-3-ultra-550b-a55b',
          messages: [{ role: 'user', content: promptContext }],
          temperature: 0.2,
          max_tokens: 600,
        }),
      });
      const data = await res.json();
      responseText = data.choices?.[0]?.message?.content || 'Dr Ahroid is analyzing the case details. Please try asking again.';

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
          text: `Dr Ahroid Clinical Note: ${reelTopic} presents with classic pathognomonic diagnostic features. Recommended first-line workup involves confirming histopathology or microbiology, followed by targeted targeted therapy.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-h-[85vh] h-[600px] bg-slate-900 border-t border-indigo-500/30 rounded-t-3xl shadow-2xl flex flex-col overflow-hidden text-white transition-all">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-600 to-cyan-400 p-0.5 shadow-lg shadow-cyan-500/20">
              <div className="w-full h-full bg-slate-950 rounded-full flex items-center justify-center">
                <Bot className="w-5 h-5 text-cyan-400 animate-pulse" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white tracking-wide">Dr Ahroid</h3>
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-cyan-500/20 text-cyan-300 rounded-full border border-cyan-500/30 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Clinical AI Mentor
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate max-w-[240px]">Topic: {reelTopic}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-full bg-white/5 hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Suggestion Chips */}
        <div className="flex gap-2 px-4 py-2 overflow-x-auto border-b border-white/5 bg-slate-950/40 text-xs no-scrollbar">
          <button
            onClick={() => handleSend(`What are the key diagnostic features of ${reelTopic}?`)}
            className="px-3 py-1.5 rounded-full bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 shrink-0 transition"
          >
            🔍 Key Diagnostic Features
          </button>
          <button
            onClick={() => handleSend(`What is the first-line treatment for ${reelTopic}?`)}
            className="px-3 py-1.5 rounded-full bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 shrink-0 transition"
          >
            💊 First-line Treatment
          </button>
          <button
            onClick={() => handleSend(`High-yield exam pearls for ${reelTopic}?`)}
            className="px-3 py-1.5 rounded-full bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 shrink-0 transition"
          >
            ⭐ Exam Pearls
          </button>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3 text-sm">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.sender === 'ai' && (
                <div className="w-7 h-7 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-4 h-4 text-cyan-400" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 shadow-md ${
                  msg.sender === 'user'
                    ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white rounded-tr-none'
                    : 'bg-slate-800/90 border border-white/10 text-slate-100 rounded-tl-none'
                }`}
              >
                <div className="whitespace-pre-wrap leading-relaxed">{msg.text}</div>
                <div
                  className={`text-[10px] mt-1 ${
                    msg.sender === 'user' ? 'text-cyan-200 text-right' : 'text-slate-400'
                  }`}
                >
                  {msg.timestamp}
                </div>
              </div>
              {msg.sender === 'user' && (
                <div className="w-7 h-7 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-4 h-4 text-indigo-400" />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex items-center gap-2 text-cyan-400 text-xs italic p-2 bg-cyan-950/30 rounded-xl border border-cyan-500/20 max-w-[200px]">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Dr Ahroid is generating response...</span>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3 bg-slate-950 border-t border-white/10 flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={`Ask Dr Ahroid about ${reelTopic}...`}
            className="flex-1 bg-slate-900 border border-white/15 focus:border-cyan-400 rounded-full px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none transition"
          />
          <button
            onClick={() => handleSend()}
            disabled={!inputText.trim() || isLoading}
            className="w-10 h-10 rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-white flex items-center justify-center disabled:opacity-40 transition shadow-lg shadow-cyan-500/20 shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
