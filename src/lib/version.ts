declare const __APP_VERSION__: string;
/** Build version (commit + build time), injected by vite.config.ts. */
export const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';
