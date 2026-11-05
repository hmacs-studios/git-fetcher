import { useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { FLPQuiz } from '@/components/FLPs/FLPQuiz';
import { FlpQuizLoading } from '@/components/FLPs/FlpQuizLoading';
import { getActiveFlp, type FlpDraft } from '@/utils/flpSession';

const FLPTestPage = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const expectedSession = (location.state as { draft?: FlpDraft } | null)?.draft?.sessionId;
  const paper = useQuery({
    queryKey: ['flp-test-draft', user?.id, location.key],
    queryFn: getActiveFlp,
    enabled: !authLoading && Boolean(user?.id),
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  if (authLoading || (user && paper.isPending)) return <FlpQuizLoading />;

  const draft = paper.data;
  const hasPaper = draft?.mcqs.length && (!expectedSession || draft.sessionId === expectedSession);

  if (!user || paper.isError || !hasPaper) {
    const title = !user ? 'Sign in required' : paper.isError ? 'Could not load your paper' : 'No active paper';
    const description = !user ? 'Sign in to access your Full-Length Paper.'
      : paper.isError ? paper.error.message : 'Start a paper from the FLP page.';

    return (
      <main className="flex min-h-dvh items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{description}</p>
            <div className="flex flex-wrap gap-2">
              {paper.isError && <Button onClick={() => void paper.refetch()}>Try again</Button>}
              <Button variant={paper.isError ? 'outline' : 'default'} onClick={() => navigate(user ? '/flp' : '/login', { replace: true })}>
                {user ? 'Back to FLP' : 'Sign in'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <FLPQuiz
      key={draft.sessionId}
      mcqs={draft.mcqs}
      onFinish={() => navigate('/flp', { replace: true })}
      timePerQuestion={60}
      subjectName={draft.subjectName}
      initialIndex={draft.currentQuestionIndex}
      initialAnswers={draft.userAnswers}
      initialTimeLeft={Math.max(0, Math.ceil((draft.deadline - Date.now()) / 1000))}
      sessionId={draft.sessionId}
      deadline={draft.deadline}
    />
  );
};

export default FLPTestPage;
