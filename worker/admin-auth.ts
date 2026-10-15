// Admin login for the analytics dashboard.
//
// - The password is checked against a PBKDF2-SHA256 hash stored in the
//   ADMIN_PASSWORD_HASH secret (generate it with `npm run admin:password`).
//   PBKDF2 runs natively in Workers (WebCrypto), so a check fits the Free
//   plan's 10 ms CPU limit; strength comes from a long random password plus
//   rate limiting rather than from a slow hash.
// - On success the browser gets a signed, HttpOnly session cookie (7 days).
//   Sessions are signed with a key derived from the hash, so changing the
//   password logs every session out.
// - Failed attempts are rate-limited per (hashed) IP using D1.

import { ensureSchema, type AnalyticsEnv } from './analytics';

export interface AuthEnv extends AnalyticsEnv {
  ADMIN_PASSWORD_HASH?: string;
}

const COOKIE = 'qm_admin';
const SESSION_DAYS = 7;
const MAX_FAILS = 5;
const FAIL_WINDOW_MS = 15 * 60_000;
// Format: pbkdf2_sha256$<iterations>$<salt base64url>$<hash base64url>
const HASH_RE = /^pbkdf2_sha256\$(\d{3,6})\$([A-Za-z0-9_-]{16,})\$([A-Za-z0-9_-]{43})$/;
const MAX_ITERATIONS = 100_000; // Workers' PBKDF2 limit

const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  });

const enc = new TextEncoder();
const b64url = (buf: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}

async function sha256(data: string): Promise<string> {
  return b64url(await crypto.subtle.digest('SHA-256', enc.encode(data)));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function configured(env: AuthEnv): string | null {
  const h = env.ADMIN_PASSWORD_HASH?.trim();
  const m = h ? HASH_RE.exec(h) : null;
  return m && Number(m[1]) <= MAX_ITERATIONS ? h! : null;
}

const fromB64url = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [, iter, salt, expected] = HASH_RE.exec(stored)!;
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromB64url(salt), iterations: Number(iter) },
    key,
    256,
  );
  return timingSafeEqual(b64url(bits), expected);
}

function readCookie(request: Request, name: string): string | null {
  const m = (request.headers.get('Cookie') ?? '').match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? m[1] : null;
}

function cookieHeader(request: Request, value: string, maxAge: number): string {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE}=${value}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

/** True if the request carries a valid, unexpired admin session cookie. */
export async function isAdmin(request: Request, env: AuthEnv): Promise<boolean> {
  const hash = configured(env);
  const raw = readCookie(request, COOKIE);
  if (!hash || !raw) return false;
  const [exp, sig] = raw.split('.');
  if (!exp || !sig || !(Number(exp) > Date.now())) return false;
  return timingSafeEqual(sig, await hmac(hash, `admin:${exp}`));
}

export async function handleLogin(request: Request, env: AuthEnv): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const hash = configured(env);
  if (!hash) {
    return json({ error: 'Admin password is not set up. Run `npm run admin:password`, then `npx wrangler secret put ADMIN_PASSWORD_HASH`.' }, 503);
  }
  let password = '';
  try {
    password = String(((await request.json()) as { password?: unknown }).password ?? '');
  } catch {
    return json({ error: 'Bad request' }, 400);
  }
  if (!password || password.length > 200) return json({ error: 'Wrong password' }, 401);

  // Rate limit by a hash of the client IP (the raw IP is never stored).
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const ipKey = await sha256(`${hash.split('$')[2]}|${ip}`);
  const db = env.DB;
  if (db) {
    await ensureSchema(db);
    const since = Date.now() - FAIL_WINDOW_MS;
    const row = await db
      .prepare('SELECT COUNT(*) AS n FROM login_attempts WHERE ip_key = ? AND ts >= ?')
      .bind(ipKey, since)
      .first<{ n: number }>();
    if ((row?.n ?? 0) >= MAX_FAILS) {
      return json({ error: 'Too many attempts. Try again in 15 minutes.' }, 429, { 'Retry-After': '900' });
    }
  }

  const ok = await verifyPassword(password, hash);
  if (!ok) {
    if (db) {
      await db.batch([
        db.prepare('INSERT INTO login_attempts (ip_key, ts) VALUES (?, ?)').bind(ipKey, Date.now()),
        db.prepare('DELETE FROM login_attempts WHERE ts < ?').bind(Date.now() - 24 * 3_600_000),
      ]);
    }
    return json({ error: 'Wrong password' }, 401);
  }
  if (db) await db.prepare('DELETE FROM login_attempts WHERE ip_key = ?').bind(ipKey).run();

  const exp = Date.now() + SESSION_DAYS * 86_400_000;
  const value = `${exp}.${await hmac(hash, `admin:${exp}`)}`;
  return json({ ok: true }, 200, { 'Set-Cookie': cookieHeader(request, value, SESSION_DAYS * 86_400) });
}

export function handleLogout(request: Request): Response {
  return json({ ok: true }, 200, { 'Set-Cookie': cookieHeader(request, '', 0) });
}
