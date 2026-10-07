import React, { useState, useEffect, useRef } from 'react';
import {
  Heart,
  MessageSquare,
  Share2,
  Play,
  Pause,
  Sparkles,
  Bot,
  ChevronUp,
  ChevronDown,
  CheckCircle,
  XCircle,
  HelpCircle,
  Flame,
  Settings2,
  X,
  Send,
  User as UserIcon,
} from 'lucide-react';
import { reelDispatcher, ClinicalReel, getBackendUrl, setBackendUrl, FALLBACK_CDC_REELS } from '@/services/reelDispatcher';
import { DrAhroidModal } from '@/components/discover/DrAhroidModal';
import { triggerHaptic } from '@/utils/haptics';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface HeartAnim {
  id: number;
  x: number;
  y: number;
}

interface ReelComment {
  id: string;
  userName: string;
  userRole?: string;
  avatarUrl?: string;
  text: string;
  timestamp: string;
  likes: number;
  isLiked?: boolean;
}

const DEFAULT_PRODUCTION_COMMENTS: Record<string, ReelComment[]> = {
  'CDC-PHIL-2033': [
    {
      id: 'c-101',
      userName: 'Dr. Sarah Khan',
      userRole: 'Dermatologist',
      avatarUrl: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=120&auto=format&fit=crop&q=80',
      text: 'Classic pathognomonic presentation of cutaneous anthrax. Notice the painless black eschar surrounded by extensive gelatinous edema.',
      timestamp: '5m ago',
      likes: 24,
    },
    {
      id: 'c-102',
      userName: 'Dr. Hamza Ali',
      userRole: 'FCPS Resident',
      avatarUrl: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=120&auto=format&fit=crop&q=80',
      text: 'High yield for board exams: Painless lesion differentiates it from staph or strep abscesses which are severely tender.',
      timestamp: '22m ago',
      likes: 18,
    },
  ],
  'CDC-PHIL-9875': [
    {
      id: 'c-201',
      userName: 'Dr. Usman Raza',
      userRole: 'Infectious Diseases',
      avatarUrl: 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=120&auto=format&fit=crop&q=80',
      text: 'Erythema migrans expands radially. Empirical Doxycycline is initiated immediately without waiting for serology.',
      timestamp: '12m ago',
      likes: 31,
    },
  ],
  'CDC-PHIL-3004': [
    {
      id: 'c-301',
      userName: 'Dr. Bilal Ahmad',
      userRole: 'Pulmonologist',
      avatarUrl: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=120&auto=format&fit=crop&q=80',
      text: 'Ziehl-Neelsen acid-fast staining retains bright pink carbolfuchsin due to mycolic acid in the bacterial cell wall.',
      timestamp: '1h ago',
      likes: 42,
    },
  ],
};

