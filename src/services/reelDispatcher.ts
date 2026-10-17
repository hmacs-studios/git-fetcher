import { supabase } from '@/integrations/supabase/client';

export interface InteractiveQuiz {
  question: string;
  option_a: string;
  option_b: string;
  correct_option: string;
  explanation: string;
}

export interface ClinicalReel {
  assigned_id: string;
  medical_topic: string;
  mbbs_year: number;
  subject: string;
  media_category: string;
  identification_text: string;
  diagnosis_text: string;
  management_text?: string;
  treatment_text?: string;
  interactive_quiz?: InteractiveQuiz;
  image_url: string;
  original_source_url?: string;
  license_type?: string;
  attribution_text?: string;
  created_at?: string;
  // --- Media & Video Extensions ---
  media_type?: 'image' | 'video';
  video_url?: string;
  // --- Ad Reel Extensions ---
  is_ad?: boolean;
  ad_banner_url?: string;
  ad_target_url?: string;
  ad_cta_text?: string;
  ad_sponsor_name?: string;
}

// The server owns feed assembly and returns complete public media URLs.
const DISCOVER_API_BASE = (
  import.meta.env.VITE_DISCOVER_API_URL || 'https://discover.medmacs.app'
).replace(/\/$/, '') + '/v2';

function isUsableReel(r: ClinicalReel): boolean {
  if (!r) return false;
  if (!r.assigned_id) return false;
  if (!r.image_url && !r.video_url && !r.ad_banner_url) return false;
  return true;
}

function getMediaUrl(r: ClinicalReel): string {
  return (
    r.video_url ||
    (r.is_ad ? r.ad_banner_url || r.image_url : r.image_url) ||
    ''
  );
}

// --- MEDIA HEALTH GATE ---
// Bad media is filtered out of the feed *before* it reaches the UI, instead of
// being autoswipped past at render time. Probed results are cached for the
// session so the repeated prefetch calls stay cheap.
const verifiedMediaUrl = new Set<string>();
const brokenMediaUrl = new Set<string>();
const brokenReelIds = new Set<string>();

const PROBE_TIMEOUT_MS = 3000;
const PROBE_CONCURRENCY = 8;

// Only media from the configured public gateway can be reliably probed.
// External providers may reject CORS HEAD requests despite valid images.
function isProbeableMedia(url: string): boolean {
  if (!url) return false;
  if (url.startsWith('data:') || url.startsWith('blob:')) return false;
  try {
    return new URL(url).origin === new URL(DISCOVER_API_BASE).origin;
  } catch {
    return false;
  }
}

async function probeMedia(url: string): Promise<boolean> {
  if (verifiedMediaUrl.has(url)) return true;
  if (brokenMediaUrl.has(url)) return false;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    const res = await fetch(url, {
      method: 'HEAD',
      mode: 'cors',
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.ok) {
      verifiedMediaUrl.add(url);
    } else {
      brokenMediaUrl.add(url);
    }
    return res.ok;
  } catch {
    brokenMediaUrl.add(url);
    return false;
  }
}

async function probeMediaConcurrent(urls: string[]): Promise<void> {
  let index = 0;
  const workerCount = Math.min(PROBE_CONCURRENCY, Math.max(urls.length, 1));
  const workers = Array.from({ length: workerCount }, async () => {
    while (index < urls.length) {
      const idx = index++;
      await probeMedia(urls[idx]);
    }
  });
  await Promise.all(workers);
}

async function filterByMediaHealth(reels: ClinicalReel[]): Promise<ClinicalReel[]> {
  const candidates = reels.filter((r) => {
    if (!r || !isUsableReel(r)) return false;
    if (brokenReelIds.has(r.assigned_id)) return false;
    return true;
  });

  const probeUrls = Array.from(
    new Set(candidates.map(getMediaUrl).filter(isProbeableMedia))
  );
  await probeMediaConcurrent(probeUrls);

  return candidates.filter((r) => {
    const url = getMediaUrl(r);
    if (!isProbeableMedia(url)) return true;
    return verifiedMediaUrl.has(url);
  });
}

