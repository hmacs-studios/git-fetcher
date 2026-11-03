import { useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Loader2, Sparkles, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CaseOfDayCard } from './CaseOfDayCard';
import type { CaseOfDay, DashboardAnnouncement, TermOfDay, WhatsNewItem } from '../types';
import { AnnouncementBody, formatAnnouncementText } from './AnnouncementText';

type DashboardDialogsProps = {
  appVersion: string;
  showWhatsNew: boolean;
  onShowWhatsNewChange: (open: boolean) => void;
  whatsNewContent?: WhatsNewItem[];
  whatsNewLoading: boolean;
  showTermOfDay: boolean;
  onShowTermOfDayChange: (open: boolean) => void;
  termOfDay?: TermOfDay;
  selectedAnnouncement: DashboardAnnouncement | null;
  onSelectedAnnouncementChange: (announcement: DashboardAnnouncement | null) => void;
  showCollaborate: boolean;
  onShowCollaborateChange: (open: boolean) => void;
  showCaseOfDay: boolean;
  onShowCaseOfDayChange: (open: boolean) => void;
  caseOfDay?: CaseOfDay;
  isPremium: boolean;
  onNavigateToChat: (text: string) => void;
  onNavigateToPricing: () => void;
};

async function openExternalUrl(url?: string | null) {
  if (!url) return;
  try {
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url });
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

