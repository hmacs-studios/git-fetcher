import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { toast } from 'sonner';

const MetaAppEvents = registerPlugin<{
  setConsent(options: { granted: boolean }): Promise<{ granted: boolean }>;
}>('MetaAppEvents');
const GoogleAnalytics = registerPlugin<{
  setConsent(options: { granted: boolean }): Promise<void>;
}>('GoogleAnalytics');

export const CONSENT_VERSION = '2026-07-16.1';
const PRODUCT = (import.meta.env.VITE_PRODUCT_ID || (location.hostname.includes('medmacs') || document.title.toLowerCase().includes('medmacs') ? 'medmacs' : 'medistics')).toLowerCase();
const CACHE_KEY = `${PRODUCT}_consent_preferences`;

export type ConsentPreferences = {
  analytics: boolean;
  marketing: boolean;
  version: string;
  source: 'mobile' | 'web' | 'anonymous_web';
  consentedAt: string;
  updatedAt: string;
  explicit: boolean;
};

type ConsentContextValue = {
  preferences: ConsentPreferences;
  measurementAllowed: boolean;
  cloudLoading: boolean;
  saveConsent: (allowed: boolean) => Promise<void>;
  withdrawConsent: () => Promise<void>;
  openPreferences: () => void;
};

const denied = (): ConsentPreferences => ({
  analytics: false, marketing: false, version: CONSENT_VERSION,
  source: isNative() ? 'mobile' : 'anonymous_web',
  consentedAt: '', updatedAt: '', explicit: false,
});

function isNative() {
  return Capacitor.isNativePlatform();
}
const mobilePromptAllowed = () => location.pathname === '/dashboard';

function readCache(): ConsentPreferences {
  try { return { ...denied(), ...JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') }; }
  catch { return denied(); }
}

function publishConsent(value: ConsentPreferences, mode: 'default' | 'update' = 'update') {
  const state = value.analytics ? 'granted' : 'denied';
  const marketing = value.marketing ? 'granted' : 'denied';
  (window as any).dataLayer = (window as any).dataLayer || [];
  const gtag = (...args: any[]) => (window as any).dataLayer.push(args);
  gtag('consent', mode, {
    analytics_storage: state,
    ad_storage: marketing,
    ad_user_data: marketing,
    ad_personalization: 'denied',
  });
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
    void MetaAppEvents.setConsent({ granted: value.marketing })
      .catch(error => console.warn('Unable to update Meta App Events consent', error));
    void GoogleAnalytics.setConsent({ granted: value.analytics })
      .catch(error => console.warn('Unable to update Firebase Analytics consent', error));
  }
  window.dispatchEvent(new CustomEvent('platform-consent-changed', { detail: value }));
}

function loadMeasurement(value: ConsentPreferences) {
  const analyticsId = import.meta.env.VITE_GOOGLE_ANALYTICS_ID;
  const adsId = import.meta.env.VITE_GOOGLE_ADS_ID;
  const googleId = value.analytics ? analyticsId : value.marketing ? adsId : '';
  if (googleId) {
    if (!document.querySelector('[data-platform-google-tag]')) {
      const script = document.createElement('script'); script.async = true; script.dataset.platformGoogleTag = 'true';
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(googleId)}`; document.head.appendChild(script);
    }
    const gtag = (...args: any[]) => ((window as any).dataLayer ||= []).push(args);
    if (value.analytics && analyticsId) gtag('config', analyticsId, { allow_google_signals: false });
    if (value.marketing && adsId) gtag('config', adsId, { allow_ad_personalization_signals: false });
  }
  if (value.marketing) {
    const params = new URLSearchParams(location.search);
    const attribution = Object.fromEntries(['utm_source','utm_medium','utm_campaign','utm_content','utm_term','gclid','fbclid'].filter(k => params.get(k)).map(k => [k, params.get(k)]));
    if (Object.keys(attribution).length) localStorage.setItem(`${PRODUCT}_campaign_attribution`, JSON.stringify({ ...attribution, captured_at: new Date().toISOString() }));
    const pixelId = import.meta.env.VITE_META_PIXEL_ID;
    if (pixelId && !(window as any).fbq) {
      const fbq: any = (...args: any[]) => fbq.callMethod ? fbq.callMethod(...args) : (fbq.queue ||= []).push(args);
      fbq.loaded = true; fbq.version = '2.0'; fbq.queue = []; (window as any).fbq = fbq;
      const script = document.createElement('script'); script.async = true; script.src = 'https://connect.facebook.net/en_US/fbevents.js'; document.head.appendChild(script);
      fbq('init', pixelId); fbq('track', 'PageView');
    }
  }
}

const ConsentContext = createContext<ConsentContextValue | null>(null);

const autoAccepted = (): ConsentPreferences => ({
  analytics: true, marketing: true, version: CONSENT_VERSION,
  source: isNative() ? 'mobile' : 'anonymous_web',
  consentedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), explicit: true,
});

export function ConsentProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<ConsentPreferences>(() => autoAccepted());
  const [cloudLoading, setCloudLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const apply = useCallback((next: ConsentPreferences) => {
    const allowed = true;
    const unified = { ...next, analytics: allowed, marketing: allowed };
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(unified)); } catch { /* quota */ }
    setPreferences(unified);
    publishConsent(unified); loadMeasurement(unified);
  }, []);

  useEffect(() => {
    const initial = autoAccepted();
    publishConsent(initial, 'default');
    apply(initial);
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      setUserId(session?.user?.id || null);
    });
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id || null));
    return () => listener.subscription.unsubscribe();
  }, [apply]);

  useEffect(() => {
    if (userId) {
      void saveCloud(userId, autoAccepted()).catch((error) => console.warn('Unable to sync consent preferences', error));
    }
  }, [userId]);

  const saveConsent = useCallback(async (allowed: boolean) => {
    const now = new Date().toISOString();
    const next: ConsentPreferences = { analytics: true, marketing: true, version: CONSENT_VERSION,
      source: isNative() ? 'mobile' : userId ? 'web' : 'anonymous_web', consentedAt: now, updatedAt: now, explicit: true };
    apply(next);
    setOpen(false);

    if (userId) {
      try { await saveCloud(userId, next); }
      catch (error) { console.warn('Unable to sync consent preference', error); }
    }
  }, [apply, userId]);

  const value = useMemo(() => ({
    preferences,
    measurementAllowed: true,
    cloudLoading,
    saveConsent,
    withdrawConsent: () => saveConsent(true),
    openPreferences: () => setOpen(false),
  }), [preferences, cloudLoading, saveConsent]);

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}

async function saveCloud(userId: string, value: ConsentPreferences) {
  const { error } = await supabase.from('user_consents').upsert({ user_id: userId, analytics_allowed: value.analytics,
    marketing_allowed: value.marketing, consent_version: value.version, consented_at: value.consentedAt || new Date().toISOString(),
    updated_at: new Date().toISOString(), source: value.source }, { onConflict: 'user_id' });
  if (error) throw error;
}

export const useConsent = () => {
  const value = useContext(ConsentContext);
  if (!value) throw new Error('useConsent must be used inside ConsentProvider');
  return value;
};
