import './themes/tokens.css';
import './styles.css';

import { playAlarm, playTick, unlockAudio } from './core/audio';
import { formatTime } from './core/format';
import { notify } from './core/notify';
import { clearAll, defaultAppData, DEFAULT_SETTINGS, loadAppData, loadSettings, write } from './core/storage';
import { createStore, persist } from './core/store';
import { createTimer } from './core/timer';
import { MODE_LABELS, type Mode } from './core/types';
import { celebrate, driftBlobs, entrance, press, slidePill, swapText } from './fx/anims';
import { applyTheme } from './themes/presets';
import { backupFilename, makeBackup, parseBackup } from './core/backup';
import { dayKey } from './core/stats';
import { breakTip } from './core/tips';
import { onceAcrossTabs, syncAcrossTabs } from './core/sync';
import { ask, dialogOpen } from './ui/dialog';
import { createFocusMode } from './ui/focusMode';
import { createStatsView } from './ui/stats';
import { bindShortcuts, createShortcutsHelp, type Shortcut } from './ui/shortcuts';
import { toast } from './ui/toast';
import { createInterruptionLogger } from './ui/interruptions';
import { createSessionActions } from './ui/sessionActions';
import { createSettingsPanel } from './ui/settingsPanel';
import { createTasksPanel } from './ui/tasks';
import { createTimerView } from './ui/timerView';

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

// ---- State
const settings = createStore(loadSettings());
const data = createStore(loadAppData(settings.get()));
persist(settings, (s) => write('settings', s));
persist(data, (d) => write('data', d));
syncAcrossTabs(settings, data);

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
    // With several tabs open, only one rings and notifies.
    onceAcrossTabs('pomo-session-end', () => {
      if (!s.muted) playAlarm(s.alarm, s.volume);
      if (s.notifications) notify(`${MODE_LABELS[finished]} complete`, COMPLETE_MESSAGES[finished]);
    });
    celebrate($('#burst'), $('.dial'));
  } else if (early) {
    celebrate($('#burst'), $('.dial'));
  }
  if (finished === 'focus') queueMicrotask(checkGoal);
  liveEl.textContent = `${MODE_LABELS[finished]} complete. Next: ${MODE_LABELS[next]}.`;
});

function checkGoal() {
  const { goal } = stats.current();
  const today = dayKey(Date.now());
  if (!goal.reached || data.get().goalCelebratedOn === today) return;
  data.set({ goalCelebratedOn: today });
  toast(`Daily goal reached — ${goal.done} pomodoros today 🎉`, { duration: 5000 });
  setTimeout(() => celebrate($('#burst'), $('.dial')), 450);
}

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
      : breakTip(mode, data.get().history.length);
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
  stats.refresh();
  const s = settings.get();
  const { status, mode } = data.get().timer;
  if (s.tick && !s.muted && status === 'running' && mode === 'focus' && remaining > 0) playTick(s.volume);
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
  if (t.status === 'paused') {
    renderTitle(timer.remaining());
    // e.g. a paused session restored from a backup or synced from another tab
    if (p.status !== 'paused' || t.remainingMs !== p.remainingMs) view.refill(t.remainingMs, timer.duration());
  }
});

settings.subscribe((s, prev) => {
  if (s.theme !== prev.theme || s.modeColors !== prev.modeColors) applyTheme(s.theme, s.modeColors);
  if (s.longBreakEvery !== prev.longBreakEvery) renderCycle();
  if (s.strictMode !== prev.strictMode) renderStatus();
  if (s.durations !== prev.durations && data.get().timer.status !== 'idle') view.render(timer.remaining(), timer.duration());
  renderTitle(timer.remaining());
});

