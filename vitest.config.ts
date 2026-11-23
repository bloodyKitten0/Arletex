import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/**/*.test.ts', 'packages/**/__tests__/**/*.ts', 'tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json'],
    },
    testTimeout: 30000,
    hookTimeout: 30000,
    // globalSetup runs ONCE in the main process – avoids EADDRINUSE race across workers
    globalSetup: ['./tests/setup/globalSetup.ts'],
    // setupFiles removed – server is started globally above
  },
  resolve: {
    alias: {
      '@arletex/contracts': path.resolve(__dirname, './packages/contracts/src'),
      '@arletex/core': path.resolve(__dirname, './packages/core/src'),
      '@arletex/database': path.resolve(__dirname, './packages/database/src'),
      '@arletex/inference': path.resolve(__dirname, './packages/inference/src'),
    },
  },
});
