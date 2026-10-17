import { useState, useEffect, useLayoutEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight, Lock, RefreshCw, WifiOff } from 'lucide-react';
import { fetchSEQSubjects, SEQSubject } from '@/utils/mcqData';
import { useAuth } from '@/hooks/useAuth';
import { MCQPageLayout } from '@/pages/mcq/MCQPageLayout';
import { SEQProgressTracker } from '@/components/seq/SEQProgressTracker';
import AppTransitionScreen from '@/components/AppTransitionScreen';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Seo from '@/components/Seo';
import { CollaborateModal } from '@/components/CollaborateModal';
import { SelectionBackdrop } from '@/components/selection/SelectionBackdrop';
import { SelectionRow } from '@/components/selection/SelectionRow';
import { rowEntrance } from '@/components/selection/motion';

const SubjectRowSkeleton = () => (
  <div className="flex animate-pulse items-center gap-4 py-4 pl-4 pr-3">
    <div className="h-6 w-6 shrink-0 rounded-md bg-muted" />
    <div className="min-w-0 flex-1 space-y-2">
      <div className="h-3.5 w-1/3 rounded-full bg-muted" />
      <div className="h-3 w-2/3 rounded-full bg-muted" />
    </div>
  </div>
);

const SEQSubjectSelectionPage = () => {
  useLayoutEffect(() => {
    requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    });
  }, []);

  const [subjects, setSubjects] = useState<SEQSubject[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [selectedSubject, setSelectedSubject] = useState<SEQSubject | null>(null);
  const [showCollaborateModal, setShowCollaborateModal] = useState(false);

  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  const { isLoading: profileLoading } = useQuery({
    queryKey: ['profile-plan', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('profiles').select('plan').eq('id', user.id).maybeSingle();
      if (error) return null;
      return data;
    },
    enabled: !!user?.id
  });

  useEffect(() => {
    const loadSubjects = async () => {
      setLoadingSubjects(true);
      setLoadError(false);
      try {
        const data = await fetchSEQSubjects();
        setSubjects(data);
      } catch (error) {
        console.error('Unable to load SEQ subjects:', error);
        setLoadError(true);
      }
      setLoadingSubjects(false);
    };
    if (!profileLoading && user) {
      loadSubjects();
    }
  }, [profileLoading, retryKey, user]);

  const handleContinue = () => {
    if (selectedSubject) {
      navigate(`/seqs/chapter/${selectedSubject.id}`);
    }
  };

  if (authLoading || profileLoading) {
    return <AppTransitionScreen />;
  }

  if (!user) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background/55 dark:bg-white/[0.035] backdrop-blur-xl p-4 text-center">
        <Card className="w-full max-w-md bg-card/60 dark:bg-white/[0.05] backdrop-blur-sm border-border shadow-lg p-6">
          <CardHeader className="mb-4">
            <Lock className="w-16 h-16 mx-auto text-primary mb-4" />
            <CardTitle className="text-2xl font-bold text-foreground">Access Restricted</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-6">Please log in to access the SEQ practice section.</p>
            <Button asChild className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-2 px-4 rounded-lg shadow-md">
              <Link to="/login">Go to Login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <MCQPageLayout backTo="/dashboard" showHeader={true} showBackButton={true}>
      <SelectionBackdrop active={Boolean(selectedSubject)} accent="amber" />
      <Seo title="SEQ Practice" description="Practice Short Essay Questions for your medical exams with Medmacs App." canonical="https://medmacs.app/seqs" />

      <div className="relative z-10 mx-auto w-full max-w-2xl px-4 sm:px-0">
        <div className="py-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-amber-600/90 dark:text-amber-500/90">SEQ Practice</p>
          <h2 className="font-['Syne'] mt-1.5 text-2xl font-bold uppercase italic leading-none tracking-[-0.03em] text-foreground sm:text-[1.75rem]">
            Select <span className="text-amber-600 dark:text-amber-500">Subject</span>
          </h2>
        </div>

        <SEQProgressTracker userId={user?.id} />

        <div className="pb-32 pt-6">
          {loadingSubjects ? (
            <div className="divide-y divide-border/50 border-b border-border/50">
              {Array.from({ length: 5 }).map((_, i) => <SubjectRowSkeleton key={i} />)}
            </div>
          ) : loadError ? (
            <div className="border-y border-border/50 px-4 py-14 text-center">
              <WifiOff className="mx-auto h-7 w-7 text-muted-foreground/50" />
              <h3 className="mt-4 text-sm font-bold text-foreground">Connection failure</h3>
              <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-muted-foreground">We could not connect to the content server. Check your connection and try again.</p>
              <Button type="button" variant="outline" className="mt-5 rounded-md" onClick={() => setRetryKey(value => value + 1)}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Try again
              </Button>
            </div>
          ) : subjects.length === 0 ? (
            <div className="border-b border-border/50 px-4 py-14 text-center">
              <p className="font-semibold text-foreground">We are not fully available in your institute yet.</p>
              <p className="mt-2 text-sm text-muted-foreground">Help us bring SEQ content to your campus.</p>
              <div className="mt-5 flex flex-col sm:flex-row justify-center gap-3">
                <Button asChild variant="outline">
                  <Link to="/contact-us?subject=campus-collaboration">Request campus collaboration</Link>
                </Button>
                <Button onClick={() => setShowCollaborateModal(true)}>
                  Become Medmacs Ambassador
                </Button>
              </div>
              <CollaborateModal open={showCollaborateModal} onOpenChange={setShowCollaborateModal} />
            </div>
          ) : (
            <div className="divide-y divide-border/50 border-b border-border/50">
              {subjects.map((subject, index) => (
                <motion.div
                  key={subject.id}
                  custom={index}
                  variants={reduceMotion ? undefined : rowEntrance}
                  initial={reduceMotion ? false : 'hidden'}
                  animate={reduceMotion ? false : 'visible'}
                >
                  <SelectionRow
                    accent="amber"
                    leading={subject.icon || '📝'}
                    title={subject.name}
                    subtitle={subject.description || undefined}
                    selected={selectedSubject?.id === subject.id}
                    accentLayoutId="seq-subject-accent"
                    onSelect={() => setSelectedSubject(subject)}
                  />
                </motion.div>
              ))}
            </div>
          )}

          <footer className="py-6 text-center">
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground/40">
              © 2026 Medmacs App
            </p>
          </footer>
        </div>
      </div>

      <AnimatePresence>
        {selectedSubject && (
          <motion.div
            initial={{ opacity: 0, y: 80 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 80 }}
            transition={{ type: 'spring', damping: 26, stiffness: 340 }}
            className="pointer-events-none fixed bottom-0 left-0 right-0 z-50 flex justify-center bg-gradient-to-t from-background via-background/95 to-transparent px-4 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-8"
          >
            <div className="pointer-events-auto w-full max-w-2xl">
              <Button
                onClick={handleContinue}
                 className="group h-12 w-full rounded-md bg-amber-500 text-xs font-bold uppercase tracking-[0.18em] text-white transition-all duration-200 hover:bg-amber-600 active:scale-[0.98]"
                size="lg"
              >
                <span className="truncate">Continue · {selectedSubject.name}</span>
                <ArrowRight className="ml-2 h-4 w-4 shrink-0 transition-transform duration-300 group-hover:translate-x-1" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </MCQPageLayout>
  );
};

export default SEQSubjectSelectionPage;
