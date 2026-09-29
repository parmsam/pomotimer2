import type { AppData, SessionRecord } from './types';

/** What a session gave its task, so a deletion can be undone exactly. */
export interface TaskCredit {
  taskId: string;
  pomodoros: number;
  trackedMs: number;
}

const sameSession = (a: SessionRecord, b: SessionRecord) => a.endedAt === b.endedAt && a.mode === b.mode;

/**
 * Removes one session from history and takes back what it credited to its task (the
 * pomodoro, and its focused time, never going below zero). Null if it's already gone.
 */
export function removeSession(d: AppData, rec: SessionRecord): (Pick<AppData, 'history' | 'tasks'> & { credit: TaskCredit | null }) | null {
  const i = d.history.findIndex((h) => sameSession(h, rec));
  if (i === -1) return null;
  const found = d.history[i];
  const history = [...d.history.slice(0, i), ...d.history.slice(i + 1)];
  const task = found.mode === 'focus' && found.taskId ? d.tasks.find((t) => t.id === found.taskId) : undefined;
  if (!task) return { history, tasks: d.tasks, credit: null };
  const credit: TaskCredit = {
    taskId: task.id,
    pomodoros: found.abandoned ? 0 : Math.min(1, task.pomodoros),
    trackedMs: Math.min(found.focusedMs ?? 0, task.trackedMs),
  };
  const tasks = d.tasks.map((t) =>
    t.id === task.id ? { ...t, pomodoros: t.pomodoros - credit.pomodoros, trackedMs: t.trackedMs - credit.trackedMs } : t,
  );
  return { history, tasks, credit };
}

/** Puts a removed session back in time order and returns its task credit. */
export function restoreSession(d: AppData, rec: SessionRecord, credit: TaskCredit | null): Pick<AppData, 'history' | 'tasks'> {
  if (d.history.some((h) => sameSession(h, rec))) return { history: d.history, tasks: d.tasks };
  let i = d.history.length;
  while (i > 0 && d.history[i - 1].endedAt > rec.endedAt) i--;
  const history = [...d.history.slice(0, i), rec, ...d.history.slice(i)];
  const tasks = credit
    ? d.tasks.map((t) => (t.id === credit.taskId ? { ...t, pomodoros: t.pomodoros + credit.pomodoros, trackedMs: t.trackedMs + credit.trackedMs } : t))
    : d.tasks;
  return { history, tasks };
}
