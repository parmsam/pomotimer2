import { animate } from 'animejs';
import { reducedMotion } from '../fx/anims';

export interface DialogOptions {
  title: string;
  body: string;
  confirm: string;
  /** Optional middle action, e.g. "Count it". */
  secondary?: string;
  cancel?: string;
  danger?: boolean;
}

export type DialogResult = 'confirm' | 'secondary' | 'cancel';

let open: Promise<DialogResult> | null = null;

export const dialogOpen = () => open !== null;

/** Small animated modal; resolves with the chosen action. Esc or backdrop = cancel. */
export function ask(opts: DialogOptions): Promise<DialogResult> {
  if (open) return open;

  const prevFocus = document.activeElement as HTMLElement | null;
  const backdrop = document.createElement('div');
  backdrop.className = 'dialog-backdrop';
  backdrop.innerHTML = `
    <div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dlg-title" aria-describedby="dlg-body">
      <h2 id="dlg-title"></h2>
      <p id="dlg-body"></p>
      <div class="dialog-actions"></div>
    </div>`;
  const box = backdrop.querySelector<HTMLElement>('.dialog')!;
  box.querySelector('h2')!.textContent = opts.title;
  box.querySelector('p')!.textContent = opts.body;
  const actions = box.querySelector('.dialog-actions')!;

  const button = (label: string, cls: string, result: DialogResult) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = cls;
    b.textContent = label;
    b.addEventListener('click', () => close(result));
    actions.append(b);
    return b;
  };

  let resolve!: (r: DialogResult) => void;
  open = new Promise<DialogResult>((r) => (resolve = r));

  const cancelBtn = button(opts.cancel ?? 'Cancel', 'btn', 'cancel');
  if (opts.secondary) button(opts.secondary, 'btn', 'secondary');
  const confirmBtn = button(opts.confirm, opts.danger ? 'btn danger solid' : 'btn solid', 'confirm');

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close('cancel');
    } else if (e.key === 'Tab') {
      // Keep focus inside the dialog.
      const items = [...actions.querySelectorAll<HTMLElement>('button')];
      const i = items.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey && i <= 0) {
        e.preventDefault();
        items[items.length - 1].focus();
      } else if (!e.shiftKey && i === items.length - 1) {
        e.preventDefault();
        items[0].focus();
      }
    }
  }

  function close(result: DialogResult) {
    document.removeEventListener('keydown', onKey, true);
    const done = () => {
      backdrop.remove();
      prevFocus?.focus();
      open = null;
      resolve(result);
    };
    if (reducedMotion()) return done();
    animate(box, { scale: 0.96, opacity: 0, duration: 160, ease: 'in(2)' });
    animate(backdrop, { opacity: 0, duration: 200, ease: 'in(2)', onComplete: done });
  }

  backdrop.addEventListener('pointerdown', (e) => {
    if (e.target === backdrop) close('cancel');
  });
  document.addEventListener('keydown', onKey, true);
  document.body.append(backdrop);
  (opts.danger ? cancelBtn : confirmBtn).focus();

  if (!reducedMotion()) {
    animate(backdrop, { opacity: [0, 1], duration: 220, ease: 'out(2)' });
    animate(box, { scale: [0.92, 1], y: [12, 0], opacity: [0, 1], duration: 500, ease: 'outElastic(1, .7)' });
  }
  return open;
}
