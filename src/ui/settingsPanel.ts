import { ALARM_OPTIONS, playAlarm, unlockAudio } from '../core/audio';
import { notificationsSupported, requestNotifications } from '../core/notify';
import type { Store } from '../core/store';
import type { AlarmSound, Mode, Settings } from '../core/types';
import { closeDrawer, openDrawer } from '../fx/anims';
import { ask } from './dialog';
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
  resetAll(): void;
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
    return el('div', { className: 'row' }, labelEl, el('span', { className: 'switch' }, input, el('span')));
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

  const appearanceSection = section(
    'Appearance',
    el('div', { className: 'themes' }, ...swatches),
    el('div', { className: 'mode-colors' }, ...colorPickers),
    colorsReset,
    toggle('rollingDigits', 'Rolling digits', 'Animate the clock as each digit changes'),
  );

  // --- Sound
  const alarmSelect = el('select', { id: 'set-alarm' }, ...ALARM_OPTIONS.map((o) => el('option', { value: o.id }, o.label)));
  alarmSelect.addEventListener('change', () => {
    update({ alarm: alarmSelect.value as AlarmSound });
    playAlarm(settings.get().alarm, settings.get().volume);
  });
  const testBtn = el('button', { className: 'btn', type: 'button' }, 'Test');
  testBtn.addEventListener('click', () => {
    unlockAudio();
    playAlarm(settings.get().alarm, settings.get().volume);
  });
  const volume = el('input', { type: 'range', min: '0', max: '1', step: '0.05', id: 'set-volume' });
  volume.addEventListener('input', () => update({ volume: Number(volume.value) }));
  syncers.push((s) => {
    alarmSelect.value = s.alarm;
    volume.value = String(s.volume);
  });

  const soundSection = section(
    'Sound',
    el('div', { className: 'row' }, el('label', { htmlFor: alarmSelect.id }, 'Alarm'), alarmSelect, testBtn),
    el('div', { className: 'row' }, el('label', { htmlFor: volume.id }, 'Volume'), volume),
    toggle('tick', 'Ticking', 'Soft tick every second during focus'),
    toggle('muted', 'Mute all sounds', 'Shortcut: M'),
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
    toggle('titleCountdown', 'Countdown in tab title'),
    toggle('focusModeOnStart', 'Focus mode on start', 'Hide everything but the timer during focus (F)'),
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
  const resetBtn = el('button', { className: 'btn danger', type: 'button' }, 'Reset everything');
  resetBtn.addEventListener('click', async () => {
    const r = await ask({
      title: 'Reset everything?',
      body: 'This deletes your settings, tasks and history in this browser. Export a backup first if you might want them back.',
      confirm: 'Reset',
      danger: true,
    });
    if (r === 'confirm') dataActions.resetAll();
  });
  const dataSection = section(
    'Data',
    el('p', { className: 'hint' }, 'Everything is saved only in this browser. Back it up to move to another device or browser.'),
    el('div', { className: 'data-actions' }, exportBtn, importBtn, fileInput, resetBtn),
  );

  const shortcutsBtn = el('button', { className: 'btn', type: 'button' }, 'View shortcuts');
  shortcutsBtn.addEventListener('click', () => document.getElementById('shortcuts-open')?.click());
  const helpSection = section(
    'Keyboard',
    el('div', { className: 'row' }, el('span', { className: 'label' }, 'Press ? anytime to see every shortcut.'), shortcutsBtn),
  );

  body.append(timerSection, appearanceSection, soundSection, behaviorSection, helpSection, dataSection);

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
