import { useQuery } from '@tanstack/react-query';
import { Sparkles, Target, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import Seo from '@/components/Seo';
import { Card, CardContent } from '@/components/ui/card';
import { MistakeBook } from '@/components/dashboard/personalization/MistakeBook';
import { usePersonalizationData } from '@/components/dashboard/personalization/usePersonalizationData';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

const MistakeBookPage = () => {
  const { user } = useAuth();
  const { groupedSubjects, wrongAttempts, isLoading } = usePersonalizationData();

  const { data: profile } = useQuery({
    queryKey: ['profile-plan', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase.from('profiles').select('plan').eq('id', user.id).maybeSingle();
      if (error) return null;
      return data;
    },
    enabled: !!user?.id,
  });

  const isPremium = true;
  const chapterCount = groupedSubjects.reduce((total, subject) => total + subject.chapters.length, 0);

  return (
    <div className="fixed inset-0 flex flex-col bg-background text-foreground overflow-hidden">
      <Seo title="Mistake Book" description="Review and correct your wrong MCQ attempts on Medmacs App." canonical="https://medmacs.app/mistake-book" />

      {/* Mesh Background Blurs */}
      <div className="pointer-events-none absolute inset-0 bg-mesh opacity-90" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-52 bg-gradient-to-b from-primary/10 to-transparent dark:from-primary/15" />

      {/* Glassmorphic Header */}
      <header className="shrink-0 relative z-30 px-4 pb-3 pt-[calc(env(safe-area-inset-top,0px)+10px)] backdrop-blur-2xl border-b border-border/60 bg-background/88 animate-fade-in">
        <div className="mx-auto flex items-center justify-between gap-3 max-w-4xl">
          <Link
            to="/dashboard"
            aria-label="Back to dashboard"
            className="flex shrink-0 items-center justify-center bg-muted text-foreground transition active:scale-95 active:bg-primary active:text-primary-foreground h-11 w-11 rounded-2xl border border-border/40"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>

          <div className="min-w-0 text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-primary">Medmacs</p>
            <h1 className="truncate text-base font-black tracking-tight uppercase italic">Mistake Book</h1>
          </div>

          <div className="flex shrink-0 items-center justify-center bg-primary/10 text-primary h-11 w-11 rounded-2xl">
            <Target className="h-5 w-5" />
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 flex flex-col min-h-0 w-full max-w-4xl mx-auto px-4 pt-6 pb-6 overflow-hidden gap-5 animate-fade-in">
        
        {/* Intro Text */}
        <div className="text-center shrink-0">
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-1.5 block">Correction Mode</span>
          <h2 className="px-1 text-2xl sm:text-3xl font-black tracking-normal text-foreground uppercase italic leading-tight text-center">
            Select <span className="live-gradient-text">Chapter&nbsp;</span>
          </h2>
          <p className="text-muted-foreground text-xs font-semibold mt-1.5 max-w-lg mx-auto text-center">
            Review and correct your wrong MCQ attempts chapter by chapter.
          </p>
        </div>

        {/* Stat Summary Box */}
        <div className="shrink-0">
          <div className="rounded-3xl border border-border/40 bg-white/5 dark:bg-white/[0.035] backdrop-blur-xl p-4 shadow-sm">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-2xl bg-background/80 p-3 text-center ring-1 ring-border/40">
                <p className="text-lg font-black text-foreground">{wrongAttempts.length}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">MCQs</p>
              </div>
              <div className="rounded-2xl bg-background/80 p-3 text-center ring-1 ring-border/40">
                <p className="text-lg font-black text-foreground">{chapterCount}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Chapters</p>
              </div>
              <div className="rounded-2xl bg-background/80 p-3 text-center ring-1 ring-border/40">
                <p className="text-lg font-black text-foreground">{groupedSubjects.length}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Subjects</p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-2xl bg-background/70 px-3 py-2 text-xs text-muted-foreground ring-1 ring-border/40">
              <Sparkles className="h-4 w-4 text-primary shrink-0" />
              <span>AI Explain follows your cloud AI policy.</span>
            </div>
          </div>
        </div>

        {/* Scrollable Subjects/Chapters List Area */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-4">
          {isLoading ? (
            <div className="space-y-6 animate-pulse">
              {Array.from({ length: 2 }).map((_, catIndex) => (
                <div key={catIndex} className="space-y-4">
                  <div className="h-6 w-1/4 bg-muted rounded-full" />
                  <div className="overflow-hidden rounded-3xl border-2 border-border/40 bg-white/5 dark:bg-white/[0.035] divide-y divide-border/40">
                    {Array.from({ length: 3 }).map((_, itemIndex) => (
                      <div key={itemIndex} className="flex items-center gap-4 p-4">
                        <div className="w-12 h-12 rounded-xl bg-muted" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 w-1/3 bg-muted rounded-full" />
                          <div className="h-3 w-1/2 bg-muted rounded-full" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : wrongAttempts.length === 0 ? (
            <Card className="max-w-md mx-auto border-border/40 bg-card/80">
              <CardContent className="p-5 text-center">
                <Target className="mx-auto mb-3 h-8 w-8 text-primary" />
                <p className="text-sm font-black text-foreground">No mistake book yet</p>
                <p className="mt-1 text-xs text-muted-foreground">Wrong MCQ attempts will appear here by subject and chapter.</p>
              </CardContent>
            </Card>
          ) : (
            <MistakeBook subjects={groupedSubjects} isPremium={isPremium} />
          )}

          <p className="pb-4 pt-8 text-center text-[10px] text-muted-foreground tracking-widest">
            © 2026 Medmacs App • All rights reserved
          </p>
        </div>
      </main>
    </div>
  );
};

export default MistakeBookPage;
