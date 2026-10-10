// Same-origin proxy for per-ayah recitation files from everyayah.com.
// Gives us CORS headers (so the app can store audio for offline use)
// and caches files at Cloudflare's edge.

const UPSTREAM = 'https://everyayah.com/data';
const PATH_RE = /^\/audio\/([A-Za-z0-9_.-]{1,80})\/(\d{6})\.mp3$/;

export async function handleAudio(request: Request, ctx?: { waitUntil(p: Promise<unknown>): void }): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders() });
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders() });
  }

  const url = new URL(request.url);
  const m = PATH_RE.exec(url.pathname);
  if (!m) return new Response('Not found', { status: 404, headers: corsHeaders() });

  const cache = (caches as unknown as { default: Cache }).default;
  const cacheKey = new Request(url.origin + url.pathname, { method: 'GET' });

  let full = await cache.match(cacheKey);
  if (!full) {
    const upstream = await fetch(`${UPSTREAM}/${m[1]}/${m[2]}.mp3`, {
      cf: { cacheTtl: 60 * 60 * 24 * 30, cacheEverything: true },
    } as RequestInit);
    if (!upstream.ok) {
      return new Response('Upstream error', { status: upstream.status === 404 ? 404 : 502, headers: corsHeaders() });
    }
    const body = await upstream.arrayBuffer();
    full = new Response(body, {
      status: 200,
      headers: {
        ...corsHeaders(),
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(body.byteLength),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
    const toCache = full.clone();
    if (ctx) ctx.waitUntil(cache.put(cacheKey, toCache));
    else await cache.put(cacheKey, toCache);
  }

  // Safari needs proper 206 responses for media range requests.
  const range = request.headers.get('Range');
  if (range) return rangeResponse(full, range, request.method === 'HEAD');
  return request.method === 'HEAD' ? new Response(null, { status: 200, headers: full.headers }) : full;
}

async function rangeResponse(full: Response, range: string, head: boolean): Promise<Response> {
  const buf = await full.arrayBuffer();
  const size = buf.byteLength;
  const m = /bytes=(\d*)-(\d*)/.exec(range);
  let start = m && m[1] ? parseInt(m[1], 10) : 0;
  let end = m && m[2] ? parseInt(m[2], 10) : size - 1;
  if (m && !m[1] && m[2]) {
    // suffix range: last N bytes
    start = Math.max(0, size - parseInt(m[2], 10));
    end = size - 1;
  }
  if (start >= size || start > end) {
    return new Response(null, { status: 416, headers: { ...corsHeaders(), 'Content-Range': `bytes */${size}` } });
  }
  end = Math.min(end, size - 1);
  const chunk = buf.slice(start, end + 1);
  return new Response(head ? null : chunk, {
    status: 206,
    headers: {
      ...corsHeaders(),
      'Content-Type': 'audio/mpeg',
      'Content-Length': String(chunk.byteLength),
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Range',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
  };
}
