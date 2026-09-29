import type { Store } from './store';
import type { AppData, Interruptions, Mode, Settings, TimerState } from './types';

const HISTORY_LIMIT = 5000;
/** Abandoned focus shorter than this is treated as an accidental start and not recorded. */
const MIN_RECORDED_FOCUS_MS = 60_000;
/** Past this share of a focus session, stopping early still counts it. */
export const COUNTS_AFTER = 0.5;

export interface CompleteEvent {
  finished: Mode;
  next: Mode;
  /** True when the session ended while the page was closed. */
  missed: boolean;
  /** True when the user wrapped up a focus session early (past halfway). */
  early: boolean;
}

export interface Timer {
  start(): void;
  pause(): void;
  toggle(): void;
  /** Restart the current mode. An in-progress focus session is abandoned. */
  reset(): void;
  /** Move to the next mode. An in-progress focus session is abandoned. */
  skip(): void;
  /** Switch mode. An in-progress focus session is abandoned. */
  setMode(mode: Mode): void;
  /** Count the current focus session now (used past the halfway mark). */
  finishEarly(): void;
  /** Close the open focus segment so time is credited to the task active until now. */
  splitSegment(): void;
  interrupt(kind: keyof Interruptions): void;
  /** Add (or with a negative value, remove) time from the current session. */
  addTime(ms: number): void;
  /** Make the current session `ms` long (time already spent still counts), without changing the setting. */
  setLength(ms: number): void;
  /** Milliseconds left in the current session, derived from the clock while running. */
  remaining(): number;
  duration(mode?: Mode): number;
  /** Share of the current session elapsed, 0..1. */
  progress(): number;
  /** Focus time in this session, including the open segment. */
  focusedMs(): number;
  inProgress(): boolean;
  /** Mode that follows the current one. */
  upcoming(): Mode;
}

const freshSession = (): Pick<TimerState, 'segmentStart' | 'focusedMs' | 'interruptions' | 'plannedMs'> => ({
  segmentStart: null,
  focusedMs: 0,
  interruptions: { internal: 0, external: 0 },
  plannedMs: null,
});

/**
 * Timestamp-based engine: while running we store `endsAt` and derive the
 * remaining time from Date.now(), so background-tab throttling can't cause drift
 * and a running session survives a reload.
 *
 * Focus time is tracked in segments (start → pause/stop). Each closed segment is
 * added to the session total and to whichever task was active, clamped to the
 * session end so it can never over-count.
 */
