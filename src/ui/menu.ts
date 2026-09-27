import { animate } from 'animejs';
import { reducedMotion } from '../fx/anims';

export interface MenuItem {
  label: string;
  run: () => void;
}

let openMenu: { el: HTMLElement; close: () => void } | null = null;
export const menuOpen = () => openMenu !== null;

/** Small dropdown anchored to a button, with arrow-key navigation. */
export function attachMenu(button: HTMLButtonElement, items: () => MenuItem[]) {
  button.setAttribute('aria-haspopup', 'menu');
  button.setAttribute('aria-expanded', 'false');

  button.addEventListener('click', () => {
    if (openMenu) return openMenu.close();
    const el = document.createElement('div');
    el.className = 'menu';
    el.setAttribute('role', 'menu');
    const buttons = items().map((item) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'menuitem');
      b.textContent = item.label;
      b.addEventListener('click', () => {
        close();
        item.run();
      });
      el.append(b);
      return b;
    });
    button.parentElement!.append(el);
    button.setAttribute('aria-expanded', 'true');

    const onKey = (e: KeyboardEvent) => {
      const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close();
        button.focus();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        const next = (i + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
        buttons[next].focus();
      } else if (e.key === 'Tab') {
        close();
      }
    };
    const onPointer = (e: PointerEvent) => {
      if (!el.contains(e.target as Node) && e.target !== button && !button.contains(e.target as Node)) close();
    };
    function close() {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', onPointer, true);
      button.setAttribute('aria-expanded', 'false');
      openMenu = null;
      el.remove();
    }
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onPointer, true);
    openMenu = { el, close };
    buttons[0]?.focus();
    if (!reducedMotion()) animate(el, { opacity: [0, 1], y: [-6, 0], duration: 220, ease: 'out(3)' });
  });
}
