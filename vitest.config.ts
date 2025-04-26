import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['./test/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/out/**'],
    environment: 'node',
    globals: true,
  },
});