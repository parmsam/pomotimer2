import { formatDuration } from './format';
import { computeStats, dayKey } from './stats';
import type { InterruptionNote, SessionRecord, Task } from './types';

export interface ParsedTask {
  title: string;
  estimate: number;
  /** Pomodoros already done, from an exported "🍅2/4". */
  pomodoros: number;
  done: boolean;
}

const MAX_ESTIMATE = 20;
const clampEstimate = (n: number) => Math.min(MAX_ESTIMATE, Math.max(1, Math.round(n) || 1));

/**
 * Tasks from Markdown, one per line. Accepts:
 *   - [ ] Write report 🍅3     - [x] Done task      * item   1. item   plain line
 *   estimates as 🍅3, 🍅🍅🍅, 🍅2/4 (done/estimate, as exported) or a trailing (3)
 * Headings, blank lines, code fences and horizontal rules are skipped.
 */
export function parseTasksMarkdown(text: string): { tasks: ParsedTask[]; skipped: number } {
  const tasks: ParsedTask[] = [];
  let skipped = 0;
  let inFence = false;
  for (const raw of text.split(/\r?\n/)) {
    let line = raw.trim();
    if (line.startsWith('```')) {
      inFence = !inFence;
      continue;
    }
    if (!line || inFence) continue;
    if (/^#{1,6}\s/.test(line) || /^([-*_]\s*){3,}$/.test(line) || line.startsWith('|') || line.startsWith('>')) {
      skipped++;
      continue;
    }

    line = line.replace(/^([-*+]|\d+[.)])\s+/, '');
    let done = false;
    const box = line.match(/^\[( |x|X)\]\s*/);
    if (box) {
      done = box[1] !== ' ';
      line = line.slice(box[0].length);
    }

    let estimate = 1;
    let pomodoros = 0;
    // "🍅2/4 · 1h 12m" (our export), "🍅 3", "🍅🍅🍅" — plus anything after it on the line.
    const tomato = line.match(/\s*(🍅️?)+\s*(\d+)?(?:\s*\/\s*(\d+))?(\s*·.*)?$/u);
    if (tomato) {
      const count = [...tomato[0].matchAll(/🍅/gu)].length;
      if (tomato[3]) {
        pomodoros = Number(tomato[2]);
        estimate = Number(tomato[3]);
      } else estimate = tomato[2] ? Number(tomato[2]) : count;
      line = line.slice(0, tomato.index).trim();
    } else {
      const paren = line.match(/\s*\((\d+)\)$/);
      if (paren) {
        estimate = Number(paren[1]);
        line = line.slice(0, paren.index).trim();
      }
    }

    line = line.replace(/^~~(.*)~~$/, '$1').trim();
    if (!line) {
      skipped++;
      continue;
    }
    tasks.push({ title: line.slice(0, 120), estimate: clampEstimate(estimate), pomodoros: Math.max(0, Math.min(pomodoros, 999)), done });
  }
  return { tasks, skipped };
}

export function taskToMarkdown(t: Task): string {
  const time = t.trackedMs >= 60_000 ? ` · ${formatDuration(t.trackedMs)}` : '';
  return `- [${t.done ? 'x' : ' '}] ${t.title} 🍅${t.pomodoros}/${t.estimate}${time}`;
}

export const tasksToMarkdown = (tasks: Task[]) => tasks.map(taskToMarkdown).join('\n');

const timeOf = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const longDate = (key: string) =>
  new Date(`${key}T12:00:00`).toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });
const esc = (s: string) => s.replace(/\|/g, '\\|');

const MODE_NAMES = { focus: 'Focus', short: 'Short break', long: 'Long break' } as const;

/**
 * A readable log of sessions, grouped by day (newest first), for `days` days ending
 * `now` (all history when `days` is null). Includes today's tasks and notes when the
 * range covers today.
 */
export function historyToMarkdown(input: {
  history: SessionRecord[];
  tasks: Task[];
  notes: InterruptionNote[];
  now: number;
  days: number | null;
  dailyGoal: number;
}): string {
  const { history, tasks, notes, now, days, dailyGoal } = input;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (days !== null) start.setDate(start.getDate() - (days - 1));
  const inRange = history.filter((r) => days === null || r.endedAt >= start.getTime());
  const taskName = new Map(tasks.map((t) => [t.id, t.title]));
  const stats = computeStats(history, { now, dailyGoal });

  const out: string[] = [];
  const title = days === 1 ? `Pomodoro log · ${longDate(dayKey(now))}` : days === null ? 'Pomodoro log · all time' : `Pomodoro log · last ${days} days`;
  out.push(`# ${title}`, '');
  const focus = inRange.filter((r) => r.mode === 'focus');
  const counted = focus.filter((r) => !r.abandoned).length;
  const focusMs = focus.reduce((n, r) => n + (r.focusedMs ?? (r.abandoned ? 0 : r.durationMs)), 0);
  out.push(`**${counted} pomodoro${counted === 1 ? '' : 's'} · ${formatDuration(focusMs)} focused** · 🔥 ${stats.streak.current}-day streak`, '');

  const coversToday = days === null || start.getTime() <= now;
  if (coversToday && tasks.length) out.push('## Tasks', '', tasksToMarkdown(tasks), '');
  if (coversToday && notes.length) {
    out.push('## Noted for later', '', ...notes.map((n) => `- ${n.text} (${n.kind}, ${timeOf(n.at)})`), '');
  }

  const byDay = new Map<string, SessionRecord[]>();
  for (const r of [...inRange].sort((a, b) => b.endedAt - a.endedAt)) {
    const k = dayKey(r.endedAt);
    byDay.set(k, [...(byDay.get(k) ?? []), r]);
  }
  if (!byDay.size) out.push('_No sessions in this period._', '');
  for (const [key, records] of byDay) {
    const dayFocus = records.filter((r) => r.mode === 'focus');
    const dayCounted = dayFocus.filter((r) => !r.abandoned).length;
    const dayMs = dayFocus.reduce((n, r) => n + (r.focusedMs ?? (r.abandoned ? 0 : r.durationMs)), 0);
    out.push(`## ${longDate(key)}`, '', `${dayCounted} pomodoro${dayCounted === 1 ? '' : 's'} · ${formatDuration(dayMs)} focused`, '');
    out.push('| Ended | Session | Task | Focused |', '|---|---|---|---|');
    for (const r of [...records].reverse()) {
      const session = `${MODE_NAMES[r.mode]}${r.abandoned ? ' (abandoned)' : ''}`;
      const task = r.taskId ? esc(taskName.get(r.taskId) ?? '(deleted task)') : '';
      const focused = r.mode === 'focus' ? formatDuration(r.focusedMs ?? r.durationMs) : '';
      out.push(`| ${timeOf(r.endedAt)} | ${session} | ${task} | ${focused} |`);
    }
    out.push('');
  }
  return out.join('\n').trimEnd() + '\n';
}
