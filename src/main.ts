import './themes/tokens.css';
import './styles.css';

import { AMBIENT_OPTIONS, createAmbientPlayer } from './core/ambient';
import { audioContext, canPlayThroughSilentMode, playAlarm, playTick, unlockAudio } from './core/audio';
import { buzz, hapticTrigger, setHapticTriggersEnabled, type Buzz } from './core/haptics';
import { formatTime } from './core/format';
import { notify } from './core/notify';
import { clearAll, defaultAppData, DEFAULT_SETTINGS, loadAppData, loadSettings, write } from './core/storage';
import { createStore, persist } from './core/store';
import { createTimer } from './core/timer';
import { MODE_LABELS, type Mode, type SessionRecord, type Settings } from './core/types';
import { removeSession } from './core/history';
import { parseCommand } from './core/commands';
import { createAgentApi } from './core/agentApi';
import { parseUrlAction, stripAction, type UrlAction } from './core/urlActions';
import { celebrate, driftBlobs, entrance, press, slidePill, swapText } from './fx/anims';
import { applyTheme, THEMES } from './themes/presets';
import { FACE_LIST } from './faces';
import { SCENES } from './fx/scenes';
import { backupFilename, makeBackup, parseBackup } from './core/backup';
import { historyToMarkdown, parseTasksMarkdown, tasksToMarkdown } from './core/markdown';
import { dayKey } from './core/stats';
import { copyText, downloadText } from './ui/clipboard';
import { attachMenu, menuOpen } from './ui/menu';
import { importOpen } from './ui/importTasks';
import { breakTip } from './core/tips';
import { onceAcrossTabs, syncAcrossTabs } from './core/sync';
import { ask, dialogOpen } from './ui/dialog';
import { createFocusMode } from './ui/focusMode';
import { setupPwa } from './ui/pwa';
import { createBackground } from './ui/background';
import { createQuoteView } from './ui/quoteView';
import { createProgressFavicon } from './ui/favicon';
import { createPip, pipSupported } from './ui/pip';
import type { FaceContext, FaceEvent } from './faces';
import { createWakeLock } from './ui/wakeLock';
import { attachGestures } from './ui/gestures';
import { createFullscreenButton, fullscreenSupported } from './ui/fullscreen';
import { createPalette, type PaletteCommand } from './ui/palette';
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
/** What a clock face needs to draw itself; shared by the page and the pop-out. */
const faceContext = (): FaceContext => {
  const t = data.get().timer;
  return {
    mode: t.mode,
    status: t.status,
    remainingMs: timer.remaining(),
    durationMs: timer.duration(),
    totalPomodoros: data.get().history.filter((h) => h.mode === 'focus' && !h.abandoned).length,
  };
};
const view = createTimerView($('.dial'), { rollingDigits: () => settings.get().rollingDigits, context: faceContext });
/** Face moments go to the page and, if open, the pop-out. */
const faceEvent = (e: FaceEvent) => {
  view.event(e);
  pip.event(e);
};

const haptic = (kind: Buzz) => settings.get().haptics && buzz(kind);
const favicon = createProgressFavicon();
const wakeLock = createWakeLock();
const pip = createPip({
  getState: () => {
    const t = data.get().timer;
    const task = data.get().tasks.find((x) => x.id === data.get().activeTaskId);
    return {
      time: formatTime(timer.remaining()),
      label: t.mode === 'focus' && task ? task.title : MODE_LABELS[t.mode],
      progress: timer.remaining() / timer.duration(),
      running: t.status === 'running',
      face: settings.get().clockFace,
      context: faceContext(),
    };
  },
  toggle: () => toggleBtn.click(),
  skip: () => $('#skip').click(),
  onClose: () => $('#pip-open').setAttribute('aria-pressed', 'false'),
});
const togglePip = () => {
  if (!pipSupported()) return toast('The pop-out timer works in Chrome and Edge');
  pip.toggle();
  $('#pip-open').setAttribute('aria-pressed', String(!pip.isOpen()));
};

