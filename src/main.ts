import './themes/tokens.css';
import './styles.css';

import { playAlarm, playTick, unlockAudio } from './core/audio';
import { notify } from './core/notify';
import { clearAll, defaultAppData, DEFAULT_SETTINGS, loadAppData, loadSettings, write } from './core/storage';
import { createStore, persist } from './core/store';
import { createTimer } from './core/timer';
import { MODE_LABELS, type Mode } from './core/types';
import { celebrate, driftBlobs, entrance, press, slidePill, swapText } from './fx/anims';
import { applyTheme } from './themes/presets';
import { dialogOpen } from './ui/dialog';
import { createInterruptionLogger } from './ui/interruptions';
import { createSessionActions } from './ui/sessionActions';
import { createSettingsPanel } from './ui/settingsPanel';
import { createTasksPanel } from './ui/tasks';
import { createTimerView, formatTime } from './ui/timerView';

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

// ---- State
const settings = createStore(loadSettings());
const data = createStore(loadAppData(settings.get()));
persist(settings, (s) => write('settings', s));
persist(data, (d) => write('data', d));

// ---- Elements
const root = document.documentElement;
const toggleBtn = $('#toggle');
const toggleLabel = $('.primary-label');
const subEl = $('#sub');
const cycleEl = $('#cycle');
const liveEl = $('#live');
const pill = $('.mode-pill');
const modeTabs = [...document.querySelectorAll<HTMLButtonElement>('.modes button')];
const view = createTimerView($('.dial'), () => settings.get().rollingDigits);

const COMPLETE_MESSAGES: Record<Mode, string> = {
  focus: 'Nice work — time for a break.',
  short: 'Break’s over — back to focus.',
  long: 'Recharged. Ready for the next round?',
};

// ---- Timer
const timer = createTimer(data, settings, ({ finished, next, missed, early }) => {
  if (!missed && !early) {
    const s = settings.get();
    playAlarm(s.alarm, s.volume);
    celebrate($('#burst'), $('.dial'));
    if (s.notifications) notify(`${MODE_LABELS[finished]} complete`, COMPLETE_MESSAGES[finished]);
  } else if (early) {
    celebrate($('#burst'), $('.dial'));
  }
  liveEl.textContent = `${MODE_LABELS[finished]} complete. Next: ${MODE_LABELS[next]}.`;
});

// ---- Rendering
function renderMode(instant = false) {
  const { mode } = data.get().timer;
  root.dataset.mode = mode;
  modeTabs.forEach((b) => b.setAttribute('aria-selected', String(b.dataset.mode === mode)));
  slidePill(pill, modeTabs.find((b) => b.dataset.mode === mode)!, instant);
}

const strictStop = () => settings.get().strictMode && data.get().timer.mode === 'focus' && data.get().timer.status === 'running';

function renderStatus() {
  const { status, mode, cycleCount } = data.get().timer;
  const label = strictStop() ? 'Stop' : status === 'running' ? 'Pause' : status === 'paused' ? 'Resume' : 'Start';
  swapText(toggleLabel, label);
  toggleBtn.setAttribute('aria-label', `${label} (Space)`);

  const round = cycleCount + (mode === 'focus' ? 1 : 0);
  const task = data.get().tasks.find((x) => x.id === data.get().activeTaskId);
  const sub =
    mode === 'focus'
      ? `#${Math.max(1, round)} · ${task ? task.title : status === 'running' ? 'Stay with it' : 'Time to focus'}`
      : mode === 'short'
        ? 'Stretch, sip, breathe'
        : 'Step away for a while';
  swapText(subEl, sub);
}

function renderCycle() {
  const every = settings.get().longBreakEvery;
  const done = data.get().timer.cycleCount % every;
  if (cycleEl.children.length !== every) {
    cycleEl.replaceChildren(...Array.from({ length: every }, () => document.createElement('span')));
  }
  [...cycleEl.children].forEach((d, i) => d.classList.toggle('done', i < done));
  cycleEl.setAttribute('aria-label', `${done} of ${every} focus sessions until long break`);
}

let lastSecond = -1;
function renderTitle(remaining: number) {
  const { mode, status } = data.get().timer;
  document.title =
    settings.get().titleCountdown && status !== 'idle'
      ? `${formatTime(remaining)} · ${MODE_LABELS[mode]}${status === 'paused' ? ' (paused)' : ''}`
      : 'pomo';
}

