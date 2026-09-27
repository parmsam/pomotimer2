import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/pomotimer2/',
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
});
