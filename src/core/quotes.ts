export interface Quote {
  text: string;
  author: string;
  /** Where it's from, e.g. a book, speech or letter. */
  source?: string;
}

/**
 * Parses the default quotes file: one Markdown blockquote per quote, attribution on a
 * final line starting with an em dash:
 *
 *   > The first principle is that you must not fool yourself.
 *   > — Richard Feynman, *Cargo Cult Science* (1974)
 */
export function parseQuotesMarkdown(md: string): Quote[] {
  const quotes: Quote[] = [];
  let block: string[] = [];
  const flush = () => {
    if (!block.length) return;
    const attrIndex = block.findIndex((l) => /^(—|--)\s*/.test(l));
    const textLines = attrIndex === -1 ? block : block.slice(0, attrIndex);
    const text = textLines.join(' ').replace(/\s+/g, ' ').trim();
    const attr = attrIndex === -1 ? '' : block[attrIndex].replace(/^(—|--)\s*/, '').trim();
    const [author, ...rest] = attr.split(',');
    const source = rest.join(',').replace(/\*/g, '').trim();
    if (text && author?.trim()) quotes.push({ text, author: author.trim(), ...(source ? { source } : {}) });
    block = [];
  };
  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith('>')) block.push(line.replace(/^>\s?/, ''));
    else flush();
  }
  flush();
  return quotes;
}

/** The user's own quotes: one per line, optionally "text — author" (or " - author"). */
export function parseCustomQuotes(text: string): Quote[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^(.*?)\s+(?:—|–|-{1,2})\s+([^—–-][^—–]*)$/);
      const body = (m ? m[1] : line).replace(/^["“]|["”]$/g, '').trim();
      return { text: body, author: m ? m[2].trim() : '' };
    })
    .filter((q) => q.text);
}

/**
 * Hands out quotes in a shuffled order with no repeats until the list is used up,
 * and never the same quote twice in a row across reshuffles.
 */
export function createQuoteRotation(quotes: Quote[], random: () => number = Math.random) {
  let bag: number[] = [];
  let last = -1;
  const refill = () => {
    bag = quotes.map((_, i) => i);
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    if (bag.length > 1 && bag[bag.length - 1] === last) [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
  };
  return {
    next(): Quote | null {
      if (!quotes.length) return null;
      if (!bag.length) refill();
      last = bag.pop()!;
      return quotes[last];
    },
  };
}