// ---- Ambient sound: plays while a session runs (focus only unless enabled for breaks).
const ambient = createAmbientPlayer();
let ambientPreview: number | undefined;
function syncAmbient() {
  const s = settings.get();
  const t = data.get().timer;
  const wanted = !s.muted && t.status === 'running' && (t.mode === 'focus' || s.ambientOnBreaks) ? s.ambient : 'off';
  if (ambientPreview && wanted === 'off') return; // let a settings preview finish
  ambient.setVolume(s.ambientVolume);
  ambient.play(wanted);
  document.body.dataset.ambient = ambient.playing();
}
function previewAmbient() {
  clearTimeout(ambientPreview);
  const s = settings.get();
  if (s.ambient === 'off' || s.muted) {
    ambientPreview = undefined;
    return syncAmbient();
  }
  ambient.setVolume(s.ambientVolume);
  ambient.play(s.ambient);
  document.body.dataset.ambient = ambient.playing();
  ambientPreview = window.setTimeout(() => {
    ambientPreview = undefined;
    syncAmbient();
  }, 4000);
}

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
      if (!s.muted) playAlarm(s.alarm, s.volume, { ignoreSilentMode: s.alarmIgnoresSilent });
      if (s.notifications) notify(`${MODE_LABELS[finished]} complete`, COMPLETE_MESSAGES[finished]);
    });
    celebrate($('#burst'), $('.dial'));
    haptic('success');
  } else if (early) {
    celebrate($('#burst'), $('.dial'));
  }
  if (finished === 'focus') {
    const rec = data.get().history.at(-1);
    queueMicrotask(() => {
      // The goal toast wins; the session can still be deleted from the progress view.
      if (!checkGoal() && rec && !rec.abandoned) offerUndo(rec, missed);
    });
  }
  queueMicrotask(() => {
    faceEvent('complete');
    if (!missed) background.pulse();
  });
  liveEl.textContent = `${MODE_LABELS[finished]} complete. Next: ${MODE_LABELS[next]}.`;
});

/** A pomodoro that ran by accident can be taken back for a few seconds after it ends. */
function offerUndo(rec: SessionRecord, missed: boolean) {
  toast(missed ? 'A pomodoro finished while you were away' : 'Pomodoro counted', {
    duration: 10_000,
    action: { label: 'Undo', run: () => undoCompletion(rec) },
  });
}

function undoCompletion(rec: SessionRecord) {
  const latest = data.get().history.at(-1)?.endedAt === rec.endedAt;
  // Still on the break that followed it: go back to focus, as if it never ran.
  if (latest && data.get().timer.mode !== 'focus') timer.setMode('focus');
  const removed = removeSession(data.get(), rec);
  if (!removed) return;
  data.set((d) => ({
    history: removed.history,
    tasks: removed.tasks,
    ...(latest ? { timer: { ...d.timer, cycleCount: Math.max(0, d.timer.cycleCount - 1) } } : {}),
  }));
  toast('Pomodoro removed', { duration: 2000 });
}

/** Celebrates the daily goal once per day. True when it showed its toast. */
function checkGoal(): boolean {
  const { goal } = stats.current();
  const today = dayKey(Date.now());
  if (!goal.reached || data.get().goalCelebratedOn === today) return false;
  data.set({ goalCelebratedOn: today });
  if (!settings.get().celebrateGoal) return false;
  toast(`Daily goal reached — ${goal.done} pomodoros today 🎉`, {
    duration: 6000,
    action: {
      label: 'Don’t show again',
      run: () => {
        settings.set({ celebrateGoal: false });
        setTimeout(() => toast('Goal celebrations off. Turn them back on in Settings'), 300);
      },
    },
  });
  setTimeout(() => celebrate($('#burst'), $('.dial')), 450);
  return true;
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
  subEl.title = sub; // full text on hover when a face has to clip it
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
  pip.update();
  requestAnimationFrame(frame);
}

// Per-second work (title, tick) must keep going in background tabs, so it uses an interval.
function secondTick() {
  const remaining = timer.remaining();
  const second = Math.ceil(remaining / 1000);
  if (second === lastSecond) return;
  lastSecond = second;
  renderTitle(remaining);
  const { status } = data.get().timer;
  favicon.update(settings.get().titleCountdown && status !== 'idle' ? remaining / timer.duration() : null);
  tasks.tick();
  stats.refresh();
  const s = settings.get();
  const { mode } = data.get().timer;
  if (s.tick && !s.muted && status === 'running' && mode === 'focus' && remaining > 0) playTick(s.volume);
}

