import { handleAudio } from './audio';

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith('/audio/')) return handleAudio(request, ctx);
    return env.ASSETS.fetch(request);
  },
};
