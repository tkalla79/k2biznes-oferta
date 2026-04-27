import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts', '**/*.test.tsx'],
    exclude: ['**/node_modules/**', '**/.next/**'],
    coverage: {
      reporter: ['text', 'lcov'],
      include: ['lib/**/*.ts', 'lib/**/*.tsx'],
      exclude: ['**/*.test.ts', '**/*.test.tsx', '**/types.ts'],
    },
  },
  // JSX automatic runtime — bez tego email templates rzucają "React is not defined".
  esbuild: {
    jsx: 'automatic',
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
      '@k2/database': resolve(__dirname, '../../packages/database'),
    },
  },
});
