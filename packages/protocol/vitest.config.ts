import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@tretta/rules': fileURLToPath(new URL('../rules/src/index.ts', import.meta.url)),
    },
  },
});
