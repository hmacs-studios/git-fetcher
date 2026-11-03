import { useEffect, useState } from 'react';
import { App } from '@capacitor/app';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CheckCircle2, Download, DownloadCloud, FileDown, ArrowUpCircle, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  dismissOtaUpdateScreen,
  startOtaDownload,
  retryOtaDownload,
  subscribeToOtaUpdates,
  type OtaUpdateState,
} from '@/services/otaUpdateService';

const transitionMessages = [
  'Boosting your experience\u2026',
  'Medmacs just got even better',
  'Installing new features\u2026',
  'Preparing smarter medical revision\u2026',
  'Making every session count\u2026',
  'Upgrading your learning space\u2026',
  'Fine-tuning your experience\u2026',
  'Bringing improvements to life\u2026',
  'Preparing your next breakthrough\u2026',
  'Building a smoother experience\u2026',
  'Optimizing your question practice\u2026',
  'Refreshing your learning journey\u2026',
  'Adding the latest improvements\u2026',
  'Making revision feel effortless\u2026',
  'Preparing powerful new tools\u2026',
  'Improving speed and reliability\u2026',
  'Polishing every little detail\u2026',
  'Getting your study space ready\u2026',
  'Unlocking a better experience\u2026',
  'Advancing the way you learn\u2026',
  'Almost ready for your next session\u2026',
  'Putting the finishing touches on\u2026',
  'Your upgraded Medmacs experience is nearly ready\u2026',
];