// Timer state transitions drive the animated renders.
data.subscribe((d, prev) => {
  const t = d.timer;
  const p = prev.timer;
  if (t.mode !== p.mode) {
    renderMode();
    faceEvent('mode');
  }
  if (t.status !== p.status || t.mode !== p.mode) {
    lastSecond = -1; // title and tab icon must refresh even if the displayed second didn't change
    syncAmbient();
    wakeLock.set(settings.get().keepAwake && t.status === 'running');
    pip.update();
  }
  if (t.status === 'running' && p.status !== 'running') faceEvent('start');
  if (t.status === 'paused' && p.status === 'running') faceEvent('pause');
  if (d.history.length > prev.history.length && d.history.at(-1)?.abandoned) faceEvent('abandon');
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
  if (s.clockFace !== prev.clockFace) view.setFace(s.clockFace);
  if (s.longBreakEvery !== prev.longBreakEvery) renderCycle();
  if (s.strictMode !== prev.strictMode) renderStatus();
  if (s.haptics !== prev.haptics) setHapticTriggersEnabled(s.haptics);
  if (s.keepAwake !== prev.keepAwake) wakeLock.set(s.keepAwake && data.get().timer.status === 'running');
  if (s.theme !== prev.theme || s.modeColors !== prev.modeColors) setTimeout(() => pip.syncTheme(), 1000);
  if (s.ambient !== prev.ambient) previewAmbient();
  else if (s.ambientVolume !== prev.ambientVolume || s.muted !== prev.muted || s.ambientOnBreaks !== prev.ambientOnBreaks) syncAmbient();
  if (s.durations !== prev.durations && data.get().timer.status !== 'idle') view.render(timer.remaining(), timer.duration());
  renderTitle(timer.remaining());
});

// ---- Controls
const logMarkdown = (days: number | null) =>
  historyToMarkdown({ ...data.get(), now: Date.now(), days, dailyGoal: settings.get().dailyGoal });

const downloadLog = (days: number | null) => {
  downloadText(`pomo-log-${dayKey(Date.now())}${days === null ? '-all' : days === 1 ? '' : `-${days}d`}.md`, logMarkdown(days));
  toast('Log downloaded');
};

