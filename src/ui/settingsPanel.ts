import { ALARM_OPTIONS, playAlarm, unlockAudio } from '../core/audio';
import { notificationsSupported, requestNotifications } from '../core/notify';
import type { Store } from '../core/store';
import type { AlarmSound, Mode, Settings } from '../core/types';
import { closeDrawer, openDrawer } from '../fx/anims';
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
  isOpen(): boolean;
}

export function createSettingsPanel(settings: Store<Settings>, onResetAll: () => void): SettingsPanel {
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

  const timerSection = section(
    'Timer',
    el('div', { className: 'durations' }, ...durationFields),
    el('div', { className: 'row' }, el('label', { htmlFor: longEvery.id }, 'Long break every', el('small', {}, 'focus sessions')), longEvery),
    toggle('autoStartBreaks', 'Auto-start breaks'),
    toggle('autoStartFocus', 'Auto-start focus', 'After a break ends'),
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

  const accentInput = el('input', { type: 'color', id: 'set-accent', ariaLabel: 'Focus accent color' });
  accentInput.addEventListener('input', () => update({ accent: accentInput.value }));
  const accentReset = el('button', { className: 'btn', type: 'button' }, 'Use theme');
  accentReset.addEventListener('click', () => update({ accent: null }));
  syncers.push((s) => {
    accentInput.value = s.accent ?? getTheme(s.theme).modes.focus;
    accentReset.hidden = s.accent === null;
  });

  const appearanceSection = section(
    'Appearance',
    el('div', { className: 'themes' }, ...swatches),
    el(
      'div',
      { className: 'row accent-row' },
      el('label', { htmlFor: accentInput.id }, 'Focus color'),
      el('div', { className: 'row' }, accentReset, accentInput),
    ),
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
  );

  // --- Data
  const resetBtn = el('button', { className: 'btn danger', type: 'button' }, 'Reset everything');
  resetBtn.addEventListener('click', () => {
    if (confirm('Reset all settings and history? This can’t be undone.')) onResetAll();
  });
  const dataSection = section(
    'Data',
    el('div', { className: 'row' }, el('span', { className: 'label' }, 'Settings & history are saved in this browser.'), resetBtn),
  );

  body.append(timerSection, appearanceSection, soundSection, behaviorSection, dataSection);

  const sync = (s: Settings) => syncers.forEach((fn) => fn(s));
  sync(settings.get());
  settings.subscribe(sync);

  let lastFocus: HTMLElement | null = null;
  const isOpen = () => !drawer.hidden;
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

  return { open, close, isOpen };
}