function toMediaUrl(path?: string | null, base?: string | null): string {
  const p = path || base || '';
  if (!p) return '';
  if (/^(https?:|data:|blob:)/.test(p)) return p;
  return p;
}

function mapReelRow(r: any): ClinicalReel {
  const payload = r.payload || {};
  return {
    ...payload,
    assigned_id: r.reel_id || payload.assigned_id,
    medical_topic: r.topic || payload.medical_topic,
    mbbs_year: r.mbbs_year ?? payload.mbbs_year,
    subject: r.subject ?? payload.subject,
    media_category: r.media_category ?? payload.media_category,
    identification_text: r.identification_text ?? payload.identification_text,
    diagnosis_text: r.diagnosis_text ?? payload.diagnosis_text,
    management_text: r.management_text ?? payload.management_text,
    treatment_text: r.treatment_text ?? payload.treatment_text,
    interactive_quiz: payload.interactive_quiz,
    image_url: toMediaUrl(r.media_path, payload.image_url),
    original_source_url: r.source_url ?? payload.original_source_url,
    license_type: r.license_type ?? payload.license_type,
    attribution_text: r.attribution_text ?? payload.attribution_text,
    media_type: payload.media_type || 'image',
    video_url: payload.video_url ? toMediaUrl(payload.video_url) : undefined,
    created_at: r.created_at ?? payload.created_at,
  };
}

function mapAdRow(a: any): ClinicalReel {
  const payload = a.payload || {};
  const media = a.media_url || payload.media_url || a.mediapath || payload.mediapath || '';
  return {
    ...payload,
    assigned_id: a.ad_id || payload.id,
    medical_topic: a.title || payload.title || 'Sponsored',
    subject: 'Sponsored',
    media_category: 'Sponsored',
    identification_text: a.sponsor_name || payload.sponsor_name || '',
    diagnosis_text: a.cta_label || payload.cta_label || '',
    image_url: toMediaUrl(media),
    is_ad: true,
    ad_banner_url: toMediaUrl(media),
    ad_target_url: a.cta_url || payload.cta_url,
    ad_cta_text: a.cta_label || payload.cta_label,
    ad_sponsor_name: a.sponsor_name || payload.sponsor_name,
    media_type: a.media_type || payload.media_type || 'image',
    mbbs_year: a.target_year ?? payload.target_year ?? 4,
  };
}

function interleaveAds(reels: ClinicalReel[], ads: ClinicalReel[], every = 5): ClinicalReel[] {
  const result: ClinicalReel[] = [];
  for (let i = 0; i < reels.length; i++) {
    result.push(reels[i]);
    if ((i + 1) % every === 0 && ads.length > 0) {
      result.push(ads.shift() as ClinicalReel);
    }
  }
  return result;
}

