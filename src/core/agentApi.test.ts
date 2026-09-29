import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAgentApi, RECIPES, type AgentCommand } from './agentApi';
import { DEFAULT_SETTINGS, defaultAppData } from './storage';
import { createStore } from './store';
import { createTimer } from './timer';
import type { AppData, Settings, Task } from './types';

const MIN = 60_000;
const T0 = new Date('2026-01-05T09:00:00Z').getTime();

function setup(commands: AgentCommand[] = [], parse: (text: string) => AgentCommand[] = () => []) {
  const settings = createStore<Settings>(structuredClone(DEFAULT_SETTINGS));
  const data = createStore<AppData>(defaultAppData(settings.get()));
  const timer = createTimer(data, settings, () => {});
  let n = 0;
  const api = createAgentApi({
    data,
    settings,
    timer,
    version: '9.9.9',
    addTask(title, estimate) {
      const task: Task = { id: `t${++n}`, title, estimate, pomodoros: 0, trackedMs: 0, done: false, createdAt: Date.now(), doneAt: null };
      data.set((d) => ({ tasks: [...d.tasks, task] }));
    },
    setActiveTask: (id) => data.set({ activeTaskId: id }),
    commands: () => commands,
    parse,
  });
  return { api, data, settings, timer };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});
afterEach(() => vi.useRealTimers());

describe('pomo API', () => {
  it('describes itself', () => {
    const { api } = setup();
    expect(api.version).toBe('9.9.9');
    expect(api.help()).toContain('pomo.start');
  });

  it('reports state as plain data', () => {
    const { api } = setup();
    expect(api.state()).toMatchObject({
      mode: 'focus',
      modeLabel: 'Focus',
      status: 'idle',
      remaining: '25:00',
      durationMs: 25 * MIN,
      progress: 0,
      next: 'short',
      cycle: { done: 0, every: 4 },
      task: null,
      today: { pomodoros: 0, focusMinutes: 0, goal: 8, goalReached: false },
      streakDays: 0,
    });
    expect(JSON.parse(JSON.stringify(api.state()))).toEqual(api.state());
  });

  it('starts, pauses and counts down from the clock', () => {
    const { api } = setup();
    expect(api.start().status).toBe('running');
    vi.advanceTimersByTime(5 * MIN);
    expect(api.state()).toMatchObject({ remaining: '20:00', progress: 0.2, today: { focusMinutes: 5 } });
    expect(api.pause().status).toBe('paused');
  });

  it('starts another mode with a one-off length, leaving the setting alone', () => {
    const { api, settings } = setup();
    expect(api.start({ mode: 'short', minutes: 10 })).toMatchObject({ mode: 'short', status: 'running', durationMs: 10 * MIN });
    expect(settings.get().durations.short).toBe(5);
  });

  it('start picks an existing task by title or id, or adds it', () => {
    const { api } = setup();
    const a = api.addTask('Write report', 2);
    expect(a).toMatchObject({ title: 'Write report', estimate: 2, done: false });
    api.addTask('Email');
    expect(api.start({ task: 'write REPORT' }).task).toEqual({ id: a.id, title: 'Write report' });
    api.pause();
    expect(api.start({ task: 'Plan sprint' }).task?.title).toBe('Plan sprint');
    expect(api.tasks().map((x) => x.title)).toEqual(['Write report', 'Email', 'Plan sprint']);
    expect(api.tasks().find((x) => x.current)?.title).toBe('Plan sprint');
  });

  it('setTask changes or clears the current task', () => {
    const { api } = setup();
    const a = api.addTask('A');
    expect(api.setTask(a.id).task?.id).toBe(a.id);
    expect(api.setTask(null).task).toBeNull();
    expect(() => api.setTask('nope')).toThrow(/no task/);
  });

  it('rejects bad input with a helpful error', () => {
    const { api } = setup();
    expect(() => api.start({ mode: 'nap' as never })).toThrow(/mode must be/);
    expect(() => api.start({ minutes: 0 })).toThrow(/minutes/);
    expect(() => api.addTask('  ')).toThrow(/title/);
    expect(() => api.addTask('A', 50)).toThrow(/estimate/);
    expect(() => api.addMinutes(0)).toThrow();
    expect(api.state().status).toBe('idle');
  });

  it('finish counts a focus session only past halfway', () => {
    const { api } = setup();
    expect(() => api.finish()).toThrow(/no focus session/);
    api.start();
    vi.advanceTimersByTime(10 * MIN);
    expect(() => api.finish()).toThrow(/halfway/);
    vi.advanceTimersByTime(5 * MIN);
    expect(api.finish()).toMatchObject({ mode: 'short', status: 'idle', today: { pomodoros: 1 } });
  });

  it('skip moves on without counting; focused minutes stay in today', () => {
    const { api } = setup();
    api.start();
    vi.advanceTimersByTime(5 * MIN);
    expect(api.skip()).toMatchObject({ mode: 'short', today: { pomodoros: 0, focusMinutes: 5 } });
  });

  it('reset restarts and addMinutes adjusts the session', () => {
    const { api } = setup();
    api.start();
    expect(api.addMinutes(5).remaining).toBe('30:00');
    vi.advanceTimersByTime(MIN);
    expect(api.reset()).toMatchObject({ status: 'idle', remaining: '25:00' });
  });

  it('lists and runs palette commands by id, title or typed text', () => {
    const ran: string[] = [];
    const cmd = (id: string, title: string): AgentCommand => ({ id, title, group: 'Test', run: () => void ran.push(id) });
    const { api } = setup([cmd('theme:matcha', 'Theme: Matcha'), cmd('mute', 'Mute sounds')], (text) =>
      text === 'start 50m focus' ? [cmd('parsed:start', 'Start a 50 min focus')] : [],
    );
    expect(api.commands()).toEqual([
      { id: 'theme:matcha', title: 'Theme: Matcha', group: 'Test' },
      { id: 'mute', title: 'Mute sounds', group: 'Test' },
    ]);
    api.run('theme:matcha');
    api.run('mute SOUNDS');
    api.run('start 50m focus');
    expect(ran).toEqual(['theme:matcha', 'mute', 'parsed:start']);
    expect(() => api.run('fly me to the moon')).toThrow(/no command/);
  });
});

describe('agent recipes', () => {
  it('every recipe runs against the real timer', () => {
    const ran: string[] = [];
    const { api, data } = setup([{ id: 'Theme:matcha', title: 'Theme: Matcha', group: 'Appearance', run: () => void ran.push('matcha') }]);
    for (const r of RECIPES) {
      const result = new Function('pomo', `return ${r.code}`)(api) as unknown;
      expect(result, r.ask).toBeTruthy();
    }
    expect(data.get().timer).toMatchObject({ mode: 'focus', status: 'paused' });
    expect(api.tasks().map((x) => x.title)).toEqual(['Write report', 'Email Sam', 'Plan sprint', 'Review PRs']);
    expect(ran).toEqual(['matcha']);
  });

  it('help() and llms.txt show every recipe', () => {
    const { api } = setup();
    const llms = readFileSync('public/llms.txt', 'utf8');
    for (const r of RECIPES) {
      expect(api.help()).toContain(r.code);
      expect(llms, r.ask).toContain(r.code);
    }
  });
});
