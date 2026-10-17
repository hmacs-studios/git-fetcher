import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BookOpen, ChevronLeft, ChevronRight, FlaskConical, Loader2, RotateCcw, Sparkles, Wand2, Bookmark } from 'lucide-react';
import { recordGeneratedFlashcards } from '@/components/profile/AchievementBadges';
import { useAuth } from '@/hooks/useAuth';
import { CorrectionMCQModal } from './CorrectionMCQModal';
import { FlashcardLimitModal, getAiLimitDetails, isAiLimitError } from './FlashcardLimitModal';
import { buildFallbackCards, refineFlashcardsWithAI } from './personalizationUtils';
import { Flashcard, MistakeChapter } from './types';
import { parseBoldText } from '@/utils/format';
import { useNavigate } from 'react-router-dom';
import { InteractiveFlashcard } from './InteractiveFlashcard';
import { fetchSavedFlashcards, toggleSaveFlashcard, SavedFlashcardItem } from '@/services/savedFlashcards';

import { LottiePlayer } from '@/components/LottiePlayer';
import bouncingDotsAnimationData from '@/assets/animations/bouncing-dots-loading.json';

type SmartDeckProps = {
  weakestChapter: MistakeChapter | null;
};

const FlashcardLottieLoader = () => (
  <div className="flex flex-col items-center justify-center py-12 space-y-3">
    <div className="w-24 h-24 flex items-center justify-center">
      <LottiePlayer animationData={bouncingDotsAnimationData} loop autoplay style={{ width: '100%', height: '100%' }} />
    </div>
    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground animate-pulse">
      Generating AI Flashcards…
    </p>
  </div>
);

