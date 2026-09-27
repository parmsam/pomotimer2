import { animate } from 'animejs';
import { parseTasksMarkdown, type ParsedTask } from '../core/markdown';
import { reducedMotion } from '../fx/anims';

const EXAMPLE = `- [ ] Write report 🍅3
- [x] Review PRs
- Plan sprint (2)
Email Sam`;

let open = false;
export const importOpen = () => open;

/** Paste-and-preview dialog for adding many tasks at once from Markdown. */
export function openImportDialog(initial: string, onAdd: (tasks: ParsedTask[]) => void) {
  if (open) return;
  open = true;
  const prevFocus = document.activeElement as HTMLElement | null;
  const backdrop = document.createElement('div');
  backdrop.className = 'dialog-backdrop';
  backdrop.innerHTML = `
    <div class="dialog import" role="dialog" aria-modal="true" aria-labelledby="imp-title">
      <h2 id="imp-title">Add tasks from Markdown</h2>
      <p>One task per line. Checkboxes, bullets and estimates are understood.</p>
      <textarea rows="7" spellcheck="false" aria-label="Markdown tasks"></textarea>
      <details class="syntax">
        <summary>Syntax</summary>
        <pre></pre>
        <p><code>🍅3</code>, <code>🍅🍅🍅</code> or a trailing <code>(3)</code> set the estimate. <code>- [x]</code> adds it as done. Headings and blank lines are skipped.</p>
      </details>
      <div class="import-preview" aria-live="polite"></div>
      <div class="dialog-actions">
        <button type="button" class="btn" data-cancel>Cancel</button>
        <button type="button" class="btn solid" data-add disabled>Add tasks</button>
      </div>
    </div>`;
  const ta = backdrop.querySelector('textarea')!;
  const preview = backdrop.querySelector<HTMLElement>('.import-preview')!;
  const addBtn = backdrop.querySelector<HTMLButtonElement>('[data-add]')!;
  backdrop.querySelector('pre')!.textContent = EXAMPLE;
  ta.placeholder = EXAMPLE;
  ta.value = initial;

  let parsed: ParsedTask[] = [];
  function update() {
    const { tasks, skipped } = parseTasksMarkdown(ta.value);
    parsed = tasks;
    addBtn.disabled = tasks.length === 0;
    addBtn.textContent = tasks.length ? `Add ${tasks.length} task${tasks.length === 1 ? '' : 's'}` : 'Add tasks';
    if (!tasks.length) {
      preview.textContent = ta.value.trim() ? 'No tasks found yet.' : '';
      return;
    }
    const list = document.createElement('ul');
    for (const t of tasks.slice(0, 8)) {
      const li = document.createElement('li');
      li.className = t.done ? 'done' : '';
      li.textContent = `${t.done ? '✓ ' : ''}${t.title}`;
      const est = document.createElement('span');
      est.textContent = t.pomodoros ? `🍅${t.pomodoros}/${t.estimate}` : `🍅${t.estimate}`;
      li.append(est);
      list.append(li);
    }
    const more = tasks.length > 8 ? `<p class="more">…and ${tasks.length - 8} more</p>` : '';
    const skip = skipped ? `<p class="more">${skipped} line${skipped === 1 ? '' : 's'} skipped (headings, tables…)</p>` : '';
    preview.replaceChildren(list);
    preview.insertAdjacentHTML('beforeend', more + skip);
  }

  function close() {
    open = false;
    document.removeEventListener('keydown', onKey, true);
    backdrop.style.pointerEvents = 'none';
    prevFocus?.focus();
    if (reducedMotion()) return backdrop.remove();
    animate(backdrop, { opacity: 0, duration: 180, ease: 'in(2)', onComplete: () => backdrop.remove() });
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && parsed.length) {
      e.preventDefault();
      addBtn.click();
    }
  }

  ta.addEventListener('input', update);
  addBtn.addEventListener('click', () => {
    const tasks = parsed;
    close();
    onAdd(tasks);
  });
  backdrop.querySelector('[data-cancel]')!.addEventListener('click', close);
  backdrop.addEventListener('pointerdown', (e) => {
    if (e.target === backdrop) close();
  });
  document.addEventListener('keydown', onKey, true);
  document.body.append(backdrop);
  update();
  ta.focus();
  if (!reducedMotion()) {
    animate(backdrop, { opacity: [0, 1], duration: 200, ease: 'out(2)' });
    animate(backdrop.querySelector('.dialog')!, { scale: [0.95, 1], y: [10, 0], opacity: [0, 1], duration: 420, ease: 'out(4)' });
  }
}