const panel = createSettingsPanel(settings, {
  exportLog: downloadLog,
  resetAll() {
    clearAll();
    settings.set(structuredClone(DEFAULT_SETTINGS));
    data.set(defaultAppData(settings.get()));
    toast('Everything has been reset');
  },
  clearHistory() {
    data.set({ history: [], goalCelebratedOn: null });
    toast('History cleared');
  },
  resetSettings() {
    const s = settings.get();
    // Keep what you wrote and the tips you've already dismissed.
    const { customQuotes, mobileTipSeen, gesturesTipSeen, shortcutsHintSeen } = s;
    settings.set({ ...structuredClone(DEFAULT_SETTINGS), customQuotes, mobileTipSeen, gesturesTipSeen, shortcutsHintSeen });
    toast('Settings reset to defaults');
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
const background = createBackground(settings, data);
createQuoteView(settings, data);
const focusMode = createFocusMode(data, settings, () => renderMode(true));
const tasks = createTasksPanel(data, settings, timer);
const interruptions = createInterruptionLogger(data, settings, timer, (title) => tasks.add(title));

// Phones: alarms and background timers are easy to miss. Say so once, when it matters.
function maybeShowMobileTip() {
  const touch = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  if (!touch || settings.get().mobileTipSeen || !settings.get().showTips) return;
  settings.set({ mobileTipSeen: true });
  const standalone = window.matchMedia('(display-mode: standalone)').matches;
  const parts = [
    canPlayThroughSilentMode() ? 'Turn your volume up' : 'Check your volume and silent switch. Silent mode can mute alarms',
    standalone ? 'keep pomo open' : 'keep this tab open (or Add to Home Screen for notifications)',
  ];
  toast(`On phones: ${parts.join(', and ')}.`, { duration: 9000 });
}

toggleBtn.addEventListener('click', () => {
  unlockAudio();
  maybeShowMobileTip();
  haptic('tap');
  press(toggleBtn);
  const t = data.get().timer;
  if (strictStop()) actions.reset('Stop');
  else if (t.mode !== 'focus' && t.status === 'running') void actions.pauseBreak(settings.get().confirmBreakPause);
  else timer.toggle();
});
$('#reset').addEventListener('click', (e) => {
  press(e.currentTarget as HTMLElement);
  haptic('tap');
  void actions.reset();
});
$('#skip').addEventListener('click', (e) => {
  press(e.currentTarget as HTMLElement);
  haptic('tap');
  void actions.skip();
});
attachGestures($('.dial'), {
  toggle: () => toggleBtn.click(),
  reset: () => void actions.reset(),
  switchTo: (mode) => void actions.switchTo(mode),
  currentMode: () => data.get().timer.mode,
  feedback: () => haptic('tap'),
});

modeTabs.forEach((b) =>
  b.addEventListener('click', () => {
    haptic('tap');
    void actions.switchTo(b.dataset.mode as Mode);
  }),
);
// iOS: taps on these land on a hidden switch that plays the system haptic.
[toggleBtn, $('#reset'), $('#skip'), ...modeTabs].forEach(hapticTrigger);
setHapticTriggersEnabled(settings.get().haptics);
$('#tasks-toggle').addEventListener('click', () => tasks.toggleVisible());

const nudgeMinute = (add: boolean) => {
  timer.addTime(add ? 60_000 : -60_000);
  toast(`${add ? '+1' : '−1'} minute · ${formatTime(timer.remaining())}`, { duration: 1500 });
};
const copyTasks = async () => {
  const md = tasksToMarkdown(data.get().tasks);
  if (!md) return toast('No tasks to copy yet');
  toast((await copyText(md)) ? 'Tasks copied as Markdown' : 'Couldn’t copy. Try Download log in Settings');
};
const copyTodayLog = async () => toast((await copyText(logMarkdown(1))) ? 'Today’s log copied' : 'Couldn’t copy. Try Download log in Settings');
const isMac = /Mac|iPhone|iPad/.test(navigator.platform);

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
  {
    keys: ['+', '−'],
    label: 'Add / remove a minute',
    group: 'Timer',
    match: (k) => k === '+' || k === '=' || k === '-',
    run: (e) => nudgeMinute(e.key !== '-'),
  },
  { keys: ['P'], label: 'Pop out a mini timer (Chrome, Edge)', group: 'General', match: (k) => k === 'p', run: () => togglePip() },
  { keys: ['F'], label: 'Focus mode (hide everything but the timer)', group: 'General', match: (k) => k === 'f', run: () => focusMode.toggle() },
  { keys: ['M'], label: 'Mute / unmute sounds', group: 'General', match: (k) => k === 'm', run: toggleMute },
  { keys: [','], label: 'Open / close settings', group: 'General', inSettings: true, match: (k) => k === ',', run: () => panel.toggle() },
  { keys: [isMac ? '⌘' : 'Ctrl', 'K'], label: 'Command palette: search every action', group: 'General' },
  { keys: ['?'], label: 'Show these shortcuts', group: 'General', inSettings: true, match: (k) => k === '?', run: () => openHelp() },
  { keys: ['Esc'], label: 'Close any panel or dialog', group: 'General' },
];

attachMenu($<HTMLButtonElement>('#tasks-menu'), () => [
  { label: 'Copy tasks as Markdown', run: copyTasks },
  { label: 'Copy today’s log', run: copyTodayLog },
  { label: 'Import from Markdown…', run: () => tasks.importMarkdown() },
]);

const help = createShortcutsHelp(SHORTCUTS);
const openHelp = () => {
  if (panel.isOpen()) panel.close();
  help.open();
  if (!settings.get().shortcutsHintSeen) settings.set({ shortcutsHintSeen: true });
};
$('#shortcuts-open').addEventListener('click', openHelp);
const fullscreen = createFullscreenButton($<HTMLButtonElement>('#fullscreen'));
$('#pip-open').hidden = !pipSupported();
$('#pip-open').addEventListener('click', togglePip);

// ---- Command palette
const SETTING_TOGGLES: [keyof Settings, string][] = [
  ['strictMode', 'strict mode'],
  ['autoStartBreaks', 'auto-start breaks'],
  ['autoStartFocus', 'auto-start focus'],
  ['focusModeOnStart', 'focus mode on start'],
  ['tick', 'ticking sound'],
  ['keepAwake', 'keep screen on'],
  ['showQuotes', 'quotes'],
  ['trackInterruptions', 'interruption tracking'],
];
const minutesLabel = (ms: number) => `${Math.round(ms / 60_000)} min`;

function paletteCommands(): PaletteCommand[] {
  const s = settings.get();
  const d = data.get();
  const t = d.timer;
  const pick = <T extends { id: string; label: string }>(group: string, items: T[], currentId: string, set: (id: T['id']) => void, keywords = '') =>
    items.map((x) => ({ id: `${group}:${x.id}`, title: `${group}: ${x.label}`, group: 'Appearance', keywords, current: x.id === currentId, run: () => set(x.id) }));
  const toggleLabel = strictStop() ? 'Stop session' : t.status === 'running' ? 'Pause' : t.status === 'paused' ? 'Resume' : `Start ${MODE_LABELS[t.mode].toLowerCase()}`;
  return [
    { id: 'toggle', title: toggleLabel, group: 'Timer', keys: ['Space'], keywords: 'start pause resume stop play timer', run: () => toggleBtn.click() },
    { id: 'reset', title: 'Restart session', group: 'Timer', keys: ['R'], keywords: 'reset', run: () => $('#reset').click() },
    { id: 'skip', title: `Skip to ${MODE_LABELS[timer.upcoming()].toLowerCase()}`, group: 'Timer', keys: ['S'], keywords: 'next', run: () => $('#skip').click() },
    ...(['focus', 'short', 'long'] as Mode[]).map((m, i) => ({
      id: `mode:${m}`,
      title: `Switch to ${MODE_LABELS[m].toLowerCase()}`,
      group: 'Timer',
      keys: [String(i + 1)],
      keywords: 'mode',
      current: t.mode === m,
      run: () => void actions.switchTo(m),
    })),
    { id: 'add-minute', title: 'Add a minute', group: 'Timer', keys: ['+'], keywords: 'more time extend', run: () => nudgeMinute(true) },
    { id: 'remove-minute', title: 'Remove a minute', group: 'Timer', keys: ['−'], keywords: 'less time shorten', run: () => nudgeMinute(false) },
    ...(!$('#interrupt').hidden ? [{ id: 'interrupt', title: 'Log an interruption', group: 'Timer', keys: ['I'], keywords: 'distraction note', run: () => interruptions.open() }] : []),
    { id: 'new-task', title: 'New task', group: 'Tasks', keys: ['N'], keywords: 'add create todo', run: () => tasks.focusInput() },
    ...d.tasks
      .filter((x) => !x.done)
      .map((x) => ({
        id: `task:${x.id}`,
        title: `Set current task: ${x.title}`,
        group: 'Tasks',
        keywords: 'active work on select',
        current: x.id === d.activeTaskId,
        run: () => {
          tasks.setActive(x.id);
          toast(`Current task: ${x.title}`, { duration: 2000 });
        },
      })),
    { id: 'tasks-visible', title: s.showTasks ? 'Hide tasks' : 'Show tasks', group: 'Tasks', keys: ['T'], keywords: 'toggle list panel', run: () => tasks.toggleVisible() },
    { id: 'copy-tasks', title: 'Copy tasks as Markdown', group: 'Tasks', keywords: 'export clipboard', run: () => void copyTasks() },
    { id: 'import-tasks', title: 'Import tasks from Markdown…', group: 'Tasks', keywords: 'paste bulk add', run: () => tasks.importMarkdown() },
    { id: 'copy-today', title: 'Copy today’s log', group: 'Export', keywords: 'export today markdown clipboard history', run: () => void copyTodayLog() },
    { id: 'download-today', title: 'Download today’s log', group: 'Export', keywords: 'export today markdown file history', run: () => downloadLog(1) },
    { id: 'download-all', title: 'Download full history', group: 'Export', keywords: 'export all log markdown file', run: () => downloadLog(null) },
    ...pick('Clock face', FACE_LIST, s.clockFace, (clockFace) => settings.set({ clockFace }), 'switch timer style'),
    ...pick('Theme', THEMES.map((x) => ({ id: x.id, label: x.name })), s.theme, (theme) => settings.set({ theme }), 'colors colours palette'),
    ...pick(
      'Background',
      [{ id: 'blobs', label: 'Blobs' }, ...SCENES, { id: 'none', label: 'None' }] as { id: Settings['background']; label: string }[],
      s.background,
      (background) => settings.set({ background }),
      'scene',
    ),
    { id: 'focus-mode', title: focusMode.isOn() ? 'Exit focus mode' : 'Focus mode', group: 'View', keys: ['F'], keywords: 'zen hide distraction', run: () => focusMode.toggle() },
    ...(fullscreenSupported() ? [{ id: 'fullscreen', title: 'Toggle full screen', group: 'View', keywords: 'fullscreen', run: () => void fullscreen.toggle() }] : []),
    ...(pipSupported() ? [{ id: 'pip', title: 'Pop out mini timer', group: 'View', keys: ['P'], keywords: 'picture in picture window', run: togglePip }] : []),
    { id: 'mute', title: s.muted ? 'Unmute sounds' : 'Mute sounds', group: 'Sound', keys: ['M'], keywords: 'sound audio silence volume', run: toggleMute },
    ...AMBIENT_OPTIONS.filter((o) => o.id !== 'off').map((o) => ({
      id: `ambient:${o.id}`,
      title: `Ambient sound: ${o.label}`,
      group: 'Sound',
      keywords: 'toggle noise background audio',
      current: s.ambient === o.id,
      // Picking the sound that's already on turns it off, so "toggle rain" works both ways.
      run: () => {
        const ambient = s.ambient === o.id ? 'off' : o.id;
        settings.set({ ambient });
        toast(ambient === 'off' ? 'Ambient sound off' : `Ambient sound: ${o.label}${t.status === 'running' ? '' : ' (plays while a session runs)'}`, { duration: 2500 });
      },
    })),
    ...SETTING_TOGGLES.map(([key, label]) => {
      const onNow = !!s[key];
      return {
        id: `setting:${key}`,
        title: `Turn ${onNow ? 'off' : 'on'} ${label}`,
        group: 'Settings',
        keywords: 'toggle enable disable',
        run: () => {
          settings.set({ [key]: !onNow } as Partial<Settings>);
          toast(`${label[0].toUpperCase()}${label.slice(1)} ${onNow ? 'off' : 'on'}`, { duration: 2000 });
        },
      };
    }),
    { id: 'settings', title: 'Open settings', group: 'General', keys: [','], keywords: 'preferences options', run: () => panel.open() },
    { id: 'stats', title: 'Progress, streak & goal', group: 'General', keys: ['G'], keywords: 'stats history statistics', run: () => stats.open() },
    { id: 'shortcuts', title: 'Keyboard shortcuts', group: 'General', keys: ['?'], keywords: 'help keys', run: openHelp },
  ];
}

/** Commands built from what's typed, e.g. "start 50m focus" or "add task Write report". */
function parsedCommands(query: string): PaletteCommand[] {
  const p = parseCommand(query);
  if (!p) return [];
  const t = data.get().timer;
  if (p.kind === 'add-task') {
    const parsed = parseTasksMarkdown(p.title).tasks[0];
    if (!parsed) return [];
    return [
      {
        id: 'parsed:add-task',
        title: `Add task “${parsed.title}”${parsed.estimate > 1 ? ` · ${parsed.estimate} pomodoros` : ''}`,
        group: 'Tasks',
        run: () => {
          tasks.add(parsed.title, parsed.estimate);
          toast('Task added', { duration: 2000 });
        },
      },
    ];
  }
  if (p.kind === 'set-length') {
    const now = settings.get().durations[p.mode];
    return [
      {
        id: 'parsed:set-length',
        title: `Set ${MODE_LABELS[p.mode].toLowerCase()} length to ${p.minutes} min (now ${now} min)`,
        group: 'Settings',
        run: () => {
          settings.set({ durations: { ...settings.get().durations, [p.mode]: p.minutes } });
          toast(`${MODE_LABELS[p.mode]} is now ${p.minutes} min`, { duration: 2500 });
        },
      },
    ];
  }
  const mode = p.mode ?? t.mode;
  const sameRunning = mode === t.mode && t.status === 'running';
  if (sameRunning && p.ms === null) return [];
  const label = MODE_LABELS[mode].toLowerCase();
  const title = sameRunning
    ? `Make this ${label} ${minutesLabel(p.ms!)}`
    : `Start ${p.ms ? `a ${minutesLabel(p.ms)} ` : ''}${label}`;
  return [
    {
      id: 'parsed:start',
      title,
      group: 'Timer',
      run: async () => {
        if (mode !== data.get().timer.mode) await actions.switchTo(mode);
        if (data.get().timer.mode !== mode) return; // switching was cancelled
        unlockAudio();
        if (p.ms) timer.setLength(p.ms);
        timer.start();
        if (sameRunning) toast(`This ${label} is now ${minutesLabel(p.ms!)} · ${formatTime(timer.remaining())} left`, { duration: 2500 });
      },
    },
  ];
}

const palette = createPalette({ commands: paletteCommands, parse: parsedCommands });
document.addEventListener('keydown', (e) => {
  if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== 'k' || palette.isOpen()) return;
  if (dialogOpen() || help.isOpen() || stats.isOpen() || interruptions.isOpen() || importOpen() || menuOpen()) return;
  e.preventDefault();
  if (panel.isOpen()) panel.close();
  palette.open();
});

// Esc closes settings even from inside one of its inputs, otherwise leaves focus mode.
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || e.defaultPrevented || dialogOpen() || help.isOpen() || stats.isOpen() || interruptions.isOpen() || importOpen() || menuOpen() || palette.isOpen()) return;
  if (panel.isOpen()) panel.close();
  else if (focusMode.isOn()) focusMode.exit();
});
bindShortcuts(SHORTCUTS, {
  modalOpen: () => dialogOpen() || help.isOpen() || interruptions.isOpen() || stats.isOpen() || importOpen() || menuOpen() || palette.isOpen(),
  settingsOpen: () => panel.isOpen(),
  popoverOpen: () => false,
});

