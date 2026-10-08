import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', '.bench-dist', 'node_modules', 'coverage', 'android', 'ios', 'resources'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { rules: { '@typescript-eslint/no-explicit-any': 'error' } },
  // Build/test scripts run in Node but also evaluate code inside the browser page.
  {
    files: ['scripts/**/*.mjs', 'agents/**/*.mjs', 'audio-src/**/*.mjs', 'art-src/**/*.mjs'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
);
