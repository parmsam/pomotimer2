import { animate } from 'animejs';
import type { Store } from '../core/store';
import type { Timer } from '../core/timer';
import type { AppData, Interruptions, InterruptionNote, Settings } from '../core/types';
import { reducedMotion } from '../fx/anims';

export interface InterruptionLogger {
  open(): void;
  isOpen(): boolean;
}

const uid = () => (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).slice(0, 12);

/**
 * Optional Cirillo-style interruption tracking: mark whether the pull came from you
 * (internal) or from outside (external), optionally jot a note, and get back to work.
 * Notes live in their own "Noted for later" list; you choose whether one becomes a task.
 */
export function createInterruptionLogger(
  data: Store<AppData>,
  settings: Store<Settings>,
  timer: Timer,
  addTask: (title: string) => void,
): InterruptionLogger {
  const wrap = document.getElementById('interrupt')!;
  const btn = wrap.querySelector<HTMLButtonElement>('.interrupt-btn')!;
  const countEl = wrap.querySelector<HTMLElement>('.interrupt-count')!;
  const notesEl = document.getElementById('notes')!;
  const notesList = notesEl.querySelector<HTMLUListElement>('.notes-list')!;

  let backdrop: HTMLElement | null = null;
  let prevFocus: HTMLElement | null = null;

  const isOpen = () => backdrop !== null;

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  }

  function open() {
    if (wrap.hidden || backdrop) return;
    prevFocus = document.activeElement as HTMLElement | null;
    backdrop = document.createElement('div');
    backdrop.className = 'dialog-backdrop light';
    backdrop.innerHTML = `
      <div class="dialog interrupt-dialog" role="dialog" aria-modal="true" aria-labelledby="int-title">
        <h2 id="int-title">What pulled you away?</h2>
        <p>Your timer keeps running. Note it and get back to it.</p>
        <input type="text" maxlength="120" placeholder="Jot it down for later (optional)" aria-label="Note for later" />
        <div class="interrupt-kinds">
          <button type="button" class="btn" data-kind="internal"><strong>Internal</strong><small>My own urge</small></button>
          <button type="button" class="btn" data-kind="external"><strong>External</strong><small>Someone or something</small></button>
        </div>
      </div>`;
    const note = backdrop.querySelector('input')!;
    backdrop.querySelectorAll<HTMLButtonElement>('[data-kind]').forEach((b) =>
      b.addEventListener('click', () => log(b.dataset.kind as keyof Interruptions, note.value)),
    );
    backdrop.addEventListener('pointerdown', (e) => {
      if (e.target === backdrop) close();
    });
    document.addEventListener('keydown', onKey, true);
    document.body.append(backdrop);
    note.focus();
    if (!reducedMotion()) {
      animate(backdrop, { opacity: [0, 1], duration: 200, ease: 'out(2)' });
      animate(backdrop.querySelector('.dialog')!, { scale: [0.94, 1], y: [10, 0], opacity: [0, 1], duration: 420, ease: 'out(4)' });
    }
  }

  function close() {
    const el = backdrop;
    if (!el) return;
    backdrop = null;
    document.removeEventListener('keydown', onKey, true);
    el.style.pointerEvents = 'none';
    (prevFocus?.isConnected ? prevFocus : btn).focus();
    if (reducedMotion()) return el.remove();
    animate(el, { opacity: 0, duration: 180, ease: 'in(2)', onComplete: () => el.remove() });
  }

  function log(kind: keyof Interruptions, text: string) {
    timer.interrupt(kind);
    const clean = text.trim();
    if (clean) data.set((d) => ({ notes: [...d.notes, { id: uid(), at: Date.now(), kind, text: clean }] }));
    close();
    if (!reducedMotion()) animate(countEl, { scale: [1.5, 1], duration: 500, ease: 'outElastic(1, .5)' });
  }

  // ---- Notes list ("Noted for later")

  const removeNote = (id: string) => data.set((d) => ({ notes: d.notes.filter((n) => n.id !== id) }));

  function noteRow(n: InterruptionNote): HTMLLIElement {
    const li = document.createElement('li');
    li.className = 'note';
    const time = new Date(n.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    li.innerHTML = `
      <span class="note-text"></span>
      <span class="note-meta"></span>
      <span class="note-actions">
        <button type="button" class="btn small" data-act="task">→ Task</button>
        <button type="button" class="btn small" data-act="dismiss">Dismiss</button>
      </span>`;
    li.querySelector('.note-text')!.textContent = n.text;
    li.querySelector('.note-meta')!.textContent = `${n.kind === 'internal' ? 'Internal' : 'External'} · ${time}`;
    li.querySelector<HTMLButtonElement>('[data-act="task"]')!.setAttribute('aria-label', `Add “${n.text}” as a task`);
    li.querySelector<HTMLButtonElement>('[data-act="dismiss"]')!.setAttribute('aria-label', `Dismiss “${n.text}”`);
    li.querySelector('[data-act="task"]')!.addEventListener('click', () => {
      addTask(n.text);
      removeNote(n.id);
    });
    li.querySelector('[data-act="dismiss"]')!.addEventListener('click', () => removeNote(n.id));
    return li;
  }

  function renderNotes() {
    const notes = data.get().notes;
    notesEl.hidden = notes.length === 0;
    notesList.replaceChildren(...notes.map(noteRow));
  }

  // ---- Button

  function render() {
    const { mode, status, interruptions } = data.get().timer;
    wrap.hidden = !settings.get().trackInterruptions || mode !== 'focus' || status === 'idle';
    if (wrap.hidden) close();
    const total = interruptions.internal + interruptions.external;
    countEl.textContent = total ? String(total) : '';
    countEl.hidden = total === 0;
    btn.setAttribute(
      'aria-label',
      `Log an interruption (I)${total ? ` — ${interruptions.internal} internal, ${interruptions.external} external so far` : ''}`,
    );
    btn.title = total ? `${interruptions.internal} internal · ${interruptions.external} external` : 'Log an interruption (I)';
  }

  btn.addEventListener('click', open);
  data.subscribe((d, prev) => {
    if (d.timer !== prev.timer) render();
    if (d.notes !== prev.notes) renderNotes();
  });
  settings.subscribe((s, prev) => {
    if (s.trackInterruptions !== prev.trackInterruptions) render();
  });
  render();
  renderNotes();

  return { open, isOpen };
}
