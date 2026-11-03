import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy, Crown, Medal, Award, Users, ArrowRight, Target } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { fetchLeaderboardEntries, leaderboardQueryKey, type LeaderboardEntry } from '@/services/leaderboard';

export const LeaderboardPreview = () => {
  const { user } = useAuth();

  const { data: leaderboardData = [], isLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: leaderboardQueryKey(user?.id, 'pakistan', 'all-time'),
    queryFn: () => fetchLeaderboardEntries('pakistan', 'all-time', user?.id),
    enabled: !!user?.id,
    staleTime: 1000 * 60,
  });

  const topUsers = leaderboardData.filter(entry => entry.rank_position <= 10);
  const currentUserData = leaderboardData.find(entry => entry.user_id === user?.id);
  const userRank = currentUserData?.rank_position ?? -1;

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return <Crown className="w-4 h-4 text-yellow-500" />;
      case 2: return <Medal className="w-4 h-4 text-gray-400" />;
      case 3: return <Award className="w-4 h-4 text-amber-600" />;
      default: return <Trophy className="w-4 h-4 text-primary" />;
    }
  };

  return (
    <Card className="bg-gradient-to-br from-card to-accent/30 border-border hover:shadow-lg transition-all duration-300">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2 text-foreground">
            <Trophy className="w-5 h-5 text-primary" />
            <span>Top Students</span>
          </CardTitle>
          <Link to="/leaderboard">
            <Button variant="ghost" size="sm" className="text-primary hover:bg-accent">
              View All
              <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {/* User rank banner */}
        {currentUserData && userRank > 0 && (
          <div className="flex items-center justify-between p-3 mb-3 rounded-xl bg-primary/10 border border-primary/20">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              <span className="text-xs font-bold text-foreground">Your Rank</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-primary">#{userRank}</span>
              <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary border-0">
                {currentUserData.total_score} pts
              </Badge>
            </div>
          </div>
        )}
        {!currentUserData && user && (
          <div className="flex items-center justify-between p-3 mb-3 rounded-xl bg-muted/50 border border-border/30">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">
                Keep practicing — you could be in the Top 10! 🚀
              </span>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="flex items-center space-x-3 animate-pulse">
                <div className="w-6 h-6 bg-muted rounded-full"></div>
                <div className="flex-1 space-y-1">
                  <div className="h-3 bg-muted rounded w-3/4"></div>
                  <div className="h-2 bg-muted rounded w-1/2"></div>
                </div>
                <div className="h-3 bg-muted rounded w-12"></div>
              </div>
            ))}
          </div>
        ) : topUsers.length === 0 ? (
          <div className="text-center py-6">
            <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground text-sm">No data available yet</p>
            <p className="text-muted-foreground text-xs">Start practicing to see rankings!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {topUsers.map((entry, index) => (
              <div 
                key={entry.id}
                className="flex items-center space-x-3 p-2 rounded-lg bg-card/60 hover:bg-accent/50 transition-all duration-200"
              >
                <div className="flex items-center space-x-2 flex-1 min-w-0">
                  <div className="flex items-center space-x-1">
                    {getRankIcon(index + 1)}
                    <span className="text-xs font-medium text-muted-foreground">
                      #{index + 1}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground text-sm truncate">
                      {entry.username}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {entry.accuracy}% • {entry.total_questions} questions
                    </p>
                  </div>
                </div>
                <Badge variant="secondary" className="text-xs bg-primary/10 text-primary">
                  {entry.total_score}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
