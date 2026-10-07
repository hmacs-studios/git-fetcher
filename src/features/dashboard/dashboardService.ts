import { DASHBOARD_GREETING_PHRASES } from './constants';
import type { DashboardProfile, UserStats } from './types';

const EMPTY_STATS: UserStats = {
  totalQuestions: 0,
  correctAnswers: 0,
  accuracy: 0,
  currentStreak: 0,
  rankPoints: 0,
  battlesWon: 0,
  totalBattles: 0,
  savedQuestions: 0,
};

export const getEmptyUserStats = (): UserStats => ({ ...EMPTY_STATS });

export function calculateCurrentStreak(createdDates: string[]): number {
  const answerDates = createdDates.map((createdAt) =>
    new Date(createdAt).toLocaleDateString('en-US', { timeZone: 'Asia/Karachi' }),
  );
  const uniqueDates = [...new Set(answerDates)];
  if (uniqueDates.length === 0) return 0;

  const today = new Date();
  const todayPKT = new Date(today.toLocaleString('en-US', { timeZone: 'Asia/Karachi' }));
  todayPKT.setHours(0, 0, 0, 0);
  const yesterday = new Date(todayPKT);
  yesterday.setDate(yesterday.getDate() - 1);

  const dateObjects = uniqueDates
    .map((dateString) => {
      const [month, day, year] = dateString.split('/');
      return new Date(Number(year), Number(month) - 1, Number(day));
    })
    .sort((a, b) => b.getTime() - a.getTime());

  const mostRecentDate = dateObjects[0];
  if (
    mostRecentDate.getTime() !== todayPKT.getTime()
    && mostRecentDate.getTime() !== yesterday.getTime()
  ) {
    return 0;
  }

  let streak = 1;
  let currentDate = new Date(mostRecentDate);
  for (let index = 1; index < dateObjects.length; index += 1) {
    const previousDate = dateObjects[index];
    const expectedPreviousDate = new Date(currentDate);
    expectedPreviousDate.setDate(expectedPreviousDate.getDate() - 1);
    if (previousDate.getTime() !== expectedPreviousDate.getTime()) break;
    streak += 1;
    currentDate = previousDate;
  }
  return streak;
}

export function parseDashboardNotice(raw?: string | null): string {
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw);
    if (parsed === null || parsed?.enabled === false) return '';
    return String(parsed?.text || parsed?.message || '').trim();
  } catch {
    return String(raw).trim();
  }
}

export function getProfileCacheKey(userId?: string): string | null {
  return userId ? `medmacs_profile_cache_${userId}` : null;
}

export function readCachedProfile(userId?: string): DashboardProfile | null {
  if (typeof window === 'undefined') return null;
  const cacheKey = getProfileCacheKey(userId);
  if (!cacheKey) return null;
  try {
    const cached = localStorage.getItem(cacheKey);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
}

export function cacheProfile(userId: string, profile: DashboardProfile | null): void {
  if (typeof window === 'undefined') return;
  const cacheKey = getProfileCacheKey(userId);
  if (!cacheKey) return;
  if (profile) localStorage.setItem(cacheKey, JSON.stringify(profile));
  else localStorage.removeItem(cacheKey);
}

export function getDashboardGreeting(displayName?: string, userId?: string): string {
  const now = new Date();
  const currentHour = now.getHours();
  if (currentHour >= 5 && currentHour < 12) return '🌅 Good Morning';
  if (currentHour >= 12 && currentHour < 17) return '☀️ Good Afternoon';
  if (currentHour >= 17 && currentHour < 21) return '🌆 Good Evening';
  return '🌙 Good Night';
}