// ---- Controls
const panel = createSettingsPanel(settings, {
  resetAll() {
    clearAll();
    settings.set(structuredClone(DEFAULT_SETTINGS));
    data.set(defaultAppData(settings.get()));
    toast('Everything has been reset');
  },
  exportBackup() {
    const blob = new Blob([JSON.stringify(makeBackup(settings.get(), data.get()), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = backupFilename();
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('Backup downloaded');
  },
  async importBackup(file) {
    let backup: ReturnType<typeof parseBackup>;
    try {
      backup = parseBackup(await file.text());
    } catch (err) {
      toast((err as Error).message, { duration: 5000 });
      return;
    }
    const when = backup.exportedAt ? new Date(backup.exportedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'an unknown date';
    const focusCount = backup.data.history.filter((h) => h.mode === 'focus' && !h.abandoned).length;
    const r = await ask({
      title: 'Replace your data with this backup?',
      body: `Backup from ${when}: ${backup.data.tasks.length} tasks and ${focusCount} pomodoros. Your current settings, tasks and history will be replaced.`,
      confirm: 'Replace',
      danger: true,
    });
    if (r !== 'confirm') return;
    settings.set(backup.settings);
    data.set(backup.data);
    toast('Backup restored');
  },
});

const actions = createSessionActions(data, timer);
const stats = createStatsView(data, settings, timer);
const focusMode = createFocusMode(data, settings, () => renderMode(true));
const tasks = createTasksPanel(data, settings, timer);
const interruptions = createInterruptionLogger(data, settings, timer, (title) => tasks.add(title));

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

const toggleMute = () => {
  const muted = !settings.get().muted;
  settings.set({ muted });
  toast(muted ? 'Sound off' : 'Sound on');
};

// One table drives both the key handling and the "?" cheat sheet.
const SHORTCUTS: Shortcut[] = [
  {
    keys: ['Space'],
    label: 'Start / pause',
    group: 'Timer',
    match: (k) => k === ' ',
    run: (e) => {
      if ((e.target as HTMLElement).closest('button')) return; // let a focused button handle its own Space
      e.preventDefault();
      toggleBtn.click();
    },
  },
  { keys: ['R'], label: 'Restart session', group: 'Timer', match: (k) => k === 'r', run: () => $('#reset').click() },
  { keys: ['S'], label: 'Skip to next session', group: 'Timer', match: (k) => k === 's', run: () => $('#skip').click() },
  {
    keys: ['1', '2', '3'],
    label: 'Focus / short break / long break',
    group: 'Timer',
    match: (k) => k === '1' || k === '2' || k === '3',
    run: (e) => void actions.switchTo((['focus', 'short', 'long'] as Mode[])[Number(e.key) - 1]),
  },
  { keys: ['I'], label: 'Log an interruption (when tracking is on)', group: 'Timer', match: (k) => k === 'i', run: () => interruptions.open() },
  { keys: ['G'], label: 'Progress, streak & goal', group: 'General', match: (k) => k === 'g', run: () => stats.open() },
  { keys: ['T'], label: 'Show / hide tasks', group: 'Tasks', match: (k) => k === 't', run: () => tasks.toggleVisible() },
  {
    keys: ['N'],
    label: 'New task',
    group: 'Tasks',
    match: (k) => k === 'n',
    run: (e) => {
      e.preventDefault();
      tasks.focusInput();
    },
  },
  // Handled by the task list itself when a task has focus:
  { keys: ['↑', '↓'], label: 'Move between tasks (↓ from the new-task field)', group: 'Tasks' },
  { keys: ['Enter'], label: 'Make it the current task', group: 'Tasks' },
  { keys: ['X'], label: 'Mark done / not done', group: 'Tasks' },
  { keys: ['E'], label: 'Edit', group: 'Tasks' },
  { keys: ['Del'], label: 'Delete', group: 'Tasks' },
  { keys: ['Alt', '↑/↓'], label: 'Reorder', group: 'Tasks' },
  { keys: ['F'], label: 'Focus mode (hide everything but the timer)', group: 'General', match: (k) => k === 'f', run: () => focusMode.toggle() },
  { keys: ['M'], label: 'Mute / unmute sounds', group: 'General', match: (k) => k === 'm', run: toggleMute },
  { keys: [','], label: 'Open / close settings', group: 'General', inSettings: true, match: (k) => k === ',', run: () => panel.toggle() },
  { keys: ['?'], label: 'Show these shortcuts', group: 'General', inSettings: true, match: (k) => k === '?', run: () => openHelp() },
  { keys: ['Esc'], label: 'Close any panel or dialog', group: 'General' },
];

const help = createShortcutsHelp(SHORTCUTS);
const openHelp = () => {
  if (panel.isOpen()) panel.close();
  help.open();
  if (!settings.get().shortcutsHintSeen) settings.set({ shortcutsHintSeen: true });
};
$('#shortcuts-open').addEventListener('click', openHelp);

// Esc closes settings even from inside one of its inputs, otherwise leaves focus mode.
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || e.defaultPrevented || dialogOpen() || help.isOpen() || stats.isOpen() || interruptions.isOpen()) return;
  if (panel.isOpen()) panel.close();
  else if (focusMode.isOn()) focusMode.exit();
});
bindShortcuts(SHORTCUTS, {
  modalOpen: () => dialogOpen() || help.isOpen() || interruptions.isOpen() || stats.isOpen(),
  settingsOpen: () => panel.isOpen(),
  popoverOpen: () => false,
});

// First visit on a device with a keyboard: point people at the cheat sheet once.
if (!settings.get().shortcutsHintSeen && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
  setTimeout(() => {
    if (settings.get().shortcutsHintSeen) return;
    toast('Tip: press ? to see keyboard shortcuts', {
      duration: 9000,
      action: { label: 'Show', run: openHelp },
      onDismiss: () => settings.set({ shortcutsHintSeen: true }),
    });
  }, 2500);
}

// Tab widths change with fonts, window size and the per-tab counts; keep the pill aligned.
new ResizeObserver(() => renderMode(true)).observe(document.querySelector('.modes')!);
modeTabs.forEach((b) => new ResizeObserver(() => renderMode(true)).observe(b));

// ---- Boot
$('.app-version').textContent = `v${__APP_VERSION__}`;
applyTheme(settings.get().theme, settings.get().modeColors);
renderMode(true);
renderStatus();
renderCycle();
view.render(timer.remaining(), timer.duration());
driftBlobs();
entrance();
requestAnimationFrame(frame);
setInterval(secondTick, 200);
