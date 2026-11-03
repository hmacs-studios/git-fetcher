import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { History, Trophy, ArrowLeft, FileText, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Link, useNavigate } from 'react-router-dom';
import { ProfileDropdown } from '@/components/ProfileDropdown';
import Seo from '@/components/Seo';

interface FLPResultSummary {
    id: string;
    score: number;
    total_questions: number;
    completed_at: string;
    username?: string;
}

const FLPResultsPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const { data: flpResults, isLoading: isLoadingResults } = useQuery<FLPResultSummary[], Error>({
        queryKey: ['flpResults', user?.id],
        queryFn: async () => {
            if (!user?.id) {
                return [];
            }

            const { data, error } = await supabase
                .from('flp_user_attempts')
                .select('id, score, total_questions, completed_at, username')
                .eq('user_id', user.id)
                .order('completed_at', { ascending: false });

            if (error) {
                throw new Error(`Error fetching results: ${error.message}`);
            }

            return data || [];
        },
        enabled: !!user?.id,
        staleTime: 5 * 60 * 1000,
    });

    const getScoreRemark = (percentage: number) => {
        if (percentage >= 90) {
            return { text: "Outstanding Pass", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/20", border: "border-emerald-200 dark:border-emerald-800" };
        } else if (percentage >= 75) {
            return { text: "Excellent Pass", color: "text-cyan-600 dark:text-cyan-400", bg: "bg-cyan-50 dark:bg-cyan-950/20", border: "border-cyan-200 dark:border-cyan-800" };
        } else if (percentage >= 60) {
            return { text: "Pass", color: "text-teal-600 dark:text-teal-400", bg: "bg-teal-50 dark:bg-teal-950/20", border: "border-teal-200 dark:border-teal-800" };
        } else {
            return { text: "Needs Revision", color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-50 dark:bg-rose-950/20", border: "border-rose-200 dark:border-rose-800" };
        }
    };

    if (isLoadingResults) {
        return (
            <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <img src="/lovable-uploads/bf69a7f7-550a-45a1-8808-a02fb889f8c5.png" alt="Loading" className="w-20 h-20 object-contain animate-pulse" />
                    <p className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-xs animate-pulse">Loading Results History...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen w-full bg-slate-50/50 dark:bg-slate-950 selection:bg-teal-500/20 text-slate-900 dark:text-white pb-12 transition-colors duration-300">
            <Seo title="FLP Results History" />
            
            {/* Header */}
            <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-950/75 backdrop-blur-md border-b border-slate-200/60 dark:border-white/10 pt-[env(safe-area-inset-top)]">
                <div className="container mx-auto grid h-14 max-w-4xl grid-cols-[1fr_auto_1fr] items-center px-5">
                    <img src="/lovable-uploads/bf69a7f7-550a-45a1-8808-a02fb889f8c5.png" alt="Medmacs" className="h-9 w-9 object-contain" />
                    <h1 className="brand-wordmark text-xl text-slate-950 dark:text-white">FLP Attempts</h1>
                    <div className="justify-self-end"><ProfileDropdown /></div>
                </div>
            </header>

            <main className="container mx-auto px-5 pt-8 max-w-4xl space-y-8">
                {/* Hero section */}
                <div className="text-center md:text-left space-y-2 max-w-2xl">
                    <h1 className="font-['Bricolage_Grotesque'] text-3xl md:text-4xl font-extrabold tracking-tight text-slate-950 dark:text-white">
                        FLP Results History
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                        Compare past scores, examine metrics, and track your overall readiness for the final clinical boards.
                    </p>
                </div>

                {/* Results list */}
                {flpResults && flpResults.length > 0 ? (
                    <div className="space-y-4">
                        {flpResults.map((result) => {
                            const percentage = result.total_questions > 0
                                ? Math.round((result.score / result.total_questions) * 100)
                                : 0;
                            const remarks = getScoreRemark(percentage);

                            return (
                                <Card
                                    key={result.id}
                                    onClick={() => navigate(`/results/flp/${result.id}`)}
                                    className="hover:shadow-md cursor-pointer hover:-translate-y-0.5 transition-all duration-200 border-slate-200/60 dark:border-white/5 bg-white dark:bg-slate-900 rounded-3xl"
                                >
                                    <CardContent className="p-6">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                                            {/* Details */}
                                            <div className="flex items-center gap-4">
                                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border ${remarks.bg} ${remarks.color} ${remarks.border}`}>
                                                    <Trophy className="w-7 h-7" />
                                                </div>
                                                <div className="min-w-0">
                                                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                                                        Scored {result.score} <span className="text-slate-400 font-semibold">/ {result.total_questions}</span>
                                                    </h3>
                                                    <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold mt-0.5">
                                                        {new Date(result.completed_at).toLocaleDateString('en-US', {
                                                            month: 'short',
                                                            day: 'numeric',
                                                            year: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        })}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Actions / Badge */}
                                            <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-none pt-4 sm:pt-0 border-slate-100 dark:border-slate-800">
                                                <Badge className={`uppercase text-[9px] tracking-wider font-black px-2.5 py-1 border shadow-sm ${remarks.bg} ${remarks.color} ${remarks.border}`}>
                                                    {percentage}% - {remarks.text}
                                                </Badge>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="hover:bg-slate-100 dark:hover:bg-slate-800 text-teal-600 dark:text-teal-400 rounded-xl"
                                                >
                                                    <FileText className="w-4 h-4 mr-1.5" />
                                                    Review
                                                    <ChevronRight className="w-4 h-4 ml-0.5" />
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200/60 dark:border-white/5 max-w-lg mx-auto">
                        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center border border-slate-100 dark:border-slate-800">
                            <History className="w-10 h-10 text-slate-400 dark:text-slate-600 animate-[pulse_3s_infinite]" />
                        </div>
                        <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">No Results Yet</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs mx-auto mb-6 font-medium">
                            Your full-length mock exam papers will appear here once completed.
                        </p>
                        <Link to="/flp">
                            <Button className="bg-gradient-to-r from-[#2dd4bf] to-[#0ea5e9] text-white font-extrabold rounded-2xl px-6 py-5 shadow-lg active:scale-95 transition-transform">
                                Start Your First Paper
                            </Button>
                        </Link>
                    </div>
                )}
            </main>
        </div>
    );
};

export default FLPResultsPage;
