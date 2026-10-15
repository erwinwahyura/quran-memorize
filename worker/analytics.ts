// Self-hosted, anonymous usage analytics stored in Cloudflare D1.
//
// - The app sends small batches of events with a random device id (no names,
//   no IPs are stored). Location comes from Cloudflare's request.cf, device
//   info from the User-Agent.
// - Bots/crawlers are flagged, and devices the owner marks as "mine" are
//   flagged internal, so the dashboard can show organic usage only.
// - /api/stats requires an admin session (see admin-auth.ts).

export interface AnalyticsEnv {
  DB?: D1Database;
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY,
    first_seen INTEGER NOT NULL,
    last_seen INTEGER NOT NULL,
    country TEXT, region TEXT, city TEXT, timezone TEXT,
    os TEXT, browser TEXT, device_type TEXT,
    standalone INTEGER, lang TEXT, ui_lang TEXT, app_version TEXT,
    is_bot INTEGER NOT NULL DEFAULT 0,
    is_internal INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    ts INTEGER NOT NULL,
    name TEXT NOT NULL,
    value REAL,
    props TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS events_ts ON events (ts)`,
  `CREATE INDEX IF NOT EXISTS events_device ON events (device_id)`,
  `CREATE INDEX IF NOT EXISTS devices_last_seen ON devices (last_seen)`,
  `CREATE TABLE IF NOT EXISTS login_attempts (ip_key TEXT NOT NULL, ts INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS login_attempts_key ON login_attempts (ip_key, ts)`,
];

let schemaReady: Promise<unknown> | null = null;
export function ensureSchema(db: D1Database) {
  schemaReady ??= db.batch(SCHEMA.map((q) => db.prepare(q))).catch((e) => {
    schemaReady = null;
    throw e;
  });
  return schemaReady;
}

const EVENT_NAMES = new Set(['open', 'page', 'add', 'play', 'listen', 'test', 'install', 'guide', 'error']);
const ID_RE = /^[a-z0-9-]{8,64}$/i;
const BOT_RE =
  /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|embedly|curl|wget|python|axios|node-fetch|go-http|java\/|httpclient|scrapy|puppeteer|playwright|phantom/i;

const json = (data: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra },
  });

function parseUA(ua: string) {
  const os = /iPhone|iPad|iPod/.test(ua)
    ? 'iOS'
    : /Android/.test(ua)
      ? 'Android'
      : /Mac OS X|Macintosh/.test(ua)
        ? 'macOS'
        : /Windows/.test(ua)
          ? 'Windows'
          : /CrOS/.test(ua)
            ? 'ChromeOS'
            : /Linux/.test(ua)
              ? 'Linux'
              : 'Other';
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /SamsungBrowser/.test(ua)
      ? 'Samsung Internet'
      : /OPR\/|Opera/.test(ua)
        ? 'Opera'
        : /Firefox\/|FxiOS/.test(ua)
          ? 'Firefox'
          : /CriOS|Chrome\//.test(ua)
            ? 'Chrome'
            : /Safari\//.test(ua)
              ? 'Safari'
              : 'Other';
  const device_type = /iPad|Tablet/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua))
    ? 'tablet'
    : /Mobi|iPhone|iPod|Android/.test(ua)
      ? 'mobile'
      : 'desktop';
  return { os, browser, device_type };
}

const str = (v: unknown, max = 64) => (typeof v === 'string' ? v.slice(0, max) : null);

/** Keep only small primitive props. */
function cleanProps(p: unknown): string | null {
  if (!p || typeof p !== 'object') return null;
  const out: Record<string, string | number | boolean> = {};
  let n = 0;
  for (const [k, v] of Object.entries(p as Record<string, unknown>)) {
    if (n++ >= 12 || !/^[a-z]{1,16}$/i.test(k)) continue;
    if (typeof v === 'string') out[k] = v.slice(0, 200);
    else if (typeof v === 'number' && isFinite(v)) out[k] = v;
    else if (typeof v === 'boolean') out[k] = v;
  }
  return Object.keys(out).length ? JSON.stringify(out) : null;
}

interface Batch {
  d: string;
  s: string;
  internal?: boolean;
  meta?: { standalone?: boolean; ui?: string; lang?: string; v?: string };
  events: { n: string; t: number; v?: number; p?: Record<string, unknown> }[];
}

export async function handleIngest(request: Request, env: AnalyticsEnv): Promise<Response> {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!env.DB) return new Response(null, { status: 204 }); // analytics not configured
  const text = await request.text();
  if (text.length > 32_000) return new Response('Too large', { status: 413 });
  let b: Batch;
  try {
    b = JSON.parse(text) as Batch;
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }
  if (!ID_RE.test(b?.d ?? '') || !ID_RE.test(b?.s ?? '') || !Array.isArray(b.events)) {
    return new Response('Bad batch', { status: 400 });
  }

  const now = Date.now();
  const ua = request.headers.get('User-Agent') ?? '';
  const cf = (request as Request & { cf?: Record<string, unknown> }).cf ?? {};
  const { os, browser, device_type } = parseUA(ua);
  const isBot = BOT_RE.test(ua) || !ua ? 1 : 0;
  const m = b.meta ?? {};

  const events = b.events
    .filter((e) => e && EVENT_NAMES.has(e.n))
    .slice(0, 100)
    .map((e) => ({
      // Trust the client clock only within a sane window.
      ts: Math.min(now, Math.max(now - 7 * 86_400_000, Number(e.t) || now)),
      name: e.n,
      value: typeof e.v === 'number' && isFinite(e.v) ? Math.max(0, Math.min(e.v, 86_400)) : null,
      props: cleanProps(e.p),
    }));
  if (!events.length) return new Response(null, { status: 204 });

  await ensureSchema(env.DB);
  const db = env.DB;
  const stmts = [
    db
      .prepare(
        `INSERT INTO devices (id, first_seen, last_seen, country, region, city, timezone, os, browser, device_type,
           standalone, lang, ui_lang, app_version, is_bot, is_internal)
         VALUES (?1, ?2, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)
         ON CONFLICT(id) DO UPDATE SET
           last_seen = MAX(last_seen, ?2), country = ?3, region = ?4, city = ?5, timezone = ?6,
           os = ?7, browser = ?8, device_type = ?9, standalone = ?10, lang = ?11, ui_lang = ?12,
           app_version = ?13, is_bot = MAX(is_bot, ?14), is_internal = ?15`,
      )
      .bind(
        b.d,
        now,
        str(cf.country, 2),
        str(cf.region),
        str(cf.city),
        str(cf.timezone),
        os,
        browser,
        device_type,
        m.standalone ? 1 : 0,
        str(m.lang, 16),
        str(m.ui, 8),
        str(m.v, 40),
        isBot,
        b.internal ? 1 : 0,
      ),
    ...events.map((e) =>
      db
        .prepare('INSERT INTO events (device_id, session_id, ts, name, value, props) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(b.d, b.s, e.ts, e.name, e.value, e.props),
    ),
  ];
  await db.batch(stmts);
  return new Response(null, { status: 204 });
}

// ---------------- stats (dashboard) ----------------

/** Caller must have verified the admin session. */
export async function handleStats(request: Request, env: AnalyticsEnv): Promise<Response> {
  if (!env.DB) return json({ error: 'D1 database binding DB is not configured' }, 503);
  await ensureSchema(env.DB);
  const db = env.DB;

  const url = new URL(request.url);
  const days = Math.min(365, Math.max(1, Number(url.searchParams.get('days')) || 30));
  // Minutes east of UTC, so daily buckets follow the viewer's day (e.g. 420 for WIB).
  const tz = Math.min(840, Math.max(-720, Number(url.searchParams.get('tz')) || 0));
  const organic = url.searchParams.get('all') !== '1';
  const now = Date.now();
  const since = now - days * 86_400_000;
  const since7 = now - 7 * 86_400_000;
  const dev = organic ? 'd.is_bot = 0 AND d.is_internal = 0' : '1 = 1';
  const dayExpr = `date((e.ts / 1000) + ${tz * 60}, 'unixepoch')`;

  const q = <T>(sql: string, ...args: unknown[]) =>
    db
      .prepare(sql)
      .bind(...args)
      .all<T>()
      .then((r) => r.results);
  const one = async <T>(sql: string, ...args: unknown[]) => (await q<T>(sql, ...args))[0];

  const breakdown = (col: string) =>
    q<{ k: string | null; n: number }>(
      `SELECT ${col} AS k, COUNT(*) AS n FROM devices d WHERE d.last_seen >= ? AND ${dev} GROUP BY k ORDER BY n DESC LIMIT 12`,
      since,
    );
  const propBreakdown = (name: string, path: string) =>
    q<{ k: string | null; n: number }>(
      `SELECT json_extract(e.props, '${path}') AS k, COUNT(*) AS n FROM events e JOIN devices d ON d.id = e.device_id
       WHERE e.ts >= ? AND e.name = ? AND ${dev} GROUP BY k ORDER BY n DESC LIMIT 12`,
      since,
      name,
    );

  const [daily, newDaily, kpi, kpi7, totals, excluded, countries, cities, os, browsers, deviceTypes, standalone, uiLang, versions, pages, playSources, reciters, errors] =
    await Promise.all([
      q<{ day: string; active: number; sessions: number; listen: number | null }>(
        `SELECT ${dayExpr} AS day, COUNT(DISTINCT e.device_id) AS active, COUNT(DISTINCT e.session_id) AS sessions,
           SUM(CASE WHEN e.name = 'listen' THEN e.value END) AS listen
         FROM events e JOIN devices d ON d.id = e.device_id WHERE e.ts >= ? AND ${dev} GROUP BY day ORDER BY day`,
        since,
      ),
      q<{ day: string; n: number }>(
        `SELECT date((d.first_seen / 1000) + ${tz * 60}, 'unixepoch') AS day, COUNT(*) AS n FROM devices d
         WHERE d.first_seen >= ? AND ${dev} GROUP BY day`,
        since,
      ),
      one<{ active: number; sessions: number; listen: number | null; plays: number }>(
        `SELECT COUNT(DISTINCT e.device_id) AS active, COUNT(DISTINCT e.session_id) AS sessions,
           SUM(CASE WHEN e.name = 'listen' THEN e.value END) AS listen,
           SUM(CASE WHEN e.name = 'play' THEN 1 ELSE 0 END) AS plays
         FROM events e JOIN devices d ON d.id = e.device_id WHERE e.ts >= ? AND ${dev}`,
        since,
      ),
      one<{ active: number }>(
        `SELECT COUNT(DISTINCT e.device_id) AS active FROM events e JOIN devices d ON d.id = e.device_id
         WHERE e.ts >= ? AND ${dev}`,
        since7,
      ),
      one<{ devices: number; installed: number; newDevices: number }>(
        `SELECT COUNT(*) AS devices, SUM(d.standalone) AS installed,
           SUM(CASE WHEN d.first_seen >= ? THEN 1 ELSE 0 END) AS newDevices
         FROM devices d WHERE ${dev}`,
        since,
      ),
      one<{ bots: number; internal: number }>(
        `SELECT SUM(is_bot) AS bots, SUM(CASE WHEN is_internal = 1 AND is_bot = 0 THEN 1 ELSE 0 END) AS internal FROM devices`,
      ),
      breakdown('d.country'),
      breakdown("COALESCE(d.city, '?') || ', ' || COALESCE(d.country, '?')"),
      breakdown('d.os'),
      breakdown('d.browser'),
      breakdown('d.device_type'),
      breakdown("CASE d.standalone WHEN 1 THEN 'Installed app' ELSE 'Browser' END"),
      breakdown('d.ui_lang'),
      breakdown('d.app_version'),
      propBreakdown('page', '$.p'),
      propBreakdown('play', '$.src'),
      propBreakdown('open', '$.reciter'),
      q<{ ts: number; msg: string | null; os: string; browser: string; app_version: string }>(
        `SELECT e.ts, json_extract(e.props, '$.m') AS msg, d.os, d.browser, d.app_version
         FROM events e JOIN devices d ON d.id = e.device_id WHERE e.name = 'error' AND e.ts >= ? AND ${dev}
         ORDER BY e.ts DESC LIMIT 20`,
        since,
      ),
    ]);

  return json({
    generatedAt: now,
    days,
    organic,
    kpi: {
      activeDevices: kpi?.active ?? 0,
      active7: kpi7?.active ?? 0,
      newDevices: totals?.newDevices ?? 0,
      totalDevices: totals?.devices ?? 0,
      installed: totals?.installed ?? 0,
      sessions: kpi?.sessions ?? 0,
      listenMinutes: Math.round(((kpi?.listen ?? 0) / 60) * 10) / 10,
      plays: kpi?.plays ?? 0,
      excludedBots: excluded?.bots ?? 0,
      excludedInternal: excluded?.internal ?? 0,
    },
    daily: daily.map((r) => ({
      day: r.day,
      active: r.active,
      sessions: r.sessions,
      listenMinutes: Math.round(((r.listen ?? 0) / 60) * 10) / 10,
      newDevices: newDaily.find((x) => x.day === r.day)?.n ?? 0,
    })),
    breakdowns: { countries, cities, os, browsers, deviceTypes, standalone, uiLang, versions, pages, playSources, reciters },
    errors,
  });
}
