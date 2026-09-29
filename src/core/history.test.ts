import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, defaultAppData } from './storage';
import { removeSession, restoreSession } from './history';
import type { AppData, SessionRecord, Task } from './types';

const MIN = 60_000;
const task = (id: string, extra: Partial<Task> = {}): Task => ({
  id,
  title: id,
  estimate: 2,
  pomodoros: 0,
  trackedMs: 0,
  done: false,
  createdAt: 1,
  doneAt: null,
  ...extra,
});
const focus = (endedAt: number, extra: Partial<SessionRecord> = {}): SessionRecord => ({
  mode: 'focus',
  endedAt,
  durationMs: 25 * MIN,
  focusedMs: 25 * MIN,
  taskId: 'a',
  ...extra,
});

function appData(history: SessionRecord[], tasks: Task[]): AppData {
  return { ...defaultAppData(structuredClone(DEFAULT_SETTINGS)), history, tasks };
}

describe('removeSession', () => {
  it('removes the session and takes back its pomodoro and focused time', () => {
    const d = appData([focus(100), focus(200)], [task('a', { pomodoros: 2, trackedMs: 50 * MIN })]);
    const r = removeSession(d, focus(200))!;
    expect(r.history.map((h) => h.endedAt)).toEqual([100]);
    expect(r.tasks[0]).toMatchObject({ pomodoros: 1, trackedMs: 25 * MIN });
    expect(r.credit).toEqual({ taskId: 'a', pomodoros: 1, trackedMs: 25 * MIN });
  });

  it('keeps the pomodoro count for an abandoned session, and never goes below zero', () => {
    const d = appData([focus(100, { abandoned: true, focusedMs: 10 * MIN })], [task('a', { pomodoros: 3, trackedMs: 4 * MIN })]);
    const r = removeSession(d, d.history[0])!;
    expect(r.tasks[0]).toMatchObject({ pomodoros: 3, trackedMs: 0 });
  });

  it('works when the task has been deleted, and returns null once the session is gone', () => {
    const d = appData([focus(100, { taskId: 'gone' })], []);
    const r = removeSession(d, d.history[0])!;
    expect(r).toMatchObject({ history: [], credit: null });
    expect(removeSession({ ...d, history: [] }, focus(100))).toBeNull();
  });
});

describe('restoreSession', () => {
  it('undoes a removal exactly, in time order', () => {
    const d = appData([focus(100), focus(200), focus(300)], [task('a', { pomodoros: 3, trackedMs: 75 * MIN })]);
    const removed = removeSession(d, focus(200))!;
    const after = { ...d, ...removed };
    const back = restoreSession(after, focus(200), removed.credit);
    expect(back.history.map((h) => h.endedAt)).toEqual([100, 200, 300]);
    expect(back.tasks).toEqual(d.tasks);
    // Restoring twice is harmless.
    expect(restoreSession({ ...d, ...back }, focus(200), removed.credit).history).toHaveLength(3);
  });
});
