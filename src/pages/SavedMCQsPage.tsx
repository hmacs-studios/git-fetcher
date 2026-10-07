import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ArrowLeft, BookmarkX, ChevronDown, Loader2, Trash2, CheckCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';

import { useToast } from '@/hooks/use-toast';
import { ProfileDropdown } from '@/components/ProfileDropdown';
import Seo from '@/components/Seo';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { FeatureLockModal } from '@/components/ui/FeatureLockModal';

interface MCQ {
  id: string;
  question: string;
  options: string[];
  correct_answer: string;
  explanation: string;
  chapter: string;
  subject: string;
}

const SavedMCQSkeleton = () => (
  <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 border border-gray-200 dark:border-gray-700">
    <div className="flex justify-between items-start gap-4">
      <div className="flex-grow space-y-3">
        <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse w-full" />
        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse w-3/4" />
      </div>
      <div className="flex gap-2">
        <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
        <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
      </div>
    </div>
  </div>
);

const SavedMCQsPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [expandedMcqId, setExpandedMcqId] = useState<string | null>(null);
  const [mcqToUnsave, setMcqToUnsave] = useState<string | null>(null);
  const [showLockModal, setShowLockModal] = useState(false);

  const { isAccessible: isSavedQuestionsAccessible, isLoading: isFeatureLoading, planTier } = useFeatureAccess('saved_questions');

  useEffect(() => {
    if (!isFeatureLoading && !isSavedQuestionsAccessible) {
      setShowLockModal(true);
    }
  }, [isFeatureLoading, isSavedQuestionsAccessible]);

  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase.from('profiles').select('plan, avatar_url').eq('id', user.id).maybeSingle();
      if (error) return null;
      return data;
    },
    enabled: !!user?.id
  });

  const { data: savedMcqs, isLoading, isError, error } = useQuery<MCQ[], Error>({
    queryKey: ['savedMcqs', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data: savedIds, error: idsErr } = await supabase.from('saved_mcqs').select('mcq_id').eq('user_id', user.id);
      if (idsErr) throw idsErr;
      const mcqIds = savedIds.map(item => item.mcq_id);
      if (mcqIds.length === 0) return [];
      const { data: mcqDetails, error: detailsErr } = await supabase.from('mcqs').select('*').in('id', mcqIds);
      if (detailsErr) throw detailsErr;
      return mcqDetails as MCQ[];
    },
    enabled: !!user?.id && !isFeatureLoading && isSavedQuestionsAccessible,
  });

  const unsaveMCQMutation = useMutation({
    mutationFn: async (mcqId: string) => {
      if (!user?.id) throw new Error("User not authenticated.");
      const { error } = await supabase.from('saved_mcqs').delete().eq('user_id', user.id).eq('mcq_id', mcqId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savedMcqs', user?.id] });
      setExpandedMcqId(null);
      toast({ title: "MCQ Unsaved", description: "This question has been removed from your saved list." });
    }
  });

  const handleToggleExpand = (mcqId: string) => setExpandedMcqId(prevId => (prevId === mcqId ? null : mcqId));

  const handleConfirmUnsave = () => {
    if (!mcqToUnsave) return;
    unsaveMCQMutation.mutate(mcqToUnsave);
    setMcqToUnsave(null);
  };

  if (!user) {
    return (
      <div className="min-h-screen w-full bg-white dark:bg-gray-900">
        <Seo title="Saved MCQs" description="Access and review your saved MCQs on Medmacs App." canonical="https://medmacs.app/saved-mcqs" />
        <div className="container mx-auto px-4 py-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] max-w-3xl flex justify-between items-center">
          <Link to="/dashboard" className="flex items-center space-x-2 text-primary dark:text-primary-400 hover:text-primary/70 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center space-x-3">
            <img src="/lovable-uploads/bf69a7f7-550a-45a1-8808-a02fb889f8c5.png" alt="Medmacs Logo" className="w-8 h-8 object-contain" />
            <span className="text-xl font-bold text-gray-900 dark:text-white">Saved MCQs</span>
          </div>
          <div className="flex items-center space-x-3">
            <ProfileDropdown />
          </div>
        </div>
        <div className="container mx-auto px-4 py-8 max-w-3xl">
          <Card className="p-8 text-center">
            <CardContent>
              <p className="text-muted-foreground mb-6">Please log in to access your saved MCQs.</p>
              <Button asChild className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-2 px-4 rounded-lg">
                <Link to="/login">Go to Login</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-white dark:bg-gray-900">
      <Seo title="Saved MCQs" description="Access and review your saved MCQs on Medmacs App." canonical="https://medmacs.app/saved-mcqs" />

      <div className="container mx-auto px-4 py-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] max-w-3xl flex justify-between items-center">
        <Link to="/dashboard" className="flex items-center space-x-2 text-primary dark:text-primary-400 hover:text-primary/70 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>

        <div className="flex items-center space-x-3">
          <img src="/lovable-uploads/bf69a7f7-550a-45a1-8808-a02fb889f8c5.png" alt="Medmacs Logo" className="w-8 h-8 object-contain" />
          <span className="text-xl font-bold text-gray-900 dark:text-white">Saved MCQs</span>
        </div>

        <div className="flex items-center space-x-3">
          <ProfileDropdown />
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Header Section */}
        <div className="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md pt-2 -mx-4 px-4 pt-[env(safe-area-inset-top)]">
          <div className="text-center mb-6">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-gray-900 dark:text-white uppercase italic leading-none">
              📚 Saved <span className="text-primary">Questions</span>
            </h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm font-medium mt-3 max-w-lg mx-auto">
              Review your bookmarked MCQs and master every concept
            </p>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => <SavedMCQSkeleton key={i} />)}
          </div>
        )}

        {/* Error State */}
        {isError && (
          <div className="text-center p-8 bg-red-50 dark:bg-red-900/20 rounded-3xl border border-red-200 dark:border-red-800">
            <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
              <BookmarkX className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <p className="text-sm font-bold text-red-600 dark:text-red-400">Error loading saved MCQs: {error?.message}</p>
          </div>
        )}

        {/* Empty State */}
        {user && !isLoading && savedMcqs && savedMcqs.length === 0 && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-24 px-6 border border-dashed border-gray-300 dark:border-gray-600 rounded-[2.5rem] bg-gray-50 dark:bg-gray-800/50">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <BookmarkX className="w-10 h-10 text-primary" />
            </div>
            <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-3">No Saved Questions</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-xs mx-auto">Start practicing and bookmark questions you'd like to review later.</p>
            <Button asChild className="rounded-2xl font-black h-12 px-8 bg-primary hover:bg-primary/90">
              <Link to="/mcqs">Start Practicing</Link>
            </Button>
          </motion.div>
        )}

        {/* MCQ List */}
        {user && savedMcqs && savedMcqs.length > 0 && (
          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {savedMcqs.map((mcq, idx) => (
                <motion.div
                  key={mcq.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: idx * 0.05 }}
                  layout
                >
                  <Card className={`overflow-hidden border-2 transition-all duration-300 transform-gpu ${expandedMcqId === mcq.id ? 'ring-2 ring-primary border-primary bg-white dark:bg-gray-800 shadow-lg shadow-primary/10' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'}`}>
                    <CardHeader className="p-5 flex flex-row justify-between items-start gap-4">
                      <div className="flex-grow space-y-3">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest bg-primary/10 text-primary border-primary/20 rounded-full px-3 py-1">
                            {mcq.subject || 'Medical'}
                          </Badge>
                        </div>
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white leading-relaxed">
                          {mcq.question}
                        </h2>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 pt-1">
                        <Button
                          variant="ghost" size="icon"
                        onClick={() => setMcqToUnsave(mcq.id)}
                          className="w-9 h-9 text-gray-400 hover:bg-red-50 hover:text-red-500 rounded-xl transition-all"
                        >
                          <BookmarkX className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          onClick={() => handleToggleExpand(mcq.id)}
                          className={`w-9 h-9 rounded-xl transition-all ${expandedMcqId === mcq.id ? 'bg-primary text-white hover:bg-primary/90 rotate-180' : 'text-gray-400 hover:bg-primary/10 hover:text-primary'}`}
                        >
                          <ChevronDown className="h-5 w-5" />
                        </Button>
                      </div>
                    </CardHeader>

                    <AnimatePresence>
                      {expandedMcqId === mcq.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        >
                          <CardContent className="px-5 pb-6 pt-0">
                            <div className="space-y-3 mt-4">
                              {mcq.options.map((option, index) => {
                                const isCorrect = option === mcq.correct_answer;
                                return (
                                  <div
                                    key={index}
                                    className={`relative p-4 rounded-2xl border-2 transition-all duration-200 group flex items-center justify-between ${isCorrect
                                        ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
                                        : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                                      }`}
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className={`w-8 h-8 rounded-xl text-sm font-black flex items-center justify-center shrink-0 ${isCorrect ? 'bg-green-500 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'}`}>
                                        {String.fromCharCode(65 + index)}
                                      </div>
                                      <span className={`text-base font-medium ${isCorrect ? 'text-green-700 dark:text-green-300' : 'text-gray-700 dark:text-gray-300'}`}>{option}</span>
                                    </div>
                                    {isCorrect && (
                                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="shrink-0 bg-green-100 dark:bg-green-900/50 p-1.5 rounded-full">
                                        <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                                      </motion.div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>

                            {mcq.explanation && (
                              <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="mt-6 p-5 rounded-3xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border border-amber-200/50 dark:border-amber-800/30"
                              >
                                <div className="flex items-center gap-2 mb-3">
                                  <div className="w-2 h-6 bg-amber-500 rounded-full" />
                                  <span className="text-xs font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">Explanation</span>
                                </div>
                                <p className="text-base font-medium text-gray-700 dark:text-gray-300 leading-relaxed italic">
                                  "{mcq.explanation}"
                                </p>
                              </motion.div>
                            )}
                          </CardContent>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Unsave Confirmation Dialog */}
        <AlertDialog open={!!mcqToUnsave} onOpenChange={() => setMcqToUnsave(null)}>
          <AlertDialogContent className="rounded-3xl p-6 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-xl font-black text-gray-900 dark:text-white italic">
                Unsave <span className="text-red-500">Question?</span>
              </AlertDialogTitle>
              <AlertDialogDescription className="text-gray-600 dark:text-gray-400 mt-2">
                This question will be removed from your saved list. You can always bookmark it again later while practicing.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex gap-3 mt-6">
              <AlertDialogCancel className="flex-1 rounded-2xl h-11 font-bold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmUnsave}
                disabled={unsaveMCQMutation.isPending}
                className="flex-1 rounded-2xl h-11 font-black bg-gradient-to-r from-red-500 to-rose-500 text-white hover:from-red-600 hover:to-rose-600"
              >
                {unsaveMCQMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Remove
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <FeatureLockModal
        open={showLockModal}
        onClose={() => setShowLockModal(false)}
        featureTitle="Saved Questions"
        planTierRequired="Premium"
      />
    </div>
  );
};

export default SavedMCQsPage;
