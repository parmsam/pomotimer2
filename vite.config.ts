import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
  base: '/pomotimer2/',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  test: {
    environment: 'jsdom',
    // A zone with DST so date logic is tested across clock changes (CI runs in UTC).
    env: { TZ: 'America/New_York' },
    include: ['src/**/*.test.ts'],
  },
});