export const MedmacsDiscoverTab: React.FC = () => {
  const { user } = useAuth();
  const [reels, setReels] = useState<ClinicalReel[]>(FALLBACK_CDC_REELS);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showPauseOverlay, setShowPauseOverlay] = useState(false);
  const [hearts, setHearts] = useState<HeartAnim[]>([]);
  const [reactions, setReactions] = useState<Record<string, { count: number; liked: boolean }>>({});
  const [selectedQuizOption, setSelectedQuizOption] = useState<Record<string, string>>({});
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [reelComments, setReelComments] = useState<Record<string, ReelComment[]>>(DEFAULT_PRODUCTION_COMMENTS);
  const [newCommentInput, setNewCommentInput] = useState('');
  const [showDrAhroid, setShowDrAhroid] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [customBackendInput, setCustomBackendInput] = useState('');

  const lastTapTimeRef = useRef<number>(0);
  const touchStartYRef = useRef<number>(0);
  const touchStartXRef = useRef<number>(0);
  const isSwipingRef = useRef<boolean>(false);
  const wheelCooldownRef = useRef<boolean>(false);
  const currentIndexRef = useRef<number>(currentIndex);
  const reelsRef = useRef<ClinicalReel[]>(reels);

  const [slideAnim, setSlideAnim] = useState<string>('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    reelsRef.current = reels;
  }, [reels]);

  useEffect(() => {
    loadReels();
  }, []);

  // Desktop wheel & arrow key navigation for smooth reel scrolling
  useEffect(() => {
    const handleGlobalWheel = (e: WheelEvent) => {
      if (wheelCooldownRef.current) return;
      if (Math.abs(e.deltaY) > 15) {
        wheelCooldownRef.current = true;
        if (e.deltaY > 0) {
          triggerNextReelWithAnim();
        } else {
          triggerPrevReelWithAnim();
        }
        setTimeout(() => {
          wheelCooldownRef.current = false;
        }, 400);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        triggerNextReelWithAnim();
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        triggerPrevReelWithAnim();
      }
    };

    window.addEventListener('wheel', handleGlobalWheel, { passive: true });
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('wheel', handleGlobalWheel);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Preload neighboring images for 0ms instant swipe
  useEffect(() => {
    if (reels.length > 0) {
      const nextImg = reels[(currentIndex + 1) % reels.length]?.image_url;
      const prevImg = reels[(currentIndex - 1 + reels.length) % reels.length]?.image_url;
      if (nextImg && nextImg.startsWith('http')) {
        const img = new Image();
        img.src = nextImg;
      }
      if (prevImg && prevImg.startsWith('http')) {
        const img = new Image();
        img.src = prevImg;
      }
    }
  }, [currentIndex, reels]);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length > 0) {
      touchStartYRef.current = e.touches[0].clientY;
      touchStartXRef.current = e.touches[0].clientX;
      isSwipingRef.current = false;
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length > 0) {
      const currentY = e.touches[0].clientY;
      const currentX = e.touches[0].clientX;
      const deltaY = currentY - touchStartYRef.current;
      const deltaX = currentX - touchStartXRef.current;

      if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 20) {
        isSwipingRef.current = true;
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.changedTouches.length === 0) return;
    const touchEndY = e.changedTouches[0].clientY;
    const touchEndX = e.changedTouches[0].clientX;
    const deltaY = touchEndY - touchStartYRef.current;
    const deltaX = touchEndX - touchStartXRef.current;

    if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 25) {
      isSwipingRef.current = true;
      if (deltaY < 0) {
        triggerNextReelWithAnim();
      } else {
        triggerPrevReelWithAnim();
      }
    }
  };

  // INFINITE LOOPING REEL NAVIGATION (1 -> 2 -> 3 -> 4 -> 5 -> 1)
  const triggerNextReelWithAnim = () => {
    const curIdx = currentIndexRef.current;
    const allReels = reelsRef.current;
    if (allReels.length === 0) return;

    setSlideAnim('animate-in slide-in-from-bottom duration-300');
    const nextIdx = (curIdx + 1) % allReels.length;
    setCurrentIndex(nextIdx);
    setIsPaused(false);
    triggerHaptic(10);
    setTimeout(() => setSlideAnim(''), 350);
  };

  const triggerPrevReelWithAnim = () => {
    const curIdx = currentIndexRef.current;
    const allReels = reelsRef.current;
    if (allReels.length === 0) return;

    setSlideAnim('animate-in slide-in-from-top duration-300');
    const prevIdx = (curIdx - 1 + allReels.length) % allReels.length;
    setCurrentIndex(prevIdx);
    setIsPaused(false);
    triggerHaptic(10);
    setTimeout(() => setSlideAnim(''), 350);
  };

  const nextReel = () => triggerNextReelWithAnim();
  const prevReel = () => triggerPrevReelWithAnim();

  const loadReels = async () => {
    setIsLoading(true);
    try {
      const data = await reelDispatcher.fetchReels('user_app', 4);
      if (data && data.length > 0) {
        setReels(data);
      } else {
        setReels(FALLBACK_CDC_REELS);
      }
    } catch (e) {
      console.error('[MedmacsDiscoverTab] Error loading reels:', e);
      setReels(FALLBACK_CDC_REELS);
    } finally {
      setIsLoading(false);
    }
  };

  const currentReel = reels[currentIndex] || FALLBACK_CDC_REELS[0];

  const handleTouchTap = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (isSwipingRef.current) return;
    const now = Date.now();
    const DOUBLE_TAP_THRESHOLD = 300;

    let clientX = 0;
    let clientY = 0;

    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ('clientX' in e) {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    if (now - lastTapTimeRef.current < DOUBLE_TAP_THRESHOLD) {
      // Double tap -> Send Love
      handleSendLove(clientX, clientY);
      lastTapTimeRef.current = 0;
    } else {
      // Single tap -> Pause / Play video toggle
      lastTapTimeRef.current = now;
      setTimeout(() => {
        if (lastTapTimeRef.current !== 0) {
          togglePauseState();
          lastTapTimeRef.current = 0;
        }
      }, DOUBLE_TAP_THRESHOLD);
    }
  };

  const togglePauseState = () => {
    setIsPaused((prev) => !prev);
    setShowPauseOverlay(true);
    triggerHaptic(10);
    setTimeout(() => setShowPauseOverlay(false), 800);
  };

  const handleSendLove = async (x: number, y: number) => {
    triggerHaptic(20);
    const newHeart: HeartAnim = { id: Date.now(), x, y };
    setHearts((prev) => [...prev, newHeart]);

    if (currentReel) {
      const rid = currentReel.assigned_id;
      setReactions((prev) => {
        const existing = prev[rid] || { count: 142, liked: false };
        return {
          ...prev,
          [rid]: { count: existing.count + (existing.liked ? 0 : 1), liked: true },
        };
      });

      // Record interaction in SQL Database
      try {
        await supabase.from('discover_reel_interactions').insert({
          user_id: user?.id || null,
          reel_id: rid,
          reaction_type: 'heart',
          watch_time_seconds: 5,
        });
      } catch (sqlErr) {
        console.warn('[SQL Interaction Error]:', sqlErr);
      }

      reelDispatcher.sendInteraction({
        user_id: user?.id || 'user_app',
        reel_id: rid,
        watch_time_seconds: 5,
        completed_reel: false,
        reaction_type: 'heart',
      });
    }

    setTimeout(() => {
      setHearts((prev) => prev.filter((h) => h.id !== newHeart.id));
    }, 1000);
  };

  const toggleReact = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentReel) return;
    triggerHaptic(15);
    const rid = currentReel.assigned_id;
    const existing = reactions[rid] || { count: 142, liked: false };
    const newLiked = !existing.liked;

    setReactions((prev) => ({
      ...prev,
      [rid]: { count: existing.count + (newLiked ? 1 : -1), liked: newLiked },
    }));

    // Record interaction in SQL Database
    try {
      await supabase.from('discover_reel_interactions').insert({
        user_id: user?.id || null,
        reel_id: rid,
        reaction_type: newLiked ? 'like' : 'unlike',
        watch_time_seconds: 5,
      });
    } catch (sqlErr) {
      console.warn('[SQL Reaction Error]:', sqlErr);
    }
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentReel) return;
    triggerHaptic(10);
    const shareUrl = `${window.location.origin}/dashboard?tab=discover&reel=${currentReel.assigned_id}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl);
      toast.success('Reel link copied to clipboard!');
    } else {
      toast.info(`Sharing: ${currentReel.medical_topic}`);
    }
  };

  const handleQuizAnswer = async (option: 'A' | 'B') => {
    if (!currentReel) return;
    triggerHaptic(12);
    const isCorrect = option === currentReel.interactive_quiz?.correct_option;

    setSelectedQuizOption((prev) => ({
      ...prev,
      [currentReel.assigned_id]: option,
    }));

    // Record quiz response into SQL Database
    try {
      await supabase.from('discover_reel_interactions').insert({
        user_id: user?.id || null,
        reel_id: currentReel.assigned_id,
        selected_option: option,
        is_correct: isCorrect,
        reaction_type: 'quiz_answer',
        watch_time_seconds: 10,
      });
    } catch (sqlErr) {
      console.warn('[SQL Quiz Answer Log Error]:', sqlErr);
    }

    reelDispatcher.sendInteraction({
      user_id: user?.id || 'user_app',
      reel_id: currentReel.assigned_id,
      watch_time_seconds: 10,
      completed_reel: true,
      selected_option: option,
    });
  };

  const handleAddComment = () => {
    if (!newCommentInput.trim() || !currentReel) return;
    const rid = currentReel.assigned_id;
    const authorName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Dr. Scholar';

    const newCommentObj: ReelComment = {
      id: `c-${Date.now()}`,
      userName: authorName,
      userRole: 'Medical Scholar',
      avatarUrl: user?.user_metadata?.avatar_url || undefined,
      text: newCommentInput.trim(),
      timestamp: 'Just now',
      likes: 0,
    };

    setReelComments((prev) => ({
      ...prev,
      [rid]: [...(prev[rid] || DEFAULT_PRODUCTION_COMMENTS['CDC-PHIL-2033']), newCommentObj],
    }));

    setNewCommentInput('');
    toast.success('Comment posted!');
  };

  const toggleCommentLike = (commentId: string) => {
    if (!currentReel) return;
    const rid = currentReel.assigned_id;
    setReelComments((prev) => {
      const list = prev[rid] || DEFAULT_PRODUCTION_COMMENTS['CDC-PHIL-2033'];
      return {
        ...prev,
        [rid]: list.map((c) =>
          c.id === commentId
            ? { ...c, likes: c.isLiked ? c.likes - 1 : c.likes + 1, isLiked: !c.isLiked }
            : c
        ),
      };
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] text-white">
        <div className="w-12 h-12 rounded-full border-4 border-cyan-500 border-t-transparent animate-spin mb-4" />
        <p className="text-sm font-medium text-cyan-300">Loading Medmacs Discover Engine...</p>
      </div>
    );
  }

  const currentReactState = reactions[currentReel.assigned_id] || { count: 142, liked: false };
  const currentAnswer = selectedQuizOption[currentReel.assigned_id];
  const isAnswered = !!currentAnswer;
  const isCorrect = currentAnswer === currentReel.interactive_quiz?.correct_option;
  const activeCommentsList = reelComments[currentReel.assigned_id] || DEFAULT_PRODUCTION_COMMENTS['CDC-PHIL-2033'] || [];

  return (
    <div className="relative w-full h-[calc(100vh-120px)] min-h-[580px] bg-slate-950 overflow-hidden flex flex-col justify-between select-none">
      {/* 1. TOP LEFT CLEAN MEDMACS DISCOVER BADGE (CDC PHIL TAG REMOVED) */}
      <div className="absolute top-4 left-4 z-30 flex items-center gap-2">
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/80 backdrop-blur-md border border-cyan-500/40 shadow-xl shadow-cyan-500/10">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
          <span className="font-extrabold text-xs tracking-wider uppercase text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-indigo-300 to-purple-400">
            Medmacs Discover
          </span>
        </div>
      </div>

      {/* TOP RIGHT BACKEND CONFIG BTN */}
      <div className="absolute top-4 right-4 z-30 flex items-center gap-2">
        <button
          onClick={() => {
            setCustomBackendInput(getBackendUrl());
            setShowSettings((prev) => !prev);
          }}
          className="p-2 rounded-full bg-slate-900/70 backdrop-blur-md border border-white/10 text-slate-300 hover:text-white"
        >
          <Settings2 className="w-4 h-4" />
        </button>
      </div>

      {/* BACKEND CONFIG MODAL */}
      {showSettings && (
        <div className="absolute top-16 right-4 z-40 w-72 bg-slate-900/95 border border-cyan-500/40 backdrop-blur-xl rounded-2xl p-4 text-xs text-white shadow-2xl">
          <h4 className="font-bold text-cyan-300 mb-2">Reel Dispatcher Endpoint</h4>
          <input
            type="text"
            value={customBackendInput}
            onChange={(e) => setCustomBackendInput(e.target.value)}
            className="w-full bg-slate-950 border border-white/20 rounded-lg p-2 text-xs text-white mb-2"
            placeholder="https://discover.medmacs.app"
          />
          <div className="flex gap-2">
            <button
              onClick={() => {
                setBackendUrl(customBackendInput);
                setShowSettings(false);
                toast.success('Updated Reel Dispatcher Endpoint!');
                loadReels();
              }}
              className="flex-1 bg-cyan-600 hover:bg-cyan-500 py-1.5 rounded-md font-semibold text-white"
            >
              Save & Reload
            </button>
          </div>
        </div>
      )}

      {/* 2. REEL IMAGE / CANVAS WITH SWIPE & TAP GESTURES */}
      <div
        ref={containerRef}
        onClick={handleTouchTap}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="relative w-full h-full flex items-center justify-center bg-black cursor-pointer overflow-hidden touch-pan-y"
      >
        <img
          key={currentReel.assigned_id}
          src={currentReel.image_url}
          alt={currentReel.medical_topic}
          referrerPolicy="no-referrer"
          crossOrigin="anonymous"
          onError={(e) => {
            const target = e.currentTarget;
            if (!target.src.includes('wikimedia.org')) {
              target.src = 'https://upload.wikimedia.org/wikipedia/commons/5/5f/Anthrax_PHIL_2033.png';
            }
          }}
          className={`w-full h-full object-contain transition-all duration-300 ${slideAnim} ${
            isPaused ? 'scale-[0.98] brightness-90' : 'scale-100'
          }`}
        />

        {/* PAUSE OVERLAY ICON */}
        {showPauseOverlay && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px] transition-all duration-200">
            <div className="w-16 h-16 rounded-full bg-slate-900/80 border border-cyan-400/50 flex items-center justify-center text-cyan-400 shadow-2xl animate-in zoom-in-75">
              {isPaused ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
            </div>
          </div>
        )}

        {/* FLOATING HEART ANIMATIONS FOR DOUBLE-TAP */}
        {hearts.map((h) => (
          <div
            key={h.id}
            style={{ left: h.x - 24, top: h.y - 24 }}
            className="pointer-events-none fixed z-50 animate-bounce"
          >
            <Heart className="w-12 h-12 text-rose-500 fill-rose-500 filter drop-shadow-[0_0_12px_rgba(244,63,94,0.8)]" />
          </div>
        ))}

        {/* BOTTOM GRADIENT OVERLAY */}
        <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent pointer-events-none" />
      </div>

      {/* 3. RIGHT SIDE CONTROLS (REACT, COMMENT, SHARE, NAV) */}
      <div className="absolute right-3 bottom-24 z-30 flex flex-col items-center gap-5">
        {/* NEXT / PREV REEL NAV */}
        <div className="flex flex-col gap-1 mb-2">
          <button
            onClick={prevReel}
            className="p-2 rounded-full bg-slate-900/70 border border-white/10 text-white hover:bg-slate-800 transition"
          >
            <ChevronUp className="w-5 h-5" />
          </button>
          <button
            onClick={nextReel}
            className="p-2 rounded-full bg-slate-900/70 border border-white/10 text-white hover:bg-slate-800 transition"
          >
            <ChevronDown className="w-5 h-5" />
          </button>
        </div>

        {/* REACT BUTTON */}
        <button onClick={toggleReact} className="flex flex-col items-center group">
          <div
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-transform active:scale-75 backdrop-blur-md border ${
              currentReactState.liked
                ? 'bg-rose-500/20 border-rose-500 text-rose-500 shadow-lg shadow-rose-500/30'
                : 'bg-slate-900/70 border-white/15 text-white group-hover:bg-slate-800'
            }`}
          >
            <Heart
              className={`w-5 h-5 ${currentReactState.liked ? 'fill-rose-500' : 'group-hover:text-rose-400'}`}
            />
          </div>
          <span className="text-[11px] font-bold text-white mt-1 drop-shadow">
            {currentReactState.count}
          </span>
        </button>

        {/* COMMENT BUTTON */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowCommentsModal(true);
          }}
          className="flex flex-col items-center group"
        >
          <div className="w-11 h-11 rounded-full bg-slate-900/70 border border-white/15 text-white flex items-center justify-center backdrop-blur-md group-hover:bg-slate-800 transition active:scale-75">
            <MessageSquare className="w-5 h-5 group-hover:text-cyan-400" />
          </div>
          <span className="text-[11px] font-bold text-white mt-1 drop-shadow">
            {activeCommentsList.length}
          </span>
        </button>

        {/* SHARE BUTTON */}
        <button onClick={handleShare} className="flex flex-col items-center group">
          <div className="w-11 h-11 rounded-full bg-slate-900/70 border border-white/15 text-white flex items-center justify-center backdrop-blur-md group-hover:bg-slate-800 transition active:scale-75">
            <Share2 className="w-5 h-5 group-hover:text-indigo-400" />
          </div>
          <span className="text-[11px] font-bold text-white mt-1 drop-shadow">Share</span>
        </button>
      </div>

      {/* 4. LEFT BOTTOM CAPTION & ASK DR AHROID BUTTON */}
      <div className="absolute left-4 bottom-4 right-20 z-30 flex flex-col gap-2 max-w-[82%]">
        {/* REEL TOPIC & CATEGORY */}
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/30 text-indigo-300 border border-indigo-500/40">
            {currentReel.subject}
          </span>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/30 text-cyan-300 border border-cyan-500/40">
            Year {currentReel.mbbs_year}
          </span>
        </div>

        <h2 className="text-lg font-extrabold text-white tracking-tight drop-shadow-md">
          {currentReel.medical_topic}
        </h2>
        <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed drop-shadow">
          {currentReel.identification_text || currentReel.diagnosis_text}
        </p>

        {/* INTERACTIVE QUIZ SNIPPET */}
        {currentReel.interactive_quiz && (
          <div className="mt-1 p-2.5 rounded-xl bg-slate-900/90 border border-cyan-500/30 backdrop-blur-md text-xs text-white shadow-xl">
            <div className="font-semibold text-cyan-300 mb-1.5 flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
              <span>{currentReel.interactive_quiz.question}</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => handleQuizAnswer('A')}
                className={`px-2.5 py-1.5 rounded-lg text-left font-medium transition border text-[11px] ${
                  currentAnswer === 'A'
                    ? isCorrect
                      ? 'bg-emerald-500/30 border-emerald-400 text-emerald-200'
                      : 'bg-rose-500/30 border-rose-400 text-rose-200'
                    : 'bg-slate-800/80 border-white/10 hover:bg-slate-700 text-slate-200'
                }`}
              >
                A: {currentReel.interactive_quiz.option_a}
              </button>
              <button
                onClick={() => handleQuizAnswer('B')}
                className={`px-2.5 py-1.5 rounded-lg text-left font-medium transition border text-[11px] ${
                  currentAnswer === 'B'
                    ? isCorrect
                      ? 'bg-emerald-500/30 border-emerald-400 text-emerald-200'
                      : 'bg-rose-500/30 border-rose-400 text-rose-200'
                    : 'bg-slate-800/80 border-white/10 hover:bg-slate-700 text-slate-200'
                }`}
              >
                B: {currentReel.interactive_quiz.option_b}
              </button>
            </div>
            {isAnswered && (
              <div className="mt-1.5 text-[10px] text-cyan-200 italic flex items-center gap-1">
                {isCorrect ? <CheckCircle className="w-3 h-3 text-emerald-400" /> : <XCircle className="w-3 h-3 text-rose-400" />}
                <span>{currentReel.interactive_quiz.explanation}</span>
              </div>
            )}
          </div>
        )}

        {/* 5. ASK DR AHROID BUTTON BELOW CAPTION */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            triggerHaptic(15);
            setShowDrAhroid(true);
          }}
          className="mt-1 self-start flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500 via-indigo-600 to-purple-600 text-white font-bold text-xs shadow-lg shadow-cyan-500/25 hover:opacity-95 active:scale-95 transition"
        >
          <Bot className="w-4 h-4 text-cyan-300 animate-pulse" />
          <span>Ask Dr Ahroid</span>
          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
        </button>
      </div>

      {/* 6. REDESIGNED COMMENT UI (PROFILE PICTURE, NAME & COMMENT UNDER IT) */}
      {showCommentsModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex flex-col justify-end animate-in fade-in duration-200">
          <div className="w-full max-h-[75vh] h-[520px] bg-slate-900 border-t border-cyan-500/30 rounded-t-3xl p-4 flex flex-col text-white shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-cyan-400" />
                <h3 className="font-bold text-sm text-white">Comments ({activeCommentsList.length})</h3>
              </div>
              <button
                onClick={() => setShowCommentsModal(false)}
                className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Comment Items List */}
            <div className="flex-1 overflow-y-auto py-3 space-y-4 text-xs pr-1">
              {activeCommentsList.map((c) => (
                <div key={c.id} className="flex gap-3 items-start group">
                  {/* User Profile Avatar */}
                  {c.avatarUrl ? (
                    <img
                      src={c.avatarUrl}
                      alt={c.userName}
                      className="w-9 h-9 rounded-full object-cover shrink-0 border border-cyan-500/30 shadow-md"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-cyan-500 to-indigo-600 border border-cyan-400/40 flex items-center justify-center shrink-0 shadow-md">
                      <span className="font-bold text-white text-xs">
                        {c.userName.replace(/^Dr\.\s*/, '').charAt(0)}
                      </span>
                    </div>
                  )}

                  {/* Name, Role & Comment Text Under It */}
                  <div className="flex-1 min-w-0 bg-slate-800/60 p-3 rounded-2xl border border-white/5">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-cyan-300 text-xs">{c.userName}</span>
                        {c.userRole && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-medium">
                            {c.userRole}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 shrink-0">{c.timestamp}</span>
                    </div>
                    {/* Comment text rendered cleanly underneath */}
                    <p className="text-slate-200 leading-relaxed font-normal text-xs">{c.text}</p>
                  </div>

                  {/* Comment Heart Like Button */}
                  <button
                    onClick={() => toggleCommentLike(c.id)}
                    className="flex flex-col items-center shrink-0 pt-1 text-slate-400 hover:text-rose-400 transition"
                  >
                    <Heart
                      className={`w-3.5 h-3.5 ${c.isLiked ? 'fill-rose-500 text-rose-500' : ''}`}
                    />
                    <span className="text-[9px] mt-0.5 font-semibold text-slate-400">{c.likes}</span>
                  </button>
                </div>
              ))}
            </div>

            {/* Bottom Comment Input Bar */}
            <div className="pt-3 border-t border-white/10 flex items-center gap-2 bg-slate-950/80 -mx-4 -mb-4 p-3">
              <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center shrink-0">
                <UserIcon className="w-4 h-4 text-white" />
              </div>
              <input
                type="text"
                value={newCommentInput}
                onChange={(e) => setNewCommentInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                placeholder="Add a clinical comment..."
                className="flex-1 bg-slate-900 border border-white/15 rounded-full px-4 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none transition"
              />
              <button
                onClick={handleAddComment}
                disabled={!newCommentInput.trim()}
                className="w-9 h-9 rounded-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold flex items-center justify-center disabled:opacity-30 transition shadow-md shadow-cyan-500/20 shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ASK DR AHROID BOTTOM PINNED MODAL */}
      <DrAhroidModal
        isOpen={showDrAhroid}
        onClose={() => setShowDrAhroid(false)}
        reelTopic={currentReel.medical_topic}
        reelCategory={currentReel.media_category}
        diagnosisText={currentReel.diagnosis_text}
      />
    </div>
  );
};
