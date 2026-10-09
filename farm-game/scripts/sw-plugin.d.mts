import type { Plugin } from 'vite';

export function offlineServiceWorker(publicDir?: string): Plugin;
export function serviceWorkerSource(built: string[], publicDir: string): string;
