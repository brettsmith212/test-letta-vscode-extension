import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['./test/**/*.test.ts', './test/**/*.test.ts.new'],
    exclude: ['**/node_modules/**', '**/out/**'],
    environment: 'node',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'istanbul',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      exclude: [
        '**/node_modules/**',
        '**/out/**',
        '**/test/**',
        '**/*.d.ts',
        'webviews/**',
      ],
    },
  },
});