const origin = 'https://flp.medmacs.app';

export function flpEndpoint(path = ''): URL {
  return new URL(`/api/flp${path}`, origin);
}

export async function fetchFlpEndpoint(url: URL, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (error) {
    if (init.signal?.aborted) throw init.signal.reason ?? error;
    throw new Error(`Could not reach the FLP service at ${url.hostname}. Please try again.`);
  }
}
