import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['./test/**/*.test.ts', './test/**/*.test.ts.new'],
    exclude: ['**/node_modules/**', '**/out/**'],
    environment: 'node',
    globals: true,
  },
});