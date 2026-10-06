import { AMBIENT_OPTIONS } from '../core/ambient';
import { ALARM_OPTIONS, canPlayThroughSilentMode, playAlarm, unlockAudio } from '../core/audio';
import { isTouchDevice } from '../core/haptics';
import { wakeLockSupported } from './wakeLock';
import { notificationsSupported, requestNotifications } from '../core/notify';
import type { Store } from '../core/store';
import type { AlarmSound, Mode, Settings } from '../core/types';
import { closeDrawer, openDrawer } from '../fx/anims';
import { ask } from './dialog';
import { FACE_LIST } from '../faces';
import { SCENES } from '../fx/scenes';
import { THEMES, getTheme } from '../themes/presets';

type BoolKey = { [K in keyof Settings]: Settings[K] extends boolean ? K : never }[keyof Settings];

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> & Record<string, unknown> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  Object.assign(node, props);
  node.append(...children);
  return node;
}

const section = (title: string, ...children: Node[]) => el('section', { className: 'section' }, el('h3', {}, title), ...children);

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export interface SettingsPanel {
  open(): void;
  close(): void;
  toggle(): void;
  isOpen(): boolean;
}

export interface DataActions {
  /** Download the session log as Markdown; `days` null = all time. */
  exportLog(days: number | null): void;
  resetAll(): void;
  /** Delete session history (which is what the streak, stats and goal are counted from). */
  clearHistory(): void;
  /** Settings back to defaults; tasks and history stay. */
  resetSettings(): void;
  exportBackup(): void;
  importBackup(file: File): Promise<void>;
}

