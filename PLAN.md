# Pomotimer 2 — Plan

A modern, aesthetic Pomodoro timer inspired by studywithme.io, pomodorotimer.online, and tomatotimers.com.
Static site deployed to GitHub Pages; all data in localStorage.

## Stack
- Vite + TypeScript, no UI framework
- anime.js v4 — all UI motion (progress ring, digit transitions, mode transitions, panels, completion celebration)
- three.js — optional, lazy-loaded background scenes (default background is CSS/anime.js gradient)
- vite-plugin-pwa — installable, offline
- GitHub Actions → GitHub Pages (`base: '/pomotimer2/'`)

## Core technical decisions
1. **Timer engine** is timestamp-based: store `endsAt`, derive remaining from `Date.now()` in rAF. No `setInterval` counting (background-tab throttling). Persisting `endsAt` means a running timer survives reload.
2. **State**: tiny typed pub/sub store. Two persisted slices, versioned, under `pomo:v1:*`, all access wrapped in try/catch:
   - `settings`
   - `appData` (tasks, session history, active timer)
3. **Audio**: Web Audio API; CC0 samples for alarms; looping ambient tracks (rain, café, brown noise — brown noise can be generated procedurally). Separate volumes.
4. **Background-tab UX**: countdown in `document.title`, progress favicon, Notification API on completion, optional Wake Lock.
5. **Accessibility**: `prefers-reduced-motion` disables three.js and simplifies anime.js; keyboard shortcuts; ARIA live region.

## Settings
- **Timer**: focus / short / long durations, long break every N, auto-start breaks, auto-start focus
- **Appearance**: theme presets (Lofi Dusk, Matcha, Midnight, Paper, Sakura), custom accent, font, timer style (ring / flip / minimal)
- **Background**: none / gradient / three.js scene / custom image URL
- **Sound**: alarm choice + volume, tick toggle, ambient loop + volume
- **Behavior**: notifications, wake lock, title countdown, focus mode on start
- **Data**: export/import JSON, reset

## Keyboard shortcuts
See the in-app cheat sheet (`?`), generated from the shortcut table in `src/main.ts`.

## Structure
```
src/
  core/    timer.ts, store.ts, storage.ts, audio.ts, notify.ts
  ui/      timerView.ts, controls.ts, settingsPanel.ts, tasks.ts, stats.ts
  fx/      anims.ts, scenes/ (three.js, lazy)
  themes/  tokens.css, presets.ts
public/sounds/
.github/workflows/deploy.yml
```

## Phases & status
Keep this checklist current: tick items as they land, add new ones as scope changes.

### Quality
- [x] Unit tests (Vitest) for the timer engine, storage, store and formatting
- [x] E2E tests (Playwright) on Chromium, WebKit and mobile
- [x] CI on every push/PR; deploys blocked unless tests pass

### Phase 1 — MVP
- [x] Vite + TS scaffold, GitHub Pages deploy workflow
- [x] Timer engine (timestamp-based, survives reload)
- [x] Store + versioned localStorage
- [x] Ring UI + anime.js transitions
- [x] Core settings panel (durations, auto-start, long-break interval)
- [x] Theme presets + custom accent
- [x] Alarm sounds + volume
- [x] Notifications, title countdown
- [x] Favicon (SVG tomato)
- [x] Rolling-digit clock animation as an opt-in setting (off by default)
- [x] First deploy to GitHub Pages (merge to `main`, enable Pages → GitHub Actions)

### Phase 2 — Polish
- [x] Task list (est. pomodoros, active task linked to sessions)
- [x] Stats (daily sessions, streak, 7-day chart)
- [x] Keyboard shortcuts
- [x] Focus mode
- [x] Export/import data (reset is done)
- [x] Record abandoned pomodoros (reset/skip mid-focus) in history — "a pomodoro is indivisible"
- [x] Interruption log: one-tap internal/external interruption marks during focus, with a quick note to "schedule" it as a task
- [x] Optional strict mode (no pause; stopping = abandoning)
- [x] "To Do Today" framing for the task list
- [x] Nuanced stop/skip/switch dialogs (replace `confirm()`): abandoning keeps focused minutes in today's total; past the halfway mark it still counts as a session
- [x] Per-mode completed counters on the mode tabs
- [x] Streak in header (🔥 n): 1 session or N focused minutes keeps it alive; best streak; total focus
- [x] Daily focus goal ("challenge") with a celebration on completion
- [x] Per-task time tracking: the focused task accrues minutes, clamped to the session, survives reload
- [x] Cross-tab sync via the `storage` event
- [x] Rotating break tips (quotes moved to Phase 4)

#### Customization (kept lean)
- [x] Interval presets quick-pick (25/5/15 · 50/10/20 · 90/15/30)
- [x] Per-mode colors (short/long break too, not just focus)
- Everything else is reserved for Phase 4 (see "Customization ideas")

