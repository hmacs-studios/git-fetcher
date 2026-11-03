import React from 'react';
import { BookOpen, Sparkles, Tag } from 'lucide-react';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import type { GlossaryTerm } from '@/services/glossaryService';

interface GlossaryTermModalProps {
  term: GlossaryTerm | null;
  open: boolean;
  onClose: () => void;
}

export const GlossaryTermModal: React.FC<GlossaryTermModalProps> = ({
  term,
  open,
  onClose,
}) => {
  if (!term) return null;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      eyebrow={term.category || 'Medical Glossary'}
      title={term.term}
      media={
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-sm">
          <BookOpen className="h-5 w-5" />
        </div>
      }
    >
      <div className="space-y-4 pt-1 pb-4">
        {/* Definition card */}
        <div className="rounded-2xl border border-border/70 bg-card/60 p-4 shadow-sm backdrop-blur-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-2">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Concise Definition
          </p>
          <p className="text-[1.05rem] font-medium leading-relaxed text-foreground tracking-[-0.01em]">
            {term.definition}
          </p>
        </div>

        {/* Category tag */}
        {term.category && (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
              <Tag className="h-3 w-3" />
              {term.category}
            </span>
            <span className="text-xs text-muted-foreground">
              Verified clinical term
            </span>
          </div>
        )}
      </div>
    </BottomSheet>
  );
};
