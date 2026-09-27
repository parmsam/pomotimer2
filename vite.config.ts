import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/pomotimer2/',
  test: {
    environment: 'jsdom',
    // A zone with DST so date logic is tested across clock changes (CI runs in UTC).
    env: { TZ: 'America/New_York' },
    include: ['src/**/*.test.ts'],
  },
});
