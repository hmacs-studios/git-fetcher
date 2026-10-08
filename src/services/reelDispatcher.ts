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

const PRIMARY_TUNNEL_URL = 'https://discover.medmacs.app';
const WORKER_FALLBACK_URL = 'https://medmacs-discover-worker.ameerhamza1396.workers.dev';
const CLOUDFLARE_DIRECT_URL = 'https://sons-jelsoft-ringtone-journalist.trycloudflare.com';
const LOCAL_STORAGE_BACKEND_KEY = 'medmacs_discover_backend_url';

export function getBackendUrl(): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(LOCAL_STORAGE_BACKEND_KEY);
    if (saved) {
      if (saved.includes('trycloudflare.com') || saved.includes('mug-realm')) {
        localStorage.removeItem(LOCAL_STORAGE_BACKEND_KEY);
      } else {
        return saved.trim().replace(/\/$/, '');
      }
    }
  }
  return PRIMARY_TUNNEL_URL;
}

export function setBackendUrl(url: string): void {
  if (typeof window !== 'undefined') {
    if (!url || url.includes('trycloudflare.com') || url.includes('mug-realm')) {
      localStorage.removeItem(LOCAL_STORAGE_BACKEND_KEY);
    } else {
      localStorage.setItem(LOCAL_STORAGE_BACKEND_KEY, url.trim().replace(/\/$/, ''));
    }
  }
}

export const FALLBACK_CDC_REELS: ClinicalReel[] = [
  {
    assigned_id: 'CDC-PHIL-2033',
    medical_topic: 'Cutaneous Anthrax Eschar',
    mbbs_year: 4,
    subject: 'Dermatology / Infectious Diseases',
    media_category: 'Patient Clinical Photo',
    identification_text: 'CDC PHIL #2033: Painless black cutaneous eschar with surrounding edema on forearm',
    diagnosis_text: 'Cutaneous Anthrax (Bacillus anthracis)',
    interactive_quiz: {
      question: 'Which pathognomonic finding confirms Cutaneous Anthrax?',
      option_a: 'Painless black eschar with surrounding gelatinous edema',
      option_b: 'Tender painful purulent nodule',
      correct_option: 'A',
      explanation: 'Bacillus anthracis causes a pathognomonic painless black eschar surrounded by extensive non-pitting edema.',
    },
    image_url: 'https://upload.wikimedia.org/wikipedia/commons/5/5f/Anthrax_PHIL_2033.png',
  },
  {
    assigned_id: 'CDC-PHIL-9875',
    medical_topic: 'Erythema Migrans (Lyme Disease)',
    mbbs_year: 4,
    subject: 'Dermatology / Infectious Diseases',
    media_category: 'Patient Clinical Photo',
    identification_text: 'CDC PHIL #9875: Expanding bullseye target rash following Ixodes tick bite',
    diagnosis_text: 'Early Localized Lyme Disease (Borrelia burgdorferi)',
    interactive_quiz: {
      question: 'What is the pathognomonic cutaneous manifestation of Lyme disease?',
      option_a: 'Erythema migrans (expanding bullseye rash)',
      option_b: 'Erythema nodosum',
      correct_option: 'A',
      explanation: 'Erythema migrans is the pathognomonic bullseye lesion of primary Borrelia burgdorferi infection.',
    },
    image_url: 'https://upload.wikimedia.org/wikipedia/commons/0/01/Erythema_migrans_-_erythematous_rash_in_Lyme_disease_-_PHIL_9875.jpg',
  },
  {
    assigned_id: 'CDC-PHIL-3004',
    medical_topic: 'Mycobacterium tuberculosis (Ziehl-Neelsen AFB)',
    mbbs_year: 3,
    subject: 'Microbiology / Pathology',
    media_category: 'Microscopy Pathology Slide',
    identification_text: 'CDC PHIL #3004: Bright pink rod-shaped acid-fast bacilli on Ziehl-Neelsen stain',
    diagnosis_text: 'Pulmonary Tuberculosis (Mycobacterium tuberculosis)',
    interactive_quiz: {
      question: 'Which microscopic staining method confirms M. tuberculosis acid-fastness?',
      option_a: 'Ziehl-Neelsen (Carbolfuchsin) Stain',
      option_b: 'Gram Stain',
      correct_option: 'A',
      explanation: 'Acid-fast Mycobacterium tuberculosis retains bright pink carbolfuchsin dye against methylene blue background.',
    },
    image_url: 'https://upload.wikimedia.org/wikipedia/commons/7/71/Mycobacterium_tuberculosis_Ziehl-Neelsen_stain_02.jpg',
  },
  {
    assigned_id: 'CDC-PHIL-3051',
    medical_topic: 'Plasmodium falciparum (Malaria Smear)',
    mbbs_year: 3,
    subject: 'Parasitology / Pathology',
    media_category: 'Microscopy Pathology Slide',
    identification_text: 'CDC PHIL #3051: Giemsa thin smear showing ring trophozoites and crescent gametocytes',
    diagnosis_text: 'Falciparum Malaria (Plasmodium falciparum)',
    interactive_quiz: {
      question: 'Which characteristic erythrocyte finding identifies Plasmodium falciparum?',
      option_a: 'Banana-shaped crescent gametocytes & double-dot ring forms',
      option_b: 'Schuffner dots in enlarged RBCs',
      correct_option: 'A',
      explanation: 'Plasmodium falciparum demonstrates classic crescent-shaped gametocytes and delicate ring forms in blood film.',
    },
    image_url: 'https://upload.wikimedia.org/wikipedia/commons/f/fc/Plasmodium_falciparum_01.png',
  },
  {
    assigned_id: 'CDC-PHIL-1268',
    medical_topic: 'Primary Syphilis (Hard Chancre)',
    mbbs_year: 4,
    subject: 'Dermatology / Venereology',
    media_category: 'Patient Clinical Photo',
    identification_text: 'CDC PHIL #1268: Solitary painless indurated ulcer with firm border on tongue',
    diagnosis_text: 'Primary Syphilis (Treponema pallidum)',
    interactive_quiz: {
      question: 'What defines the primary stage ulcer in Treponema pallidum infection?',
      option_a: 'Single painless ulcer (chancre) with indurated firm border',
      option_b: 'Multiple painful superficial vesicles',
      correct_option: 'A',
      explanation: 'Primary syphilis presents with a pathognomonic hard chancre that is clean-based, indurated, and painless.',
    },
    image_url: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Primary_stage_syphilis_sore_%28chancre%29_on_the_surface_of_a_tongue-CDC.jpg',
  },
];

