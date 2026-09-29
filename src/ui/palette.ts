import { animate } from 'animejs';
import { matchCommand } from '../core/commands';
import { reducedMotion } from '../fx/anims';

export interface PaletteCommand {
  id: string;
  title: string;
  group: string;
  /** Extra words that find this command but aren't shown, e.g. "toggle sound noise". */
  keywords?: string;
  /** Keyboard shortcut shown on the right. */
  keys?: string[];
  /** Marks the option that's in effect now (current theme, face, ...). */
  current?: boolean;
  run(): void;
}

export interface Palette {
  open(): void;
  close(): void;
  toggle(): void;
  isOpen(): boolean;
}

const MAX_RESULTS = 60;
const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';

/** Titles with the matched letters wrapped in <mark>. */
function highlight(title: string, indices: number[]): DocumentFragment {
  const frag = document.createDocumentFragment();
  const hit = new Set(indices);
  let run = '';
  let marked = false;
  const flush = () => {
    if (!run) return;
    if (marked) {
      const m = document.createElement('mark');
      m.textContent = run;
      frag.append(m);
    } else frag.append(run);
    run = '';
  };
  [...title].forEach((ch, i) => {
    if (hit.has(i) !== marked) {
      flush();
      marked = hit.has(i);
    }
    run += ch;
  });
  flush();
  return frag;
}

/**
 * Cmd/Ctrl+K command palette: fuzzy search over every command, plus commands built from
 * what's typed (e.g. "start 50m focus"), which are listed first.
 */
export function createPalette(opts: { commands: () => PaletteCommand[]; parse: (query: string) => PaletteCommand[] }): Palette {
  let backdrop: HTMLElement | null = null;
  let prevFocus: HTMLElement | null = null;
  let results: PaletteCommand[] = [];
  let active = 0;
  let input!: HTMLInputElement;
  let list!: HTMLUListElement;

  function search(query: string): { cmd: PaletteCommand; indices: number[] }[] {
    const parsed = opts.parse(query).map((cmd) => ({ cmd, indices: [] }));
    const all = opts.commands();
    if (!query.trim()) return [...parsed, ...all.map((cmd) => ({ cmd, indices: [] }))];
    const scored = all
      .map((cmd, order) => ({ cmd, order, m: matchCommand(query, cmd.title, `${cmd.group} ${cmd.keywords ?? ''}`) }))
      .filter((x) => x.m !== null)
      .sort((a, b) => b.m!.score - a.m!.score || a.order - b.order)
      .slice(0, MAX_RESULTS)
      .map((x) => ({ cmd: x.cmd, indices: x.m!.indices }));
    return [...parsed, ...scored];
  }

  function render() {
    const found = search(input.value);
    results = found.map((f) => f.cmd);
    active = 0;
    list.replaceChildren(
      ...found.map(({ cmd, indices }, i) => {
        const li = document.createElement('li');
        li.id = `pal-opt-${i}`;
        li.setAttribute('role', 'option');
        li.className = 'pal-option';
        const title = document.createElement('span');
        title.className = 'pal-title';
        title.append(highlight(cmd.title, indices));
        const meta = document.createElement('span');
        meta.className = 'pal-meta';
        if (cmd.current) {
          const check = document.createElement('span');
          check.className = 'pal-current';
          check.innerHTML = `${CHECK}<span class="sr-only">(current)</span>`;
          meta.append(check);
        }
        cmd.keys?.forEach((k) => {
          const kbd = document.createElement('kbd');
          kbd.textContent = k;
          meta.append(kbd);
        });
        const group = document.createElement('small');
        group.textContent = cmd.group;
        meta.append(group);
        li.append(title, meta);
        li.addEventListener('pointermove', () => {
          if (active !== i) setActive(i, false);
        });
        li.addEventListener('click', () => run(i));
        return li;
      }),
    );
    if (!found.length) {
      const empty = document.createElement('li');
      empty.className = 'pal-empty';
      empty.textContent = 'No matching commands';
      list.append(empty);
    }
    setActive(0, true);
  }

  function setActive(i: number, scroll: boolean) {
    const items = list.querySelectorAll<HTMLElement>('.pal-option');
    if (!items.length) {
      input.removeAttribute('aria-activedescendant');
      return;
    }
    active = (i + items.length) % items.length;
    items.forEach((o, k) => o.setAttribute('aria-selected', String(k === active)));
    input.setAttribute('aria-activedescendant', items[active].id);
    if (scroll) items[active].scrollIntoView({ block: 'nearest' });
  }

  function run(i: number) {
    const cmd = results[i];
    if (!cmd) return;
    close();
    cmd.run();
  }

  function onKey(e: KeyboardEvent) {
    const k = e.key;
    if (k === 'Escape' || ((e.metaKey || e.ctrlKey) && k.toLowerCase() === 'k')) {
      if (k === 'Escape' && input.value) {
        input.value = '';
        render();
      } else close();
    } else if (k === 'ArrowDown' || k === 'ArrowUp') {
      setActive(active + (k === 'ArrowDown' ? 1 : -1), true);
    } else if (k === 'Enter') {
      if (e.isComposing) return;
      run(active);
    } else if (k === 'Tab') {
      // focus stays in the search field
    } else return;
    e.preventDefault();
    e.stopPropagation();
  }

  function build(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'dialog-backdrop palette-backdrop';
    el.innerHTML = `
      <div class="dialog palette" role="dialog" aria-modal="true" aria-label="Command palette">
        <div class="pal-search">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>
          <input type="text" role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls="pal-list"
            aria-label="Command" placeholder="Type a command, or “start 50m focus”" autocomplete="off" spellcheck="false" />
        </div>
        <ul id="pal-list" class="pal-list" role="listbox" aria-label="Commands"></ul>
        <footer class="pal-foot" aria-hidden="true">
          <span><kbd>↑</kbd><kbd>↓</kbd> choose</span><span><kbd>Enter</kbd> run</span><span><kbd>Esc</kbd> close</span>
        </footer>
      </div>`;
    input = el.querySelector('input')!;
    list = el.querySelector('ul')!;
    input.addEventListener('input', render);
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
    render();
    document.addEventListener('keydown', onKey, true);
    input.focus();
    if (!reducedMotion()) {
      animate(backdrop, { opacity: [0, 1], duration: 180, ease: 'out(2)' });
      animate(backdrop.querySelector('.dialog')!, { scale: [0.97, 1], y: [-8, 0], opacity: [0, 1], duration: 320, ease: 'out(4)' });
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
    animate(el, { opacity: 0, duration: 140, ease: 'in(2)', onComplete: () => el.remove() });
  }

  return { open, close, toggle: () => (backdrop ? close() : open()), isOpen: () => backdrop !== null };
}