export function createSettingsPanel(settings: Store<Settings>, dataActions: DataActions): SettingsPanel {
  const drawer = document.getElementById('settings')!;
  const scrim = document.getElementById('scrim')!;
  const body = document.getElementById('settings-body')!;
  const syncers: ((s: Settings) => void)[] = [];
  const update = (patch: Partial<Settings>) => settings.set(patch);

  function toggle(key: BoolKey, label: string, hint?: string, onEnable?: () => Promise<boolean>) {
    const input = el('input', { type: 'checkbox', id: `set-${key}` });
    input.addEventListener('change', async () => {
      if (input.checked && onEnable && !(await onEnable())) {
        input.checked = false;
        return;
      }
      update({ [key]: input.checked });
    });
    syncers.push((s) => (input.checked = s[key]));
    const labelEl = el('label', { htmlFor: input.id }, label);
    if (hint) labelEl.append(el('small', {}, hint));
    return el('div', { className: 'row' }, labelEl, el('label', { className: 'switch' }, input, el('span')));
  }

  function numberRow(min: number, max: number, get: (s: Settings) => number, set: (n: number) => void) {
    const input = el('input', { type: 'number', min: String(min), max: String(max), inputMode: 'numeric' });
    input.addEventListener('change', () => {
      const n = clamp(Math.round(Number(input.value)) || min, min, max);
      input.value = String(n);
      set(n);
    });
    syncers.push((s) => (input.value = String(get(s))));
    return input;
  }

  // --- Timer
  const durationFields = (['focus', 'short', 'long'] as Mode[]).map((mode) => {
    const label = { focus: 'Focus', short: 'Short break', long: 'Long break' }[mode];
    const input = numberRow(1, 180, (s) => s.durations[mode], (n) =>
      update({ durations: { ...settings.get().durations, [mode]: n } }),
    );
    return el('label', {}, `${label} (min)`, input);
  });
  const longEvery = numberRow(2, 12, (s) => s.longBreakEvery, (n) => update({ longBreakEvery: n }));
  longEvery.id = 'set-long-every';

  const goalInput = numberRow(1, 24, (s) => s.dailyGoal, (n) => update({ dailyGoal: n }));
  goalInput.id = 'set-daily-goal';

  const PRESETS: [number, number, number][] = [
    [25, 5, 15],
    [50, 10, 20],
    [90, 15, 30],
  ];
  const presetBtns = PRESETS.map(([focus, short, long]) => {
    const b = el('button', { className: 'btn preset', type: 'button' }, `${focus} / ${short} / ${long}`);
    b.setAttribute('aria-label', `${focus} minute focus, ${short} minute short break, ${long} minute long break`);
    b.addEventListener('click', () => update({ durations: { focus, short, long } }));
    syncers.push((s) => {
      const d = s.durations;
      b.setAttribute('aria-pressed', String(d.focus === focus && d.short === short && d.long === long));
    });
    return b;
  });

  const timerSection = section(
    'Timer',
    el('div', { className: 'presets', role: 'group', ariaLabel: 'Interval presets' }, ...presetBtns),
    el('div', { className: 'durations' }, ...durationFields),
    el('div', { className: 'row' }, el('label', { htmlFor: longEvery.id }, 'Long break every', el('small', {}, 'focus sessions')), longEvery),
    el('div', { className: 'row' }, el('label', { htmlFor: goalInput.id }, 'Daily goal', el('small', {}, 'pomodoros per day')), goalInput),
    toggle('autoStartBreaks', 'Auto-start breaks'),
    toggle('autoStartFocus', 'Auto-start focus', 'After a break ends'),
    toggle('strictMode', 'Strict mode', 'No pausing — stopping a pomodoro abandons it'),
    toggle('confirmBreakPause', 'Confirm pausing a break', 'Ask first, so a stray tap doesn’t stop your break'),
    toggle('trackInterruptions', 'Track interruptions', 'Log internal/external distractions during focus (I)'),
  );

  // --- Appearance
  const swatches = THEMES.map((t) => {
    const btn = el(
      'button',
      { className: 'theme-swatch', type: 'button' },
      el('span', { className: 'preview' }),
      t.name,
    );
    const preview = btn.querySelector<HTMLElement>('.preview')!;
    preview.style.background = `linear-gradient(135deg, ${t.bg2}, ${t.bg})`;
    Object.values(t.modes).forEach((c) => {
      const dot = el('i');
      dot.style.background = c;
      preview.append(dot);
    });
    btn.addEventListener('click', () => update({ theme: t.id }));
    syncers.push((s) => btn.setAttribute('aria-pressed', String(s.theme === t.id)));
    return btn;
  });

  const colorPickers = (['focus', 'short', 'long'] as Mode[]).map((mode) => {
    const name = { focus: 'Focus', short: 'Short break', long: 'Long break' }[mode];
    const input = el('input', { type: 'color', id: `set-color-${mode}`, ariaLabel: `${name} color` });
    input.addEventListener('input', () => update({ modeColors: { ...settings.get().modeColors, [mode]: input.value } }));
    syncers.push((s) => (input.value = s.modeColors[mode] ?? getTheme(s.theme).modes[mode]));
    return el('label', { className: 'color-pick' }, input, name);
  });
  const colorsReset = el('button', { className: 'btn', type: 'button' }, 'Use theme colors');
  colorsReset.addEventListener('click', () => update({ modeColors: { focus: null, short: null, long: null } }));
  syncers.push((s) => (colorsReset.hidden = Object.values(s.modeColors).every((c) => c === null)));

  const faceBtns = FACE_LIST.map((f) => {
    const btn = el('button', { className: 'face-option', type: 'button' });
    btn.innerHTML = `${f.preview}<span>${f.label}</span>`;
    btn.addEventListener('click', () => update({ clockFace: f.id }));
    syncers.push((s) => btn.setAttribute('aria-pressed', String(s.clockFace === f.id)));
    return btn;
  });

  const BACKGROUNDS: { id: Settings['background']; label: string }[] = [
    { id: 'blobs', label: 'Blobs' },
    ...SCENES,
    { id: 'none', label: 'None' },
  ];
  const bgBtns = BACKGROUNDS.map((b) => {
    const btn = el('button', { className: 'btn preset', type: 'button' }, b.label);
    btn.addEventListener('click', () => update({ background: b.id }));
    syncers.push((s) => btn.setAttribute('aria-pressed', String(s.background === b.id)));
    return btn;
  });

  const appearanceSection = section(
    'Appearance',
    el('p', { className: 'sub-h' }, 'Clock'),
    el('div', { className: 'faces', role: 'group', ariaLabel: 'Clock face' }, ...faceBtns),
    el('p', { className: 'sub-h' }, 'Background'),
    el('div', { className: 'bg-options', role: 'group', ariaLabel: 'Background' }, ...bgBtns),
    el('p', { className: 'sub-h' }, 'Theme'),
    el('div', { className: 'themes' }, ...swatches),
    el('div', { className: 'mode-colors' }, ...colorPickers),
    colorsReset,
    toggle('rollingDigits', 'Rolling digits', 'Animate the clock as each digit changes'),
    toggle('splash', 'Splash screen', 'Show the pomo logo for a moment when the app opens'),
  );

  // --- Sound
  const alarmSelect = el('select', { id: 'set-alarm' }, ...ALARM_OPTIONS.map((o) => el('option', { value: o.id }, o.label)));
  alarmSelect.addEventListener('change', () => {
    update({ alarm: alarmSelect.value as AlarmSound });
    playAlarm(settings.get().alarm, settings.get().volume, { ignoreSilentMode: settings.get().alarmIgnoresSilent });
  });
  const testBtn = el('button', { className: 'btn', type: 'button' }, 'Test');
  testBtn.addEventListener('click', () => {
    unlockAudio();
    playAlarm(settings.get().alarm, settings.get().volume, { ignoreSilentMode: settings.get().alarmIgnoresSilent });
  });
  const volume = el('input', { type: 'range', min: '0', max: '1', step: '0.05', id: 'set-volume' });
  volume.addEventListener('input', () => update({ volume: Number(volume.value) }));
  syncers.push((s) => {
    alarmSelect.value = s.alarm;
    volume.value = String(s.volume);
  });

  const ambientSelect = el('select', { id: 'set-ambient' }, ...AMBIENT_OPTIONS.map((o) => el('option', { value: o.id }, o.label)));
  ambientSelect.addEventListener('change', () => {
    unlockAudio();
    update({ ambient: ambientSelect.value as Settings['ambient'] });
  });
  const ambientVolume = el('input', { type: 'range', min: '0', max: '1', step: '0.05', id: 'set-ambient-volume' });
  ambientVolume.addEventListener('input', () => update({ ambientVolume: Number(ambientVolume.value) }));
  syncers.push((s) => {
    ambientSelect.value = s.ambient;
    ambientVolume.value = String(s.ambientVolume);
  });

  const soundSection = section(
    'Sound',
    el('div', { className: 'row' }, el('label', { htmlFor: alarmSelect.id }, 'Alarm'), alarmSelect, testBtn),
    el('div', { className: 'row' }, el('label', { htmlFor: volume.id }, 'Volume'), volume),
    toggle('tick', 'Ticking', 'Soft tick every second during focus'),
    el('div', { className: 'row' }, el('label', { htmlFor: ambientSelect.id }, 'Ambient sound', el('small', {}, 'While a session runs')), ambientSelect),
    el('div', { className: 'row' }, el('label', { htmlFor: ambientVolume.id }, 'Ambient volume'), ambientVolume),
    toggle('ambientOnBreaks', 'Ambient during breaks too'),
    toggle('muted', 'Mute all sounds', 'Shortcut: M'),
    ...(canPlayThroughSilentMode()
      ? [toggle('alarmIgnoresSilent', 'Alarm ignores silent mode', 'Rings even with the silent switch on. May briefly pause other audio')]
      : []),
  );

  // --- Behavior
  const notifHint = el('p', { className: 'hint', hidden: true });
  const behaviorSection = section(
    'Behavior',
    toggle('notifications', 'Notifications', 'When a session ends', async () => {
      const ok = await requestNotifications();
      notifHint.hidden = ok;
      notifHint.textContent = notificationsSupported()
        ? 'Notifications are blocked. Allow them in your browser’s site settings.'
        : 'This browser doesn’t support notifications.';
      return ok;
    }),
    notifHint,
    toggle('titleCountdown', 'Countdown in tab title and icon'),
    ...(wakeLockSupported() ? [toggle('keepAwake', 'Keep screen awake', 'While a session is running')] : []),
    toggle('focusModeOnStart', 'Focus mode on start', 'Hide everything but the timer during focus (F)'),
    ...(isTouchDevice() ? [toggle('haptics', 'Vibration', 'Tap feedback, and a buzz when a session ends')] : []),
  );

  // --- Data
  const exportBtn = el('button', { className: 'btn', type: 'button' }, 'Export backup');
  exportBtn.addEventListener('click', () => dataActions.exportBackup());
  const fileInput = el('input', { type: 'file', accept: 'application/json,.json', hidden: true, id: 'import-file' });
  fileInput.setAttribute('aria-label', 'Choose a backup file');
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (file) void dataActions.importBackup(file);
  });
  const importBtn = el('button', { className: 'btn', type: 'button' }, 'Import backup');
  importBtn.addEventListener('click', () => fileInput.click());
  const confirmed = async (title: string, body: string, confirm: string) =>
    (await ask({ title, body, confirm, danger: true })) === 'confirm';
  const historyBtn = el('button', { className: 'btn danger', type: 'button' }, 'Clear history');
  historyBtn.addEventListener('click', async () => {
    const body = 'This deletes your session history, which resets your streak, stats and daily goal. Tasks and settings stay.';
    if (await confirmed('Clear history?', body, 'Clear')) dataActions.clearHistory();
  });
  const settingsBtn = el('button', { className: 'btn danger', type: 'button' }, 'Reset settings');
  settingsBtn.addEventListener('click', async () => {
    const body = 'This puts every setting back to its default. Your tasks, history and custom quotes stay.';
    if (await confirmed('Reset settings?', body, 'Reset')) dataActions.resetSettings();
  });
  const resetBtn = el('button', { className: 'btn danger', type: 'button' }, 'Reset everything');
  resetBtn.addEventListener('click', async () => {
    const body = 'This deletes your settings, tasks and history in this browser. Export a backup first if you might want them back.';
    if (await confirmed('Reset everything?', body, 'Reset')) dataActions.resetAll();
  });
  const logRange = el(
    'select',
    { id: 'log-range' },
    el('option', { value: '1' }, 'Today'),
    el('option', { value: '7' }, 'Last 7 days'),
    el('option', { value: '30' }, 'Last 30 days'),
    el('option', { value: 'all' }, 'All time'),
  );
  logRange.setAttribute('aria-label', 'Log period');
  const logBtn = el('button', { className: 'btn', type: 'button' }, 'Download log (.md)');
  logBtn.addEventListener('click', () => dataActions.exportLog(logRange.value === 'all' ? null : Number(logRange.value)));

  const dataSection = section(
    'Data',
    el('div', { className: 'row' }, el('span', { className: 'label' }, 'Session log as Markdown'), logRange, logBtn),
    el('p', { className: 'hint' }, 'Everything is saved only in this browser. Back it up to move to another device or browser.'),
    el('div', { className: 'data-actions' }, exportBtn, importBtn, fileInput),
    el('div', { className: 'data-actions' }, historyBtn, settingsBtn, resetBtn),
  );

  const shortcutsBtn = el('button', { className: 'btn', type: 'button' }, 'View shortcuts');
  shortcutsBtn.addEventListener('click', () => document.getElementById('shortcuts-open')?.click());
  const tipsAgain = el('button', { className: 'btn', type: 'button' }, 'Show tips again');
  tipsAgain.addEventListener('click', () => {
    update({ showTips: true, shortcutsHintSeen: false, mobileTipSeen: false, gesturesTipSeen: false });
    tipsAgain.textContent = 'Tips will show again';
    setTimeout(() => (tipsAgain.textContent = 'Show tips again'), 2500);
  });
  const quoteSource = el(
    'select',
    { id: 'set-quote-source' },
    el('option', { value: 'default' }, 'Built-in (100 quotes)'),
    el('option', { value: 'custom' }, 'My quotes'),
  );
  quoteSource.addEventListener('change', () => update({ quoteSource: quoteSource.value as Settings['quoteSource'] }));
  const customQuotes = el('textarea', { id: 'set-custom-quotes', rows: 4, spellcheck: true, placeholder: 'One per line, e.g.\nShip small, ship often. — Me' });
  customQuotes.setAttribute('aria-label', 'My quotes, one per line');
  customQuotes.addEventListener('change', () => update({ customQuotes: customQuotes.value }));
  const customWrap = el('div', { className: 'custom-quotes' }, customQuotes, el('p', { className: 'hint' }, 'One quote per line. Add “— Name” to credit someone.'));
  const quoteOptions = el(
    'div',
    { className: 'quote-options' },
    el('div', { className: 'row' }, el('label', { htmlFor: quoteSource.id }, 'Quotes'), quoteSource),
    customWrap,
  );
  syncers.push((s) => {
    quoteSource.value = s.quoteSource;
    if (document.activeElement !== customQuotes) customQuotes.value = s.customQuotes;
    quoteOptions.hidden = !s.showQuotes;
    customWrap.hidden = s.quoteSource !== 'custom';
  });

  const messagesSection = section(
    'Messages',
    toggle('showQuotes', 'Show a quote', 'Under the timer, a new one each session'),
    quoteOptions,
    toggle('showTips', 'Show tips', 'One-time hints, e.g. keyboard shortcuts or phone settings'),
    toggle('celebrateGoal', 'Celebrate the daily goal'),
    el('div', { className: 'row' }, el('span', { className: 'label' }, 'Seen the tips already?'), tipsAgain),
  );

  const helpSection = section(
    'Keyboard',
    el('div', { className: 'row' }, el('span', { className: 'label' }, 'Press ? anytime to see every shortcut.'), shortcutsBtn),
  );

  const about = el('div', { className: 'about' });
  about.innerHTML = `
    <p><strong>pomo</strong> v${__APP_VERSION__}. Free and open source, and your data never leaves this browser.</p>
    <p class="about-links">
      <a href="https://github.com/parmsam/pomotimer2" target="_blank" rel="noopener"><svg class="gh" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>GitHub</a>
      <a href="https://github.com/parmsam/pomotimer2/issues/new" target="_blank" rel="noopener">Report an issue</a>
    </p>`;
  const aboutSection = section('About', about);

  body.append(timerSection, appearanceSection, soundSection, behaviorSection, messagesSection, helpSection, dataSection, aboutSection);

  const sync = (s: Settings) => syncers.forEach((fn) => fn(s));
  sync(settings.get());
  settings.subscribe(sync);

  let lastFocus: HTMLElement | null = null;
  const isOpen = () => drawer.dataset.state === 'open';
  const open = () => {
    if (isOpen()) return;
    lastFocus = document.activeElement as HTMLElement | null;
    openDrawer(drawer, scrim);
    document.getElementById('settings-close')!.focus();
  };
  const close = () => {
    if (!isOpen()) return;
    closeDrawer(drawer, scrim);
    lastFocus?.focus();
  };

  document.getElementById('settings-open')!.addEventListener('click', open);
  document.getElementById('settings-close')!.addEventListener('click', close);
  scrim.addEventListener('click', close);

  return { open, close, toggle: () => (isOpen() ? close() : open()), isOpen };
}
