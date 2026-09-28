import { describe, expect, it } from 'vitest';
import css from './styles.css?raw';

describe('styles.css', () => {
  it('never pivots SVG artwork around pixel coordinates', () => {
    // Safari (and Firefox in some cases) place px transform-origins wrongly once an SVG is
    // scaled: this caused the offset progress ring and the wobbling hamster wheel. Use
    // `transform-box: fill-box` with percentages/keywords, or SVG transform attributes.
    const offenders = css.match(/transform-origin:\s*-?\d+(\.\d+)?px[^;]*;/g) ?? [];
    expect(offenders).toEqual([]);
    expect(css).not.toMatch(/transform-box:\s*view-box/);
  });
});