const MEDMACS_SECRET_KEY = 'medmacs_discover_sec_key_2026_e2e_secure';

async function createClientHmacHeaders(path: string): Promise<Record<string, string>> {
  const timestamp = Date.now().toString();
  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(MEDMACS_SECRET_KEY);
    const msgData = encoder.encode(`${timestamp}.${path}`);
    const cryptoKey = await window.crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signature = await window.crypto.subtle.sign('HMAC', cryptoKey, msgData);
    const hexSig = Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    return {
      'X-Medmacs-Signature': hexSig,
      'X-Medmacs-Timestamp': timestamp,
      'bypass-tunnel-reminder': 'true',
      'ngrok-skip-browser-warning': 'true',
    };
  } catch (e) {
    return {
      'bypass-tunnel-reminder': 'true',
      'ngrok-skip-browser-warning': 'true',
    };
  }
}

class ReelDispatcher {
  public async fetchReels(userId: string = 'user_app', year: number = 4, subject?: string, limit: number = 1): Promise<ClinicalReel[]> {
    const userUrl = getBackendUrl();
    const candidateUrls = Array.from(new Set([WORKER_FALLBACK_URL, PRIMARY_TUNNEL_URL, userUrl].filter(Boolean)));
    const headers = await createClientHmacHeaders('/api/reels/feed');

    for (const baseUrl of candidateUrls) {
      let url = `${baseUrl}/api/reels/feed?user_id=${encodeURIComponent(userId)}&year=${year}&limit=${limit}`;
      if (subject) url += `&subject=${encodeURIComponent(subject)}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      try {
        const response = await fetch(url, { headers, signal: controller.signal });
        clearTimeout(timeoutId);
        if (response.ok) {
          const data = await response.json();
          const rawReels = data.reels || [];
          if (rawReels.length > 0) {
            const reels: ClinicalReel[] = rawReels.map((r: any) => ({
              ...r,
              image_url: r.image_url?.startsWith('/') ? `${baseUrl}${r.image_url}` : r.image_url,
            }));
            return reels;
          }
        }
      } catch (e) {
        clearTimeout(timeoutId);
        console.warn(`[ReelDispatcher] Endpoint failed (${baseUrl}):`, e);
      }
    }

    console.warn('[ReelDispatcher] Using static fallback CDC PHIL reels');
    return FALLBACK_CDC_REELS;
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
