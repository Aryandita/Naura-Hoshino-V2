import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['dashboard/tests/**/*.test.{js,mjs}'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['dashboard/src/**/*.{js,mjs}'],
      exclude: ['**/*.test.js', '**/vendor/**']
    },
    setupFiles: ['./dashboard/tests/setup.js']
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './dashboard/src'),
      '@components': path.resolve(__dirname, './dashboard/src/components'),
      '@js': path.resolve(__dirname, './dashboard/src/js')
    }
  }
});
