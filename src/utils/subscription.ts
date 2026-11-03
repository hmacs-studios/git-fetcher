export const getEffectivePlan = (
  plan?: string | null,
  expiry?: string | null,
): string => {
  const normalized = String(plan || 'free').trim().toLowerCase();
  if (normalized === 'free') return 'free';
  if (!expiry) return normalized;
  const expiryTime = Date.parse(expiry);
  return Number.isFinite(expiryTime) && expiryTime <= Date.now() ? 'free' : normalized;
};

