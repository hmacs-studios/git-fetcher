import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { LogOut, AlertTriangle } from 'lucide-react';

interface SignOutConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  isSigningOut?: boolean;
}

export const SignOutConfirmModal: React.FC<SignOutConfirmModalProps> = ({
  open,
  onOpenChange,
  onConfirm,
  isSigningOut = false,
}) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto max-h-[85dvh] rounded-t-[2rem] border-x border-t border-red-500/20 bg-background/95 p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] backdrop-blur-2xl max-w-lg w-full z-[300]"
        overlayClassName="z-[300]"
      >
        <div className="w-12 h-1.5 bg-muted-foreground/30 rounded-full mx-auto mb-4" aria-hidden="true" />
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 w-16 h-16 rounded-full bg-red-100 dark:bg-red-950/60 flex items-center justify-center shadow-inner border border-red-500/20">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <SheetHeader className="text-center sm:text-center">
            <SheetTitle className="text-xl font-bold font-['Bricolage_Grotesque'] text-foreground">
              Are you sure you want to log out?
            </SheetTitle>
            <SheetDescription className="text-sm text-muted-foreground mt-2 font-medium">
              All downloaded chapters will be erased.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col-reverse sm:flex-row gap-3 w-full mt-6">
            <Button
              onClick={() => onOpenChange(false)}
              variant="outline"
              disabled={isSigningOut}
              className="flex-1 rounded-2xl h-12 font-bold uppercase tracking-wider text-xs border-border/60"
            >
              Cancel
            </Button>
            <Button
              onClick={onConfirm}
              disabled={isSigningOut}
              className="flex-1 rounded-2xl h-12 font-black uppercase tracking-wider text-xs bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/20"
            >
              <LogOut className="w-4 h-4 mr-2" />
              {isSigningOut ? 'Signing out...' : 'Log Out'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
