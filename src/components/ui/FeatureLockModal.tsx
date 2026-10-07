import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Sparkles, ShieldAlert, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';

interface FeatureLockModalProps {
  open: boolean;
  onClose: () => void;
  featureTitle?: string;
  planTierRequired?: string;
  instituteName?: string;
  redirectOnClose?: boolean;
}

export function FeatureLockModal({
  open,
  onClose,
  featureTitle = 'This Feature',
  redirectOnClose = true,
}: FeatureLockModalProps) {
  const navigate = useNavigate();

  const handleClose = () => {
    onClose();
    if (redirectOnClose) {
      navigate('/dashboard', { replace: true });
    }
  };

  const handleUpgrade = () => {
    onClose();
    navigate('/pricing');
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
      <SheetContent
        side="bottom"
        className="mx-auto max-h-[88dvh] overflow-y-auto rounded-t-[2rem] border-x border-t border-primary/20 bg-background/95 p-6 pb-[calc(2.5rem+env(safe-area-inset-bottom))] backdrop-blur-2xl sm:max-w-lg z-[300]"
        overlayClassName="z-[300]"
      >
        <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-muted" aria-hidden="true" />
        
        <SheetHeader className="text-center sm:text-center">
          <div className="w-24 h-24 rounded-3xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 shadow-inner mx-auto mb-3">
            <img
              src="/open-lock.gif?v=2"
              alt="Locked Feature"
              className="w-20 h-20 object-contain drop-shadow-lg select-none"
            />
          </div>
          <SheetTitle className="text-2xl font-bold brand-syne tracking-tight">
            Unlock {featureTitle}
          </SheetTitle>
          <SheetDescription className="mt-2 text-sm text-muted-foreground leading-relaxed font-medium">
            This feature is not available on your plan.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-5 space-y-3">
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground leading-relaxed">
              <span className="font-extrabold text-foreground block mb-0.5">
                Access Restricted
              </span>
              This feature is not available on your plan. Upgrade your plan to unlock full access.
            </div>
          </div>
        </div>

        <div className="mt-6 mb-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Button
            onClick={handleClose}
            variant="outline"
            className="w-full h-12 rounded-xl font-bold text-muted-foreground hover:text-foreground"
          >
            Back to Dashboard
          </Button>

          <Button
            onClick={handleUpgrade}
            className="w-full h-12 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-extrabold shadow-md shadow-amber-500/25"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Upgrade Plan
            <ArrowRight className="h-4 w-4 ml-1.5" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default FeatureLockModal;
