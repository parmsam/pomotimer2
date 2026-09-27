import { describe, expect, it } from 'vitest';
import { createQuoteRotation, parseCustomQuotes, parseQuotesMarkdown } from './quotes';

describe('parseQuotesMarkdown', () => {
  it('reads blockquotes with em-dash attributions, joining wrapped lines', () => {
    const md = `# Quotes

Some intro text that isn't a quote.

> The first principle is that you must not fool yourself —
> and you are the easiest person to fool.
> — Richard Feynman, *Cargo Cult Science* (1974)

> Nothing in life is to be feared, it is only to be understood.
> — Marie Curie

> No attribution here is skipped.
`;
    expect(parseQuotesMarkdown(md)).toEqual([
      {
        text: 'The first principle is that you must not fool yourself — and you are the easiest person to fool.',
        author: 'Richard Feynman',
        source: 'Cargo Cult Science (1974)',
      },
      { text: 'Nothing in life is to be feared, it is only to be understood.', author: 'Marie Curie' },
    ]);
  });

  it('keeps commas inside the source', () => {
    expect(parseQuotesMarkdown('> Hi.\n> — Ann Author, *A Book*, ch. 2 (1999)')[0].source).toBe('A Book, ch. 2 (1999)');
  });
});

describe('parseCustomQuotes', () => {
  it('reads one per line with an optional author', () => {
    expect(parseCustomQuotes('Ship it. — Me\n\n“Small steps” - Mom\nJust keep going\nWell-being matters')).toEqual([
      { text: 'Ship it.', author: 'Me' },
      { text: 'Small steps', author: 'Mom' },
      { text: 'Just keep going', author: '' },
      { text: 'Well-being matters', author: '' },
    ]);
  });
});

describe('createQuoteRotation', () => {
  const qs = ['a', 'b', 'c', 'd'].map((t) => ({ text: t, author: 'x' }));

  it('shows every quote before repeating any', () => {
    const r = createQuoteRotation(qs);
    const first = new Set(Array.from({ length: 4 }, () => r.next()!.text));
    expect(first.size).toBe(4);
  });

  it('never repeats the same quote back to back across reshuffles', () => {
    const r = createQuoteRotation(qs);
    let prev = '';
    for (let i = 0; i < 400; i++) {
      const q = r.next()!.text;
      expect(q).not.toBe(prev);
      prev = q;
    }
  });

  it('handles empty and single-quote lists', () => {
    expect(createQuoteRotation([]).next()).toBeNull();
    const one = createQuoteRotation([qs[0]]);
    expect([one.next()!.text, one.next()!.text]).toEqual(['a', 'a']);
  });
});
