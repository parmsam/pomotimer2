import { describe, expect, it } from 'vitest';
import { historyToMarkdown, parseTasksMarkdown, tasksToMarkdown } from './markdown';
import type { SessionRecord, Task } from './types';

const MIN = 60_000;
const task = (extra: Partial<Task>): Task => ({ id: 'x', title: 'T', estimate: 1, pomodoros: 0, trackedMs: 0, done: false, createdAt: 0, doneAt: null, ...extra });

describe('parseTasksMarkdown', () => {
  it('reads the documented syntax', () => {
    const { tasks } = parseTasksMarkdown(`
- [ ] Write report 🍅3
- [x] Review PRs 🍅1
- Plan sprint (2)
Email Sam
* Star bullet
+ Plus bullet
1. Numbered 🍅🍅
2) Other numbered
`);
    expect(tasks).toEqual([
      { title: 'Write report', estimate: 3, pomodoros: 0, done: false },
      { title: 'Review PRs', estimate: 1, pomodoros: 0, done: true },
      { title: 'Plan sprint', estimate: 2, pomodoros: 0, done: false },
      { title: 'Email Sam', estimate: 1, pomodoros: 0, done: false },
      { title: 'Star bullet', estimate: 1, pomodoros: 0, done: false },
      { title: 'Plus bullet', estimate: 1, pomodoros: 0, done: false },
      { title: 'Numbered', estimate: 2, pomodoros: 0, done: false },
      { title: 'Other numbered', estimate: 1, pomodoros: 0, done: false },
    ]);
  });

  it('skips headings, rules, quotes, tables and code blocks, and counts what it skipped', () => {
    const { tasks, skipped } = parseTasksMarkdown(['## Work', '---', '> quote', '| a | b |', '```', '- not a task', '```', '- [ ] Real'].join('\n'));
    expect(tasks.map((t) => t.title)).toEqual(['Real']);
    expect(skipped).toBe(4);
  });

  it('keeps titles that merely contain numbers, brackets or dots', () => {
    const { tasks } = parseTasksMarkdown('- Read ch. 3 (intro) and v1.2 notes\n- [ ] Fix bug #42');
    expect(tasks.map((t) => [t.title, t.estimate])).toEqual([
      ['Read ch. 3 (intro) and v1.2 notes', 1],
      ['Fix bug #42', 1],
    ]);
  });

  it('clamps estimates and handles uppercase X and strikethrough', () => {
    const { tasks } = parseTasksMarkdown('- [X] ~~Old thing~~ 🍅0\n- Huge (99)');
    expect(tasks).toEqual([
      { title: 'Old thing', estimate: 1, pomodoros: 0, done: true },
      { title: 'Huge', estimate: 20, pomodoros: 0, done: false },
    ]);
  });

  it('round-trips the export format, including progress', () => {
    const original = [
      task({ title: 'Draft report', estimate: 4, pomodoros: 2, trackedMs: 72 * MIN }),
      task({ title: 'Review PRs', estimate: 2, pomodoros: 2, trackedMs: 48 * MIN, done: true }),
      task({ title: 'Plain', estimate: 1 }),
    ];
    const md = tasksToMarkdown(original);
    expect(md).toBe(['- [ ] Draft report 🍅2/4 · 1h 12m', '- [x] Review PRs 🍅2/2 · 48m', '- [ ] Plain 🍅0/1'].join('\n'));
    expect(parseTasksMarkdown(md).tasks).toEqual(
      original.map((t) => ({ title: t.title, estimate: t.estimate, pomodoros: t.pomodoros, done: t.done })),
    );
  });

  it('handles Windows line endings', () => {
    expect(parseTasksMarkdown('- a\r\n- b\r\n').tasks.map((t) => t.title)).toEqual(['a', 'b']);
  });
});

describe('historyToMarkdown', () => {
  const at = (d: string, t: string) => new Date(`${d}T${t}:00`).getTime();
  const NOW = at('2026-03-10', '17:00');
  const history: SessionRecord[] = [
    { mode: 'focus', endedAt: at('2026-03-09', '10:00'), durationMs: 25 * MIN, focusedMs: 25 * MIN, taskId: 'a' },
    { mode: 'focus', endedAt: at('2026-03-10', '09:25'), durationMs: 25 * MIN, focusedMs: 25 * MIN, taskId: 'a' },
    { mode: 'short', endedAt: at('2026-03-10', '09:30'), durationMs: 5 * MIN },
    { mode: 'focus', endedAt: at('2026-03-10', '09:40'), durationMs: 25 * MIN, focusedMs: 8 * MIN, abandoned: true, taskId: 'gone' },
  ];
  const base = { history, tasks: [task({ id: 'a', title: 'Draft | report', estimate: 3, pomodoros: 2 })], notes: [], now: NOW, dailyGoal: 4 };

  it('summarizes today with tasks and a per-session table', () => {
    const md = historyToMarkdown({ ...base, days: 1 });
    expect(md).toContain('# Pomodoro log · Tuesday, Mar 10, 2026');
    expect(md).toContain('**1 pomodoro · 33m focused** · 🔥 2-day streak');
    expect(md).toContain('## Tasks');
    expect(md).toContain('- [ ] Draft | report 🍅2/3');
    expect(md).toContain('| Focus | Draft \\| report | 25m |');
    expect(md).toContain('| Focus (abandoned) | (deleted task) | 8m |');
    expect(md).toContain('| Short break |  |  |');
    expect(md).not.toContain('Mar 9');
  });

  it('groups a longer range by day, newest first', () => {
    const md = historyToMarkdown({ ...base, days: 7 });
    expect(md.indexOf('Tuesday, Mar 10')).toBeLessThan(md.indexOf('Monday, Mar 9'));
    expect(md).toContain('**2 pomodoros · 58m focused**');
  });

  it('says so when there is nothing to show', () => {
    expect(historyToMarkdown({ ...base, history: [], tasks: [], days: 1 })).toContain('_No sessions in this period._');
  });
});
