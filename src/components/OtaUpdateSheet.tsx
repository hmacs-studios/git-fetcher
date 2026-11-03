import { useEffect, useState } from 'react';
import { App } from '@capacitor/app';
import { Download, ArrowUpCircle, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { subscribeToOtaUpdates, dismissOtaUpdateScreen, type OtaUpdateState } from '@/services/otaUpdateService';

function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || bytes <= 0) return '';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function OtaUpdateSheet() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<OtaUpdateState>({ phase: 'idle', progress: 0 });

  useEffect(() => {
    const unsub = subscribeToOtaUpdates((s) => {
      setState(s);
      setOpen(s.phase === 'downloading' || s.phase === 'preparing' || s.phase === 'installing');
    });
    return unsub;
  }, []);

  const handleLater = () => {
    setOpen(false);
  };

  const handleExit = async () => {
    await App.exitApp();
  };

  const isMandatory = state.mandatory ?? false;
  const sizeText = formatBytes(state.size);
  const phaseLabel = state.phase === 'downloading' ? 'Downloading...' : state.phase === 'preparing' ? 'Preparing...' : 'Installing...';

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v && !isMandatory) handleLater(); }}>
      <SheetContent
        side="bottom"
        className="flex max-h-[85dvh] flex-col overflow-hidden rounded-t-[2rem] border-x border-t border-primary/20 bg-background/95 backdrop-blur-2xl"
        overlayClassName="z-[300]"
        onPointerDownOutside={(e) => { if (isMandatory) e.preventDefault(); }}
        onInteractOutside={(e) => { if (isMandatory) e.preventDefault(); }}
      >
        <div className="px-6 pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
          <SheetHeader className="text-left">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25">
              <Download className="h-6 w-6" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-primary">Medmacs</p>
            <SheetTitle className="text-2xl font-extrabold tracking-tight brand-display">
              Update Available
            </SheetTitle>
            <SheetDescription>
              A new version of Medmacs is being downloaded.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-5 space-y-4">
            {/* Version & Size */}
            <div className="flex items-center gap-3 rounded-2xl border border-border/50 bg-card p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <ArrowUpCircle className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-foreground">Version {state.version || '—'}</p>
                {sizeText && (
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <FileDown className="h-3 w-3" />
                    {sizeText}
                  </p>
                )}
              </div>
            </div>

            {/* Release Notes */}
            {state.notes && (
              <div className="rounded-2xl border border-border/50 bg-card p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-2">What's New</p>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{state.notes}</p>
              </div>
            )}

            {/* Progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-muted-foreground">{phaseLabel}</span>
                <span className="font-bold text-foreground">{state.progress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-300"
                  style={{ width: `${state.progress}%` }}
                />
              </div>
            </div>

            {/* Buttons */}
            {isMandatory ? (
              <Button
                onClick={handleExit}
                variant="outline"
                className="w-full rounded-2xl h-12 font-bold bg-muted/20 border-transparent hover:bg-muted/40 uppercase text-xs tracking-widest"
              >
                Exit Application
              </Button>
            ) : (
              <Button
                onClick={handleLater}
                variant="outline"
                className="w-full rounded-2xl h-12 font-bold bg-muted/20 border-transparent hover:bg-muted/40 uppercase text-xs tracking-widest"
              >
                Dismiss
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default OtaUpdateSheet;
