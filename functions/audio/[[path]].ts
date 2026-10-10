// Cloudflare Pages Function — same audio proxy as the Worker, for Pages deployments.
import { handleAudio } from '../../worker/audio';

export const onRequest = (context: { request: Request; waitUntil(p: Promise<unknown>): void }) =>
  handleAudio(context.request, context);
