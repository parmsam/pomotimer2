import { formatTime } from './format';
import { computeStats } from './stats';
import type { Store } from './store';
import { COUNTS_AFTER, type Timer } from './timer';
import { MODE_LABELS, type AppData, type Mode, type Settings, type Task } from './types';

/**
 * `window.pomo`: a small scripting API for AI agents and automation driving the page
 * (Playwright `page.evaluate`, DevTools, browser agents). Calls act directly, without the
 * confirmation dialogs the buttons show; abandoning a focus session follows the usual rules.
 */
export interface PomoApi {
  readonly version: string;
  /** Plain-text description of this API. */
  help(): string;
  state(): PomoState;
  /** Start or resume. `mode` switches first (abandoning a focus session in progress); `minutes` is a one-off length; `task` picks an open task by id or title, adding it if needed. */
  start(opts?: { mode?: Mode; minutes?: number; task?: string }): PomoState;
  pause(): PomoState;
  /** Restart the current session. */
  reset(): PomoState;
  /** Move on to the next session without counting the current one. */
  skip(): PomoState;
  /** Count the current focus session now. Only allowed past the halfway mark. */
  finish(): PomoState;
  /** Add (or with a negative number, remove) minutes from the current session. */
  addMinutes(minutes: number): PomoState;
  tasks(): PomoTask[];
  addTask(title: string, estimate?: number): PomoTask;
  /** Make a task (by id or title) the current one, or clear it with null. */
  setTask(task: string | null): PomoState;
  /** Everything the command palette can do right now. */
  commands(): { id: string; title: string; group: string }[];
  /** Run a palette command by id or title, or palette text such as "start 50m focus". It behaves exactly like the palette, including any confirmation dialog. */
  run(command: string): PomoState;
}

export interface PomoState {
  mode: Mode;
  modeLabel: string;
  status: 'idle' | 'running' | 'paused';
  remainingMs: number;
  /** Time left as shown, e.g. "24:13". */
  remaining: string;
  durationMs: number;
  /** Share of the session elapsed, 0..1. */
  progress: number;
  /** Mode that follows this one. */
  next: Mode;
  /** Focus sessions done toward the long break, and how many it takes. */
  cycle: { done: number; every: number };
  task: { id: string; title: string } | null;
  today: { pomodoros: number; focusMinutes: number; goal: number; goalReached: boolean };
  streakDays: number;
}

export interface PomoTask {
  id: string;
  title: string;
  estimate: number;
  pomodoros: number;
  trackedMinutes: number;
  done: boolean;
  current: boolean;
}

export interface AgentCommand {
  id: string;
  title: string;
  group: string;
  run(): void | Promise<void>;
}

export interface AgentApiDeps {
  data: Store<AppData>;
  settings: Store<Settings>;
  timer: Timer;
  version: string;
  addTask(title: string, estimate: number): void;
  setActiveTask(id: string | null): void;
  commands(): AgentCommand[];
  /** Commands built from typed text, as in the palette. */
  parse(text: string): AgentCommand[];
}

const MODES: Mode[] = ['focus', 'short', 'long'];
const MAX_MINUTES = 24 * 60;

/**
 * Common requests and the calls that answer them, shown in `pomo.help()` and `llms.txt`.
 * The unit tests run every `code` against the real timer, so they can't go stale.
 */
export const RECIPES: { ask: string; code: string; note: string }[] = [
  {
    ask: 'What is the timer status?',
    code: 'pomo.state()',
    note: 'Report remaining, modeLabel, status, task and today. No need to read the page.',
  },
  {
    ask: 'Start a 50-minute focus session on "Write report"',
    code: "pomo.start({ mode: 'focus', minutes: 50, task: 'Write report' })",
    note: 'Check pomo.state() first: switching away from a focus session in progress abandons it.',
  },
  {
    ask: 'Add three tasks',
    code: "['Email Sam', 'Plan sprint', 'Review PRs'].map((title) => pomo.addTask(title))",
    note: 'One call per task, with an optional estimate: pomo.addTask(title, 3).',
  },
  {
    ask: 'Pause, or stop early',
    code: 'pomo.pause()',
    note: "pause() keeps the session. Past halfway, pomo.finish() counts it; skip() and reset() don't.",
  },
  {
    ask: 'Change a setting or the theme',
    code: "pomo.run('Theme:matcha')",
    note: 'Find ids with pomo.commands(). Never edit localStorage directly.',
  },
];

const HELP = `pomo: Pomodoro timer scripting API (window.pomo). Data stays in this browser.
All calls are synchronous and return the new state unless noted.

pomo.state()                         mode, status, time left, current task, today's totals, streak
pomo.start({ mode?, minutes?, task? })  start/resume; mode = "focus" | "short" | "long";
                                     minutes = one-off length; task = id or title (added if new)
pomo.pause()
pomo.reset()                         restart the current session
pomo.skip()                          next session; an unfinished focus session doesn't count
pomo.finish()                        count the current focus session now (past halfway only)
pomo.addMinutes(n)                   n may be negative
pomo.tasks()                         the task list
pomo.addTask(title, estimate?)       returns the new task
pomo.setTask(idOrTitle | null)       make a task current
pomo.commands()                      every command-palette action available now
pomo.run(idOrText)                   run one, e.g. pomo.run("Theme:matcha") or pomo.run("start 50m focus")

Leaving a focus session early keeps its focused minutes in today's total.
Sound can't start until someone has clicked or pressed a key on the page.

Common requests:
${RECIPES.map((r) => `- ${r.ask}\n    ${r.code}\n    ${r.note}`).join('\n')}`;