export function createTimer(
  data: Store<AppData>,
  settings: Store<Settings>,
  onComplete: (e: CompleteEvent) => void,
): Timer {
  let timeout: number | undefined;

  const t = () => data.get().timer;
  const setTimer = (patch: Partial<TimerState>) => data.set((d) => ({ timer: { ...d.timer, ...patch } }));

  /** The mode's length from settings, ignoring any one-off length. */
  const usual = (mode: Mode) => settings.get().durations[mode] * 60_000;
  const duration = (mode: Mode = t().mode) => {
    const planned = t().plannedMs;
    return mode === t().mode && typeof planned === 'number' && planned > 0 ? planned : usual(mode);
  };

  const remaining = () => {
    const s = t();
    return s.status === 'running' && s.endsAt !== null ? Math.max(0, s.endsAt - Date.now()) : s.remainingMs;
  };

  const openSegmentMs = () => {
    const s = t();
    if (s.segmentStart === null) return 0;
    const end = s.endsAt !== null ? Math.min(Date.now(), s.endsAt) : Date.now();
    return Math.max(0, end - s.segmentStart);
  };

  /** Credits the open segment to the session and the active task. */
  function closeSegment(reopen: boolean) {
    const ms = openSegmentMs();
    data.set((d) => ({
      timer: { ...d.timer, focusedMs: d.timer.focusedMs + ms, segmentStart: reopen ? Date.now() : null },
      tasks: ms > 0 && d.activeTaskId ? d.tasks.map((x) => (x.id === d.activeTaskId ? { ...x, trackedMs: x.trackedMs + ms } : x)) : d.tasks,
    }));
  }

  function schedule() {
    clearTimeout(timeout);
    if (t().status === 'running') timeout = window.setTimeout(check, remaining() + 20);
  }

  function check() {
    if (t().status === 'running' && remaining() <= 0) complete({ missed: false, early: false });
    else schedule();
  }

  function nextMode(finished: Mode, cycleCount: number): Mode {
    if (finished !== 'focus') return 'focus';
    return cycleCount % settings.get().longBreakEvery === 0 ? 'long' : 'short';
  }

  function complete({ missed, early }: { missed: boolean; early: boolean }) {
    clearTimeout(timeout);
    if (t().mode === 'focus') closeSegment(false);
    const { mode: finished, cycleCount, focusedMs, interruptions } = t();
    const count = finished === 'focus' ? cycleCount + 1 : finished === 'long' ? 0 : cycleCount;
    const next = nextMode(finished, count);

    data.set((d) => ({
      history: [
        ...d.history,
        {
          mode: finished,
          endedAt: Date.now(),
          durationMs: duration(finished),
          ...(finished === 'focus' ? { focusedMs, taskId: d.activeTaskId, interruptions } : {}),
        },
      ].slice(-HISTORY_LIMIT),
      tasks:
        finished === 'focus' && d.activeTaskId
          ? d.tasks.map((x) => (x.id === d.activeTaskId ? { ...x, pomodoros: x.pomodoros + 1 } : x))
          : d.tasks,
      timer: { mode: next, status: 'idle', endsAt: null, remainingMs: usual(next), cycleCount: count, ...freshSession() },
    }));

    onComplete({ finished, next, missed, early });

    const s = settings.get();
    if (!missed && (next === 'focus' ? s.autoStartFocus : s.autoStartBreaks)) start();
  }

  /** Ends the current session without counting it, keeping focused minutes in history. */
  function abandon() {
    if (t().mode === 'focus' && t().status !== 'idle') {
      closeSegment(false);
      const { focusedMs, interruptions } = t();
      if (focusedMs >= MIN_RECORDED_FOCUS_MS) {
        data.set((d) => ({
          history: [
            ...d.history,
            { mode: 'focus' as const, endedAt: Date.now(), durationMs: duration('focus'), focusedMs, abandoned: true, taskId: d.activeTaskId, interruptions },
          ].slice(-HISTORY_LIMIT),
        }));
      }
    }
  }

  function start() {
    if (t().status === 'running') return;
    const ms = t().remainingMs > 0 ? t().remainingMs : duration();
    const now = Date.now();
    setTimer({ status: 'running', endsAt: now + ms, segmentStart: t().mode === 'focus' ? now : null });
    schedule();
  }

  function pause() {
    if (t().status !== 'running') return;
    if (t().mode === 'focus') closeSegment(false);
    setTimer({ status: 'paused', remainingMs: remaining(), endsAt: null });
    clearTimeout(timeout);
  }

  function setMode(mode: Mode) {
    clearTimeout(timeout);
    abandon();
    setTimer({ mode, status: 'idle', endsAt: null, remainingMs: usual(mode), ...freshSession() });
  }

  function addTime(ms: number) {
    const s = t();
    if (s.status === 'running' && s.endsAt !== null) {
      setTimer({ endsAt: Math.max(Date.now() + 1000, s.endsAt + ms) });
      schedule();
    } else {
      setTimer({ remainingMs: Math.max(1000, remaining() + ms) });
    }
  }

  const upcoming = () => nextMode(t().mode, t().cycleCount + (t().mode === 'focus' ? 1 : 0));

  // Keep an untouched session in sync when its duration setting changes.
  settings.subscribe((s, prev) => {
    const { mode, status } = t();
    if (status === 'idle' && s.durations[mode] !== prev.durations[mode]) setTimer({ plannedMs: null, remainingMs: usual(mode) });
  });

  // Another tab may start, pause or finish the session: follow its lead.
  data.subscribe((d, prev) => {
    if (d.timer.status !== prev.timer.status || d.timer.endsAt !== prev.timer.endsAt) schedule();
  });

  // Timers are throttled in hidden tabs; re-check as soon as we're visible again.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) check();
  });

  // Resume a session persisted from a previous page load.
  if (t().status === 'running') {
    if (remaining() <= 0) complete({ missed: true, early: false });
    else schedule();
  }

  return {
    start,
    pause,
    toggle: () => (t().status === 'running' ? pause() : start()),
    reset: () => setMode(t().mode),
    skip: () => setMode(upcoming()),
    setMode,
    finishEarly: () => {
      if (t().mode === 'focus' && t().status !== 'idle') complete({ missed: false, early: true });
    },
    splitSegment: () => {
      if (t().segmentStart !== null) closeSegment(true);
    },
    addTime,
    setLength(ms) {
      const delta = ms - duration();
      setTimer({ plannedMs: ms });
      addTime(delta);
    },
    interrupt: (kind) => {
      if (t().mode !== 'focus' || t().status === 'idle') return;
      setTimer({ interruptions: { ...t().interruptions, [kind]: t().interruptions[kind] + 1 } });
    },
    remaining,
    duration,
    progress: () => {
      const d = duration();
      return d > 0 ? Math.min(1, Math.max(0, 1 - remaining() / d)) : 0;
    },
    focusedMs: () => t().focusedMs + openSegmentMs(),
    inProgress: () => t().status !== 'idle',
    upcoming,
  };
}
