import type { Store } from '../core/store';
import { COUNTS_AFTER, type Timer } from '../core/timer';
import { MODE_LABELS, type AppData, type Mode } from '../core/types';
import { ask } from './dialog';

function focusedPhrase(ms: number): string {
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return 'the time you’ve focused';
  return `your ${mins} focused minute${mins === 1 ? '' : 's'}`;
}

/**
 * Reset / skip / switch with gentle guard rails, following the Pomodoro rule that a
 * pomodoro is indivisible: stopping early abandons it (focused minutes still count
 * toward today), but past the halfway mark you can still count it.
 */
export function createSessionActions(data: Store<AppData>, timer: Timer) {
  const t = () => data.get().timer;
  const focusInProgress = () => t().mode === 'focus' && timer.inProgress();
  const pastHalf = () => timer.progress() >= COUNTS_AFTER;
  const kept = () => focusedPhrase(timer.focusedMs());
  /** Wraps a dialog so its answer is dropped if the session ended while it was open. */
  async function confirmFor(opts: Parameters<typeof ask>[0]) {
    const before = `${t().mode}:${data.get().history.length}`;
    const r = await ask(opts);
    return before === `${t().mode}:${data.get().history.length}` ? r : 'cancel';
  }

  /** Pausing a running break, optionally after a confirmation (guards against stray taps). */
  async function pauseBreak(confirm: boolean) {
    if (!confirm) return timer.toggle();
    const r = await confirmFor({ title: 'Pause this break?', body: 'Your break is still running. Pause it?', confirm: 'Pause', cancel: 'Keep resting' });
    if (r === 'confirm' && t().status === 'running') timer.toggle();
  }

  async function reset(verb: 'Restart' | 'Stop' = 'Restart') {
    if (!focusInProgress()) return timer.reset();
    // Decide up front: the clock keeps running while the dialog is open.
    const half = pastHalf();
    const r = half
      ? await confirmFor({
          title: `${verb} this pomodoro?`,
          body: `You’re past halfway, so you can still count it. ${verb === 'Stop' ? 'Stopping' : 'Restarting'} without counting keeps ${kept()} in today’s total.`,
          confirm: 'Count it',
          secondary: `${verb} without counting`,
        })
      : await confirmFor({
          title: `${verb} this pomodoro?`,
          body: `It won’t count as a session, but ${kept()} stay in today’s total.`,
          confirm: verb,
          danger: true,
        });
    if (half && r === 'confirm') timer.finishEarly();
    else if (r === (half ? 'secondary' : 'confirm')) timer.reset();
  }

  async function skip() {
    if (!timer.inProgress()) return timer.skip();
    if (t().mode !== 'focus') {
      const r = await confirmFor({ title: 'Skip this break?', body: 'Rest is what keeps the next pomodoro sharp.', confirm: 'Skip break' });
      if (r === 'confirm') timer.skip();
      return;
    }
    const next = MODE_LABELS[timer.upcoming()].toLowerCase();
    if (pastHalf()) {
      const r = await confirmFor({
        title: 'Wrap up early?',
        body: `You’re past halfway, so this pomodoro counts. On to your ${next}.`,
        confirm: 'Count it',
        secondary: 'Skip without counting',
      });
      if (r === 'confirm') timer.finishEarly();
      else if (r === 'secondary') timer.skip();
    } else {
      const r = await confirmFor({
        title: `Skip to your ${next}?`,
        body: `This pomodoro won’t count, but ${kept()} stay in today’s total.`,
        confirm: 'Skip',
        danger: true,
      });
      if (r === 'confirm') timer.skip();
    }
  }

  async function switchTo(mode: Mode) {
    if (mode === t().mode) return;
    if (!focusInProgress()) return timer.setMode(mode);
    const title = `Switch to ${MODE_LABELS[mode]}?`;
    if (pastHalf()) {
      const r = await confirmFor({
        title,
        body: 'You’re past halfway, so this pomodoro still counts.',
        confirm: 'Count it & switch',
        secondary: 'Switch without counting',
      });
      if (r === 'confirm') timer.finishEarly();
      if (r !== 'cancel' && t().mode !== mode) timer.setMode(mode);
    } else {
      const r = await confirmFor({ title, body: `This pomodoro won’t count, but ${kept()} stay in today’s total.`, confirm: 'Switch', danger: true });
      if (r === 'confirm') timer.setMode(mode);
    }
  }

  return { reset, skip, switchTo, pauseBreak };
}
