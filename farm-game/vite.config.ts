import { defineConfig } from 'vitest/config';
import { offlineServiceWorker } from './scripts/sw-plugin.mjs';

export default defineConfig({
  base: './',
  plugins: [offlineServiceWorker()],
  build: {
    chunkSizeWarningLimit: 2000,
    // Phaser is ~90% of the bytes and rarely changes: its own chunk lets returning players
    // re-download only the small game chunk after an update.
    rollupOptions: {
      output: {
        manualChunks: (id: string) => (id.includes('node_modules/phaser') ? 'phaser' : undefined),
      },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      // The rules layer is the part that must be proven; scenes/UI are covered by `npm run e2e`.
      include: [
        'src/systems/**',
        'src/state/**',
        'src/data/**',
        'src/input/InputHub.ts',
        'src/ui/daylight.ts',
      ],
      reporter: ['text-summary', 'text'],
    },
  },
});
