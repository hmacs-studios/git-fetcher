import { type ReactNode } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';

type MCQQuestionMapDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
};

export function MCQQuestionMapDrawer({
  open,
  onOpenChange,
  children,
}: MCQQuestionMapDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="z-[201] flex h-full w-[310px] max-w-[88vw] flex-col border-r border-slate-300/80 bg-white/[0.98] p-0 shadow-2xl backdrop-blur-3xl dark:border-white/10 dark:bg-zinc-950/[0.97] sm:w-[360px]"
        overlayClassName="z-[200] bg-slate-950/60 backdrop-blur-sm dark:bg-black/70"
      >
        <SheetHeader className="border-b border-border/50 px-5 pb-4 pt-[calc(1rem+env(safe-area-inset-top))] text-left sm:text-left">
          <SheetTitle className="font-['Bricolage_Grotesque'] text-lg font-extrabold tracking-tight text-foreground">
            Question <span className="text-primary">Map</span>
          </SheetTitle>
          <SheetDescription className="mt-0.5 text-[11px] font-medium text-muted-foreground">
            Tap a question number to jump to it
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
