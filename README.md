# 🍅 pomo

An aesthetic, customizable Pomodoro timer with smooth [anime.js](https://animejs.com) motion. It has tasks, streaks, stats and keyboard shortcuts, and everything stays in your browser.

**[Open the app →](https://parmsam.github.io/pomotimer2/)**

<p align="center">
  <img src="docs/screenshot-desktop.png" alt="pomo on desktop: a glowing progress ring counting down a focus session, with today's task list beside it" width="72%" />
  &nbsp;
  <img src="docs/screenshot-mobile.png" alt="pomo on a phone" width="22%" />
</p>

## Features

- **A timer that doesn't drift.** It counts from a saved end time, so background tabs, sleep and reloads don't throw it off. A session that finishes while the page is closed still counts.
- **Tasks.** A "Today" list with pomodoro estimates, an estimated finish time, and focus time tracked against whichever task you're working on.
- **Honest sessions.** Following Cirillo's rule that a pomodoro is indivisible, stopping early abandons it, but your focused minutes still count toward today. Past the halfway mark you can still count it.
- **Progress.** A daily streak, a daily goal, per-mode counts, and a 7-day focus chart.
- **Optional extras:** strict mode (no pausing), interruption tracking (internal/external, with notes saved for later), and focus mode, which hides everything but the timer.
- **Make it yours.** Five themes, per-mode colors, interval presets (25/5/15 · 50/10/20 · 90/15/30), alarm sounds, and an optional tick.
- **Works with multiple tabs.** Open tabs stay in sync, and only one of them rings.
- **Your data stays local.** No account, no server, no tracking. Export a JSON backup to move between browsers.
- **Accessible.** Full keyboard control, screen-reader labels, and it respects "reduce motion".

## Keyboard shortcuts

Press <kbd>?</kbd> in the app to see them all.

| Key | Action |
|---|---|
| <kbd>Space</kbd> | Start / pause |
| <kbd>R</kbd> / <kbd>S</kbd> | Restart / skip session |
| <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> | Focus / short break / long break |
| <kbd>T</kbd> / <kbd>N</kbd> | Show tasks / new task |
| <kbd>↑</kbd> <kbd>↓</kbd> <kbd>Enter</kbd> <kbd>X</kbd> <kbd>E</kbd> <kbd>Del</kbd> | Move between tasks, make current, done, edit, delete |
| <kbd>Alt</kbd> + <kbd>↑</kbd>/<kbd>↓</kbd> | Reorder a task |
| <kbd>G</kbd> | Progress, streak & goal |
| <kbd>F</kbd> | Focus mode |
| <kbd>I</kbd> | Log an interruption (when tracking is on) |
| <kbd>M</kbd> | Mute |
| <kbd>,</kbd> | Settings |
| <kbd>Esc</kbd> | Close any panel or dialog |

## Privacy

pomo is a static site on GitHub Pages. Settings, tasks and history are saved in your browser's `localStorage` and never sent anywhere. Clearing site data removes them, so use **Settings → Data → Export backup** if you want a copy.

## Development

Requires Node 22+.

```sh
npm install
npm run dev        # http://localhost:5173/pomotimer2/
npm run build      # typecheck + production build to dist/
npm run check      # typecheck + unit tests + end-to-end tests
```

| | |
|---|---|
| Stack | Vite + TypeScript (no UI framework), anime.js v4, Web Audio for synthesized alarms |
| Unit tests | Vitest (`src/**/*.test.ts`), with fake timers for time-based logic |
| E2E tests | Playwright on Chromium, WebKit and a mobile viewport (`e2e/`) |
| CI / deploy | Every push runs the tests; pushes to `main` deploy to GitHub Pages only if they pass |

The plan and roadmap live in [`PLAN.md`](PLAN.md), and conventions for contributors (human or AI) in [`AGENTS.md`](AGENTS.md).

## Roadmap

Up next: Markdown import/export of tasks, an installable offline app, clock themes (a tomato kitchen timer, a Tamagotchi), three.js backgrounds, ambient sounds and haptics. See [`PLAN.md`](PLAN.md).

## Credits

- The [Pomodoro Technique](https://en.wikipedia.org/wiki/Pomodoro_Technique) was created by Francesco Cirillo.
- Inspired by [studywithme.io](https://studywithme.io/aesthetic-pomodoro-timer/), [pomodorotimer.online](https://pomodorotimer.online) and [tomatotimers.com](https://www.tomatotimers.com).
- Font: [Outfit](https://fonts.google.com/specimen/Outfit).
