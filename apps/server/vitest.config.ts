import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: [
      {
        find: '@tretta/protocol/shared',
        replacement: fileURLToPath(new URL('../../packages/protocol/src/shared.ts', import.meta.url)),
      },
      {
        find: '@tretta/protocol',
        replacement: fileURLToPath(new URL('../../packages/protocol/src/index.ts', import.meta.url)),
      },
      {
        find: '@tretta/rules',
        replacement: fileURLToPath(new URL('../../packages/rules/src/index.ts', import.meta.url)),
      },
    ],
  },
});
