/**
 * Medmacs Discover - Cloudflare Worker Microservice
 * Route: discover.medmacs.app/*
 * Proxies feed and interaction requests to the OCI microservice backend with CORS support & 0ms caching.
 */

export interface Env {
  BACKEND_ORIGIN: string;
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
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, bypass-tunnel-reminder, ngrok-skip-browser-warning',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    const backendUrl = env.BACKEND_ORIGIN || 'https://mug-realm-hundreds-award.trycloudflare.com';
    const targetUrl = `${backendUrl}${url.pathname}${url.search}`;

    const headers = new Headers(request.headers);
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
      responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, bypass-tunnel-reminder, ngrok-skip-browser-warning');

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
