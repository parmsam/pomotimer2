import { animate, stagger } from 'animejs';
import { formatDuration } from '../core/format';
import { removeSession, restoreSession } from '../core/history';
import { computeStats, dayKey, STREAK_FOCUS_MS, type DayStats, type Stats } from '../core/stats';
import type { Store } from '../core/store';
import type { Timer } from '../core/timer';
import type { AppData, Mode, SessionRecord, Settings } from '../core/types';
import { reducedMotion } from '../fx/anims';
import { toast } from './toast';

export interface StatsView {
  current(): Stats;
  /** Re-render the always-visible bits (streak chip, goal meter, tab counts). */
  refresh(): void;
  open(): void;
  isOpen(): boolean;
}

const RECENT = 15;
const TRASH = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>';

/** "Today 10:32", "Yesterday 18:05", "Mon, Sep 22 09:10". */
function when(ts: number): string {
  const time = new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const key = dayKey(ts);
  const now = new Date();
  if (key === dayKey(now.getTime())) return `Today ${time}`;
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  if (key === dayKey(y.getTime())) return `Yesterday ${time}`;
  return `${new Date(ts).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} ${time}`;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const weekday = (key: string, style: 'short' | 'long' = 'short') =>
  new Date(`${key}T12:00:00`).toLocaleDateString([], style === 'short' ? { weekday: 'short' } : { weekday: 'long', month: 'short', day: 'numeric' });

export function createStatsView(data: Store<AppData>, settings: Store<Settings>, timer: Timer): StatsView {
  const chip = document.getElementById('streak')!;
  const chipCount = chip.querySelector<HTMLElement>('.streak-count')!;
  const goalEl = document.getElementById('goal')!;
  const goalFill = goalEl.querySelector<HTMLElement>('.goal-fill')!;
  const goalText = goalEl.querySelector<HTMLElement>('.goal-text')!;
  const tabCounts = new Map<Mode, HTMLElement>(
    [...document.querySelectorAll<HTMLElement>('.modes [data-mode]')].map((b) => [b.dataset.mode as Mode, b.querySelector<HTMLElement>('.mode-count')!]),
  );

  let backdrop: HTMLElement | null = null;
  let prevFocus: HTMLElement | null = null;

  const current = () => {
    const t = data.get().timer;
    return computeStats(data.get().history, {
      now: Date.now(),
      dailyGoal: settings.get().dailyGoal,
      liveFocusMs: t.mode === 'focus' ? timer.focusedMs() : 0,
    });
  };

  // ---- Always-visible summary

  let lastStreak = -1;
  function refresh() {
    const s = current();
    const { streak, goal, today } = s;
    chipCount.textContent = String(streak.current);
    chip.classList.toggle('lit', streak.todayDone);
    chip.setAttribute(
      'aria-label',
      `${plural(streak.current, 'day')} streak${streak.todayDone ? '' : ' — focus today to keep it going'}. Open progress (G)`,
    );
    chip.title = streak.todayDone ? `${plural(streak.current, 'day')} streak` : `${plural(streak.current, 'day')} streak · focus today to keep it`;
    if (lastStreak !== -1 && streak.current > lastStreak && !reducedMotion()) {
      animate(chip, { scale: [1, 1.25, 1], duration: 700, ease: 'outElastic(1, .5)' });
    }
    lastStreak = streak.current;

    const pct = Math.min(1, goal.done / Math.max(1, goal.target));
    goalFill.style.width = `${pct * 100}%`;
    goalEl.classList.toggle('reached', goal.reached);
    goalText.textContent = goal.reached ? `Goal reached · ${goal.done} today` : `${goal.done} of ${goal.target} today`;
    goalEl.setAttribute('aria-label', `Daily goal: ${goal.done} of ${goal.target} pomodoros`);

    for (const [mode, el] of tabCounts) {
      const n = today.completed[mode];
      el.textContent = n ? String(n) : '';
      el.hidden = n === 0;
    }
  }

  // ---- Progress dialog

  function tile(label: string, value: string, sub: string) {
    return `<div class="tile"><span class="tile-label">${label}</span><span class="tile-value">${value}</span><span class="tile-sub">${sub}</span></div>`;
  }

  function chart(week: DayStats[]) {
    const max = Math.max(...week.map((d) => d.focusMs), 60 * 60_000); // at least a 1h scale
    const todayKey = dayKey(Date.now());
    const bars = week
      .map((d) => {
        const h = (d.focusMs / max) * 100;
        const isToday = d.key === todayKey;
        const tip = `${weekday(d.key, 'long')}: ${plural(d.pomodoros, 'pomodoro')} · ${formatDuration(d.focusMs)} focused`;
        return `<button type="button" class="bar${isToday ? ' today' : ''}" data-tip="${tip}" aria-label="${tip}">
            ${isToday && d.focusMs > 0 ? `<span class="bar-value">${formatDuration(d.focusMs)}</span>` : ''}
            <span class="bar-fill" style="height:${d.focusMs > 0 ? Math.max(h, 3) : 0}%"></span>
            <span class="bar-day">${isToday ? 'Today' : weekday(d.key)}</span>
          </button>`;
      })
      .join('');
    const rows = week.map((d) => `<tr><th scope="row">${weekday(d.key, 'long')}</th><td>${d.pomodoros}</td><td>${formatDuration(d.focusMs)}</td></tr>`).join('');
    return `
      <div class="chart" role="presentation">
        <span class="chart-max">${formatDuration(max)}</span>
        <div class="bars">${bars}</div>
        <div class="chart-tip" hidden></div>
      </div>
      <table class="sr-only"><caption>Focus by day, last 7 days</caption>
        <thead><tr><th scope="col">Day</th><th scope="col">Pomodoros</th><th scope="col">Focus time</th></tr></thead>
        <tbody>${rows}</tbody></table>`;
  }

  /** Latest focus sessions, each deletable (with undo) in case one ran by accident. */
  function recentList(): HTMLElement {
    const wrap = document.createElement('section');
    wrap.className = 'recent';
    const h = document.createElement('h3');
    h.className = 'stats-h';
    h.id = 'st-recent';
    h.textContent = 'Recent sessions';
    wrap.append(h);
    const sessions = data
      .get()
      .history.filter((r) => r.mode === 'focus')
      .slice(-RECENT)
      .reverse();
    if (!sessions.length) {
      const p = document.createElement('p');
      p.className = 'recent-empty';
      p.textContent = 'Finished pomodoros show up here.';
      wrap.append(p);
      return wrap;
    }
    const ul = document.createElement('ul');
    ul.setAttribute('aria-labelledby', h.id);
    sessions.forEach((rec, i) => {
      const li = document.createElement('li');
      const label = document.createElement('span');
      label.className = 'recent-when';
      label.textContent = when(rec.endedAt);
      const detail = document.createElement('span');
      detail.className = 'recent-detail';
      const task = rec.taskId ? data.get().tasks.find((t) => t.id === rec.taskId) : undefined;
      detail.textContent = [
        formatDuration(rec.focusedMs ?? rec.durationMs),
        rec.abandoned ? 'stopped early' : '',
        task?.title ?? '',
      ]
        .filter(Boolean)
        .join(' · ');
      li.classList.toggle('abandoned', !!rec.abandoned);
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'icon-sm';
      del.dataset.recent = String(i);
      del.setAttribute('aria-label', `Delete the ${when(rec.endedAt)} session`);
      del.title = 'Delete';
      del.innerHTML = TRASH;
      del.addEventListener('click', () => remove(rec));
      li.append(label, detail, del);
      ul.append(li);
    });
    wrap.append(ul);
    return wrap;
  }

  function remove(rec: SessionRecord) {
    const removed = removeSession(data.get(), rec);
    if (!removed) return;
    data.set({ history: removed.history, tasks: removed.tasks });
    toast(rec.abandoned ? 'Session deleted' : 'Pomodoro deleted', {
      duration: 6000,
      action: { label: 'Undo', run: () => data.set((d) => restoreSession(d, rec, removed.credit)) },
    });
  }

  /** Redraws the open dialog in place (no entrance animation), keeping focus on the same row. */
  function rerender() {
    if (!backdrop) return;
    const focused = (document.activeElement as HTMLElement | null)?.dataset.recent;
    const fresh = build(current());
    backdrop.replaceChildren(...fresh.childNodes);
    if (focused === undefined) return;
    const rows = backdrop.querySelectorAll<HTMLElement>('[data-recent]');
    (rows[Math.min(Number(focused), rows.length - 1)] ?? backdrop.querySelector<HTMLElement>('.shortcuts-head button'))?.focus();
  }

  function build(s: Stats): HTMLElement {
    const el = document.createElement('div');
    el.className = 'dialog-backdrop';
    const { today, streak, goal, totals } = s;
    const extras = [
      today.abandoned ? plural(today.abandoned, 'abandoned session') : '',
      today.interruptions ? plural(today.interruptions, 'interruption') : '',
    ].filter(Boolean);
    el.innerHTML = `
      <div class="dialog stats" role="dialog" aria-modal="true" aria-labelledby="st-title">
        <header class="shortcuts-head">
          <h2 id="st-title">Your progress</h2>
          <button class="icon-sm" type="button" aria-label="Close">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </header>
        <div class="tiles">
          ${tile('Today', plural(today.pomodoros, 'pomodoro'), `${formatDuration(today.focusMs)} focused`)}
          ${tile('Streak', `🔥 ${plural(streak.current, 'day')}`, `Best: ${plural(streak.best, 'day')}`)}
          ${tile('Daily goal', `${goal.done} / ${goal.target}`, goal.reached ? 'Reached 🎉' : `${goal.target - goal.done} to go`)}
          ${tile('All time', plural(totals.pomodoros, 'pomodoro'), `${formatDuration(totals.focusMs)} · ${plural(totals.daysFocused, 'day')}`)}
        </div>
        <h3 class="stats-h">Focus this week</h3>
        ${chart(s.week)}
        <p class="stats-note">One pomodoro — or ${STREAK_FOCUS_MS / 60_000} focused minutes — keeps your streak going.${extras.length ? ` Today: ${extras.join(', ')}.` : ''}</p>
      </div>`;
    el.querySelector('.dialog')!.append(recentList());

    const tip = el.querySelector<HTMLElement>('.chart-tip')!;
    const chartEl = el.querySelector<HTMLElement>('.chart')!;
    const showTip = (bar: HTMLElement) => {
      tip.textContent = bar.dataset.tip!;
      tip.hidden = false;
      const c = chartEl.getBoundingClientRect();
      const b = bar.getBoundingClientRect();
      const x = Math.min(Math.max(b.left + b.width / 2 - c.left, 90), c.width - 90);
      tip.style.left = `${x}px`;
    };
    el.querySelectorAll<HTMLElement>('.bar').forEach((bar) => {
      bar.addEventListener('pointerenter', () => showTip(bar));
      bar.addEventListener('focus', () => showTip(bar));
      bar.addEventListener('pointerleave', () => (tip.hidden = true));
      bar.addEventListener('blur', () => (tip.hidden = true));
    });
    el.querySelector('.shortcuts-head button')!.addEventListener('click', close);
    el.addEventListener('pointerdown', (e) => {
      if (e.target === el) close();
    });
    return el;
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape' || e.key.toLowerCase() === 'g') {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  }

  function open() {
    if (backdrop) return;
    prevFocus = document.activeElement as HTMLElement | null;
    backdrop = build(current());
    document.body.append(backdrop);
    document.addEventListener('keydown', onKey, true);
    backdrop.querySelector<HTMLElement>('.shortcuts-head button')!.focus();
    if (reducedMotion()) return;
    animate(backdrop, { opacity: [0, 1], duration: 220, ease: 'out(2)' });
    animate(backdrop.querySelector('.dialog')!, { scale: [0.94, 1], y: [12, 0], opacity: [0, 1], duration: 450, ease: 'out(4)' });
    animate(backdrop.querySelectorAll('.tile'), { y: [12, 0], opacity: [0, 1], delay: stagger(60, { start: 120 }), duration: 450, ease: 'out(3)' });
    animate(backdrop.querySelectorAll('.bar-fill'), { scaleY: [0, 1], delay: stagger(50, { start: 250 }), duration: 700, ease: 'out(4)' });
  }

  function close() {
    const el = backdrop;
    if (!el) return;
    backdrop = null;
    document.removeEventListener('keydown', onKey, true);
    el.style.pointerEvents = 'none';
    prevFocus?.focus();
    if (reducedMotion()) return el.remove();
    animate(el, { opacity: 0, duration: 180, ease: 'in(2)', onComplete: () => el.remove() });
  }

  chip.addEventListener('click', open);
  data.subscribe((d, prev) => {
    if (d.history !== prev.history || d.timer.mode !== prev.timer.mode) refresh();
    if (d.history !== prev.history) rerender();
  });
  settings.subscribe((s, prev) => {
    if (s.dailyGoal !== prev.dailyGoal) refresh();
  });
  refresh();

  return { current, refresh, open, isOpen: () => backdrop !== null };
}
