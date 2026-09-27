import { describe, expect, it } from 'vitest';
import { parseQuotesMarkdown } from '../core/quotes';
import md from './quotes.md?raw';

const quotes = parseQuotesMarkdown(md);

describe('default quotes (src/content/quotes.md)', () => {
  it('has about a hundred quotes', () => {
    expect(quotes.length).toBeGreaterThanOrEqual(95);
  });

  it('every quote has text, an author and a source', () => {
    for (const q of quotes) {
      expect(q.text.length, JSON.stringify(q)).toBeGreaterThan(5);
      expect(q.author.length, JSON.stringify(q)).toBeGreaterThan(2);
      expect(q.source?.length ?? 0, `${q.author}: "${q.text}" needs a source`).toBeGreaterThan(2);
    }
  });

  it('has no duplicates', () => {
    const seen = new Set<string>();
    for (const q of quotes) {
      const key = q.text.toLowerCase().replace(/[^a-z]/g, '');
      expect(seen.has(key), `duplicate: ${q.text}`).toBe(false);
      seen.add(key);
    }
  });

  it('keeps quotes short enough to read at a glance', () => {
    for (const q of quotes) expect(q.text.length, q.text).toBeLessThanOrEqual(220);
  });

  it('leaves out well-known misattributions', () => {
    const text = quotes.map((q) => q.text.toLowerCase()).join('\n');
    for (const bad of [
      'we are what we repeatedly do', // Will Durant, not Aristotle
      'insanity is doing the same thing', // not Einstein
      'dressed in overalls', // not reliably Edison
      'it does not matter how slowly you go', // not Confucius
      'the time you enjoy wasting',
    ]) {
      expect(text).not.toContain(bad);
    }
  });
});
