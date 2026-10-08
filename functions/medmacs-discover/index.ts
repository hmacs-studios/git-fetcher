/**
 * Medmacs Discover - Cloudflare Worker Microservice
 * Route: discover.medmacs.app/*
 * Proxies feed and interaction requests to the OCI microservice backend with HMAC SHA-256 E2E Security.
 */

export interface Env {
  BACKEND_ORIGIN: string;
}

const MEDMACS_SECRET_KEY = 'medmacs_discover_sec_key_2026_e2e_secure';

async function generateHmacSignature(timestamp: string, path: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(MEDMACS_SECRET_KEY);
  const msgData = encoder.encode(`${timestamp}.${path}`);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Medmacs-Signature, X-Medmacs-Timestamp, bypass-tunnel-reminder, ngrok-skip-browser-warning',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    const backendUrl = env.BACKEND_ORIGIN || 'https://sons-jelsoft-ringtone-journalist.trycloudflare.com';
    const targetUrl = `${backendUrl}${url.pathname}${url.search}`;

    const headers = new Headers(request.headers);
    const timestamp = Date.now().toString();
    const hmacSig = await generateHmacSignature(timestamp, url.pathname);

    headers.set('X-Medmacs-Signature', hmacSig);
    headers.set('X-Medmacs-Timestamp', timestamp);
    headers.set('bypass-tunnel-reminder', 'true');
    headers.set('ngrok-skip-browser-warning', 'true');
    headers.set('Host', new URL(backendUrl).host);

    try {
      const backendResponse = await fetch(targetUrl, {
        method: request.method,
        headers: headers,
        body: request.method !== 'GET' && request.method !== 'HEAD' ? await request.clone().arrayBuffer() : undefined,
      });

      const responseHeaders = new Headers(backendResponse.headers);
      responseHeaders.set('Access-Control-Allow-Origin', '*');
      responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Medmacs-Signature, X-Medmacs-Timestamp, bypass-tunnel-reminder, ngrok-skip-browser-warning');

      return new Response(backendResponse.body, {
        status: backendResponse.status,
        statusText: backendResponse.statusText,
        headers: responseHeaders,
      });
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: 'Medmacs Discover Worker Proxy Error',
          message: String(error),
        }),
        {
          status: 502,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }
  },
};
