import { FACES, type Face, type FaceContext, type FaceEvent, type FaceId } from '../faces';

/**
 * Pop-out mini timer: a small always-on-top window (Document Picture-in-Picture,
 * Chromium only) showing the same clock face as the page and driving the real timer.
 */
interface DocumentPictureInPicture {
  requestWindow(opts?: { width?: number; height?: number }): Promise<Window>;
  window: Window | null;
}
const api = () => (window as Window & { documentPictureInPicture?: DocumentPictureInPicture }).documentPictureInPicture;
export const pipSupported = () => !!api();

export interface PipState {
  time: string;
  label: string;
  /** Share of the session remaining, 1 → 0. */
  progress: number;
  running: boolean;
  face: FaceId;
  context: FaceContext;
}

// Layout for the small window; everything else (faces, theme) comes from the page's own CSS.
const PIP_STYLES = `
  html, body { margin: 0; height: 100%; }
  body { display: grid; place-items: center; overflow: hidden; }
  .pip-mini { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 10px; }
  .pip-mini .dial { width: min(86vw, calc(100vh - 78px)); }
  .pip-mini .time { font-size: 19cqw; }
  .pip-mini .sub { font-size: 5cqw; margin-top: 4px; }
  /* No room below the device in the small window; its screen already shows the mode. */
  .pip-mini .dial[data-face='handheld'] .sub { display: none; }
  .pip-mini .row { display: flex; align-items: center; gap: 10px; }
  .pip-mini .primary { min-width: 96px; padding: 9px 18px; font-size: 0.8rem; }
  .pip-mini .icon-btn { width: 36px; height: 36px; }
  .pip-mini .icon-btn svg { width: 17px; height: 17px; }
`;

const SKIP_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 4 10 8-10 8V4Z"/><path d="M19 5v14"/></svg>';

/** Copies the page's stylesheets (inline and linked, incl. fonts) into another document. */
function copyStyles(doc: Document) {
  doc.head.querySelectorAll('[data-copied]').forEach((n) => n.remove());
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const style = doc.createElement('style');
      style.textContent = Array.from(sheet.cssRules, (r) => r.cssText).join('\n');
      style.dataset.copied = '';
      doc.head.append(style);
    } catch {
      // Cross-origin sheet (e.g. Google Fonts): link to it instead.
      if (!sheet.href) continue;
      const link = doc.createElement('link');
      link.rel = 'stylesheet';
      link.href = sheet.href;
      link.dataset.copied = '';
      doc.head.append(link);
    }
  }
  const pip = doc.createElement('style');
  pip.textContent = PIP_STYLES;
  pip.dataset.copied = '';
  doc.head.append(pip);
}

export function createPip(deps: { getState(): PipState; toggle(): void; skip(): void; onClose(): void }) {
  let win: Window | null = null;
  let face: Face | null = null;
  let els: { dial: HTMLElement; layer: HTMLElement; time: HTMLElement; sub: HTMLElement; toggle: HTMLButtonElement } | null = null;

  /** Theme tokens live as inline custom properties + data attributes on the page root. */
  function syncTheme() {
    if (!win) return;
    const src = document.documentElement;
    const dst = win.document.documentElement;
    dst.style.cssText = src.style.cssText;
    for (const k of ['mode', 'scheme'] as const) {
      if (src.dataset[k]) dst.dataset[k] = src.dataset[k];
    }
  }

  function mountFace(id: FaceId, ctx: FaceContext) {
    if (!els) return;
    face?.unmount();
    face = (FACES[id] ?? FACES.ring)();
    els.dial.dataset.face = face.id;
    face.mount(els.layer, ctx);
    if (win) copyStyles(win.document); // a face may have loaded a font since the window opened
  }

  function update() {
    if (!els || !win) return;
    const s = deps.getState();
    if (face?.id !== s.face) mountFace(s.face, s.context);
    if (els.time.textContent !== s.time) els.time.textContent = s.time;
    if (els.sub.textContent !== s.label) els.sub.textContent = s.label;
    els.toggle.textContent = s.running ? 'Pause' : 'Start';
    const mode = document.documentElement.dataset.mode;
    if (mode && win.document.documentElement.dataset.mode !== mode) syncTheme();
    face?.setProgress(Math.min(1, Math.max(0, s.progress)), s.context);
  }

  async function open() {
    const pip = api();
    if (!pip || win) return;
    win = await pip.requestWindow({ width: 280, height: 330 });
    const doc = win.document;
    doc.title = 'pomo';
    copyStyles(doc);
    doc.body.innerHTML = `
      <main class="pip-mini">
        <div class="dial">
          <div class="face-layer" aria-hidden="true"></div>
          <div class="dial-center">
            <div class="time" role="timer"></div>
            <div class="sub"></div>
          </div>
        </div>
        <div class="row">
          <button class="primary pip-toggle" type="button"></button>
          <button class="icon-btn pip-skip" type="button" aria-label="Skip">${SKIP_ICON}</button>
        </div>
      </main>`;
    els = {
      dial: doc.querySelector('.dial')!,
      layer: doc.querySelector('.face-layer')!,
      time: doc.querySelector('.time')!,
      sub: doc.querySelector('.sub')!,
      toggle: doc.querySelector('.pip-toggle')!,
    };
    els.toggle.addEventListener('click', deps.toggle);
    doc.querySelector('.pip-skip')!.addEventListener('click', deps.skip);
    doc.addEventListener('keydown', (e) => {
      if (e.key === ' ') {
        e.preventDefault();
        deps.toggle();
      }
    });
    win.addEventListener('pagehide', () => {
      face?.unmount();
      face = null;
      win = null;
      els = null;
      deps.onClose();
    });
    syncTheme();
    update();
  }

  return {
    open,
    close: () => win?.close(),
    toggle: () => (win ? win.close() : void open()),
    isOpen: () => win !== null,
    update,
    syncTheme,
    /** Mirror face moments (wind-up, celebration…) in the pop-out. */
    event: (e: FaceEvent) => face?.event?.(e, deps.getState().context),
  };
}
