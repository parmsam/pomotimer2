import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, defaultAppData } from './storage';
import { createStore } from './store';
import { createTimer, type CompleteEvent } from './timer';
import type { AppData, Settings, Task } from './types';

const MIN = 60_000;
const T0 = new Date('2026-01-05T09:00:00Z').getTime();

function setup(opts: { settings?: Partial<Settings>; data?: (d: AppData) => AppData } = {}) {
  const settings = createStore<Settings>({ ...structuredClone(DEFAULT_SETTINGS), ...opts.settings });
  const base = defaultAppData(settings.get());
  const data = createStore<AppData>(opts.data ? opts.data(base) : base);
  const events: CompleteEvent[] = [];
  const timer = createTimer(data, settings, (e) => events.push(e));
  return { settings, data, timer, events, t: () => data.get().timer };
}

const task = (id: string, extra: Partial<Task> = {}): Task => ({
  id,
  title: id,
  estimate: 1,
  pomodoros: 0,
  trackedMs: 0,
  done: false,
  createdAt: T0,
  doneAt: null,
  ...extra,
});

/** Advances the clock and fires due timers. */
const advance = (ms: number) => vi.advanceTimersByTime(ms);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});
afterEach(() => vi.useRealTimers());

describe('countdown', () => {
  it('starts idle at the full focus duration', () => {
    const { timer, t } = setup();
    expect(t().status).toBe('idle');
    expect(timer.remaining()).toBe(25 * MIN);
  });

  it('derives remaining time from the clock while running', () => {
    const { timer } = setup();
    timer.start();
    advance(90_000);
    expect(timer.remaining()).toBe(25 * MIN - 90_000);
    expect(timer.progress()).toBeCloseTo(0.06);
  });

  it('freezes on pause and continues on resume', () => {
    const { timer, t } = setup();
    timer.start();
    advance(5 * MIN);
    timer.pause();
    expect(t().status).toBe('paused');
    advance(10 * MIN);
    expect(timer.remaining()).toBe(20 * MIN);
    timer.start();
    advance(MIN);
    expect(timer.remaining()).toBe(19 * MIN);
  });

  it('reflects a changed duration while idle, but not mid-session', () => {
    const { timer, settings } = setup();
    settings.set({ durations: { ...settings.get().durations, focus: 50 } });
    expect(timer.remaining()).toBe(50 * MIN);
    timer.start();
    advance(MIN);
    settings.set({ durations: { ...settings.get().durations, focus: 10 } });
    expect(timer.remaining()).toBe(49 * MIN);
  });
});

describe('completion and cycles', () => {
  it('moves focus → short break and records the session', () => {
    const { timer, t, data, events } = setup();
    timer.start();
    advance(25 * MIN + 100);
    expect(t()).toMatchObject({ mode: 'short', status: 'idle', cycleCount: 1, remainingMs: 5 * MIN });
    expect(data.get().history).toEqual([
      expect.objectContaining({ mode: 'focus', durationMs: 25 * MIN, focusedMs: 25 * MIN }),
    ]);
    expect(events).toEqual([{ finished: 'focus', next: 'short', missed: false, early: false }]);
  });

  it('gives a long break after every Nth focus session, then resets the cycle', () => {
    const { timer, t } = setup({ settings: { longBreakEvery: 2 } });
    const run = () => {
      timer.start();
      advance(timer.remaining() + 100);
    };
    run(); // focus 1
    expect(t().mode).toBe('short');
    run(); // short
    run(); // focus 2
    expect(t().mode).toBe('long');
    expect(t().cycleCount).toBe(2);
    run(); // long
    expect(t()).toMatchObject({ mode: 'focus', cycleCount: 0 });
  });

  it('auto-starts the next session when enabled', () => {
    const { timer, t } = setup({ settings: { autoStartBreaks: true } });
    timer.start();
    advance(25 * MIN + 100);
    expect(t()).toMatchObject({ mode: 'short', status: 'running' });
  });
});

describe('surviving a reload', () => {
  const running = (endsAt: number, segmentStart: number) => (d: AppData): AppData => ({
    ...d,
    timer: { ...d.timer, status: 'running', endsAt, segmentStart },
  });

  it('keeps counting a session that is still running', () => {
    const { timer, t } = setup({ data: running(T0 + 10 * MIN, T0 - 15 * MIN) });
    expect(t().status).toBe('running');
    expect(timer.remaining()).toBe(10 * MIN);
    advance(10 * MIN + 100);
    expect(t().mode).toBe('short');
  });

  it('credits a session that finished while the page was closed, without auto-starting', () => {
    const { t, data, events } = setup({
      settings: { autoStartBreaks: true },
      data: running(T0 - 2 * MIN, T0 - 27 * MIN),
    });
    expect(events[0]).toMatchObject({ finished: 'focus', missed: true });
    expect(t()).toMatchObject({ mode: 'short', status: 'idle' });
    // Focus time is clamped to the session end, not "now".
    expect(data.get().history[0].focusedMs).toBe(25 * MIN);
  });
});

