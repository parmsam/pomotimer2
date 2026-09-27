import { animate } from 'animejs';
import { formatDuration } from '../core/format';
import type { Store } from '../core/store';
import type { Timer } from '../core/timer';
import type { AppData, Settings, Task } from '../core/types';
import { reducedMotion } from '../fx/anims';
import { ask } from './dialog';

const ICONS = {
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
  edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/></svg>',
  trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
};

const uid = () => (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).slice(0, 12);

export interface TasksPanel {
  add(title: string, estimate?: number): void;
  /** Refresh live values (the active task's tracked time). Call about once a second. */
  tick(): void;
  toggleVisible(): void;
  focusInput(): void;
}

export function createTasksPanel(data: Store<AppData>, settings: Store<Settings>, timer: Timer): TasksPanel {
  const panel = document.getElementById('tasks')!;
  const list = panel.querySelector<HTMLUListElement>('.task-list')!;
  const form = panel.querySelector<HTMLFormElement>('.task-add')!;
  const input = form.querySelector<HTMLInputElement>('input[name="title"]')!;
  const estInput = form.querySelector<HTMLInputElement>('input[name="estimate"]')!;
  const metaEl = panel.querySelector<HTMLElement>('#tasks-meta')!;
  const footEl = panel.querySelector<HTMLElement>('#tasks-foot')!;
  const clearBtn = panel.querySelector<HTMLButtonElement>('#tasks-clear')!;
  const emptyEl = panel.querySelector<HTMLElement>('.tasks-empty')!;
  const rows = new Map<string, HTMLLIElement>();
  let editing: string | null = null;

  const tasks = () => data.get().tasks;
  const setTasks = (fn: (t: Task[]) => Task[], extra: Partial<AppData> = {}) => data.set((d) => ({ tasks: fn(d.tasks), ...extra }));

  function setActive(id: string | null) {
    if (id === data.get().activeTaskId) return;
    timer.splitSegment(); // credit time so far to the previously active task
    data.set({ activeTaskId: id });
  }

  function add(title: string, estimate = 1) {
    const clean = title.trim();
    if (!clean) return;
    const task: Task = { id: uid(), title: clean, estimate, pomodoros: 0, trackedMs: 0, done: false, createdAt: Date.now(), doneAt: null };
    const firstOpen = !tasks().some((t) => !t.done);
    setTasks((ts) => [...ts, task], firstOpen && !data.get().activeTaskId ? { activeTaskId: task.id } : {});
  }

  function toggleDone(id: string) {
    const task = tasks().find((t) => t.id === id);
    if (!task) return;
    const done = !task.done;
    let activeTaskId = data.get().activeTaskId;
    if (done && activeTaskId === id) {
      timer.splitSegment();
      // Move focus to the next open task, like crossing off a to-do list.
      activeTaskId = tasks().find((t) => !t.done && t.id !== id)?.id ?? null;
    }
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, done, doneAt: done ? Date.now() : null } : t)), { activeTaskId });
  }

  function remove(id: string) {
    if (data.get().activeTaskId === id) timer.splitSegment();
    setTasks(
      (ts) => ts.filter((t) => t.id !== id),
      data.get().activeTaskId === id ? { activeTaskId: null } : {},
    );
  }

  function move(id: string, delta: number) {
    const ts = [...tasks()];
    const i = ts.findIndex((t) => t.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= ts.length) return;
    [ts[i], ts[j]] = [ts[j], ts[i]];
    setTasks(() => ts);
    requestAnimationFrame(() => rows.get(id)?.querySelector<HTMLElement>('.task-main')?.focus());
  }

  // ---- Rendering

  function liveTracked(t: Task) {
    return t.trackedMs + (t.id === data.get().activeTaskId && data.get().timer.mode === 'focus' ? timer.focusedMs() - data.get().timer.focusedMs : 0);
  }

  function metaText(t: Task) {
    const tracked = liveTracked(t);
    return `🍅 ${t.pomodoros}/${t.estimate}${tracked > 0 ? ` · ${formatDuration(tracked)}` : ''}`;
  }

  function buildRow(t: Task): HTMLLIElement {
    const li = document.createElement('li');
    li.className = 'task';
    li.dataset.id = t.id;
    li.innerHTML = `
      <button class="task-check" role="checkbox" type="button">${ICONS.check}</button>
      <button class="task-main" type="button">
        <span class="task-title"></span>
        <span class="task-sub"><span class="task-meta"></span><span class="task-badge">Focusing</span></span>
      </button>
      <div class="task-actions">
        <button class="task-edit icon-sm" type="button" aria-label="Edit task">${ICONS.edit}</button>
        <button class="task-delete icon-sm" type="button" aria-label="Delete task">${ICONS.trash}</button>
      </div>`;
    li.querySelector('.task-check')!.addEventListener('click', () => {
      toggleDone(t.id);
      if (!reducedMotion()) animate(li.querySelector('.task-check')!, { scale: [0.7, 1], duration: 500, ease: 'outElastic(1, .5)' });
    });
    li.querySelector('.task-main')!.addEventListener('click', () => {
      const task = tasks().find((x) => x.id === t.id);
      if (task && !task.done) setActive(data.get().activeTaskId === t.id ? null : t.id);
    });
    li.querySelector('.task-main')!.addEventListener('keydown', (e) => {
      const ke = e as KeyboardEvent;
      if (ke.altKey && (ke.key === 'ArrowUp' || ke.key === 'ArrowDown')) {
        ke.preventDefault();
        move(t.id, ke.key === 'ArrowUp' ? -1 : 1);
      }
    });
    li.querySelector('.task-edit')!.addEventListener('click', () => startEdit(t.id));
    li.querySelector('.task-delete')!.addEventListener('click', async () => {
      const task = tasks().find((x) => x.id === t.id);
      if (!task) return;
      if (task.pomodoros > 0 || task.trackedMs > 60_000) {
        const r = await ask({ title: 'Delete this task?', body: `“${task.title}” and its tracked time will be removed.`, confirm: 'Delete', danger: true });
        if (r !== 'confirm') return;
      }
      remove(t.id);
    });
    return li;
  }

  function updateRow(li: HTMLLIElement, t: Task, active: boolean) {
    li.classList.toggle('done', t.done);
    li.classList.toggle('active', active);
    const check = li.querySelector('.task-check')!;
    check.setAttribute('aria-checked', String(t.done));
    check.setAttribute('aria-label', t.done ? `Mark “${t.title}” not done` : `Mark “${t.title}” done`);
    const main = li.querySelector('.task-main')!;
    main.setAttribute('aria-pressed', String(active));
    main.setAttribute('title', t.done ? t.title : active ? 'Stop focusing on this task' : 'Focus on this task (Alt+↑/↓ to reorder)');
    li.querySelector('.task-title')!.textContent = t.title;
    li.querySelector('.task-meta')!.textContent = metaText(t);
  }

  function startEdit(id: string) {
    const li = rows.get(id);
    const task = tasks().find((t) => t.id === id);
    if (!li || !task) return;
    editing = id;
    const formEl = document.createElement('form');
    formEl.className = 'task-editor';
    formEl.innerHTML = `
      <input name="title" maxlength="120" aria-label="Task title" />
      <label class="est" title="Estimated pomodoros">🍅<input name="estimate" type="number" min="1" max="20" aria-label="Estimated pomodoros" /></label>
      <button class="btn solid" type="submit">Save</button>
      <button class="btn" type="button" data-cancel>Cancel</button>`;
    const title = formEl.querySelector<HTMLInputElement>('[name="title"]')!;
    const est = formEl.querySelector<HTMLInputElement>('[name="estimate"]')!;
    title.value = task.title;
    est.value = String(task.estimate);
    const finish = (save: boolean) => {
      editing = null;
      formEl.remove();
      li.classList.remove('editing');
      if (save && title.value.trim()) {
        const estimate = Math.min(20, Math.max(1, Math.round(Number(est.value)) || 1));
        setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, title: title.value.trim(), estimate } : t)));
      } else render();
      li.querySelector<HTMLElement>('.task-main')?.focus();
    };
    formEl.addEventListener('submit', (e) => {
      e.preventDefault();
      finish(true);
    });
    formEl.querySelector('[data-cancel]')!.addEventListener('click', () => finish(false));
    formEl.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        finish(false);
      }
    });
    li.classList.add('editing');
    li.append(formEl);
    title.focus();
    title.select();
  }

  function render() {
    const { tasks: ts, activeTaskId } = data.get();
    const ids = new Set(ts.map((t) => t.id));

    for (const [id, li] of rows) {
      if (ids.has(id)) continue;
      rows.delete(id);
      if (reducedMotion()) li.remove();
      else {
        li.style.pointerEvents = 'none';
        animate(li, { opacity: 0, x: 24, height: 0, paddingTop: 0, paddingBottom: 0, marginTop: 0, duration: 320, ease: 'in(2)', onComplete: () => li.remove() });
      }
    }

    ts.forEach((t) => {
      let li = rows.get(t.id);
      const isNew = !li;
      if (!li) {
        li = buildRow(t);
        rows.set(t.id, li);
      }
      if (editing !== t.id) updateRow(li, t, t.id === activeTaskId);
      list.append(li); // keeps DOM order in sync (moves existing nodes)
      if (isNew && !reducedMotion()) animate(li, { opacity: [0, 1], y: [-10, 0], duration: 420, ease: 'out(3)' });
    });

    const open = ts.filter((t) => !t.done);
    const doneCount = ts.length - open.length;
    emptyEl.hidden = ts.length > 0;
    metaEl.textContent = ts.length ? `${doneCount}/${ts.length} done` : '';
    clearBtn.hidden = doneCount === 0;
    renderFooter(open);
  }

  function renderFooter(open: Task[]) {
    const left = open.reduce((n, t) => n + Math.max(0, t.estimate - t.pomodoros), 0);
    if (!left) {
      footEl.textContent = '';
      return;
    }
    const s = settings.get();
    const focusMs = s.durations.focus * 60_000;
    const breakMs = s.durations.short * 60_000;
    const inFocus = data.get().timer.mode === 'focus' && timer.inProgress() ? focusMs - timer.remaining() : 0;
    const finish = new Date(Date.now() + left * focusMs + (left - 1) * breakMs - inFocus);
    const time = finish.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    footEl.textContent = `${left} 🍅 to go · done around ${time}`;
  }

  // ---- Wiring

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    add(input.value, Math.min(20, Math.max(1, Math.round(Number(estInput.value)) || 1)));
    input.value = '';
    estInput.value = '1';
  });

  clearBtn.addEventListener('click', async () => {
    const n = tasks().filter((t) => t.done).length;
    const r = await ask({ title: `Clear ${n} finished task${n === 1 ? '' : 's'}?`, body: 'Your session history is kept.', confirm: 'Clear', danger: true });
    if (r === 'confirm') setTasks((ts) => ts.filter((t) => !t.done));
  });

  data.subscribe((d, prev) => {
    if (d.tasks !== prev.tasks || d.activeTaskId !== prev.activeTaskId) render();
  });
  settings.subscribe((s, prev) => {
    if (s.showTasks !== prev.showTasks) applyVisibility(true);
    if (s.durations !== prev.durations) render();
  });

  function applyVisibility(animated: boolean) {
    const show = settings.get().showTasks;
    document.querySelector('.stage')!.classList.toggle('with-tasks', show);
    document.getElementById('tasks-toggle')?.setAttribute('aria-pressed', String(show));
    if (show) {
      panel.hidden = false;
      if (animated && !reducedMotion()) animate(panel, { opacity: [0, 1], y: [16, 0], duration: 500, ease: 'out(3)' });
    } else if (animated && !reducedMotion()) {
      animate(panel, { opacity: 0, y: 16, duration: 250, ease: 'in(2)', onComplete: () => (panel.hidden = !settings.get().showTasks) });
    } else panel.hidden = true;
  }

  applyVisibility(false);
  render();

  return {
    add,
    tick() {
      const id = data.get().activeTaskId;
      const li = id ? rows.get(id) : undefined;
      const task = tasks().find((t) => t.id === id);
      if (li && task && editing !== id) li.querySelector('.task-meta')!.textContent = metaText(task);
      renderFooter(tasks().filter((t) => !t.done));
    },
    toggleVisible: () => settings.set({ showTasks: !settings.get().showTasks }),
    focusInput() {
      if (!settings.get().showTasks) settings.set({ showTasks: true });
      input.focus();
    },
  };
}
