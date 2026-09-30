import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Not `?raw`: Vitest's CSS handling turns that import into an empty string.
const css = readFileSync('src/styles.css', 'utf8');

describe('styles.css', () => {
  it('is actually loaded', () => {
    expect(css.length).toBeGreaterThan(1000);
  });

  it('never pivots SVG artwork around pixel coordinates', () => {
    // Safari (and Firefox in some cases) place px transform-origins wrongly once an SVG is
    // scaled: this caused the offset progress ring and the wobbling hamster wheel. Use
    // `transform-box: fill-box` with percentages/keywords, or SVG transform attributes.
    const offenders = css.match(/transform-origin:\s*-?\d+(\.\d+)?px[^;]*;/g) ?? [];
    expect(offenders).toEqual([]);
    expect(css).not.toMatch(/transform-box:\s*view-box/);
  });

  it('keeps text fields at 16px+ on iOS, which zooms into smaller ones on focus', () => {
    // Playwright's WebKit isn't iOS, so the e2e test can't reach this branch.
    const block = css.match(/@supports \(-webkit-touch-callout: none\) \{([^}]*)\}/)?.[1] ?? '';
    for (const el of ['input', 'textarea', 'select']) expect(block).toMatch(new RegExp(`\\b${el}\\b`));
    expect(block).toMatch(/font-size:\s*max\(16px, 1em\) !important/);
  });
});