// ---- Scripting API for agents and automation (see `pomo.help()`)
const pomo = createAgentApi({
  data,
  settings,
  timer,
  version: __APP_VERSION__,
  addTask: (title, estimate) => tasks.add(title, estimate),
  setActiveTask: (id) => tasks.setActive(id),
  commands: paletteCommands,
  parse: parsedCommands,
});
window.pomo = pomo;

// ---- Link actions, e.g. ?do=start&mode=focus&min=50&task=Write+report
/** Runs like the buttons do, so abandoning a focus session still asks first. */
async function runUrlAction(a: UrlAction) {
  if (a.kind === 'invalid') return toast(`Couldn’t run that link: ${a.reason}`, { duration: 5000 });
  if (a.kind === 'pause') return timer.pause();
  if (a.kind === 'skip') return actions.skip();
  if (a.kind === 'reset') return actions.reset();
  if (a.kind === 'add-task') {
    tasks.add(a.title, a.estimate);
    return toast(`Task added: ${a.title}`, { duration: 2500 });
  }
  if (a.mode && a.mode !== data.get().timer.mode) await actions.switchTo(a.mode);
  if (a.mode && data.get().timer.mode !== a.mode) return; // switching was cancelled
  try {
    pomo.start({ ...(a.minutes ? { minutes: a.minutes } : {}), ...(a.task ? { task: a.task } : {}) });
  } catch (err) {
    return toast(`Couldn’t run that link: ${(err as Error).message.replace(/^pomo\.\w+: /, '')}`, { duration: 5000 });
  }
  // Without a click or key press first, browsers may keep the alarm silent.
  unlockAudio();
  if (audioContext()?.state !== 'running' && !settings.get().muted) toast('Timer started. Tap anywhere to turn on the alarm sound', { duration: 6000 });
}

