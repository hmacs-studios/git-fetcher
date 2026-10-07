import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Eye, RotateCw, ChevronLeft, ChevronRight, BookOpen, X } from 'lucide-react';
import { parseBoldText } from '@/utils/format';

export type FlashcardData = {
  front: string;
  back: string;
  source?: string;
};

type InteractiveFlashcardProps = {
  card: FlashcardData;
  currentIndex: number;
  totalCards: number;
  chapterName?: string;
  batchIndex?: number;
  onClose?: () => void;
  onSwipeNext: () => void;
  onSwipePrev: () => void;
};

const CARD_THEMES = [
  {
    bg: 'bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600',
    text: 'text-white',
    subtext: 'text-purple-100',
    badge: 'bg-white/20 text-white backdrop-blur-md border-white/20',
    accentBg: 'bg-white/10 backdrop-blur-md border-white/20',
    shadow: 'shadow-purple-500/25',
  },
  {
    bg: 'bg-gradient-to-br from-blue-600 via-teal-600 to-emerald-600',
    text: 'text-white',
    subtext: 'text-teal-100',
    badge: 'bg-white/20 text-white backdrop-blur-md border-white/20',
    accentBg: 'bg-white/10 backdrop-blur-md border-white/20',
    shadow: 'shadow-teal-500/25',
  },
  {
    bg: 'bg-gradient-to-br from-amber-500 via-orange-600 to-rose-600',
    text: 'text-white',
    subtext: 'text-orange-100',
    badge: 'bg-white/20 text-white backdrop-blur-md border-white/20',
    accentBg: 'bg-white/10 backdrop-blur-md border-white/20',
    shadow: 'shadow-orange-500/25',
  },
  {
    bg: 'bg-gradient-to-br from-violet-600 via-fuchsia-600 to-pink-500',
    text: 'text-white',
    subtext: 'text-pink-100',
    badge: 'bg-white/20 text-white backdrop-blur-md border-white/20',
    accentBg: 'bg-white/10 backdrop-blur-md border-white/20',
    shadow: 'shadow-fuchsia-500/25',
  },
  {
    bg: 'bg-gradient-to-br from-cyan-600 via-blue-600 to-indigo-700',
    text: 'text-white',
    subtext: 'text-cyan-100',
    badge: 'bg-white/20 text-white backdrop-blur-md border-white/20',
    accentBg: 'bg-white/10 backdrop-blur-md border-white/20',
    shadow: 'shadow-blue-500/25',
  },
];

export const InteractiveFlashcard: React.FC<InteractiveFlashcardProps> = ({
  card,
  currentIndex,
  totalCards,
  chapterName,
  batchIndex,
  onClose,
  onSwipeNext,
  onSwipePrev,
}) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const theme = CARD_THEMES[currentIndex % CARD_THEMES.length];

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

  const upcomingCards = [1, 2, 3].filter((offset) => currentIndex + offset < totalCards);

  return (
    <div className="relative w-full max-w-md mx-auto aspect-[3/4.2] max-h-[520px] select-none pt-8 pb-3 px-2" style={{ perspective: '1000px' }}>
      {/* Static Stacked inactive cards behind the active card */}
      {upcomingCards.map((offset) => {
        const nextIndex = currentIndex + offset;
        const nextTheme = CARD_THEMES[nextIndex % CARD_THEMES.length];
        const translateY = -offset * 10;
        const scale = 1 - offset * 0.04;
        const opacity = 1 - offset * 0.15;

        return (
          <div
            key={nextIndex}
            style={{
              transform: `translateY(${translateY}px) scale(${scale})`,
              transformOrigin: 'bottom center',
              zIndex: 10 - offset,
              opacity,
            }}
            className={`absolute inset-x-2 bottom-3 top-8 rounded-[2.5rem] ${nextTheme.bg} ${nextTheme.shadow} shadow-2xl border border-white/40 pointer-events-none`}
          />
        );
      })}

      {/* Active Front Card with Card Stacking animation */}
      <AnimatePresence mode="popLayout">
        <motion.div
          key={currentIndex}
          onClick={handleFlip}
          initial={{ scale: 0.92, opacity: 0, y: -16 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 16 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className={`relative z-20 w-full h-full rounded-[2.5rem] p-5 sm:p-7 flex flex-col justify-between cursor-pointer ${theme.bg} ${theme.text} ${theme.shadow} shadow-2xl overflow-hidden font-rounded border border-white/20`}
        >
        {/* Background decorative glow */}
        <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-white/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 rounded-full bg-black/10 blur-3xl pointer-events-none" />

        {/* Header inside Card: Chapter Name, Batch info, Progress & Close Button */}
        <div className="relative z-10 space-y-2">
          {/* Brand Header */}
          <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-white/15">
            <div className="flex items-center gap-2">
              <img
                src="/assets/brand/medmacs-logo.png"
                alt="Medmacs Logo"
                className="h-6 w-6 object-contain drop-shadow-md"
                onError={(e) => {
                  e.currentTarget.src = "/lovable-uploads/bf69a7f7-550a-45a1-8808-a02fb889f8c5.png";
                }}
              />
              <span className="text-xs font-black uppercase tracking-widest text-white/95 font-rounded drop-shadow-sm">
                Medmacs<span className="opacity-75 text-[10px]">.app</span>
              </span>
            </div>
            {onClose && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                aria-label="Close card"
                className={`flex h-6 w-6 items-center justify-center rounded-full border transition hover:opacity-80 ${theme.accentBg}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
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

        {/* Card Main Body: Question vs Answer (Wheel spin / Rolodex effect bottom-to-top) */}
        <div className="my-auto relative z-10 min-h-[190px] flex items-center justify-center text-center w-full" style={{ perspective: '600px' }}>
          <AnimatePresence mode="wait">
            {!isFlipped ? (
              <motion.div
                key="front"
                initial={{ opacity: 0, rotateX: -90, y: 30 }}
                animate={{ opacity: 1, rotateX: 0, y: 0 }}
                exit={{ opacity: 0, rotateX: 90, y: -30 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                style={{ transformOrigin: 'center center' }}
                className="w-full space-y-3"
              >
                <span className={`text-[11px] font-extrabold uppercase tracking-widest ${theme.subtext} block`}>
                  Question
                </span>
                <div className="max-h-[220px] overflow-y-auto px-2 select-text">
                  <p className="text-lg sm:text-xl font-bold font-rounded leading-relaxed tracking-tight">
                    {card.front}
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="back"
                initial={{ opacity: 0, rotateX: -90, y: 30 }}
                animate={{ opacity: 1, rotateX: 0, y: 0 }}
                exit={{ opacity: 0, rotateX: 90, y: -30 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                style={{ transformOrigin: 'center center' }}
                className="w-full space-y-3"
              >
                <span className={`text-[11px] font-extrabold uppercase tracking-widest ${theme.subtext} block`}>
                  Answer & Explanation
                </span>
                <div className={`text-base sm:text-lg font-medium font-rounded leading-relaxed p-4 rounded-2xl border ${theme.accentBg} max-h-[220px] overflow-y-auto text-left select-text`}>
                  {parseBoldText(card.back)}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer inside Card: In-card controls + Reveal Action */}
        <div className="relative z-10 space-y-3 pt-2 border-t border-white/15">
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

            <div className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold ${theme.accentBg}`}>
              {isFlipped ? (
                <>
                  <RotateCw className="h-3.5 w-3.5" />
                  <span>Question</span>
                </>
              ) : (
                <>
                  <Eye className="h-3.5 w-3.5" />
                  <span>Tap to reveal</span>
                </>
              )}
            </div>

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

