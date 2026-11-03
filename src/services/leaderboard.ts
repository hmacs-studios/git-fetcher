import { supabase } from '@/integrations/supabase/client';

export type LeaderboardScope = 'pakistan' | 'institute' | 'year-campus';
export type LeaderboardPeriod = 'all-time' | 'monthly' | 'weekly';

export type LeaderboardEntry = {
  id: string;
  user_id: string;
  rank_position: number;
  username: string;
  avatar_url: string | null;
  total_score: number;
  accuracy: number;
  best_streak: number;
  total_questions: number;
  correct_answers: number;
};

export const leaderboardQueryKey = (
  userId: string | undefined,
  scope: LeaderboardScope,
  period: LeaderboardPeriod,
  institute?: string | null,
  year?: string | null,
) => [
  'leaderboard', userId, scope, period,
  scope === 'pakistan' ? null : institute ?? null,
  scope === 'year-campus' ? year ?? null : null,
] as const;

export async function fetchLeaderboardEntries(
  scope: LeaderboardScope,
  period: LeaderboardPeriod,
  viewerId?: string,
): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase.rpc('get_leaderboard_entries', {
    p_scope: scope,
    p_period: period,
  });
  if (error) {
    // Keep the existing app usable until the migration reaches this project.
    if (error.code === 'PGRST202') return fetchLegacyLeaderboard(scope, period, viewerId);
    throw error;
  }

  return (data || []).map((row: Omit<LeaderboardEntry, 'id'>) => ({
    ...row,
    id: row.user_id,
  }));
}

async function fetchLegacyLeaderboard(
  scope: LeaderboardScope,
  period: LeaderboardPeriod,
  viewerId?: string,
): Promise<LeaderboardEntry[]> {
  const [answersResult, profilesResult] = await Promise.all([
    supabase.from('user_answers').select('user_id, is_correct, time_taken, created_at, mcq_id'),
    supabase.from('profiles').select('id, username, full_name, avatar_url, institute, year'),
  ]);
  if (answersResult.error) throw answersResult.error;
  if (profilesResult.error) throw profilesResult.error;

  const profiles = profilesResult.data || [];
  const viewer = profiles.find(profile => profile.id === viewerId);
  const scopedProfiles = profiles.filter(profile =>
    scope === 'pakistan' ||
    (!!viewer?.institute && profile.institute === viewer.institute &&
      (scope === 'institute' || (!!viewer.year && profile.year === viewer.year))),
  );
  const scopedIds = new Set(scopedProfiles.map(profile => profile.id));
  const localNow = new Date(Date.now() + 5 * 60 * 60 * 1000);
  const year = localNow.getUTCFullYear();
  const month = localNow.getUTCMonth();
  const day = localNow.getUTCDate();
  const mondayOffset = (localNow.getUTCDay() + 6) % 7;
  const start = period === 'monthly'
    ? Date.UTC(year, month, 1) - 5 * 60 * 60 * 1000
    : period === 'weekly'
      ? Date.UTC(year, month, day - mondayOffset) - 5 * 60 * 60 * 1000
      : null;
  const end = period === 'monthly'
    ? Date.UTC(year, month + 1, 1) - 5 * 60 * 60 * 1000
    : period === 'weekly'
      ? Date.UTC(year, month, day - mondayOffset + 7) - 5 * 60 * 60 * 1000
      : null;

  const answersByUser = new Map<string, typeof answersResult.data>();
  for (const answer of answersResult.data || []) {
    if (!scopedIds.has(answer.user_id)) continue;
    const createdAt = new Date(answer.created_at).getTime();
    if ((start !== null && createdAt < start) || (end !== null && createdAt >= end)) continue;
    const answers = answersByUser.get(answer.user_id) || [];
    answers.push(answer);
    answersByUser.set(answer.user_id, answers);
  }

  const entries = scopedProfiles.flatMap(profile => {
    const answers = answersByUser.get(profile.id);
    if (!answers?.length) return [];
    answers.sort((a, b) => a.created_at.localeCompare(b.created_at) || a.mcq_id.localeCompare(b.mcq_id));
    let correctAnswers = 0;
    let currentStreak = 0;
    let bestStreak = 0;
    let totalTime = 0;
    for (const answer of answers) {
      totalTime += answer.time_taken || 0;
      if (answer.is_correct) {
        correctAnswers++;
        currentStreak++;
        bestStreak = Math.max(bestStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }
    const accuracy = Math.round(correctAnswers * 100 / answers.length);
    const averageTime = Math.round(totalTime / answers.length);
    return [{
      id: profile.id,
      user_id: profile.id,
      rank_position: 0,
      username: profile.username || profile.full_name || 'Anonymous',
      avatar_url: profile.avatar_url,
      total_score: correctAnswers * 10 + bestStreak * 5 + accuracy + Math.max(0, 60 - averageTime),
      accuracy,
      best_streak: bestStreak,
      total_questions: answers.length,
      correct_answers: correctAnswers,
    }];
  });
  entries.sort((a, b) => b.total_score - a.total_score || a.user_id.localeCompare(b.user_id));
  return entries
    .map((entry, index) => ({ ...entry, rank_position: index + 1 }))
    .filter(entry => entry.rank_position <= 50 || entry.user_id === viewerId);
}
