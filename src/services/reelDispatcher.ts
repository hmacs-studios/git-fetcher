/**
 * Medmacs Discover - Reel Dispatcher Microservice Client
 * Handles fetching, queuing, prefetching, and interaction logging for clinical reels.
 */

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
}

const PRIMARY_TUNNEL_URL = 'https://mug-realm-hundreds-award.trycloudflare.com';
const LOCAL_STORAGE_BACKEND_KEY = 'medmacs_discover_backend_url';

export function getBackendUrl(): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(LOCAL_STORAGE_BACKEND_KEY);
    if (saved) return saved.trim().replace(/\/$/, '');
  }
  return PRIMARY_TUNNEL_URL;
}

export function setBackendUrl(url: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(LOCAL_STORAGE_BACKEND_KEY, url.trim().replace(/\/$/, ''));
  }
}

class ReelDispatcher {
  public async fetchReels(userId: string = 'user_app', year: number = 4, subject?: string): Promise<ClinicalReel[]> {
    const baseUrl = getBackendUrl();
    const headers: Record<string, string> = {
      'bypass-tunnel-reminder': 'true',
      'ngrok-skip-browser-warning': 'true',
    };

    let url = `${baseUrl}/api/reels/feed?user_id=${encodeURIComponent(userId)}&year=${year}`;
    if (subject) {
      url += `&subject=${encodeURIComponent(subject)}`;
    }

    try {
      const response = await fetch(url, { headers });
      if (!response.ok) {
        throw new Error(`Reel Feed HTTP ${response.status}`);
      }
      const data = await response.json();
      const reels: ClinicalReel[] = data.reels || [];
      return reels;
    } catch (error) {
      console.warn('[ReelDispatcher] Failed to fetch live feed:', error);
      return [];
    }
  }

  public async sendInteraction(payload: {
    user_id: string;
    reel_id: string;
    watch_time_seconds: number;
    completed_reel: boolean;
    reaction_type?: string;
    selected_option?: string;
  }): Promise<boolean> {
    const baseUrl = getBackendUrl();
    try {
      const response = await fetch(`${baseUrl}/api/reels/interaction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'bypass-tunnel-reminder': 'true',
        },
        body: JSON.stringify(payload),
      });
      return response.ok;
    } catch (e) {
      console.warn('[ReelDispatcher] Interaction logging failed:', e);
      return false;
    }
  }
}

export const reelDispatcher = new ReelDispatcher();