export function DashboardDialogs({
  appVersion,
  showWhatsNew,
  onShowWhatsNewChange,
  whatsNewContent,
  whatsNewLoading,
  showTermOfDay,
  onShowTermOfDayChange,
  termOfDay,
  selectedAnnouncement,
  onSelectedAnnouncementChange,
  showCollaborate,
  onShowCollaborateChange,
  showCaseOfDay,
  onShowCaseOfDayChange,
  caseOfDay,
  isPremium,
  onNavigateToChat,
  onNavigateToPricing,
}: DashboardDialogsProps) {
  const dailyInsight = {
    key: 'term',
    label: 'Term of the Day',
    title: termOfDay?.term || 'Term of the Day',
    body: termOfDay?.definition || 'Loading latest term...',
  };

  const closeTerm = useCallback(() => {
    onShowTermOfDayChange(false);
  }, [onShowTermOfDayChange]);

  return (
    <>
      <Dialog open={showWhatsNew} onOpenChange={onShowWhatsNewChange}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">What's New</DialogTitle>
            <DialogDescription>Current Version: {appVersion}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {whatsNewLoading ? (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">Fetching updates...</p>
              </div>
            ) : whatsNewContent?.length ? (
              whatsNewContent.map((release) => (
                <div key={`${release.version}-${release.title}`} className="flex items-start gap-3 p-3 rounded-xl bg-muted/50">
                  <Badge className="bg-primary/15 text-primary border-0 text-xs font-bold shrink-0">{release.version}</Badge>
                  <div>
                    <p className="text-sm font-bold text-foreground">{release.title}</p>
                    <p className="text-xs text-muted-foreground">{release.desc || release.description}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">No recent updates found.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showTermOfDay} onOpenChange={onShowTermOfDayChange}>
        <DialogContent data-term-of-day-modal="true" className="w-full sm:max-w-[420px] p-0 overflow-hidden border-0 bg-transparent shadow-2xl [&>button]:hidden data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom !top-auto !bottom-0 !left-1/2 !-translate-x-1/2 !translate-y-0">
          <DialogHeader>
            <DialogTitle className="sr-only">Term of the Day</DialogTitle>
            <DialogDescription className="sr-only">{termOfDay?.term}</DialogDescription>
          </DialogHeader>
          {termOfDay && (
            <div className="relative min-h-[430px] overflow-hidden rounded-t-[2rem] border border-white/15 bg-slate-950/82 p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] text-white shadow-2xl shadow-emerald-950/40 backdrop-blur-2xl">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(16,185,129,0.30),transparent_34%),radial-gradient(circle_at_85%_20%,rgba(34,211,238,0.22),transparent_32%),linear-gradient(135deg,rgba(6,78,59,0.72),rgba(15,23,42,0.84))]" />
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/65 to-transparent" />
              <div className="relative z-10 flex h-full min-h-[382px] flex-col">
                <div className="mb-5 flex items-center justify-between gap-4">
                  <div className="h-1.5 w-9 rounded-full bg-white" />
                  <button type="button" onClick={closeTerm} aria-label="Close term of the day" className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/10">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={dailyInsight.key}
                    initial={{ opacity: 0, y: 260 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 260 }}
                    transition={{ duration: 0.28, ease: 'easeInOut' }}
                    className="flex flex-1 flex-col"
                  >
                    <div className="mb-6 flex items-center gap-3">
                      <div className="flex h-14 w-14 items-center justify-center rounded-3xl border border-emerald-100/20 bg-emerald-200/15">
                        <Sparkles className="h-7 w-7 text-emerald-100" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-100/70">{dailyInsight.label}</p>
                        <h3 className="text-3xl font-black leading-tight text-white break-words">{dailyInsight.title}</h3>
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto pr-1">
                      <p className="text-[15px] leading-7 text-white/82">{dailyInsight.body}</p>
                    </div>
                  </motion.div>
                </AnimatePresence>
                <Button type="button" onClick={closeTerm} className="mt-6 h-11 w-full rounded-2xl bg-white text-slate-950 font-black hover:bg-white/90">Done</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedAnnouncement} onOpenChange={(open) => !open && onSelectedAnnouncementChange(null)}>
        <DialogContent data-dashboard-announcement-modal="true" className="!fixed !inset-x-0 !bottom-0 !top-auto !left-0 !translate-x-0 !translate-y-0 !w-full !max-w-none p-0 overflow-hidden border-0 rounded-t-[2rem] rounded-b-none [&>button]:hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom sm:!left-1/2 sm:!bottom-0 sm:!top-auto sm:!-translate-x-1/2 sm:!translate-y-0 sm:!w-[min(100%,430px)] sm:rounded-t-[2rem]">
          <DialogHeader>
            <DialogTitle className="sr-only">{selectedAnnouncement?.modal_heading || 'Dashboard announcement'}</DialogTitle>
            <DialogDescription className="sr-only">{selectedAnnouncement?.modal_subheading}</DialogDescription>
          </DialogHeader>
          {selectedAnnouncement && (
            <div className="relative max-h-[calc(100dvh-env(safe-area-inset-top))] overflow-hidden bg-[#06111f] text-white">
              {selectedAnnouncement.modal_background_image_url ? (
                <img src={selectedAnnouncement.modal_background_image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-[#0f172a] via-[#0f766e] to-[#075985]" />
              )}
              <div className="absolute inset-0 bg-black/55" />
              <div className="relative z-10 flex max-h-[calc(100dvh-env(safe-area-inset-top))] flex-col">
                <div className="flex items-start justify-between gap-4 p-5 pb-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#2dd4bf] mb-2">Medmacs Update</p>
                    <h2 className="whitespace-pre-wrap break-words text-2xl font-black leading-tight tracking-tight">{formatAnnouncementText(selectedAnnouncement.modal_heading)}</h2>
                  </div>
                  <button type="button" onClick={() => onSelectedAnnouncementChange(null)} aria-label="Close announcement" className="w-9 h-9 rounded-full bg-white/10 border border-white/10 flex items-center justify-center shrink-0">
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
                <div className="min-h-0 overflow-y-auto px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
                  <AnnouncementBody text={selectedAnnouncement.modal_subheading} />
                  {!!selectedAnnouncement.modal_image_urls?.length && (
                    <div className="mb-5 space-y-3">
                        {selectedAnnouncement.modal_image_urls.map((imageUrl) => (
                          <img key={imageUrl} src={imageUrl} alt="" className="h-auto w-full rounded-2xl border border-white/10 object-contain shadow-lg" />
                        ))}
                    </div>
                  )}
                  {selectedAnnouncement.cta_text && selectedAnnouncement.cta_url && (
                    <button type="button" onClick={() => openExternalUrl(selectedAnnouncement.cta_url)} className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#2dd4bf] to-[#0ea5e9] text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2">
                      {selectedAnnouncement.cta_text}<ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showCollaborate} onOpenChange={onShowCollaborateChange}>
        <DialogContent className="sm:max-w-[420px] p-0 overflow-hidden border-0 rounded-[2rem] bg-transparent shadow-2xl [&>button]:hidden">
          <DialogHeader>
            <DialogTitle className="sr-only">Why Medmacs</DialogTitle>
            <DialogDescription className="sr-only">Learn why students collaborate with Medmacs.</DialogDescription>
          </DialogHeader>
          <div className="relative overflow-hidden rounded-[2rem] border border-white/15 bg-slate-950/82 text-white shadow-2xl shadow-rose-950/35">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_6%,rgba(244,63,94,0.34),transparent_34%),radial-gradient(circle_at_88%_24%,rgba(34,211,238,0.24),transparent_32%),linear-gradient(135deg,rgba(76,5,25,0.72),rgba(15,23,42,0.84))]" />
            <button type="button" onClick={() => onShowCollaborateChange(false)} aria-label="Close collaboration dialog" className="absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/10">
              <X className="w-4 h-4" />
            </button>
            <div className="relative z-10 px-6 pt-7 pb-6">
              <div className="flex items-end justify-between gap-3 mb-5">
                <div><p className="text-[10px] font-black uppercase tracking-[0.24em] text-rose-100/70 mb-2">Collaborate</p><h2 className="text-3xl font-black">Why Medmacs?</h2></div>
                <img src="/mascots/Mascot3.png" alt="Medmacs mascot" className="w-28 h-28 object-contain" />
              </div>
              <div className="rounded-3xl border border-white/12 bg-white/10 p-4 mb-5">
                <p className="text-sm leading-6 text-white/82">Medmacs is built around students who want better study tools, sharper medical learning, and a community that actually moves fast. Collaborators help shape campaigns, campus presence, content ideas, and student-first features.</p>
              </div>
              <button type="button" onClick={() => openExternalUrl('https://medmacs.app/collaborate')} className="w-full py-3.5 rounded-2xl bg-white text-slate-950 font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2">
                Visit Collaborate<ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showCaseOfDay} onOpenChange={onShowCaseOfDayChange}>
        <DialogContent data-case-of-day-modal="true" className="w-full sm:max-w-[450px] p-0 overflow-hidden border-0 bg-transparent shadow-2xl [&>button]:hidden data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom !top-auto !bottom-0 !left-1/2 !-translate-x-1/2 !translate-y-0">
          <DialogHeader>
            <DialogTitle className="sr-only">Case of the Day</DialogTitle>
            <DialogDescription className="sr-only">{caseOfDay?.case_name}</DialogDescription>
          </DialogHeader>
          {caseOfDay && (
            <CaseOfDayCard
              caseOfDay={caseOfDay}
              onClose={() => onShowCaseOfDayChange(false)}
              isPremium={isPremium}
              onNavigateToChat={onNavigateToChat}
              onNavigateToPricing={onNavigateToPricing}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
