import { useEffect, useState } from 'react';

const IMAGE_CACHE = 'medmacs-profile-image-cache';
const IMAGE_INVALIDATED_EVENT = 'medmacs-profile-image-invalidated';

export const invalidateCachedImage = (url?: string | null) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(IMAGE_INVALIDATED_EVENT, { detail: { url: url || null } }));
};

export const useCachedImage = (url?: string | null) => {
  const [cachedUrl, setCachedUrl] = useState<string | null>(url || null);
  const [cacheVersion, setCacheVersion] = useState(0);

  useEffect(() => {
    const handleInvalidation = (event: Event) => {
      const invalidatedUrl = (event as CustomEvent<{ url?: string | null }>).detail?.url;
      if (!invalidatedUrl || invalidatedUrl === url) setCacheVersion((version) => version + 1);
    };
    window.addEventListener(IMAGE_INVALIDATED_EVENT, handleInvalidation);
    return () => window.removeEventListener(IMAGE_INVALIDATED_EVENT, handleInvalidation);
  }, [url]);

  useEffect(() => {
    let revokedUrl: string | null = null;
    let cancelled = false;

    const load = async () => {
      if (!url || typeof window === 'undefined' || !('caches' in window)) {
        setCachedUrl(url || null);
        return;
      }

      try {
        const cache = await caches.open(IMAGE_CACHE);
        if (cacheVersion > 0) await cache.delete(url);
        const cached = await cache.match(url);

        if (cached) {
          const blob = await cached.blob();
          revokedUrl = URL.createObjectURL(blob);
          if (!cancelled) setCachedUrl(revokedUrl);
        } else {
          setCachedUrl(url);
        }

        if (navigator.onLine) {
          const response = await fetch(url, { cache: 'reload', mode: 'cors' });
          if (response.ok) {
            await cache.put(url, response.clone());
            const blob = await response.blob();
            const nextUrl = URL.createObjectURL(blob);
            if (revokedUrl) URL.revokeObjectURL(revokedUrl);
            revokedUrl = nextUrl;
            if (!cancelled) setCachedUrl(nextUrl);
          }
        }
      } catch {
        setCachedUrl(url);
      }
    };

    load();

    return () => {
      cancelled = true;
      if (revokedUrl) URL.revokeObjectURL(revokedUrl);
    };
  }, [url, cacheVersion]);

  return cachedUrl || url || null;
};

