/**
 * Pop-out mini timer: a small always-on-top window (Document Picture-in-Picture,
 * Chromium only) that mirrors the clock and drives the real timer.
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
}

const R = 44;
const C = 2 * Math.PI * R;
const THEME_VARS = ['--bg', '--bg2', '--text', '--on-accent', '--mode', '--muted', '--faint', '--surface', '--border'];

const STYLES = `
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; }
  body {
    display: grid; place-items: center;
    font-family: 'Outfit', system-ui, sans-serif; color: var(--text);
    background: radial-gradient(120% 90% at 50% 0%, var(--bg2), var(--bg) 70%);
    -webkit-font-smoothing: antialiased;
  }
  .mini { display: flex; flex-direction: column; align-items: center; gap: 10px; }
  .dial { position: relative; width: 132px; height: 132px; display: grid; place-items: center; }
  svg { position: absolute; inset: 0; width: 100%; height: 100%; }
  .track { fill: none; stroke: var(--faint); stroke-width: 6; }
  .prog { fill: none; stroke: var(--mode); stroke-width: 7; stroke-linecap: round; stroke-dasharray: ${C}; }
  .time { font-size: 30px; font-weight: 300; font-variant-numeric: tabular-nums; }
  .label { font-size: 12px; color: var(--muted); }
  .row { display: flex; gap: 8px; }
  button {
    font: 600 13px 'Outfit', system-ui, sans-serif; letter-spacing: .05em; text-transform: uppercase;
    border: 0; border-radius: 999px; padding: 8px 18px; cursor: pointer;
  }
  .toggle { color: var(--on-accent); background: var(--mode); min-width: 92px; }
  .skip { color: var(--text); background: var(--surface); border: 1px solid var(--border); }
`;

export function createPip(deps: { getState(): PipState; toggle(): void; skip(): void; onClose(): void }) {
  let win: Window | null = null;
  let els: { time: HTMLElement; label: HTMLElement; prog: SVGCircleElement; toggle: HTMLButtonElement } | null = null;

  function syncTheme() {
    if (!win) return;
    const css = getComputedStyle(document.documentElement);
    for (const v of THEME_VARS) win.document.documentElement.style.setProperty(v, css.getPropertyValue(v));
  }

  function update() {
    if (!els) return;
    const s = deps.getState();
    if (els.time.textContent !== s.time) els.time.textContent = s.time;
    els.label.textContent = s.label;
    els.prog.style.strokeDashoffset = String(C * (1 - Math.min(1, Math.max(0, s.progress))));
    els.toggle.textContent = s.running ? 'Pause' : 'Start';
  }

  async function open() {
    const pip = api();
    if (!pip || win) return;
    win = await pip.requestWindow({ width: 240, height: 250 });
    const doc = win.document;
    doc.title = 'pomo';
    const style = doc.createElement('style');
    style.textContent = STYLES;
    const font = doc.createElement('link');
    font.rel = 'stylesheet';
    font.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600&display=swap';
    doc.head.append(font, style);
    doc.body.innerHTML = `
      <main class="mini">
        <div class="dial">
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <circle class="track" cx="50" cy="50" r="${R}"/>
            <circle class="prog" cx="50" cy="50" r="${R}" transform="rotate(-90 50 50)"/>
          </svg>
          <div class="time" role="timer"></div>
        </div>
        <div class="label"></div>
        <div class="row"><button class="toggle" type="button"></button><button class="skip" type="button" aria-label="Skip">Skip</button></div>
      </main>`;
    els = {
      time: doc.querySelector('.time')!,
      label: doc.querySelector('.label')!,
      prog: doc.querySelector('.prog')!,
      toggle: doc.querySelector('.toggle')!,
    };
    els.toggle.addEventListener('click', deps.toggle);
    doc.querySelector('.skip')!.addEventListener('click', deps.skip);
    doc.addEventListener('keydown', (e) => {
      if (e.key === ' ') {
        e.preventDefault();
        deps.toggle();
      }
    });
    win.addEventListener('pagehide', () => {
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
  };
}
