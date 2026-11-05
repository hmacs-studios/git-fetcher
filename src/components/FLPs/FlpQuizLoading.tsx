import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';

export function FlpQuizLoading() {
  return (
    <div className="min-h-dvh bg-background">
      <Sheet open>
        <SheetContent side="bottom" overlayClassName="z-[200]"
          className="z-[201] mx-auto rounded-t-3xl border-border bg-card pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:max-w-lg [&>button]:hidden">
          <SheetHeader className="text-left">
            <SheetTitle>Loading your paper</SheetTitle>
            <SheetDescription>Getting your questions and saved progress ready.</SheetDescription>
          </SheetHeader>
          <div aria-hidden="true" className="mt-5 space-y-3">
            <Skeleton className="h-4 w-4/5 motion-reduce:animate-none" />
            <Skeleton className="h-10 rounded-xl motion-reduce:animate-none" />
            <Skeleton className="h-10 rounded-xl motion-reduce:animate-none" />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
