import React, { useState, useEffect, useRef } from 'react';
import {
  Heart,
  MessageSquare,
  Share2,
  Play,
  Pause,
  Sparkles,
  Bot,
  Volume2,
  VolumeX,
  ChevronUp,
  ChevronDown,
  CheckCircle,
  XCircle,
  HelpCircle,
  Flame,
  Settings2,
} from 'lucide-react';
import { reelDispatcher, ClinicalReel, getBackendUrl, setBackendUrl, FALLBACK_CDC_REELS } from '@/services/reelDispatcher';
import { DrAhroidModal } from '@/components/discover/DrAhroidModal';
import { triggerHaptic } from '@/utils/haptics';
import { toast } from 'sonner';

interface HeartAnim {
  id: number;
  x: number;
  y: number;
}

export const MedmacsDiscoverTab: React.FC = () => {
  const [reels, setReels] = useState<ClinicalReel[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [showPauseOverlay, setShowPauseOverlay] = useState(false);
  const [hearts, setHearts] = useState<HeartAnim[]>([]);
  const [reactions, setReactions] = useState<Record<string, { count: number; liked: boolean }>>({});
  const [selectedQuizOption, setSelectedQuizOption] = useState<Record<string, string>>({});
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [comments, setComments] = useState<Record<string, string[]>>({});
  const [newCommentText, setNewCommentText] = useState('');
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

  // Window-level wheel & keydown listener for desktop reel scrolling
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

  // Preload neighboring reel images for instant 0ms swipe transition
  useEffect(() => {
    if (reels.length > 0) {
      const nextImg = reels[currentIndex + 1]?.image_url;
      const prevImg = reels[currentIndex - 1]?.image_url;
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

  const appendMoreReels = async () => {
    try {
      const moreData = await reelDispatcher.fetchReels('user_app', 4);
      if (moreData && moreData.length > 0) {
        setReels((prev) => {
          const existingIds = new Set(prev.map((r) => r.assigned_id));
          const newItems = moreData.filter((r) => !existingIds.has(r.assigned_id));
          return newItems.length > 0 ? [...prev, ...newItems] : [...prev, ...moreData];
        });
      }
    } catch (e) {
      console.warn('[MedmacsDiscoverTab] Failed to append more reels:', e);
    }
  };

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

    if (curIdx >= allReels.length - 2) {
      void appendMoreReels();
    }
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

  const currentReel = reels[currentIndex];

  const handleTouchTap = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
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

  const handleSendLove = (x: number, y: number) => {
    triggerHaptic(20);
    const newHeart: HeartAnim = { id: Date.now(), x, y };
    setHearts((prev) => [...prev, newHeart]);

    if (currentReel) {
      const rid = currentReel.assigned_id;
      setReactions((prev) => {
        const existing = prev[rid] || { count: 124, liked: false };
        return {
          ...prev,
          [rid]: { count: existing.count + (existing.liked ? 0 : 1), liked: true },
        };
      });
      reelDispatcher.sendInteraction({
        user_id: 'user_app',
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

  const toggleReact = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentReel) return;
    triggerHaptic(15);
    const rid = currentReel.assigned_id;
    setReactions((prev) => {
      const existing = prev[rid] || { count: 124, liked: false };
      const newLiked = !existing.liked;
      return {
        ...prev,
        [rid]: { count: existing.count + (newLiked ? 1 : -1), liked: newLiked },
      };
    });
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentReel) return;
    triggerHaptic(10);
    const shareUrl = `${window.location.origin}/discover?reel=${currentReel.assigned_id}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl);
      toast.success('Reel link copied to clipboard!');
    } else {
      toast.info(`Sharing: ${currentReel.medical_topic}`);
    }
  };

  const handleQuizAnswer = (option: 'A' | 'B') => {
    if (!currentReel) return;
    triggerHaptic(12);
    setSelectedQuizOption((prev) => ({
      ...prev,
      [currentReel.assigned_id]: option,
    }));
    reelDispatcher.sendInteraction({
      user_id: 'user_app',
      reel_id: currentReel.assigned_id,
      watch_time_seconds: 10,
      completed_reel: true,
      selected_option: option,
    });
  };

  const handleAddComment = () => {
    if (!newCommentText.trim() || !currentReel) return;
    const rid = currentReel.assigned_id;
    setComments((prev) => ({
      ...prev,
      [rid]: [...(prev[rid] || ['Great diagnostic slide!', 'Pathognomonic appearance.']), newCommentText.trim()],
    }));
    setNewCommentText('');
    toast.success('Comment added!');
  };



  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] text-white">
        <div className="w-12 h-12 rounded-full border-4 border-cyan-500 border-t-transparent animate-spin mb-4" />
        <p className="text-sm font-medium text-cyan-300">Loading Medmacs Discover Engine...</p>
      </div>
    );
  }

  if (!currentReel) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] text-white p-6 text-center">
        <Flame className="w-16 h-16 text-rose-500 mb-3 animate-bounce" />
        <h3 className="text-xl font-bold">No Reels Available</h3>
        <p className="text-sm text-slate-400 mt-1 max-w-xs">
          The Medmacs Discover feed is preparing fresh CDC PHIL clinical cases.
        </p>
        <button
          onClick={loadReels}
          className="mt-4 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-indigo-600 rounded-full font-semibold text-sm shadow-lg"
        >
          Refresh Feed
        </button>
      </div>
    );
  }

  const currentReactState = reactions[currentReel.assigned_id] || { count: 128, liked: false };
  const currentAnswer = selectedQuizOption[currentReel.assigned_id];
  const isAnswered = !!currentAnswer;
  const isCorrect = currentAnswer === currentReel.interactive_quiz?.correct_option;

  return (
    <div className="relative w-full h-[calc(100vh-120px)] min-h-[580px] bg-slate-950 overflow-hidden flex flex-col justify-between select-none">
      {/* 1. TOP LEFT MEDMACS DISCOVER BADGE */}
      <div className="absolute top-4 left-4 z-30 flex items-center gap-2">
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/80 backdrop-blur-md border border-cyan-500/40 shadow-xl shadow-cyan-500/10">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
          <span className="font-extrabold text-xs tracking-wider uppercase text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-indigo-300 to-purple-400">
            Medmacs Discover
          </span>
          <span className="px-1.5 py-0.2 text-[9px] font-bold bg-cyan-500/20 text-cyan-300 rounded-md">
            CDC PHIL
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
            placeholder="https://your-tunnel.trycloudflare.com"
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
            disabled={currentIndex === 0}
            className="p-2 rounded-full bg-slate-900/70 border border-white/10 text-white disabled:opacity-30 hover:bg-slate-800 transition"
          >
            <ChevronUp className="w-5 h-5" />
          </button>
          <button
            onClick={nextReel}
            disabled={currentIndex === reels.length - 1}
            className="p-2 rounded-full bg-slate-900/70 border border-white/10 text-white disabled:opacity-30 hover:bg-slate-800 transition"
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
            {(comments[currentReel.assigned_id] || ['1', '2']).length}
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

      {/* COMMENTS DRAWER MODAL */}
      {showCommentsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col justify-end">
          <div className="w-full max-h-[60vh] h-[400px] bg-slate-900 border-t border-white/10 rounded-t-3xl p-4 flex flex-col text-white">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="font-bold text-sm">Comments ({comments[currentReel.assigned_id]?.length || 2})</h3>
              <button onClick={() => setShowCommentsModal(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-3 space-y-2 text-xs">
              {(comments[currentReel.assigned_id] || [
                'Classic pathognomonic presentation!',
                'CDC PHIL slides are extremely high yield.',
              ]).map((c, i) => (
                <div key={i} className="p-2.5 rounded-xl bg-slate-800/80 border border-white/5">
                  <span className="font-semibold text-cyan-400">Dr Scholar: </span>
                  <span className="text-slate-200">{c}</span>
                </div>
              ))}
            </div>
            <div className="pt-2 flex gap-2 border-t border-white/10">
              <input
                type="text"
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                placeholder="Write a clinical comment..."
                className="flex-1 bg-slate-950 border border-white/15 rounded-full px-3 py-1.5 text-xs text-white focus:outline-none"
              />
              <button onClick={handleAddComment} className="px-4 py-1.5 bg-cyan-600 rounded-full font-bold text-xs">
                Post
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. ASK DR AHROID BOTTOM PINNED MODAL */}
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
