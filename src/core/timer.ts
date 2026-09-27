import type { Store } from './store';
import type { AppData, Mode, Settings } from './types';

const HISTORY_LIMIT = 5000;

export interface CompleteEvent {
  finished: Mode;
  next: Mode;
  /** True when the session ended while the page was closed. */
  missed: boolean;
}

export interface Timer {
  start(): void;
  pause(): void;
  toggle(): void;
  reset(): void;
  skip(): void;
  setMode(mode: Mode): void;
  /** Milliseconds left in the current session, derived from the clock while running. */
  remaining(): number;
  duration(mode?: Mode): number;
}

/**
 * Timestamp-based engine: while running we store `endsAt` and derive the
 * remaining time from Date.now(), so background-tab throttling can't cause drift
 * and a running session survives a reload.
 */
export function createTimer(
  data: Store<AppData>,
  settings: Store<Settings>,
  onComplete: (e: CompleteEvent) => void,
): Timer {
  let timeout: number | undefined;

  const t = () => data.get().timer;
  const setTimer = (patch: Partial<AppData['timer']>) =>
    data.set((d) => ({ timer: { ...d.timer, ...patch } }));

  const duration = (mode: Mode = t().mode) => settings.get().durations[mode] * 60_000;

  const remaining = () => {
    const s = t();
    return s.status === 'running' && s.endsAt !== null ? Math.max(0, s.endsAt - Date.now()) : s.remainingMs;
  };

  function schedule() {
    clearTimeout(timeout);
    if (t().status === 'running') timeout = window.setTimeout(check, remaining() + 20);
  }

  function check() {
    if (t().status === 'running' && remaining() <= 0) complete(false);
    else schedule();
  }

  function nextMode(finished: Mode, cycleCount: number): Mode {
    if (finished !== 'focus') return 'focus';
    return cycleCount % settings.get().longBreakEvery === 0 ? 'long' : 'short';
  }

  function complete(missed: boolean) {
    clearTimeout(timeout);
    const { mode: finished, cycleCount } = t();
    const count = finished === 'focus' ? cycleCount + 1 : finished === 'long' ? 0 : cycleCount;
    const next = nextMode(finished, count);

    data.set((d) => ({
      history: [...d.history, { mode: finished, endedAt: Date.now(), durationMs: duration(finished) }].slice(-HISTORY_LIMIT),
      timer: { mode: next, status: 'idle', endsAt: null, remainingMs: duration(next), cycleCount: count },
    }));

    onComplete({ finished, next, missed });

    const s = settings.get();
    if (!missed && (next === 'focus' ? s.autoStartFocus : s.autoStartBreaks)) start();
  }

  function start() {
    if (t().status === 'running') return;
    const ms = t().remainingMs > 0 ? t().remainingMs : duration();
    setTimer({ status: 'running', endsAt: Date.now() + ms });
    schedule();
  }

  function pause() {
    if (t().status !== 'running') return;
    setTimer({ status: 'paused', remainingMs: remaining(), endsAt: null });
    clearTimeout(timeout);
  }

  function setMode(mode: Mode) {
    clearTimeout(timeout);
    setTimer({ mode, status: 'idle', endsAt: null, remainingMs: duration(mode) });
  }

  // Keep an untouched session in sync when its duration setting changes.
  settings.subscribe((s, prev) => {
    const { mode, status } = t();
    if (status === 'idle' && s.durations[mode] !== prev.durations[mode]) setTimer({ remainingMs: duration(mode) });
  });

  // Timers are throttled in hidden tabs; re-check as soon as we're visible again.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) check();
  });

  // Resume a session persisted from a previous page load.
  if (t().status === 'running') {
    if (remaining() <= 0) complete(true);
    else schedule();
  }

  return {
    start,
    pause,
    toggle: () => (t().status === 'running' ? pause() : start()),
    reset: () => setMode(t().mode),
    skip: () => setMode(nextMode(t().mode, t().cycleCount + (t().mode === 'focus' ? 1 : 0))),
    setMode,
    remaining,
    duration,
  };
}
