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

### Phase 1 — MVP
- [ ] Vite + TS scaffold, GitHub Pages deploy workflow
- [ ] Timer engine (timestamp-based, survives reload)
- [ ] Store + versioned localStorage
- [ ] Ring UI + anime.js transitions
- [ ] Core settings panel (durations, auto-start, long-break interval)
- [ ] Theme presets + custom accent
- [ ] Alarm sounds + volume
- [ ] Notifications, title countdown

### Phase 2 — Polish
- [ ] Task list (est. pomodoros, active task linked to sessions)
- [ ] Stats (daily sessions, streak, 7-day chart)
- [ ] Keyboard shortcuts
- [ ] Focus mode
- [ ] Export/import/reset data

### Phase 3 — Eye candy
- [ ] three.js scenes (particles/fireflies, shader gradient mesh, rain on glass, low-poly tomato)
- [ ] Ambient audio loops
- [ ] PWA (offline, installable)
- [ ] Wake Lock, progress favicon

## Decisions log
- 2026-09-27 — Vanilla TS over React/Svelte: single-screen app, imperative animation libs.
- 2026-09-27 — three.js is optional + lazy-loaded; default background is CSS/anime.js.
- 2026-09-27 — In scope: tasks, stats, ambient sounds, PWA.
