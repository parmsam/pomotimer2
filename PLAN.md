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
Space start/pause · R reset · S skip · F focus mode · `,` settings · T tasks

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
- [ ] Stats (daily sessions, streak, 7-day chart)
- [x] Keyboard shortcuts
- [ ] Focus mode
- [ ] Export/import data (reset is done)
- [x] Record abandoned pomodoros (reset/skip mid-focus) in history — "a pomodoro is indivisible"
- [x] Interruption log: one-tap internal/external interruption marks during focus, with a quick note to "schedule" it as a task
- [x] Optional strict mode (no pause; stopping = abandoning)
- [x] "To Do Today" framing for the task list
- [x] Nuanced stop/skip/switch dialogs (replace `confirm()`): abandoning keeps focused minutes in today's total; past the halfway mark it still counts as a session
- [ ] Per-mode completed counters on the mode tabs
- [ ] Streak in header (🔥 n): 1 session or N focused minutes keeps it alive; best streak; total focus
- [ ] Daily focus goal ("challenge") with a celebration on completion
- [x] Per-task time tracking: the focused task accrues minutes, clamped to the session, survives reload
- [ ] Cross-tab sync via the `storage` event
- [ ] Rotating break tips + editable motivational quote
- [ ] Optional name + time-of-day greeting

#### Customization
- [ ] Timer style: ring / minimal (digits only) / progress bar
- [ ] Clock font choice (a few curated Google Fonts) + weight
- [ ] Per-mode colors (short/long break too, not just focus)
- [ ] Custom theme builder: tweak bg, blobs, text; save as "My theme"
- [ ] Background controls: blob intensity/speed, grain on/off, solid color option
- [ ] Alarm per mode (e.g. gentle chime to end a break) + alarm repeat count
- [ ] Toggle UI elements: cycle dots, subtitle, tab counters, quote
- [ ] Custom mode names and subtitle messages
- [ ] Preset intervals quick-pick (25/5/15 · 50/10/20 · 90/15/30)

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
- [ ] README: what it is, screenshot/GIF, live link, features, keyboard shortcuts, privacy note (data stays in the browser), local dev + testing commands, credits (Cirillo, inspirations)
- [ ] Nicely placed GitHub link in the app: small GitHub icon in the top bar or an "About" footer in settings, opening the repo in a new tab

#### Clock themes
Whole-timer "faces" that go beyond the Phase 2 timer styles (ring / minimal / bar). Each face is a module that renders from the same `remaining / duration / mode / status` state, so the engine doesn't change.
- [ ] Face picker in settings with live previews
- [ ] **Tomato**: Cirillo's original kitchen timer. A tomato dial that twists back as time runs down, with a wind-up animation on start and an optional mechanical tick. Leaves wilt slightly on breaks, and it wobbles and "rings" at the end
- [ ] **Tamagotchi**: an egg-shaped LCD device with pixel digits and a small pixel pet. The pet works alongside you during focus and plays or naps on breaks. It grows or evolves with completed pomodoros and your streak, and looks a bit sad after abandoned sessions (never punishing)
- [ ] Other candidates: flip clock, hourglass (sand falls with time), analog kitchen clock, growing plant, burning candle, minimal LCD
- [ ] Faces follow the theme colours, respect reduced motion, and stay accessible (time always available to screen readers)

#### Markdown export
- [ ] Export session history as Markdown (per-day headings, sessions with times and durations, daily totals)
- [ ] Export tasks as a Markdown checklist (`- [x]`), with pomodoros and tracked time per task
- [ ] Export options: date range, include tasks / sessions / stats summary
- [ ] Download as `.md` + copy to clipboard (for pasting into Obsidian, Notion, GitHub)

#### Keyboard & gesture shortcuts
Basics already exist (Space, R, S, `,`, Esc).
- [ ] More keys: `1`/`2`/`3` switch mode, `T` tasks, `F` focus mode, `M` mute, `+`/`-` add or remove a minute, `P` pop-out timer
- [ ] `?` opens a shortcuts cheat-sheet overlay
- [ ] Optional: remap keys in settings
- [ ] Swipe gestures on touch screens: swipe left/right on the dial to change mode, tap the dial to start/pause, long-press to reset, swipe up for tasks
- [ ] Gestures ignore scrolling areas and follow the same confirm rules as buttons (e.g. abandoning a focus session)

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
