import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/.next/**'],
    coverage: {
      reporter: ['text', 'lcov'],
      include: ['lib/**/*.ts'],
      exclude: ['**/*.test.ts', '**/types.ts'],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
      '@k2/database': resolve(__dirname, '../../packages/database'),
    },
  },
});