// Smooth ring + digits; rAF pauses in hidden tabs, which is fine for visuals.
function frame() {
  if (data.get().timer.status === 'running') view.render(timer.remaining(), timer.duration());
  requestAnimationFrame(frame);
}

// Per-second work (title, tick) must keep going in background tabs, so it uses an interval.
function secondTick() {
  const remaining = timer.remaining();
  const second = Math.ceil(remaining / 1000);
  if (second === lastSecond) return;
  lastSecond = second;
  renderTitle(remaining);
  tasks.tick();
  const s = settings.get();
  const { status, mode } = data.get().timer;
  if (s.tick && status === 'running' && mode === 'focus' && remaining > 0) playTick(s.volume);
}

// Timer state transitions drive the animated renders.
data.subscribe((d, prev) => {
  const t = d.timer;
  const p = prev.timer;
  if (t.mode !== p.mode) renderMode();
  if (t.status !== p.status || t.mode !== p.mode || t.cycleCount !== p.cycleCount || d.activeTaskId !== prev.activeTaskId || d.tasks !== prev.tasks) {
    renderStatus();
    renderCycle();
  }
  // Mode change, reset, or completion: animate the ring back to full.
  if (t.status === 'idle' && (p.status !== 'idle' || t.mode !== p.mode || t.remainingMs !== p.remainingMs)) {
    view.refill(t.remainingMs, timer.duration());
  }
  if (t.status === 'paused') renderTitle(timer.remaining());
});

settings.subscribe((s, prev) => {
  if (s.theme !== prev.theme || s.accent !== prev.accent) applyTheme(s.theme, s.accent);
  if (s.longBreakEvery !== prev.longBreakEvery) renderCycle();
  if (s.strictMode !== prev.strictMode) renderStatus();
  if (s.durations !== prev.durations && data.get().timer.status !== 'idle') view.render(timer.remaining(), timer.duration());
  renderTitle(timer.remaining());
});

// ---- Controls
const panel = createSettingsPanel(settings, () => {
  clearAll();
  settings.set(structuredClone(DEFAULT_SETTINGS));
  data.set(defaultAppData(settings.get()));
});

const actions = createSessionActions(data, timer);
const tasks = createTasksPanel(data, settings, timer);
const interruptions = createInterruptionLogger(data, timer, (title) => tasks.add(title));

toggleBtn.addEventListener('click', () => {
  unlockAudio();
  press(toggleBtn);
  if (strictStop()) actions.reset('Stop');
  else timer.toggle();
});
$('#reset').addEventListener('click', (e) => {
  press(e.currentTarget as HTMLElement);
  void actions.reset();
});
$('#skip').addEventListener('click', (e) => {
  press(e.currentTarget as HTMLElement);
  void actions.skip();
});
modeTabs.forEach((b) => b.addEventListener('click', () => void actions.switchTo(b.dataset.mode as Mode)));
$('#tasks-toggle').addEventListener('click', () => tasks.toggleVisible());

document.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey || dialogOpen()) return;
  if (e.key === 'Escape' && panel.isOpen()) return panel.close();
  const target = e.target as HTMLElement;
  if (panel.isOpen() || interruptions.isOpen() || target.closest('input, select, textarea')) return;
  const key = e.key.toLowerCase();
  if (key === ' ' && !target.closest('button')) {
    e.preventDefault();
    toggleBtn.click();
  } else if (key === 'r') $('#reset').click();
  else if (key === 's') $('#skip').click();
  else if (key === ',') panel.open();
  else if (key === 't') tasks.toggleVisible();
  else if (key === 'n') {
    e.preventDefault();
    tasks.focusInput();
  } else if (key === 'i') interruptions.open();
});

window.addEventListener('resize', () => renderMode(true));

// ---- Boot
applyTheme(settings.get().theme, settings.get().accent);
renderMode(true);
renderStatus();
renderCycle();
view.render(timer.remaining(), timer.duration());
driftBlobs();
entrance();
document.fonts?.ready.then(() => renderMode(true));
requestAnimationFrame(frame);
setInterval(secondTick, 200);
