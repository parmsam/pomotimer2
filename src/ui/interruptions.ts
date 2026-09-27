import { animate } from 'animejs';
import type { Store } from '../core/store';
import type { Timer } from '../core/timer';
import type { AppData, Interruptions } from '../core/types';
import { reducedMotion } from '../fx/anims';

export interface InterruptionLogger {
  open(): void;
  isOpen(): boolean;
}

/**
 * Cirillo-style interruption marks: note whether the pull came from you (internal)
 * or from outside (external), optionally jot it down as a task to handle later,
 * then get back to work.
 */
export function createInterruptionLogger(
  data: Store<AppData>,
  timer: Timer,
  addTask: (title: string) => void,
): InterruptionLogger {
  const wrap = document.getElementById('interrupt')!;
  const btn = wrap.querySelector<HTMLButtonElement>('.interrupt-btn')!;
  const countEl = wrap.querySelector<HTMLElement>('.interrupt-count')!;
  const pop = wrap.querySelector<HTMLElement>('.interrupt-pop')!;
  const note = pop.querySelector<HTMLInputElement>('input')!;

  const isOpen = () => !pop.hidden;

  function close() {
    if (!isOpen()) return;
    const done = () => (pop.hidden = true);
    btn.setAttribute('aria-expanded', 'false');
    if (reducedMotion()) done();
    else animate(pop, { opacity: 0, y: 6, duration: 160, ease: 'in(2)', onComplete: done });
  }

  function open() {
    if (wrap.hidden || isOpen()) return;
    pop.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    note.value = '';
    pop.querySelector<HTMLElement>('[data-kind="internal"]')!.focus();
    if (!reducedMotion()) animate(pop, { opacity: [0, 1], y: [8, 0], scale: [0.97, 1], duration: 380, ease: 'out(3)' });
  }

  function log(kind: keyof Interruptions) {
    timer.interrupt(kind);
    if (note.value.trim()) addTask(note.value);
    close();
    btn.focus();
    if (!reducedMotion()) animate(countEl, { scale: [1.5, 1], duration: 500, ease: 'outElastic(1, .5)' });
  }

  function render() {
    const { mode, status, interruptions } = data.get().timer;
    wrap.hidden = mode !== 'focus' || status === 'idle';
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

  btn.addEventListener('click', () => (isOpen() ? close() : open()));
  pop.querySelectorAll<HTMLButtonElement>('[data-kind]').forEach((b) =>
    b.addEventListener('click', () => log(b.dataset.kind as keyof Interruptions)),
  );
  pop.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
      btn.focus();
    }
  });
  document.addEventListener('pointerdown', (e) => {
    if (isOpen() && !wrap.contains(e.target as Node)) close();
  });

  data.subscribe((d, prev) => {
    if (d.timer !== prev.timer) render();
  });
  render();

  return { open, isOpen };
}