export const SmartDeck = ({ weakestChapter }: SmartDeckProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [savedCards, setSavedCards] = useState<SavedFlashcardItem[]>([]);
  const [activeCard, setActiveCard] = useState(0);
  const [batchIndex, setBatchIndex] = useState(0);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [flashcardModalOpen, setFlashcardModalOpen] = useState(false);
  const [savedDeckOpen, setSavedDeckOpen] = useState(false);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [limitModalOpen, setLimitModalOpen] = useState(false);
  const [limitDetails, setLimitDetails] = useState(getAiLimitDetails(null));

  const loadSavedCards = async () => {
    const list = await fetchSavedFlashcards(user?.id);
    setSavedCards(list);
  };

  useEffect(() => {
    loadSavedCards();
  }, [user?.id]);

  const handleToggleSave = async (cardToSave: Flashcard) => {
    await toggleSaveFlashcard(cardToSave, weakestChapter?.name, user?.id);
    await loadSavedCards();
  };

  const loadFlashcards = async (nextBatch = false) => {
    if (!weakestChapter) return;
    const nextIndex = nextBatch ? batchIndex + 1 : batchIndex;
    const requestedCount = 5;
    const allowedCount = requestedCount;

    setCardsLoading(true);
    setActiveCard(0);
    setFlashcardModalOpen(true);
    try {
      const cards = await refineFlashcardsWithAI(weakestChapter.attempts, nextIndex, allowedCount);
      const nextCards = cards.length ? cards : buildFallbackCards(weakestChapter.attempts, nextIndex, allowedCount);
      setFlashcards(nextCards);
      await recordGeneratedFlashcards(user?.id, nextCards.length);
      setBatchIndex(nextIndex);
    } catch (error) {
      if (isAiLimitError(error)) {
        setFlashcardModalOpen(false);
        setLimitDetails(getAiLimitDetails(error, 'free', 2));
        setLimitModalOpen(true);
        return;
      }
      const nextCards = buildFallbackCards(weakestChapter.attempts, nextIndex, allowedCount);
      setFlashcards(nextCards);
      await recordGeneratedFlashcards(user?.id, nextCards.length);
      setBatchIndex(nextIndex);
    } finally {
      setCardsLoading(false);
    }
  };

  const startCorrectionSession = () => {
    if (!weakestChapter) return;
    setFlashcardModalOpen(false);
    setCorrectionOpen(true);
  };

  const currentCard = flashcards[activeCard];
  const isAllCardsCompleted = flashcards.length > 0 && activeCard >= flashcards.length;

  return (
    <>
      <Card className="overflow-hidden border-border/40 bg-card/55 dark:bg-white/[0.035] shadow-sm">
        <CardHeader className="bg-gradient-to-br from-rose-500/10 via-amber-500/10 to-cyan-500/10 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <FlaskConical className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <CardDescription className="text-[10px] font-black uppercase tracking-widest text-primary">
                Chapter {weakestChapter?.number} - weakest chapter
              </CardDescription>
              <CardTitle className="mt-1 text-lg font-black uppercase italic leading-tight">
                {weakestChapter?.name}
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">{weakestChapter?.subjectName} - {weakestChapter?.attempts.length} wrong attempts</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-muted/50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Step 1</p>
              <p className="mt-1 text-sm font-black text-foreground">Flashcard batch</p>
            </div>
            <div className="rounded-2xl bg-muted/50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Step 2</p>
              <p className="mt-1 text-sm font-black text-foreground">Correction MCQs</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button className="h-12 flex-1 rounded-2xl font-black" onClick={() => loadFlashcards(false)} disabled={cardsLoading || !weakestChapter}>
              {cardsLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
              Build Flashcards
            </Button>
            {savedCards.length > 0 && (
              <Button
                variant="outline"
                className="h-12 border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-300 font-bold px-3.5 rounded-2xl"
                onClick={() => { setActiveCard(0); setSavedDeckOpen(true); }}
                title="View Saved Flashcards"
              >
                <Bookmark className="h-4 w-4 fill-current mr-1.5" />
                Saved ({savedCards.length})
              </Button>
            )}
          </div>

          {flashcards.length > 0 && (
            <Button variant="outline" className="w-full rounded-xl" onClick={() => setFlashcardModalOpen(true)}>
              <BookOpen className="mr-2 h-4 w-4" />
              Open Current Batch
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Saved Flashcards Modal Deck */}
      <Dialog open={savedDeckOpen} onOpenChange={setSavedDeckOpen}>
        <DialogContent className="max-w-md p-0 border-none bg-transparent shadow-none [&>button]:hidden flex flex-col items-center justify-center">
          <DialogTitle className="sr-only">Saved Flashcards</DialogTitle>
          <DialogDescription className="sr-only">Access your saved medical flashcards</DialogDescription>
          {savedCards.length > 0 && (
            <div className="w-full space-y-3">
              <InteractiveFlashcard
                card={savedCards[activeCard < savedCards.length ? activeCard : 0]}
                currentIndex={activeCard < savedCards.length ? activeCard : 0}
                totalCards={savedCards.length}
                chapterName={savedCards[activeCard < savedCards.length ? activeCard : 0]?.chapter_name || 'Saved Deck'}
                isSaved={true}
                onToggleSave={() => handleToggleSave(savedCards[activeCard < savedCards.length ? activeCard : 0] as any)}
                onClose={() => setSavedDeckOpen(false)}
                onSwipeNext={() => setActiveCard((index) => (index + 1) % savedCards.length)}
                onSwipePrev={() => setActiveCard((index) => (index - 1 + savedCards.length) % savedCards.length)}
                onAskDrAhroid={(prompt) => {
                  setSavedDeckOpen(false);
                  navigate('/ai/chatbot', { state: { prefillPrompt: prompt } });
                }}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={flashcardModalOpen} onOpenChange={setFlashcardModalOpen}>
        <DialogContent className="max-w-md p-0 border-none bg-transparent shadow-none [&>button]:hidden flex flex-col items-center justify-center">
          <DialogTitle className="sr-only">
            {weakestChapter?.name || 'Flashcard Batch'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Interactive AI flashcards batch
          </DialogDescription>

          {cardsLoading ? (
            <FlashcardLottieLoader />
          ) : isAllCardsCompleted ? (
            <div className="relative w-full max-w-md mx-auto aspect-[3/4.2] max-h-[520px] rounded-[2.5rem] p-6 flex flex-col justify-between bg-gradient-to-br from-indigo-900/60 via-purple-900/60 to-pink-900/60 backdrop-blur-2xl text-white shadow-2xl font-rounded border border-white/20 select-none">
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="bg-white/15 text-white font-rounded font-bold border-white/20 backdrop-blur-md">
                  Batch Completed 🎉
                </Badge>
                <button
                  type="button"
                  onClick={() => setFlashcardModalOpen(false)}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 border border-white/20 hover:bg-white/20 transition"
                >
                  <span className="text-sm font-bold">×</span>
                </button>
              </div>

              <div className="my-auto text-center space-y-4">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/15 backdrop-blur-xl border border-white/30 text-white shadow-2xl">
                  <Sparkles className="h-8 w-8 text-amber-300" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-2xl font-bold font-rounded">Batch {batchIndex + 1} Finished!</h3>
                  <p className="text-xs text-purple-200/90 font-medium">You've completed all {flashcards.length} revision cards in this set.</p>
                </div>
              </div>

              <div className="space-y-2.5 pt-2 border-t border-white/15">
                <Button className="w-full h-12 rounded-2xl font-black bg-white text-purple-950 hover:bg-purple-50 shadow-lg text-sm" onClick={() => loadFlashcards(true)} disabled={cardsLoading}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Load Next Batch
                </Button>
                <Button variant="secondary" className="w-full h-12 rounded-2xl font-bold bg-white/15 text-white hover:bg-white/25 backdrop-blur-md border border-white/20 text-sm" onClick={startCorrectionSession}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Continue Correcting MCQs
                </Button>
                <button
                  type="button"
                  onClick={() => setActiveCard(0)}
                  className="w-full text-center text-xs font-bold text-purple-200 hover:text-white py-1 underline underline-offset-4"
                >
                  Replay batch from Card 1
                </button>
              </div>
            </div>
          ) : currentCard ? (
            <div className="w-full space-y-3">
              <InteractiveFlashcard
                card={currentCard}
                currentIndex={activeCard}
                totalCards={flashcards.length}
                chapterName={weakestChapter?.name}
                batchIndex={batchIndex}
                isSaved={savedCards.some((s) => s.front === currentCard.front && s.back === currentCard.back)}
                onToggleSave={() => handleToggleSave(currentCard)}
                onClose={() => setFlashcardModalOpen(false)}
                onSwipeNext={() => setActiveCard((index) => index + 1)}
                onSwipePrev={() => setActiveCard((index) => Math.max(0, index - 1))}
                onAskDrAhroid={(prompt) => {
                  setFlashcardModalOpen(false);
                  navigate('/ai/chatbot', { state: { prefillPrompt: prompt } });
                }}
              />
            </div>
          ) : (
            <Button className="h-12 w-full rounded-2xl font-black" onClick={() => loadFlashcards(false)}>
              <Wand2 className="mr-2 h-4 w-4" />
              Build Flashcards
            </Button>
          )}
        </DialogContent>
      </Dialog>

      <FlashcardLimitModal
        open={limitModalOpen}
        onOpenChange={setLimitModalOpen}
        plan={limitDetails.plan}
        limit={limitDetails.limit}
        period={limitDetails.period}
        limitKind={limitDetails.limitKind}
        featureLabel="Smart Deck flashcards"
        onUpgrade={() => {
          setLimitModalOpen(false);
          navigate('/pricing');
        }}
      />

      <CorrectionMCQModal
        open={correctionOpen}
        chapter={weakestChapter}
        onOpenChange={setCorrectionOpen}
      />
    </>
  );
};