export function createAgentApi(deps: AgentApiDeps): PomoApi {
  const { data, settings, timer } = deps;
  const t = () => data.get().timer;

  function state(): PomoState {
    const d = data.get();
    const s = settings.get();
    const now = Date.now();
    const stats = computeStats(d.history, { now, dailyGoal: s.dailyGoal, liveFocusMs: t().mode === 'focus' ? timer.focusedMs() : 0 });
    const task = d.tasks.find((x) => x.id === d.activeTaskId);
    const remainingMs = timer.remaining();
    return {
      mode: t().mode,
      modeLabel: MODE_LABELS[t().mode],
      status: t().status,
      remainingMs,
      remaining: formatTime(remainingMs),
      durationMs: timer.duration(),
      progress: Math.round(timer.progress() * 1000) / 1000,
      next: timer.upcoming(),
      cycle: { done: t().cycleCount % s.longBreakEvery, every: s.longBreakEvery },
      task: task ? { id: task.id, title: task.title } : null,
      today: {
        pomodoros: stats.today.pomodoros,
        focusMinutes: Math.floor(stats.today.focusMs / 60_000),
        goal: stats.goal.target,
        goalReached: stats.goal.reached,
      },
      streakDays: stats.streak.current,
    };
  }

  const toTask = (x: Task): PomoTask => ({
    id: x.id,
    title: x.title,
    estimate: x.estimate,
    pomodoros: x.pomodoros,
    trackedMinutes: Math.floor(x.trackedMs / 60_000),
    done: x.done,
    current: x.id === data.get().activeTaskId,
  });

  const findTask = (key: string) => {
    const k = key.trim().toLowerCase();
    return data.get().tasks.find((x) => x.id === key) ?? data.get().tasks.find((x) => !x.done && x.title.toLowerCase() === k);
  };

  function addTask(title: string, estimate = 1): PomoTask {
    const clean = String(title ?? '').trim();
    if (!clean) throw new Error('pomo.addTask: title is required');
    const est = Math.round(Number(estimate));
    if (!(est >= 1 && est <= 20)) throw new Error('pomo.addTask: estimate must be 1–20 pomodoros');
    const before = new Set(data.get().tasks.map((x) => x.id));
    deps.addTask(clean, est);
    const added = data.get().tasks.find((x) => !before.has(x.id));
    if (!added) throw new Error('pomo.addTask: the task could not be added');
    return toTask(added);
  }

  function setTask(key: string | null): PomoState {
    if (key === null) {
      deps.setActiveTask(null);
      return state();
    }
    const task = findTask(String(key));
    if (!task) throw new Error(`pomo.setTask: no task “${key}”. See pomo.tasks()`);
    if (task.done) throw new Error(`pomo.setTask: “${task.title}” is done`);
    deps.setActiveTask(task.id);
    return state();
  }

  function start(opts: { mode?: Mode; minutes?: number; task?: string } = {}): PomoState {
    const { mode, minutes, task } = opts ?? {};
    if (mode !== undefined && !MODES.includes(mode)) throw new Error(`pomo.start: mode must be one of ${MODES.join(', ')}`);
    if (minutes !== undefined && !(Number.isFinite(minutes) && minutes >= 1 && minutes <= MAX_MINUTES)) {
      throw new Error(`pomo.start: minutes must be 1–${MAX_MINUTES}`);
    }
    if (task !== undefined) {
      const found = findTask(task);
      if (found) setTask(found.id);
      else deps.setActiveTask(addTask(task).id);
    }
    if (mode && mode !== t().mode) timer.setMode(mode);
    if (minutes !== undefined) timer.setLength(Math.round(minutes) * 60_000);
    timer.start();
    return state();
  }

  return {
    version: deps.version,
    help: () => HELP,
    state,
    start,
    pause() {
      timer.pause();
      return state();
    },
    reset() {
      timer.reset();
      return state();
    },
    skip() {
      timer.skip();
      return state();
    },
    finish() {
      if (t().mode !== 'focus' || t().status === 'idle') throw new Error('pomo.finish: no focus session in progress');
      if (timer.progress() < COUNTS_AFTER) throw new Error('pomo.finish: a pomodoro counts only past the halfway mark');
      timer.finishEarly();
      return state();
    },
    addMinutes(n: number) {
      if (!Number.isFinite(n) || n === 0) throw new Error('pomo.addMinutes: pass a non-zero number of minutes');
      timer.addTime(Math.round(n * 60_000));
      return state();
    },
    tasks: () => data.get().tasks.map(toTask),
    addTask,
    setTask,
    commands: () => deps.commands().map(({ id, title, group }) => ({ id, title, group })),
    run(command: string) {
      const text = String(command ?? '').trim();
      const all = deps.commands();
      const lower = text.toLowerCase();
      const cmd =
        all.find((c) => c.id === text) ??
        all.find((c) => c.id.toLowerCase() === lower || c.title.toLowerCase() === lower) ??
        deps.parse(text)[0];
      if (!cmd) throw new Error(`pomo.run: no command matches “${text}”. See pomo.commands()`);
      // Palette commands may open a dialog; don't wait on it.
      void Promise.resolve(cmd.run()).catch(() => {});
      return state();
    },
  };
}

declare global {
  interface Window {
    pomo?: PomoApi;
  }
}