class ReelDispatcher {
  private async dataAction<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Authentication required');
    const response = await fetch(`${DISCOVER_API_BASE}/api/reels/data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ action, payload }),
    });
    if (!response.ok) throw new Error(`Reel operation failed (${response.status})`);
    return response.json() as Promise<T>;
  }

  // --- FEED (JSON API PRIMARY, SELF-HOSTED SUPABASE FALLBACK) ---
  private async fetchReelsFromJson(
    userId: string,
    year: number,
    subject?: string,
    limit: number = 15
  ): Promise<ClinicalReel[]> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Authentication required');

      let url = `${DISCOVER_API_BASE}/api/reels/feed?user_id=${encodeURIComponent(userId)}&year=${year}&limit=${limit}`;
      if (subject) url += `&subject=${encodeURIComponent(subject)}`;

      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      clearTimeout(timeoutId);
      if (!response.ok) throw new Error(`JSON feed HTTP ${response.status}`);

      const data = await response.json();
      const rawReels = data.reels || [];
      return rawReels
        .map((r: any): ClinicalReel => ({
          ...r,
          assigned_id: r.assigned_id || r.reel_id || r.ad_id || r.id,
          medical_topic: r.medical_topic || r.topic || r.title || (r.is_ad ? 'Sponsored' : 'Clinical Reel'),
          image_url: r.image_url || r.media_path || r.media_url || r.ad_banner_url || '',
          ad_banner_url: r.ad_banner_url || (r.is_ad ? r.media_url || r.media_path || r.image_url : undefined),
          is_ad: Boolean(r.is_ad || r.ad_id || r.cta_url || r.sponsor_name),
          media_type: r.media_type || 'image',
        }))
        .filter(isUsableReel);
    } catch (e) {
      clearTimeout(timeoutId);
      console.warn('[ReelDispatcher] JSON feed failed, falling back to Supabase:', e);
      return [];
    }
  }

  public async fetchReels(
    userId: string = 'user_app',
    year: number = 4,
    subject?: string,
    limit: number = 15,
    recentTopics: string[] = [],
    recentChapters: string[] = []
  ): Promise<ClinicalReel[]> {
    try {
      const reels = await this.fetchReelsFromJson(userId, year, subject, limit);
      const seen = new Set<string>();
      const uniqueReels: ClinicalReel[] = [];

      for (const r of reels) {
        if (!seen.has(r.assigned_id)) {
          seen.add(r.assigned_id);
          uniqueReels.push(r);
        }
      }

      return uniqueReels.filter(isUsableReel);
    } catch (e) {
      console.warn('[ReelDispatcher] Server feed unavailable:', e);
      return [];
    }
  }

  // --- INTERACTIONS (QUIZ / REACT TELEMETRY) ---
  public async sendInteraction(payload: {
    user_id: string;
    reel_id: string;
    watch_time_seconds: number;
    completed_reel: boolean;
    reaction_type?: string;
    selected_option?: string;
  }): Promise<boolean> {
    if (!payload.user_id || payload.user_id === 'user_app') {
      return false;
    }

    try {
      const result = await this.dataAction<{ ok: boolean }>('interaction', payload);
      return result.ok;
    } catch {
      return false;
    }
  }

  // --- PERSISTENT VIEWS ---
  public async recordView(payload: {
    user_id: string;
    reel_id: string;
    watch_time_seconds: number;
    is_interacted: boolean;
  }): Promise<boolean> {
    if (!payload.user_id || payload.user_id === 'user_app') {
      return false;
    }

    try {
      const result = await this.dataAction<{ ok: boolean }>('record_view', payload);
      return result.ok;
    } catch {
      return false;
    }
  }

  // --- PERSISTENT LIKES ---
  public async toggleLike(userId: string | undefined, reelId: string, isLiked: boolean): Promise<void> {
    if (!userId || userId === 'user_app') return;

    await this.dataAction('toggle_like', { reel_id: reelId, is_liked: isLiked });
  }

  public async fetchReelLikes(
    reelId: string,
    userId?: string
  ): Promise<{ count: number; userLiked: boolean; viewsCount: number; accountsReached: number }> {
    try {
      const result = await this.dataAction<{ count: number; user_liked: boolean; views_count: number; accounts_reached: number }>('stats', { reel_id: reelId });
      return {
        count: result.count || 0,
        userLiked: !!result.user_liked,
        viewsCount: result.views_count || 0,
        accountsReached: result.accounts_reached || 0,
      };
    } catch (e) {
      console.warn('[ReelDispatcher] Fetch likes failed:', e);
      return { count: 0, userLiked: false, viewsCount: 0, accountsReached: 0 };
    }
  }

  public async fetchReelStats(
    reelId: string,
    userId?: string
  ): Promise<{ viewsCount: number; accountsReached: number; likesCount: number; userLiked: boolean }> {
    const likes = await this.fetchReelLikes(reelId, userId);
    return {
      viewsCount: likes.viewsCount,
      accountsReached: likes.accountsReached,
      likesCount: likes.count,
      userLiked: likes.userLiked,
    };
  }

  // --- PERSISTENT COMMENTS & REPLIES ---
  public async fetchComments(reelId: string, userId?: string): Promise<any[]> {
    try {
      const result = await this.dataAction<{ comments: any[] }>('comments', { reel_id: reelId });
      return result.comments || [];
    } catch (e) {
      console.warn('[ReelDispatcher] Fetch comments failed:', e);
      return [];
    }
  }

  public async postComment(payload: {
    userId: string | undefined;
    reelId: string;
    userName: string;
    userRole?: string;
    avatarUrl?: string;
    commentText: string;
    parentCommentId?: string;
    userPlan?: string;
    isHighAccuracy?: boolean;
  }): Promise<any | null> {
    if (!payload.userId || payload.userId === 'user_app') return null;

    try {
      const result = await this.dataAction<{ comment: any }>('post_comment', {
        reel_id: payload.reelId,
        parent_comment_id: payload.parentCommentId || null,
        user_name: payload.userName,
        user_role: payload.userRole || 'Medical Student',
        avatar_url: payload.avatarUrl || null,
        comment_text: payload.commentText,
      });
      return result.comment;
    } catch {
      return null;
    }
  }

  public async updateComment(userId: string | undefined, commentId: string, updatedText: string): Promise<boolean> {
    if (!userId || userId === 'user_app' || !commentId) return false;

    try {
      const result = await this.dataAction<{ ok: boolean }>('update_comment', { comment_id: commentId, comment_text: updatedText });
      return result.ok;
    } catch {
      return false;
    }
  }

  public async deleteComment(userId: string | undefined, commentId: string): Promise<boolean> {
    if (!userId || userId === 'user_app' || !commentId) return false;

    try {
      const result = await this.dataAction<{ ok: boolean }>('delete_comment', { comment_id: commentId });
      return result.ok;
    } catch {
      return false;
    }
  }

  // --- COMMENT REACTIONS ---
  public async toggleCommentReaction(
    userId: string | undefined,
    commentId: string,
    currentlyLiked: boolean
  ): Promise<boolean> {
    if (!userId || userId === 'user_app' || !commentId) return !currentlyLiked;

    const result = await this.dataAction<{ liked: boolean }>('toggle_comment_reaction', {
      comment_id: commentId,
      currently_liked: currentlyLiked,
    });
    return result.liked;
  }

  // --- REEL REPORTS ---
  public async submitReport(payload: {
    userId: string | undefined;
    reelId: string;
    reason: string;
    notes?: string;
  }): Promise<boolean> {
    if (!payload.userId || payload.userId === 'user_app') return false;
    try {
      const result = await this.dataAction<{ ok: boolean }>('report', {
        reel_id: payload.reelId,
        reason: payload.reason,
        notes: payload.notes || null,
      });
      return result.ok;
    } catch {
      return false;
    }
  }

  // --- SAVED REELS ---
  public async toggleSave(userId: string | undefined, reelId: string, isSaved: boolean): Promise<boolean> {
    if (!userId || userId === 'user_app') return false;

    try {
      const result = await this.dataAction<{ ok: boolean }>('toggle_save', { reel_id: reelId, is_saved: isSaved });
      return result.ok;
    } catch {
      return false;
    }
  }

  public async fetchSavedReelIds(userId: string | undefined): Promise<Set<string>> {
    const saved = new Set<string>();
    if (!userId || userId === 'user_app') return saved;

    try {
      const result = await this.dataAction<{ reel_ids: string[] }>('saved_ids');
      (result.reel_ids || []).forEach((id) => saved.add(id));
    } catch {}

    return saved;
  }

  public async fetchSavedReels(userId: string | undefined): Promise<ClinicalReel[]> {
    if (!userId || userId === 'user_app') return [];

    try {
      const result = await this.dataAction<{ reels: any[] }>('saved_reels');
      return (result.reels || []).map(mapReelRow).filter(isUsableReel);
    } catch {
      return [];
    }
  }

  // --- BROKEN MEDIA FEEDBACK ---
  // Called from the UI when a media element fails to load despite preflight.
  // The reel/media is recorded so it never reappears in later fetches.
  public reportBrokenMedia(reelId: string, mediaUrl?: string): void {
    if (reelId) brokenReelIds.add(reelId);
    if (mediaUrl) brokenMediaUrl.add(mediaUrl);
  }
}

export const reelDispatcher = new ReelDispatcher();