### Phase 3 — Eye candy
- [ ] three.js scenes (particles/fireflies, shader gradient mesh, rain on glass, low-poly tomato)
- [ ] Ambient audio loops
- [ ] PWA (offline, installable)
- [ ] Wake Lock, progress favicon
- [ ] Pop-out mini timer via Document Picture-in-Picture (Chromium; hide the button elsewhere)
- [ ] Custom background photos (IndexedDB, a few images, never leave the device)
- [ ] Lofi / vinyl-crackle ambient option
- [ ] PWA "new version available" prompt
- [ ] Mobile notice: background timers/alarms are unreliable on mobile browsers

#### Background animation options
- [ ] Background picker in settings: blobs (current) / three.js scenes / custom photo / solid
- [ ] Per-scene controls: speed, density/intensity, color follows theme vs. mode
- [ ] Scenes react to the timer (e.g. calmer during breaks, subtle pulse on completion)
- [ ] Auto-pause heavy scenes when the tab is hidden or on battery saver; always off under reduced motion

#### Repo & discoverability
- [x] README: what it is, screenshot/GIF, live link, features, keyboard shortcuts, privacy note (data stays in the browser), local dev + testing commands, credits (Cirillo, inspirations)
- [x] Nicely placed GitHub link in the app: small GitHub icon in the top bar or an "About" footer in settings, opening the repo in a new tab

#### Haptic feedback
- [ ] `haptics.ts` with one `buzz(pattern)` helper and a Settings toggle (on by default on touch devices, off elsewhere)
- [ ] Android/Chromium: standard `navigator.vibrate()`, e.g. a short tick on start/pause/task done and a longer pattern when a session ends
- [ ] iOS 18+ Safari: no `navigator.vibrate()`. Workaround: a hidden `<input type="checkbox" switch>` with a `<label>`, toggled programmatically, which fires the system switch haptic
  - Caveat: it probably only fires inside a real user gesture (tap), so it suits tap feedback (start, pause, mark done, mode switch). It likely **can't** buzz when a session ends on its own. Verify on a device; the end-of-session alert stays sound + notification on iOS
  - Feature-detect and fail silently; keep the hack isolated in one module so it's easy to remove if Apple changes behaviour
- [ ] Respect reduced-motion/"reduce haptics" preferences and the mute setting

#### Clock themes
Whole-timer "faces" that go beyond the Phase 2 timer styles (ring / minimal / bar). Each face is a module that renders from the same `remaining / duration / mode / status` state, so the engine doesn't change.
- [ ] Face picker in settings with live previews
- [ ] **Tomato**: Cirillo's original kitchen timer. A tomato dial that twists back as time runs down, with a wind-up animation on start and an optional mechanical tick. Leaves wilt slightly on breaks, and it wobbles and "rings" at the end
- [ ] **Tamagotchi**: an egg-shaped LCD device with pixel digits and a small pixel pet. The pet works alongside you during focus and plays or naps on breaks. It grows or evolves with completed pomodoros and your streak, and looks a bit sad after abandoned sessions (never punishing)
- [ ] Other candidates: flip clock, hourglass (sand falls with time), analog kitchen clock, growing plant, burning candle, minimal LCD
- [ ] Faces follow the theme colours, respect reduced motion, and stay accessible (time always available to screen readers)

#### Markdown export, import & bulk add
- [ ] Export session history as Markdown (per-day headings, sessions with times and durations, daily totals)
- [ ] One-click "Copy as Markdown" for today's tasks and outcomes (done/open, pomodoros, tracked time, interruptions)
- [ ] Import / bulk-add tasks from Markdown, pasted into the new-task field or an import dialog, with a preview before adding. Proposed syntax, one task per line:
  ```
  - [ ] Write report 🍅3        # open task, estimate 3
  - [x] Review PRs 🍅1          # already done
  - Plan sprint (2)             # (n) also sets the estimate
  Email Sam                     # plain lines work too; estimate defaults to 1
  ## Work                       # headings are kept as optional list/group labels (future)
  ```
- [ ] Round-trip: exported task Markdown re-imports cleanly (same syntax both ways)
- [ ] Export tasks as a Markdown checklist (`- [x]`), with pomodoros and tracked time per task
- [ ] Export options: date range, include tasks / sessions / stats summary
- [ ] Download as `.md` + copy to clipboard (for pasting into Obsidian, Notion, GitHub)

#### Keyboard & gesture shortcuts
Basics already exist (Space, R, S, `,`, Esc).
- [x] `1`/`2`/`3` switch mode, `M` mute, `,` toggles settings (pulled into Phase 2)
- [x] `?` cheat-sheet overlay, keyboard button in the top bar, one-time tip for new visitors (pulled into Phase 2)
- [x] Task list keyboard control: ↑/↓ Home/End, Enter current, X done, E edit, Del delete, Alt+↑/↓ reorder
- [ ] More keys: `F` focus mode, `+`/`-` add or remove a minute, `P` pop-out timer
- [ ] Optional: remap keys in settings
- [ ] Swipe gestures on touch screens: swipe left/right on the dial to change mode, tap the dial to start/pause, long-press to reset, swipe up for tasks
- [ ] Gestures ignore scrolling areas and follow the same confirm rules as buttons (e.g. abandoning a focus session)

