import { parseMinutes } from './commands';
import type { Mode } from './types';

/**
 * Actions triggered from a link, e.g. `?do=start&mode=focus&min=50&task=Write+report`.
 * Settings are never carried in the URL; the action runs on top of the saved ones.
 */
export type UrlAction =
  | { kind: 'start'; mode: Mode | null; minutes: number | null; task: string | null }
  | { kind: 'pause' }
  | { kind: 'skip' }
  | { kind: 'reset' }
  | { kind: 'add-task'; title: string; estimate: number }
  /** A `do=` link we can't run, with a reason to show. */
  | { kind: 'invalid'; reason: string };

/** Query parameters that belong to an action (removed once it has run). */
export const ACTION_PARAMS = ['do', 'mode', 'min', 'task', 'estimate'] as const;

const MODES: Record<string, Mode> = { focus: 'focus', work: 'focus', short: 'short', break: 'short', long: 'long' };
const MAX_TITLE = 200;

export function parseUrlAction(search: string): UrlAction | null {
  const q = new URLSearchParams(search);
  const verb = q.get('do')?.trim().toLowerCase();
  if (!verb) return null;
  const task = q.get('task')?.trim().slice(0, MAX_TITLE) || null;

  switch (verb) {
    case 'start': {
      const modeParam = q.get('mode')?.trim().toLowerCase();
      const mode = modeParam ? (MODES[modeParam] ?? null) : null;
      if (modeParam && !mode) return { kind: 'invalid', reason: `unknown mode “${modeParam}” (use focus, short or long)` };
      const minParam = q.get('min')?.trim();
      const minutes = minParam ? parseMinutes(minParam) : null;
      if (minParam && !minutes) return { kind: 'invalid', reason: `“${minParam}” isn’t a length in minutes (1–1440)` };
      return { kind: 'start', mode, minutes, task };
    }
    case 'pause':
    case 'skip':
    case 'reset':
      return { kind: verb };
    case 'add-task': {
      if (!task) return { kind: 'invalid', reason: 'add-task needs a task, e.g. &task=Write+report' };
      const estimate = Math.round(Number(q.get('estimate') ?? 1));
      return { kind: 'add-task', title: task, estimate: estimate >= 1 && estimate <= 20 ? estimate : 1 };
    }
    default:
      return { kind: 'invalid', reason: `unknown action “${verb}”` };
  }
}

/** The same URL without the action's parameters, so a reload doesn't run it again. */
export function stripAction(href: string): string {
  const url = new URL(href);
  ACTION_PARAMS.forEach((p) => url.searchParams.delete(p));
  return url.pathname + url.search + url.hash;
}
