import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Eye, RotateCw, ChevronLeft, ChevronRight, BookOpen, X, Bot, ThumbsUp, RefreshCw, CheckCircle2, Bookmark } from 'lucide-react';
import { parseBoldText } from '@/utils/format';

export type FlashcardData = {
  id?: string;
  front: string;
  back: string;
  source?: string;
  chapter_name?: string;
};

type InteractiveFlashcardProps = {
  card: FlashcardData;
  currentIndex: number;
  totalCards: number;
  chapterName?: string;
  batchIndex?: number;
  isSaved?: boolean;
  onToggleSave?: () => void;
  onClose?: () => void;
  onSwipeNext: () => void;
  onSwipePrev: () => void;
  onAskDrAhroid?: (prompt: string) => void;
};

const CARD_THEMES = [
  {
    bg: 'bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600',
    text: 'text-white',
    subtext: 'text-purple-100',
    badge: 'bg-white/20 text-white backdrop-blur-md border-white/20',
    accentBg: 'bg-white/10 backdrop-blur-md border-white/20',
    shadow: 'shadow-purple-500/25',
    progressBg: 'bg-purple-300',
  },
  {
    bg: 'bg-gradient-to-br from-blue-600 via-teal-600 to-emerald-600',
    text: 'text-white',
    subtext: 'text-teal-100',
    badge: 'bg-white/20 text-white backdrop-blur-md border-white/20',
    accentBg: 'bg-white/10 backdrop-blur-md border-white/20',
    shadow: 'shadow-teal-500/25',
    progressBg: 'bg-emerald-300',
  },
  {
    bg: 'bg-gradient-to-br from-amber-500 via-orange-600 to-rose-600',
    text: 'text-white',
    subtext: 'text-orange-100',
    badge: 'bg-white/20 text-white backdrop-blur-md border-white/20',
    accentBg: 'bg-white/10 backdrop-blur-md border-white/20',
    shadow: 'shadow-orange-500/25',
    progressBg: 'bg-rose-300',
  },
  {
    bg: 'bg-gradient-to-br from-violet-600 via-fuchsia-600 to-pink-500',
    text: 'text-white',
    subtext: 'text-pink-100',
    badge: 'bg-white/20 text-white backdrop-blur-md border-white/20',
    accentBg: 'bg-white/10 backdrop-blur-md border-white/20',
    shadow: 'shadow-fuchsia-500/25',
    progressBg: 'bg-pink-300',
  },
  {
    bg: 'bg-gradient-to-br from-cyan-600 via-blue-600 to-indigo-700',
    text: 'text-white',
    subtext: 'text-cyan-100',
    badge: 'bg-white/20 text-white backdrop-blur-md border-white/20',
    accentBg: 'bg-white/10 backdrop-blur-md border-white/20',
    shadow: 'shadow-blue-500/25',
    progressBg: 'bg-cyan-300',
  },
];

