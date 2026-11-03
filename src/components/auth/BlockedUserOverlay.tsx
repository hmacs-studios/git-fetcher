import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { Send, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface RestrictionDetails {
  user_restricted: boolean;
  reason: string | null;
  duration: string | null;
  reviewed: boolean;
  decision: boolean;
  appeal?: string | null;
}

interface BlockedUserOverlayProps {
  details: RestrictionDetails;
  onSignOut: () => void;
  userId?: string;
}

const BlockedUserOverlay: React.FC<BlockedUserOverlayProps> = ({ details, onSignOut, userId }) => {
  const [showAppealForm, setShowAppealForm] = useState(false);
  const [appealText, setAppealText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const isInfinite = !details.duration;
  const unlockDate = details.duration ? new Date(details.duration) : null;
  const isExpired = unlockDate ? unlockDate < new Date() : false;
  const hasAlreadyAppealed = !!details.appeal;

  // If the restriction has expired, we should technically not show this overlay,
  // but the server-side should handle that. For UI safety:
  if (details.user_restricted === false || (details.duration && isExpired)) {
    return null;
  }

  const handleAppealSubmit = async () => {
    if (!appealText.trim()) {
      toast({
        title: "Reason required",
        description: "Please provide a reason for your appeal.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Find user ID if not provided as prop
      let effectiveUserId = userId;
      if (!effectiveUserId) {
        const { data: { user } } = await supabase.auth.getUser();
        effectiveUserId = user?.id;
      }

      if (!effectiveUserId) throw new Error("User ID not found");

      // Update the restriction_details object while preserving existing keys
      const updatedDetails = {
        ...details,
        appeal: appealText.trim()
      };

      const { error } = await supabase
        .from('profiles')
        .update({ restriction_details: updatedDetails })
        .eq('id', effectiveUserId);

      if (error) throw error;

      toast({
        title: "Appeal submitted!",
        description: "Our moderation team will review your case shortly.",
      });
      
      // We rely on the parent (UserRestrictionHandler) to re-fetch the data 
      // or we can reload the page to simplified logic
      window.location.reload(); 

    } catch (error: any) {
      console.error("Appeal error:", error);
      toast({
        title: "Submission failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] isolate flex h-dvh items-start justify-center overflow-y-auto bg-white px-6 pb-24 pt-[calc(env(safe-area-inset-top,0px)+6rem)] text-slate-950 sm:items-center sm:py-28">
      <div className="absolute left-6 top-[calc(env(safe-area-inset-top,0px)+18px)] z-20 flex items-center gap-2.5">
        <img
          src="/lovable-uploads/bf69a7f7-550a-45a1-8808-a02fb889f8c5.png"
          alt="Medmacs"
          className="h-9 w-9 object-contain"
        />
        <span className="brand-wordmark text-lg text-slate-950">Medmacs</span>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-xl text-center"
      >
        <p className="mb-3 text-xs font-black uppercase tracking-[0.22em] text-cyan-600">Access paused</p>
        <h1 className="font-['Bricolage_Grotesque'] text-[clamp(2.2rem,9vw,3.3rem)] font-extrabold leading-[0.98] tracking-[-.055em] text-slate-950">
          Account Restricted
        </h1>
        <p className="mx-auto mt-4 max-w-md text-sm font-semibold leading-6 text-slate-500">
          Your Medmacs access is currently limited. You can review the reason below and submit an appeal if something needs a second look.
        </p>

        <div className="mt-8 space-y-7 text-left">

            <div className="space-y-5 rounded-[2rem] border border-cyan-600/15 bg-cyan-600/[0.04] p-5 shadow-2xl shadow-cyan-950/5">
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Reason for restriction</span>
                <p className="text-base font-bold leading-6 text-slate-900">
                  {details.reason || "Violating community guidelines or platform terms."}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 border-t border-cyan-600/10 pt-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Duration</span>
                  <p className="text-sm font-black text-slate-900">
                    {isInfinite ? "Permanent" : "Temporary"}
                  </p>
                </div>
                
                {!isInfinite && unlockDate && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Unlock Date</span>
                    <p className="text-sm font-black text-slate-900">
                      {format(unlockDate, "PPPP 'at' p")}
                    </p>
                  </div>
                )}
              </div>
              
              {details.reviewed && (
                <div className="pt-2">
                  <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black ${details.decision ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${details.decision ? 'bg-green-500' : 'bg-orange-500'}`} />
                    Final Review Completed
                  </div>
                </div>
              )}
            </div>

            <AnimatePresence mode="wait">
              {hasAlreadyAppealed ? (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3 rounded-[2rem] border border-cyan-600/15 bg-cyan-600/[0.04] p-5"
                >
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-700">
                    <CheckCircle2 className="w-4 h-4" />
                    Appeal Submitted
                  </div>
                  <div className="text-slate-600">
                    <p className="text-sm font-semibold leading-relaxed">
                      Your appeal request has been received and is currently being processed by our moderation team.
                    </p>
                  </div>
                  <p className="border-t border-cyan-600/10 pt-3 text-[11px] font-semibold text-slate-400">
                    Response time typically varies from 24 to 48 hours depending on queue volume. You will be notified once a decision is made.
                  </p>
                </motion.div>
              ) : showAppealForm ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <div className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700">
                      State your case for appeal
                    </div>
                    <Textarea 
                      placeholder="Explain why you believe this restriction should be lifted..."
                      className="min-h-[128px] resize-none rounded-[1.5rem] border-cyan-600/15 bg-cyan-600/[0.04] pt-4 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:ring-cyan-500/30"
                      value={appealText}
                      onChange={(e) => setAppealText(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Button 
                      variant="ghost" 
                      onClick={() => setShowAppealForm(false)}
                      disabled={isSubmitting}
                      className="h-12 rounded-2xl font-black text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                    >
                      Cancel
                    </Button>
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          className="h-12 gap-2 rounded-2xl bg-gradient-to-r from-cyan-600 to-teal-500 font-black text-white shadow-2xl shadow-cyan-700/20 hover:from-cyan-500 hover:to-teal-400"
                          disabled={isSubmitting || !appealText.trim()}
                        >
                          <Send className="w-4 h-4" />
                          Submit Appeal
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This appeal will be sent to our moderation team for a final review. 
                            <strong> Once submitted, the appeal cannot be edited or modified.</strong>
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Review Again</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={handleAppealSubmit}
                            className="bg-gradient-to-r from-cyan-600 to-teal-500 text-white hover:from-cyan-500 hover:to-teal-400"
                          >
                            Yes, Submit Appeal
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </motion.div>
              ) : (
                <div className="flex flex-col gap-3">
                  <Button 
                    className="h-14 w-full rounded-2xl bg-gradient-to-r from-cyan-600 to-teal-500 font-black text-white shadow-2xl shadow-cyan-700/20 hover:from-cyan-500 hover:to-teal-400"
                    onClick={() => setShowAppealForm(true)}
                  >
                    Appeal this decision
                  </Button>
                  
                  <Button 
                    variant="secondary" 
                    className="h-14 w-full rounded-2xl bg-slate-100 font-black text-slate-700 hover:bg-slate-200"
                    onClick={onSignOut}
                  >
                    Sign Out
                  </Button>
                </div>
              )}
            </AnimatePresence>
            
            <p className="px-4 text-center text-[11px] font-semibold leading-5 text-slate-400">
              Medmacs maintains a safe learning environment. All appeals are final and handled manually by our team.
            </p>
        </div>
      </motion.div>

      <p className="absolute bottom-[calc(env(safe-area-inset-bottom,0px)+18px)] left-0 right-0 z-20 text-center text-[11px] font-semibold text-slate-400">
        A project by <span className="font-black text-slate-700">HMACS Studios</span>
      </p>
    </div>
  );
};

export default BlockedUserOverlay;
