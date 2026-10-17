import { supabase } from '@/integrations/supabase/client';
import { FlashcardData } from '@/components/dashboard/personalization/InteractiveFlashcard';

const SAVED_FLASHCARDS_STORAGE_KEY = 'medmacs_saved_flashcards_v1';

export interface SavedFlashcardItem extends FlashcardData {
  id: string;
  chapter_name?: string;
  saved_at: string;
}

// Helper to get local saved flashcards fallback
export const getLocalSavedFlashcards = (): SavedFlashcardItem[] => {
  try {
    const raw = localStorage.getItem(SAVED_FLASHCARDS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Failed to read local saved flashcards', err);
    return [];
  }
};

// Helper to save local flashcards fallback
const setLocalSavedFlashcards = (items: SavedFlashcardItem[]) => {
  try {
    localStorage.setItem(SAVED_FLASHCARDS_STORAGE_KEY, JSON.stringify(items));
  } catch (err) {
    console.error('Failed to update local saved flashcards', err);
  }
};

// Fetch user saved flashcards (Supabase with localStorage fallback)
export const fetchSavedFlashcards = async (userId?: string): Promise<SavedFlashcardItem[]> => {
  if (userId) {
    try {
      const { data, error } = await (supabase as any)
        .from('saved_flashcards')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Supabase query error (using localStorage fallback):', error.message || error);
      } else if (Array.isArray(data)) {
        const mapped: SavedFlashcardItem[] = data.map(item => ({
          id: item.id,
          front: item.front_text || item.front,
          back: item.back_text || item.back,
          source: item.source || 'Saved',
          chapter_name: item.chapter_name || 'General',
          saved_at: item.created_at || new Date().toISOString(),
        }));
        setLocalSavedFlashcards(mapped);
        return mapped;
      }
    } catch (e) {
      console.warn('Supabase saved_flashcards fetch fallback to localStorage', e);
    }
  }
  return getLocalSavedFlashcards();
};

// Toggle save flashcard (Supabase + localStorage sync)
export const toggleSaveFlashcard = async (
  card: FlashcardData,
  chapterName?: string,
  userId?: string
): Promise<{ saved: boolean; cardId: string }> => {
  const currentSaved = getLocalSavedFlashcards();
  const existing = currentSaved.find(
    (item) => item.front === card.front && item.back === card.back
  );

  if (existing) {
    // Unsave card
    const updated = currentSaved.filter((item) => item.id !== existing.id);
    setLocalSavedFlashcards(updated);

    if (userId) {
      try {
        const { error } = await (supabase as any)
          .from('saved_flashcards')
          .delete()
          .eq('user_id', userId)
          .eq('front_text', card.front);
        if (error) console.warn('Supabase delete error:', error.message || error);
      } catch (err) {
        console.warn('Supabase delete saved_flashcards warning:', err);
      }
    }
    return { saved: false, cardId: existing.id };
  } else {
    // Save card (valid UUID format for Supabase UUID primary key)
    const newId = card.id && card.id.length === 36 ? card.id : crypto.randomUUID();
    const newItem: SavedFlashcardItem = {
      id: newId,
      front: card.front,
      back: card.back,
      source: card.source || 'Smart Deck',
      chapter_name: chapterName || card.chapter_name || 'General',
      saved_at: new Date().toISOString(),
    };

    const updated = [newItem, ...currentSaved];
    setLocalSavedFlashcards(updated);

    if (userId) {
      try {
        const { error } = await (supabase as any).from('saved_flashcards').insert([{
          id: newId,
          user_id: userId,
          front_text: card.front,
          back_text: card.back,
          source: card.source || 'Smart Deck',
          chapter_name: chapterName || 'General',
          created_at: newItem.saved_at,
        }]);
        if (error) console.warn('Supabase insert error (card saved locally):', error.message || error);
      } catch (err) {
        console.warn('Supabase insert saved_flashcards table warning:', err);
      }
    }
    return { saved: true, cardId: newId };
  }
};
