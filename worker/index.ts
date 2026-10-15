import { handleLogin, handleLogout, isAdmin, type AuthEnv } from './admin-auth';
import { handleIngest, handleStats } from './analytics';
import { handleAudio } from './audio';

interface Env extends AuthEnv {
  ASSETS: { fetch(request: Request): Promise<Response> };
}

const json = (data: unknown, status: number) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith('/audio/')) return handleAudio(request, ctx);
    try {
      if (pathname === '/api/e') return await handleIngest(request, env);
      if (pathname === '/api/login') return await handleLogin(request, env);
      if (pathname === '/api/logout') return handleLogout(request);
      if (pathname === '/api/stats') {
        if (!(await isAdmin(request, env))) return json({ error: 'unauthorized' }, 401);
        return await handleStats(request, env);
      }
    } catch (e) {
      console.error('api error', e);
      return json({ error: 'server error' }, 500);
    }
    if (pathname.startsWith('/api/')) return new Response('Not found', { status: 404 });
    return env.ASSETS.fetch(request);
  },
};