export const InteractiveFlashcard: React.FC<InteractiveFlashcardProps> = ({
  card,
  currentIndex,
  totalCards,
  chapterName,
  batchIndex,
  isSaved,
  onToggleSave,
  onClose,
  onSwipeNext,
  onSwipePrev,
  onAskDrAhroid,
}) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [mastered, setMastered] = useState<boolean | null>(null);
  const theme = CARD_THEMES[currentIndex % CARD_THEMES.length];

  // Motion values for swipe drag
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-18, 18]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0.5, 1, 1, 1, 0.5]);

  useEffect(() => {
    setIsFlipped(false);
    setMastered(null);
  }, [currentIndex]);

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsFlipped((prev) => !prev);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
        e.preventDefault();
        handlePrev();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex]);

  const handleFlip = () => {
    setIsFlipped((prev) => !prev);
  };

  const handleNext = () => {
    setIsFlipped(false);
    onSwipeNext();
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setIsFlipped(false);
      onSwipePrev();
    }
  };

  const handleDragEnd = (_: any, info: any) => {
    if (info.offset.x > 90) {
      handleNext();
    } else if (info.offset.x < -90 && currentIndex > 0) {
      handlePrev();
    }
  };

  const upcomingCards = [1, 2, 3].filter((offset) => currentIndex + offset < totalCards);
  const progressPercent = Math.round(((currentIndex + 1) / totalCards) * 100);

  return (
    <div className="relative w-full max-w-md mx-auto aspect-[3/4.4] max-h-[540px] select-none pt-6 pb-2 px-2" style={{ perspective: '1200px' }}>
      {/* Top Animated Progress Bar */}
      <div className="absolute top-1 inset-x-4 h-1.5 rounded-full bg-white/20 overflow-hidden z-30 backdrop-blur-md">
        <motion.div
          className={`h-full ${theme.progressBg}`}
          initial={{ width: 0 }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Static Stacked inactive cards behind the active card */}
      {upcomingCards.map((offset) => {
        const nextIndex = currentIndex + offset;
        const nextTheme = CARD_THEMES[nextIndex % CARD_THEMES.length];
        const translateY = -offset * 10;
        const scale = 1 - offset * 0.04;
        const opacityVal = 1 - offset * 0.15;

        return (
          <div
            key={nextIndex}
            style={{
              transform: `translateY(${translateY}px) scale(${scale})`,
              transformOrigin: 'bottom center',
              zIndex: 10 - offset,
              opacity: opacityVal,
            }}
            className={`absolute inset-x-2 bottom-2 top-6 rounded-[2.5rem] ${nextTheme.bg} ${nextTheme.shadow} shadow-2xl border border-white/40 pointer-events-none`}
          />
        );
      })}

      {/* Active Card Container with 3D Flip & Drag Gestures */}
      <AnimatePresence mode="popLayout">
        <motion.div
          key={currentIndex}
          style={{ x, rotate, opacity }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          onDragEnd={handleDragEnd}
          initial={{ scale: 0.92, opacity: 0, y: -16 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 16 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className={`relative z-20 w-full h-full rounded-[2.5rem] p-5 sm:p-7 flex flex-col justify-between ${theme.bg} ${theme.text} ${theme.shadow} shadow-2xl overflow-hidden font-rounded border border-white/20`}
        >
          {/* Background decorative glow */}
          <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-white/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-64 h-64 rounded-full bg-black/10 blur-3xl pointer-events-none" />

          {/* Header inside Card */}
          <div className="relative z-10 space-y-2">
            <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-white/15">
              <div className="flex items-center gap-2">
                <img
                  src="/lovable-uploads/bf69a7f7-550a-45a1-8808-a02fb889f8c5.png"
                  alt="Medmacs"
                  className="h-6 w-6 object-contain drop-shadow-md"
                />
                <span className="text-xs font-black uppercase tracking-widest text-white/95 font-rounded drop-shadow-sm">
                  Medmacs<span className="opacity-75 text-[10px]">.app</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                {onToggleSave && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onToggleSave(); }}
                    aria-label={isSaved ? "Unsave flashcard" : "Save flashcard"}
                    title={isSaved ? "Unsave flashcard" : "Save flashcard"}
                    className={`flex h-7 w-7 items-center justify-center rounded-full border transition hover:scale-105 active:scale-95 ${
                      isSaved ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-md shadow-amber-500/30' : theme.accentBg
                    }`}
                  >
                    <Bookmark className={`h-3.5 w-3.5 ${isSaved ? 'fill-slate-950' : ''}`} />
                  </button>
                )}
                {onClose && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onClose(); }}
                    aria-label="Close card"
                    className={`flex h-7 w-7 items-center justify-center rounded-full border transition hover:opacity-80 active:scale-95 ${theme.accentBg}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {chapterName && (
              <div className="flex items-center justify-between gap-2 pt-0.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <BookOpen className="h-3.5 w-3.5 shrink-0 opacity-80" />
                  <span className="truncate text-xs font-bold uppercase tracking-wider opacity-90 font-rounded">
                    {chapterName}
                  </span>
                </div>
                {batchIndex !== undefined && (
                  <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${theme.accentBg} shrink-0`}>
                    Batch {batchIndex + 1}
                  </span>
                )}
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <Badge variant="secondary" className={`font-rounded font-bold px-3 py-1 text-xs rounded-full border ${theme.badge}`}>
                Card {currentIndex + 1} of {totalCards}
              </Badge>
              {card.source && (
                <span className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider ${theme.subtext}`}>
                  <Sparkles className="h-3.5 w-3.5 opacity-80" />
                  {card.source}
                </span>
              )}
            </div>
          </div>

          {/* 3D Flip Card Body */}
          <div
            onClick={handleFlip}
            className="my-auto relative z-10 min-h-[200px] flex items-center justify-center text-center w-full cursor-pointer"
            style={{ perspective: '1000px' }}
          >
            <motion.div
              animate={{ rotateY: isFlipped ? 180 : 0 }}
              transition={{ duration: 0.45, ease: 'easeInOut' }}
              className="w-full h-full relative"
              style={{ transformStyle: 'preserve-3d' }}
            >
              {/* Front Side */}
              <div
                className="w-full space-y-3"
                style={{
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  opacity: isFlipped ? 0 : 1,
                  pointerEvents: isFlipped ? 'none' : 'auto',
                }}
              >
                <span className={`text-[11px] font-extrabold uppercase tracking-widest ${theme.subtext} block`}>
                  Question (Tap or space to flip)
                </span>
                <div className="max-h-[210px] overflow-y-auto px-2 select-text">
                  <p className="text-lg sm:text-xl font-bold font-rounded leading-relaxed tracking-tight">
                    {card.front}
                  </p>
                </div>
              </div>

              {/* Back Side */}
              <div
                className="w-full space-y-3 absolute inset-0 flex flex-col justify-center"
                style={{
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                  opacity: isFlipped ? 1 : 0,
                  pointerEvents: isFlipped ? 'auto' : 'none',
                }}
              >
                <span className={`text-[11px] font-extrabold uppercase tracking-widest ${theme.subtext} block`}>
                  Answer & Clinical Explanation
                </span>
                <div className={`text-base sm:text-lg font-medium font-rounded leading-relaxed p-4 rounded-2xl border ${theme.accentBg} max-h-[210px] overflow-y-auto text-left select-text`}>
                  {parseBoldText(card.back)}
                </div>
              </div>
            </motion.div>
          </div>

          {/* Footer Controls & Actions */}
          <div className="relative z-10 space-y-2.5 pt-2 border-t border-white/15">
            {/* Ask Dr. Ahroid & Mastery Quick Rating Bar */}
            <div className="flex items-center justify-between gap-1.5">
              {onAskDrAhroid && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAskDrAhroid(`Dr Ahroid, explain this flashcard key point in depth:\n\nQ: ${card.front}\n\nA: ${card.back}`);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold transition hover:bg-white/20 border ${theme.accentBg}`}
                >
                  <Bot className="h-3.5 w-3.5 text-cyan-300" />
                  <span>Ask Dr. Ahroid</span>
                </button>
              )}

              <div className="flex items-center gap-1.5 ml-auto">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setMastered(false); }}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition ${
                    mastered === false ? 'bg-red-500/80 text-white border-red-400' : `${theme.accentBg} opacity-75 hover:opacity-100`
                  }`}
                >
                  <RefreshCw className="h-3 w-3 inline mr-1" />
                  Review
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setMastered(true); }}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition ${
                    mastered === true ? 'bg-emerald-500/80 text-white border-emerald-400' : `${theme.accentBg} opacity-75 hover:opacity-100`
                  }`}
                >
                  <CheckCircle2 className="h-3 w-3 inline mr-1" />
                  Mastered
                </button>
              </div>
            </div>

            {/* Navigation & Flip Prompt */}
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handlePrev(); }}
                disabled={currentIndex === 0}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition disabled:opacity-40 border ${theme.accentBg}`}
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Prev</span>
              </button>

              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleFlip(); }}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold ${theme.accentBg} hover:opacity-90 active:scale-95`}
              >
                {isFlipped ? (
                  <>
                    <RotateCw className="h-3.5 w-3.5" />
                    <span>Flip Question</span>
                  </>
                ) : (
                  <>
                    <Eye className="h-3.5 w-3.5" />
                    <span>Tap to reveal</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleNext(); }}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition hover:opacity-80 active:scale-95 border ${theme.accentBg}`}
              >
                <span>Next</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