describe('abandoning and finishing early', () => {
  it('records an abandoned focus session with its focused minutes', () => {
    const { timer, t, data } = setup();
    timer.start();
    advance(8 * MIN);
    timer.reset();
    expect(t()).toMatchObject({ status: 'idle', mode: 'focus', remainingMs: 25 * MIN, focusedMs: 0 });
    expect(data.get().history).toEqual([expect.objectContaining({ abandoned: true, focusedMs: 8 * MIN })]);
  });

  it('ignores accidental starts shorter than a minute', () => {
    const { timer, data } = setup();
    timer.start();
    advance(20_000);
    timer.skip();
    expect(data.get().history).toEqual([]);
  });

  it('does not record anything when resetting a break', () => {
    const { timer, data } = setup();
    timer.setMode('short');
    timer.start();
    advance(2 * MIN);
    timer.reset();
    expect(data.get().history).toEqual([]);
  });

  it('counts a session when finishing early', () => {
    const { timer, t, data, events } = setup();
    timer.start();
    advance(15 * MIN);
    expect(timer.progress()).toBeGreaterThan(0.5);
    timer.finishEarly();
    expect(t()).toMatchObject({ mode: 'short', cycleCount: 1 });
    expect(data.get().history[0]).toMatchObject({ mode: 'focus', focusedMs: 15 * MIN });
    expect(data.get().history[0].abandoned).toBeUndefined();
    expect(events[0].early).toBe(true);
  });

  it('skip goes to the mode that would follow', () => {
    const { timer, t } = setup({ settings: { longBreakEvery: 1 } });
    timer.skip();
    expect(t().mode).toBe('long');
  });
});

describe('task time tracking', () => {
  const withTasks = (d: AppData): AppData => ({ ...d, tasks: [task('a'), task('b')], activeTaskId: 'a' });

  it('credits focus time and the pomodoro to the active task', () => {
    const { timer, data } = setup({ data: withTasks });
    timer.start();
    advance(25 * MIN + 100);
    const a = data.get().tasks[0];
    expect(a.trackedMs).toBe(25 * MIN);
    expect(a.pomodoros).toBe(1);
    expect(data.get().history[0].taskId).toBe('a');
  });

  it('splits time between tasks when switching mid-session', () => {
    const { timer, data } = setup({ data: withTasks });
    timer.start();
    advance(10 * MIN);
    timer.splitSegment();
    data.set({ activeTaskId: 'b' });
    advance(4 * MIN);
    timer.pause();
    const [a, b] = data.get().tasks;
    expect(a.trackedMs).toBe(10 * MIN);
    expect(b.trackedMs).toBe(4 * MIN);
    expect(timer.focusedMs()).toBe(14 * MIN);
  });

  it('does not count paused time or break time', () => {
    const { timer, data } = setup({ data: withTasks });
    timer.start();
    advance(5 * MIN);
    timer.pause();
    advance(30 * MIN);
    timer.start();
    advance(20 * MIN + 100);
    expect(data.get().tasks[0].trackedMs).toBe(25 * MIN);
    timer.start(); // short break
    advance(5 * MIN + 100);
    expect(data.get().tasks[0].trackedMs).toBe(25 * MIN);
  });
});

describe('interruptions', () => {
  it('tallies only during an in-progress focus session and resets per session', () => {
    const { timer, t, data } = setup();
    timer.interrupt('internal'); // idle: ignored
    timer.start();
    timer.interrupt('internal');
    timer.interrupt('external');
    timer.interrupt('external');
    expect(t().interruptions).toEqual({ internal: 1, external: 2 });
    advance(25 * MIN + 100);
    expect(data.get().history[0].interruptions).toEqual({ internal: 1, external: 2 });
    expect(t().interruptions).toEqual({ internal: 0, external: 0 });
  });
});

describe('adding and removing time', () => {
  it('extends and shortens a running session, never below a second', () => {
    const { timer, t } = setup();
    timer.start();
    advance(MIN);
    timer.addTime(MIN);
    expect(timer.remaining()).toBe(25 * MIN);
    timer.addTime(-5 * MIN);
    expect(timer.remaining()).toBe(20 * MIN);
    timer.addTime(-60 * MIN);
    expect(timer.remaining()).toBe(1000);
    advance(1100);
    expect(t().mode).toBe('short'); // the shortened session still completes
  });

  it('adjusts an idle or paused session', () => {
    const { timer, t } = setup();
    timer.addTime(5 * MIN);
    expect(t().remainingMs).toBe(30 * MIN);
    timer.start();
    advance(MIN);
    timer.pause();
    timer.addTime(-MIN);
    expect(timer.remaining()).toBe(28 * MIN);
  });

  it('progress stays within 0..1 when time is added beyond the planned length', () => {
    const { timer } = setup();
    timer.addTime(10 * MIN);
    expect(timer.progress()).toBe(0);
  });
});

describe('one-off session length', () => {
  it('runs a longer session without touching the setting, and records its real length', () => {
    const { timer, t, settings, data } = setup();
    timer.setLength(50 * MIN);
    timer.start();
    expect(timer.duration()).toBe(50 * MIN);
    expect(timer.remaining()).toBe(50 * MIN);
    advance(25 * MIN);
    expect(timer.progress()).toBe(0.5);
    advance(25 * MIN + 100);
    expect(data.get().history.at(-1)).toMatchObject({ mode: 'focus', durationMs: 50 * MIN });
    expect(settings.get().durations.focus).toBe(25);
    // The next session goes back to the usual lengths.
    expect(t().plannedMs).toBeNull();
    expect(timer.remaining()).toBe(5 * MIN);
  });

  it('keeps time already spent when a running session is resized', () => {
    const { timer } = setup();
    timer.start();
    advance(10 * MIN);
    timer.setLength(50 * MIN);
    expect(timer.remaining()).toBe(40 * MIN);
    expect(timer.progress()).toBeCloseTo(0.2);
  });

  it('is dropped on restart and when the setting changes', () => {
    const { timer, t, settings } = setup();
    timer.setLength(50 * MIN);
    timer.reset();
    expect(timer.remaining()).toBe(25 * MIN);
    timer.setLength(50 * MIN);
    settings.set({ durations: { ...settings.get().durations, focus: 30 } });
    expect(t().plannedMs).toBeNull();
    expect(timer.remaining()).toBe(30 * MIN);
  });
});
