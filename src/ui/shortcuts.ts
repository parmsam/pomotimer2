import { animate } from 'animejs';
import { reducedMotion } from '../fx/anims';

export interface Shortcut {
  /** Keys as shown in the cheat sheet, e.g. ['Space'] or ['1', '2', '3']. */
  keys: string[];
  label: string;
  group: 'Timer' | 'Tasks' | 'General';
  /** Matches `event.key` (case-insensitive). Omit for display-only entries handled elsewhere. */
  match?: (key: string) => boolean;
  run?: (e: KeyboardEvent) => void;
  /** Also fire while the settings drawer is open (e.g. to close it). */
  inSettings?: boolean;
}

const GROUPS: Shortcut['group'][] = ['Timer', 'Tasks', 'General'];

export interface ShortcutsHelp {
  open(): void;
  close(): void;
  toggle(): void;
  isOpen(): boolean;
}

/** Cheat-sheet overlay generated from the same table that drives the key handler. */
export function createShortcutsHelp(shortcuts: Shortcut[]): ShortcutsHelp {
  let backdrop: HTMLElement | null = null;
  let prevFocus: HTMLElement | null = null;

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape' || e.key === '?') {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === 'Tab') {
      e.preventDefault(); // only one focusable control
    }
  }

  function build(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'dialog-backdrop';
    el.innerHTML = `
      <div class="dialog shortcuts" role="dialog" aria-modal="true" aria-labelledby="sc-title">
        <header class="shortcuts-head">
          <h2 id="sc-title">Keyboard shortcuts</h2>
          <button class="icon-sm" type="button" aria-label="Close">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </header>
        <div class="shortcuts-body"></div>
      </div>`;
    const body = el.querySelector('.shortcuts-body')!;
    for (const group of GROUPS) {
      const items = shortcuts.filter((s) => s.group === group);
      if (!items.length) continue;
      const section = document.createElement('section');
      const h = document.createElement('h3');
      h.textContent = group;
      const dl = document.createElement('dl');
      for (const s of items) {
        const dt = document.createElement('dt');
        s.keys.forEach((k, i) => {
          if (i) dt.append(' ');
          const kbd = document.createElement('kbd');
          kbd.textContent = k;
          dt.append(kbd);
        });
        const dd = document.createElement('dd');
        dd.textContent = s.label;
        dl.append(dt, dd);
      }
      section.append(h, dl);
      body.append(section);
    }
    el.querySelector('.shortcuts-head button')!.addEventListener('click', close);
    el.addEventListener('pointerdown', (e) => {
      if (e.target === el) close();
    });
    return el;
  }

  function open() {
    if (backdrop) return;
    prevFocus = document.activeElement as HTMLElement | null;
    backdrop = build();
    document.body.append(backdrop);
    document.addEventListener('keydown', onKey, true);
    backdrop.querySelector<HTMLElement>('.shortcuts-head button')!.focus();
    if (!reducedMotion()) {
      animate(backdrop, { opacity: [0, 1], duration: 220, ease: 'out(2)' });
      animate(backdrop.querySelector('.dialog')!, { scale: [0.94, 1], y: [12, 0], opacity: [0, 1], duration: 450, ease: 'out(4)' });
      animate(backdrop.querySelectorAll('.shortcuts-body section'), { y: [10, 0], opacity: [0, 1], delay: (_?: unknown, i = 0) => 80 + i * 60, duration: 400, ease: 'out(3)' });
    }
  }

  function close() {
    const el = backdrop;
    if (!el) return;
    backdrop = null;
    document.removeEventListener('keydown', onKey, true);
    el.style.pointerEvents = 'none';
    prevFocus?.focus();
    if (reducedMotion()) return el.remove();
    animate(el, { opacity: 0, duration: 180, ease: 'in(2)', onComplete: () => el.remove() });
  }

  return { open, close, toggle: () => (backdrop ? close() : open()), isOpen: () => backdrop !== null };
}

const isTyping = (t: HTMLElement) =>
  !!t.closest('textarea, select, [contenteditable="true"]') ||
  (t instanceof HTMLInputElement && !['checkbox', 'radio', 'range', 'button', 'color'].includes(t.type));

/**
 * Global key handling. Shortcuts are skipped while typing, while a modal is open, and
 * (unless marked `inSettings`) while the settings drawer is open.
 */
export function bindShortcuts(
  shortcuts: Shortcut[],
  state: { modalOpen: () => boolean; settingsOpen: () => boolean; popoverOpen: () => boolean },
) {
  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented || state.modalOpen() || state.popoverOpen()) return;
    const target = e.target as HTMLElement;
    if (isTyping(target)) return;
    const key = e.key.toLowerCase();
    const s = shortcuts.find((x) => x.match?.(key));
    if (!s?.run) return;
    if (state.settingsOpen() && !s.inSettings) return;
    s.run(e);
  });
}
