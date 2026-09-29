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
- Everything else is on the Backburner list

### Phase 3 — Eye candy
- [x] three.js scenes: fireflies, aurora (shader), rain. (Low-poly tomato skipped: the Tomato clock face covers it)
- [x] Ambient sound: rain, brown noise, pink noise, generated in code (no audio files); focus-only by default, fades, preview in settings
- [x] PWA (offline, installable)
- [x] Wake Lock (keep screen awake while running), progress favicon
- [x] Pop-out mini timer via Document Picture-in-Picture (Chromium; hide the button elsewhere)
- [x] Vinyl-crackle ambient option (real lo-fi music would need licensed tracks, so it's skipped)
- [x] PWA "new version available" prompt
- [x] Mobile notice: background timers/alarms are unreliable on mobile browsers

#### Background animation options
- [x] Background picker in settings: blobs (current) / three.js scenes / custom photo / solid
- [x] Scenes react to the timer (e.g. calmer during breaks, subtle pulse on completion)
- [x] Auto-pause heavy scenes when the tab is hidden or on battery saver; always off under reduced motion

#### Repo & discoverability
- [x] README: what it is, screenshot/GIF, live link, features, keyboard shortcuts, privacy note (data stays in the browser), local dev + testing commands, credits (Cirillo, inspirations)
- [x] Nicely placed GitHub link in the app: small GitHub icon in the top bar or an "About" footer in settings, opening the repo in a new tab

#### Silent mode (phones)
- [x] No browser exposes the silent switch. On iOS it mutes Web Audio's default "ambient" session. Safari 17+'s Audio Session API (`navigator.audioSession.type = 'playback'`) lets the alarm ring anyway; switched only for the alarm, then back to `auto`
- [x] Setting "Alarm ignores silent mode" (default on, shown only where supported), plus a one-time phone tip about volume/silent switch/keeping the tab open or installing

#### Haptic feedback
- [x] `haptics.ts` with one `buzz(pattern)` helper and a Settings toggle (on by default on touch devices, off elsewhere)
- [x] Android/Chromium: standard `navigator.vibrate()`, e.g. a short tick on start/pause/task done and a longer pattern when a session ends
- [x] iOS 18+ Safari: no `navigator.vibrate()`. Workaround: a hidden `<input type="checkbox" switch>` with a `<label>`, toggled programmatically, which fires the system switch haptic
  - Caveat: it probably only fires inside a real user gesture (tap), so it suits tap feedback (start, pause, mark done, mode switch). It likely **can't** buzz when a session ends on its own. Verify on a device; the end-of-session alert stays sound + notification on iOS
  - Feature-detect and fail silently; keep the hack isolated in one module so it's easy to remove if Apple changes behaviour
- [x] Own on/off setting (touch devices only). There's no web API for the OS "reduce haptics" preference

#### Clock themes
Whole-timer "faces" that go beyond the Phase 2 timer styles (ring / minimal / bar). Each face is a module that renders from the same `remaining / duration / mode / status` state, so the engine doesn't change.
- [x] Face picker in settings with live previews
- [x] **Tomato**: Cirillo's original kitchen timer. A tomato dial that twists back as time runs down, with a wind-up animation on start and an optional mechanical tick. Leaves wilt slightly on breaks, and it wobbles and "rings" at the end
- [x] **Tamagotchi**: an egg-shaped LCD device with pixel digits and a small pixel pet. The pet works alongside you during focus and plays or naps on breaks. It grows or evolves with completed pomodoros and your streak, and looks a bit sad after abandoned sessions (never punishing)
- [x] More faces (requested): Hourglass, Plant Buddy, Retro Handheld, Potion Flask, Robot Pet (replaced Zen Enso), Tetris, Blob Pet, Spaceship Orbit, Hamster Wheel
- [x] Livelier faces, round 2: Tetris (row-by-row drops, shuffle, ghost piece, NEXT/LINES, line-clear finale), Spaceship (turning planet, flame flicker, comets, victory lap), Retro Handheld (chomper eats the time bar, scanlines, button presses), Tomato (minute tick, last-minute tremble, ringing), Potion (glow, sparkles, cork pop), Plant (watering can, leaf rustle, falling petals on breaks)
- [x] Faces follow the theme colours, respect reduced motion, and stay accessible (time always available to screen readers)

#### Markdown export, import & bulk add
- [x] Export session history as Markdown (per-day headings, sessions with times and durations, daily totals)
- [x] One-click "Copy as Markdown" for today's tasks and outcomes (done/open, pomodoros, tracked time, interruptions)
- [x] Import / bulk-add tasks from Markdown, pasted into the new-task field or an import dialog, with a preview before adding. Proposed syntax, one task per line:
  ```
  - [ ] Write report 🍅3        # open task, estimate 3
  - [x] Review PRs 🍅1          # already done
  - Plan sprint (2)             # (n) also sets the estimate
  Email Sam                     # plain lines work too; estimate defaults to 1
  ## Work                       # headings are kept as optional list/group labels (future)
  ```
- [x] Round-trip: exported task Markdown re-imports cleanly (same syntax both ways)
- [x] Export tasks as a Markdown checklist (`- [x]`), with pomodoros and tracked time per task
- [x] Export options: date range, include tasks / sessions / stats summary
- [x] Download as `.md` + copy to clipboard (for pasting into Obsidian, Notion, GitHub)

#### Keyboard & gesture shortcuts
Basics already exist (Space, R, S, `,`, Esc).
- [x] `1`/`2`/`3` switch mode, `M` mute, `,` toggles settings (pulled into Phase 2)
- [x] `?` cheat-sheet overlay, keyboard button in the top bar, one-time tip for new visitors (pulled into Phase 2)
- [x] Task list keyboard control: ↑/↓ Home/End, Enter current, X done, E edit, Del delete, Alt+↑/↓ reorder
- [x] More keys: `F` focus mode, `+`/`-` add or remove a minute, `P` pop-out timer
- [x] Touch gestures on the timer: tap to start/pause, swipe left/right to change mode, hold to restart (swipe-up for tasks dropped: it fights page scrolling, and tasks sit right below)
- [x] Gestures ignore scrolling areas and follow the same confirm rules as buttons (e.g. abandoning a focus session)

### Phase 4 — Quotes
- [x] Settings toggle: show a quote (off by default), e.g. under the timer or on breaks, rotating per session
- [x] Source: **Default list** (~100 quotes) or **My quotes** (one or more of the user's own, added/edited/removed in settings, stored locally)
- [x] Default list: 100 productivity/work/learning quotes from scientists (e.g. Feynman, Curie, Einstein) and other accomplished people
  - Kept in a Markdown file in the repo (`src/content/quotes.md`) so it's easy to review and update in a PR. Imported at build time with Vite `?raw` and parsed, with no runtime fetch
  - Proposed format, one quote per blockquote, attribution after an em dash:
    ```
    > The first principle is that you must not fool yourself — and you are the easiest person to fool.
    > — Richard Feynman, *Cargo Cult Science* (1974)
    ```
  - **Accuracy rule:** only well-sourced attributions (misattributed quotes are rampant). Include a source where possible, and drop anything that's apocryphal
  - Unit test the parser, and add a test that every entry has text and an author and there are no duplicates
- [x] Rotation: random without repeats until the list is exhausted; don't change mid-session
- [x] Accessible: quote text is real text (not an image), muted styling, and it can be hidden entirely

### Phase 5 — Links & agents
- [x] Link actions: `?do=start|pause|skip|reset|add-task` with `mode`, `min`, `task`, `estimate`; params are stripped after running, and abandoning a focus session still asks first
- [x] PWA icon shortcuts (start focus / short / long break) built on link actions
- [x] `window.pomo` scripting API for agents and automation driving the page: state, start/pause/reset/skip/finish, tasks, and every palette command via `pomo.run()`
- [x] `public/llms.txt` describing link actions and the API
- WebMCP (`navigator.modelContext`) skipped for now: it needs an agent built into the browser; revisit if that becomes common

## Backburner (revisit if there's demand)
Not part of any phase. Pick these up only if people ask for them.
- [ ] Optional name + time-of-day greeting (e.g. "Good morning, Sam"; "Welcome back" after a gap). Off by default; the name is stored locally only
- [ ] Timer style: ring / minimal (digits only) / progress bar
- [ ] Clock font (a few curated Google Fonts, loaded on demand) and weight
- [ ] Custom theme builder: tweak background, blobs and text colours; save as "My theme"
- [ ] Background controls: blob intensity and speed, grain on/off, solid colour
- [ ] Separate alarm sound for the end of a break, plus an alarm repeat count
- [ ] Show/hide individual UI elements (cycle dots, goal meter, tab counts, streak chip, subtitle)
- [ ] Custom mode names and subtitle messages
- [ ] Custom background photos (IndexedDB, a few images, never leave the device)
- [ ] Per-scene controls: speed, density/intensity, color follows theme vs. mode
- [ ] Remap keyboard shortcuts in settings
- [x] Command palette (Cmd/Ctrl+K) with fuzzy search and a command-bar timer syntax, e.g. "Start 50m focus", "Switch to Tamagotchi", "Toggle rain", "Export today", "Log interruption", "Set current task"
- [x] Undo an accidental pomodoro: an Undo button on the "Pomodoro counted" toast (10 s), and deletable sessions (with undo) under "Recent sessions" in the progress view

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
- 2026-09-27 — Safari fix: settings switches are <label>s with `appearance: none` checkboxes. Some WebKit builds shrink native checkboxes to 12x12, which made most of each switch unclickable.
- 2026-09-27 — PWA via vite-plugin-pwa with registerType 'prompt': updates wait for the user so a running session is never reloaded. The PWA e2e project runs against a production preview.
- 2026-09-27 — Clock faces are modules in src/faces (ring, tomato, tamagotchi) that render from the same timer state; digits stay real text. Face artwork avoids CSS transform-origin in px (the ring bug), using transform-box: fill-box or SVG transform attributes.
- 2026-09-27 — three.js loads lazily only when a scene is chosen (own ~130 KB gz chunk). It's precached by the PWA, so a chosen scene also works offline.
- 2026-09-27 — Moved custom photos, per-scene controls, extra clock faces and key remapping to the Phase 4 reserve (keep customization lean).
- 2026-09-27 — No speculative clock faces in the plan; new ones will come from specific requests.
- 2026-09-27 — Messages: tips can be turned off (and replayed), the goal celebration has "Don't show again"; confirmations of user actions and update prompts always show.
- 2026-09-27 — Phase 4 is quotes only; the greeting and the customization ideas live on a separate Backburner list outside the phases.
- 2026-09-27 — Default quotes sourced from Wikiquote "Sourced" sections (and well-documented originals), cross-checked by hand. Extraction was unreliable (e.g. a nonsense citation), so anything that didn't check out was dropped. A test guards against known misattributions.
- 2026-09-27 — Five more faces added on request. Faces expose data-level (0–100) for tests; continuous motion is CSS (off under reduced motion); art-top faces put the digits below the artwork.
- 2026-09-27 — The pop-out mini timer mounts its own instance of the selected face, with the page's stylesheets and theme tokens copied into the PiP document, so it always matches the page.
- 2026-09-27 — Zen Enso retired in favor of Robot Pet; saved settings with an unknown face fall back to the ring. In focus mode, the quote (if on) moves above the clock.
- 2026-09-27 — Robot Pet battery now drains during focus and recharges on breaks (it used to fill on focus and drain while "charging"). Blob Pet gets distinct short-break (stretch/yawn) and long-break (nap) moods via data-mode.
- 2026-09-28 — Second animation pass on Tetris, Spaceship, Handheld, Tomato, Potion and Plant. Face unit tests mock reduced motion (static art); an e2e test plays a real completion on each. Command palette (Cmd/Ctrl+K) added to the backburner.
- 2026-09-28 — Command palette (Cmd/Ctrl+K) shipped from the backburner. "Start 50m focus" sets a one-off length for that session only (new `timer.plannedMs`, cleared on restart/switch/completion); "set focus to 50m" changes the saved setting. Picking the ambient sound that's already on turns it off, so "toggle rain" works both ways. Keyboard-only for now (no top-bar button).
- 2026-09-28 — Fixed a label race in `swapText`: Start and Pause swapped in the same tick (e.g. auto-started breaks) left the button reading "Start" while running.
- 2026-09-28 — Accidental pomodoros: a finished focus session can be undone from its toast (removes the record, takes back the task's 🍅 and focused time, restores the cycle dot, and returns to Focus if still on the following break). Older sessions are deleted from Progress → Recent sessions (last 15 focus sessions), with an Undo toast instead of a confirm dialog. When the daily-goal toast shows, it takes the place of the Undo toast.
- 2026-09-29 — Agent access without a backend: link actions (`?do=`) for anything that opens a URL, and `window.pomo` for agents that drive the page. Settings never go in the URL. The API acts without confirmation dialogs (explicit programmatic intent) but `finish()` only counts past halfway; link actions go through the normal dialogs since a stale bookmark could fire mid-session. `llms.txt` added; WebMCP deferred. An outside agent still can't see the timer, since data stays in the browser.
- 2026-09-29 — Fixed keep-awake for sessions restored on reload: the startup `wakeLock.set` call had landed after a `return` inside `previewAmbient` (since 9c3da73), so the screen could sleep until the next pause/resume.