function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || bytes <= 0) return '';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const OtaUpdateScreen = () => {
  const [state, setState] = useState<OtaUpdateState>({ phase: 'idle', progress: 0 });
  const [messageIndex, setMessageIndex] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => subscribeToOtaUpdates((s) => {
    setState(s);
    if (s.phase === 'idle' || s.phase === 'available') setDownloading(false);
  }), []);

  useEffect(() => {
    if (state.phase === 'available' || state.phase === 'idle' || state.phase === 'complete' || state.phase === 'failed' || state.phase === 'error') return;
    const interval = window.setInterval(() => {
      setMessageIndex(current => (current + 1) % transitionMessages.length);
    }, 5000);
    return () => window.clearInterval(interval);
  }, [state.phase]);

  const isChecking = state.phase === 'checking';
  const isAvailable = state.phase === 'available';
  const isDownloading = state.phase === 'downloading';
  const isPreparing = state.phase === 'preparing';
  const isInstalling = state.phase === 'installing';
  const isComplete = state.phase === 'complete';
  const isFailed = state.phase === 'failed';
  const isError = state.phase === 'error';
  const isMandatory = state.mandatory ?? false;
  const progress = Math.max(0, Math.min(100, state.progress));
  const isActive = isDownloading || isPreparing || isInstalling;
  const canContinue = isComplete || isFailed || isError;

  const handleContinue = async () => {
    setDownloading(true);
    await startOtaDownload();
  };

  const handleRetry = async () => {
    setDownloading(true);
    await retryOtaDownload();
  };

  const handleLater = () => {
    dismissOtaUpdateScreen();
  };

  const handleExit = async () => {
    await App.exitApp();
  };

  const displayMessage = isComplete
    ? 'You\u2019re all set!'
    : isFailed || isError
      ? 'Update paused'
      : transitionMessages[messageIndex];

  const sizeText = formatBytes(state.size);

  return (
    <>
      {isChecking && (
        <div role="status" aria-live="polite" className="fixed inset-0 z-[10000] flex flex-col items-center justify-center gap-4 bg-background text-foreground">
          <img src="/icon.svg" alt="" className="h-24 w-24 object-contain" />
          <p className="text-sm font-semibold text-muted-foreground">Checking for app updates...</p>
        </div>
      )}
      {/* ── Bottom-pinned update prompt ── */}
      {isAvailable && (
        <div className="fixed inset-0 z-[10000] flex items-end justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={!isMandatory ? handleLater : undefined}
            aria-hidden="true"
          />

          {/* Sheet panel */}
          <div className="relative z-10 w-full sm:max-w-lg rounded-t-[2rem] border-x border-t border-primary/20 bg-background p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-muted" aria-hidden="true" />

            <div className="text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-cyan-500 text-white shadow-lg shadow-primary/25">
                <Download className="h-7 w-7" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-primary">Medmacs</p>
              <h2 className="mt-1 text-2xl font-extrabold tracking-tight brand-display">
                Update{' '}
                <span className="text-primary">
                  {isMandatory ? 'Required' : 'Available'}
                </span>
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {isMandatory
                  ? 'A new version of Medmacs is required to continue.'
                  : 'A new version of Medmacs is available with improvements and bug fixes.'}
              </p>
            </div>

            <div className="mt-5 space-y-3">
              {/* Version & Size */}
              <div className="flex items-center gap-3 rounded-2xl border border-border/50 bg-card p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <ArrowUpCircle className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-foreground">Version {state.version || '\u2014'}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <FileDown className="h-3 w-3" />
                    {sizeText || 'Calculating size\u2026'}
                  </p>
                </div>
              </div>

              {/* Release Notes */}
              {state.notes && (
                <div className="rounded-2xl border border-border/50 bg-card p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-2">What's New</p>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{state.notes}</p>
                </div>
              )}
            </div>

            <div className="mt-6 grid grid-cols-1 gap-3">
              <Button
                onClick={handleContinue}
                disabled={downloading}
                className="w-full rounded-2xl h-12 bg-gradient-to-r from-primary to-cyan-500 hover:from-primary/90 hover:to-cyan-500/90 text-white font-bold shadow-lg shadow-primary/20"
              >
                {downloading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <DownloadCloud className="mr-2 h-4 w-4" />
                )}
                Continue
              </Button>
              {isMandatory ? (
                <Button
                  onClick={handleExit}
                  variant="outline"
                  className="w-full rounded-2xl h-12 font-bold"
                >
                  Exit
                </Button>
              ) : (
                <Button
                  onClick={handleLater}
                  variant="outline"
                  className="w-full rounded-2xl h-12 font-bold"
                >
                  Later
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Full-screen overlay for download / install / complete / error ── */}
      {(isActive || canContinue) && (
        <div className="fixed inset-0 z-[10000] overflow-hidden bg-white text-slate-950">
          <div className="mx-auto flex h-full w-full max-w-md flex-col px-5 pb-[max(18px,env(safe-area-inset-bottom))] pt-[max(18px,env(safe-area-inset-top))]">
            <header className="flex items-center gap-2.5 font-['Bricolage_Grotesque'] text-lg font-extrabold tracking-[-.045em]">
              <img src="/favicon.png" alt="" className="h-8 w-8 rounded-lg object-contain" />
              <span className="brand-wordmark text-xl text-foreground">Medmacs</span>
            </header>

            <main className="flex min-h-0 flex-1 flex-col items-center justify-center px-2 text-center">
              {/* Complete state */}
              {isComplete && (
                <motion.div
                  initial={reduceMotion ? false : { scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
                  className="mb-6 flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 shadow-xl shadow-emerald-400/30"
                >
                  <CheckCircle2 className="h-14 w-14 text-white" />
                </motion.div>
              )}

              {/* Error / Failed icon */}
              {(isFailed || isError) && (
                <motion.div
                  initial={reduceMotion ? false : { scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                  className="mb-6 flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 shadow-xl shadow-amber-400/30"
                >
                  <RefreshCw className="h-14 w-14 text-white" />
                </motion.div>
              )}

              <p className="mb-3 text-xs font-bold uppercase tracking-[.2em] text-slate-400">
                {isComplete ? 'Update complete' : 'App update'}
              </p>

              <div className="flex min-h-28 items-center justify-center">
                <AnimatePresence mode="wait">
                  <motion.h1
                    key={displayMessage}
                    initial={reduceMotion ? false : { opacity: 0, y: 14, filter: 'blur(6px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    exit={reduceMotion ? undefined : { opacity: 0, y: -12, filter: 'blur(5px)' }}
                    transition={{ duration: reduceMotion ? 0 : 0.42, ease: [0.22, 1, 0.36, 1] }}
                    className="font-['Bricolage_Grotesque'] text-[clamp(1.75rem,7vw,2.3rem)] font-extrabold leading-[1.05] tracking-[-.05em]"
                  >
                    {displayMessage}
                  </motion.h1>
                </AnimatePresence>
              </div>

              <p className="mt-3 max-w-xs text-sm leading-6 text-slate-500">
                {isComplete
                  ? 'The app has been updated and is ready to use.'
                  : isFailed || isError
                    ? state.message || 'Something went wrong during the update.'
                    : state.notes || 'Preparing the newest Medmacs experience for you.'}
              </p>
            </main>

            {/* Progress button — active download/install */}
            {isActive && (
              <button
                type="button"
                disabled
                className="relative isolate min-h-14 w-full overflow-hidden rounded-2xl bg-slate-100 px-5 py-4 text-sm font-extrabold text-slate-950 shadow-sm disabled:cursor-wait disabled:text-white"
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 left-0 -z-10 bg-gradient-to-r from-primary to-cyan-500 transition-[width] duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
                {`Installing \u00B7 ${progress}%`}
              </button>
            )}

            {/* Complete button */}
            {isComplete && (
              <motion.div
                initial={reduceMotion ? false : { opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <button
                  type="button"
                  onClick={dismissOtaUpdateScreen}
                  className="relative isolate min-h-14 w-full overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-4 text-sm font-extrabold text-white shadow-lg shadow-emerald-400/25 transition-transform active:scale-[.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                >
                  Continue
                </button>
              </motion.div>
            )}

            {/* Error / Failed buttons */}
            {(isFailed || isError) && (
              <motion.div
                initial={reduceMotion ? false : { opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="space-y-3"
              >
                {isMandatory ? (
                  <>
                    <button
                      type="button"
                      onClick={handleRetry}
                      className="relative isolate min-h-14 w-full overflow-hidden rounded-2xl bg-gradient-to-r from-primary to-cyan-500 px-5 py-4 text-sm font-extrabold text-white shadow-lg shadow-primary/25 transition-transform active:scale-[.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    >
                      <RefreshCw className="mr-2 inline h-4 w-4" />
                      Retry Update
                    </button>
                    <button
                      type="button"
                      onClick={handleExit}
                      className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-600 transition-transform active:scale-[.98]"
                    >
                      Exit App
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={dismissOtaUpdateScreen}
                    className="relative isolate min-h-14 w-full overflow-hidden rounded-2xl bg-slate-100 px-5 py-4 text-sm font-extrabold text-slate-950 shadow-sm transition-transform active:scale-[.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  >
                    Continue
                  </button>
                )}
              </motion.div>
            )}

            <p className="mt-4 shrink-0 text-center text-xs text-slate-400">
              A project by <span className="font-semibold text-slate-600">HMACS Studios</span>
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default OtaUpdateScreen;
