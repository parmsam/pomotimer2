import { animate } from 'animejs';
import { createQuoteRotation, parseCustomQuotes, parseQuotesMarkdown, type Quote } from '../core/quotes';
import type { Store } from '../core/store';
import type { AppData, Settings } from '../core/types';
import { reducedMotion } from '../fx/anims';
import defaultMd from '../content/quotes.md?raw';

/** Optional quote under the timer. Changes when a new session starts, never mid-session. */
export function createQuoteView(settings: Store<Settings>, data: Store<AppData>) {
  const fig = document.getElementById('quote')!;
  const text = fig.querySelector('blockquote')!;
  const cite = fig.querySelector('figcaption')!;
  const defaults = parseQuotesMarkdown(defaultMd);

  let rotation = createQuoteRotation(defaults);
  let current: Quote | null = null;

  function list(s: Settings): Quote[] {
    if (s.quoteSource === 'custom') {
      const mine = parseCustomQuotes(s.customQuotes);
      if (mine.length) return mine;
    }
    return defaults;
  }

  function show(q: Quote | null, animated: boolean) {
    current = q;
    fig.hidden = !settings.get().showQuotes || !q;
    if (fig.hidden || !q) return;
    const apply = () => {
      text.textContent = q.text;
      cite.textContent = q.author ? `— ${q.author}` : '';
      cite.title = q.source ?? '';
    };
    if (!animated || reducedMotion()) return apply();
    animate(fig, {
      opacity: [1, 0],
      duration: 250,
      ease: 'in(2)',
      onComplete: () => {
        apply();
        animate(fig, { opacity: [0, 1], y: [6, 0], duration: 600, ease: 'out(3)' });
      },
    });
  }

  const next = (animated: boolean) => show(rotation.next(), animated);

  settings.subscribe((s, prev) => {
    if (s.quoteSource !== prev.quoteSource || s.customQuotes !== prev.customQuotes) {
      rotation = createQuoteRotation(list(s));
      next(false);
    } else if (s.showQuotes !== prev.showQuotes) {
      if (s.showQuotes && !current) next(true);
      else show(current, s.showQuotes);
    }
  });
  // A new session (mode change) gets a new quote.
  data.subscribe((d, prev) => {
    if (d.timer.mode !== prev.timer.mode) next(true);
  });

  rotation = createQuoteRotation(list(settings.get()));
  next(false);
}