### Phase 4 — Quotes, greeting & extra customization
- [ ] Settings toggle: show a quote (off by default), e.g. under the timer or on breaks, rotating per session
- [ ] Source: **Default list** (~100 quotes) or **My quotes** (one or more of the user's own, added/edited/removed in settings, stored locally)
- [ ] Default list: ~100 productivity/work/learning quotes from scientists (e.g. Feynman, Curie, Einstein) and other accomplished people
  - Kept in a Markdown file in the repo (`src/content/quotes.md`) so it's easy to review and update in a PR. Imported at build time with Vite `?raw` and parsed, with no runtime fetch
  - Proposed format, one quote per blockquote, attribution after an em dash:
    ```
    > The first principle is that you must not fool yourself — and you are the easiest person to fool.
    > — Richard Feynman, *Cargo Cult Science* (1974)
    ```
  - **Accuracy rule:** only well-sourced attributions (misattributed quotes are rampant). Include a source where possible, and drop anything that's apocryphal
  - Unit test the parser, and add a test that every entry has text and an author and there are no duplicates
- [ ] Rotation: random without repeats until the list is exhausted; don't change mid-session
- [ ] Accessible: quote text is real text (not an image), muted styling, and it can be hidden entirely

#### Greeting
- [ ] Optional name + time-of-day greeting (e.g. "Good morning, Sam"; "Welcome back" after a gap). Off by default; the name is stored locally only

#### Customization ideas (reserved)
Only pick these up if there's real demand. Several overlap with Phase 3 clock themes and background options, so build those first and reuse them.
- [ ] Timer style: ring / minimal (digits only) / progress bar
- [ ] Clock font (a few curated Google Fonts, loaded on demand) and weight
- [ ] Custom theme builder: tweak background, blobs and text colours; save as "My theme"
- [ ] Background controls: blob intensity and speed, grain on/off, solid colour
- [ ] Separate alarm sound for the end of a break, plus an alarm repeat count
- [ ] Show/hide individual UI elements (cycle dots, goal meter, tab counts, streak chip, subtitle)
- [ ] Custom mode names and subtitle messages

## Reference notes
**pomodorotimer.online** (studied 2026-09-27; captured into `ref/`, which is gitignored). A Nuxt PWA with no backend; data lives in localStorage and IndexedDB. What stood out:
- Timer uses a wall-clock deadline in a Web Worker; sessions that finish while the tab is closed still count. (We already do the deadline and missed-completion credit.)
- Abandoning a session is handled gently: focused minutes always count toward today, and past 50% the session still counts. Pausing gets a soft nudge ("A pause breaks your flow").
- Streaks, daily challenges with rewards, and per-mode counters make the timer feel like it's counting your wins.
- Tasks are extensive (lists, subtasks, priority, due dates, labels, "plan for today", per-task time that rolls up to parent tasks). We'll take a lean subset.
- A pop-out picture-in-picture mini timer that controls the real timer.
- Custom photo backgrounds, lofi music, editable quote, greeting by name.

**Wikipedia: Pomodoro Technique**: 25 / 5 min intervals, and a 20–30 min long break after 4 pomodoros. A pomodoro is indivisible: an interruption means it gets postponed or abandoned (inform → negotiate → schedule → call back). The five stages are planning, tracking, recording, processing and visualizing.

## Decisions log
- 2026-09-27 — Vanilla TS over React/Svelte: single-screen app, imperative animation libs.
- 2026-09-27 — three.js is optional + lazy-loaded; default background is CSS/anime.js.
- 2026-09-27 — In scope: tasks, stats, ambient sounds, PWA.
- 2026-09-27 — Alarms are synthesized with Web Audio (no sample files, no licensing concerns).
- 2026-09-27 — Default long break stays 15 min to match other popular apps (Wikipedia/Cirillo canon is 20–30).
- 2026-09-27 — From the Wikipedia article: pomodoros are indivisible and interruptions get logged → Phase 2 items for abandoned sessions, interruption log, strict mode.
- 2026-09-27 — Rolling digits off by default (felt busy); kept as an Appearance toggle.
- 2026-09-27 — Phase 3 adds richer background animation options and Markdown export of sessions/tasks (JSON export/import stays in Phase 2 for backup).
- 2026-09-27 — Clock themes (Tomato kitchen timer, Tamagotchi, and others) planned for Phase 3 as swappable timer faces on the same engine.
- 2026-09-27 — Added Vitest + Playwright test suites and CI gating deploys, after bugs (ring offset, settings drawer) slipped past ad-hoc checks.
- 2026-09-27 — Interruption tracking made opt-in; notes kept in a separate 'Noted for later' list instead of auto-creating tasks.
- 2026-09-27 — Streak rule: a day counts with one counted pomodoro or 25 focused minutes. Stats are derived from session history (no separate counters to drift).
- 2026-09-27 — Quotes become their own Phase 4: optional, default list maintained as Markdown in the repo, or user-provided list.
- 2026-09-27 — Customization trimmed to presets + per-mode colors in Phase 2; the other ideas are reserved in Phase 4.
- 2026-09-27 — Phase 2 complete; the name greeting moved to Phase 4 alongside quotes.