const urlAction = parseUrlAction(location.search);
if (urlAction) {
  history.replaceState(history.state, '', stripAction(location.href));
  queueMicrotask(() => void runUrlAction(urlAction));
}

// First visit on a touch screen: mention the timer gestures once.
if (settings.get().showTips && !settings.get().gesturesTipSeen && window.matchMedia('(hover: none) and (pointer: coarse)').matches) {
  setTimeout(() => {
    if (settings.get().gesturesTipSeen) return;
    toast('Tip: tap the timer to start or pause, swipe it to switch modes, hold to restart', {
      duration: 9000,
      onDismiss: () => settings.set({ gesturesTipSeen: true }),
    });
  }, 2500);
}

// First visit on a device with a keyboard: point people at the cheat sheet once.
if (settings.get().showTips && !settings.get().shortcutsHintSeen && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
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
view.setFace(settings.get().clockFace);
renderMode(true);
renderStatus();
renderCycle();
view.render(timer.remaining(), timer.duration());
driftBlobs();
entrance();
requestAnimationFrame(frame);
setInterval(secondTick, 200);
setupPwa(() => data.get().timer.status === 'running', () => settings.get().showTips);
syncAmbient();
// A session restored on reload doesn't change status, so take the wake lock now.
wakeLock.set(settings.get().keepAwake && data.get().timer.status === 'running');
