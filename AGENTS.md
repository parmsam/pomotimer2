# AGENTS.md

Guidance for AI coding agents working in this repo.

**`PLAN.md` is the living plan.** Read it before starting work. When you finish a task, tick its checklist item; when scope or a key decision changes, update the relevant section and add a dated line to the decisions log.

## Project
Aesthetic Pomodoro timer. Static site on GitHub Pages; no backend. All persistence is localStorage.

## Stack
- Vite + TypeScript (strict), **no UI framework** — plain DOM modules.
- anime.js v4 for UI animation; three.js only for optional background scenes, always **lazy-loaded** via dynamic `import()`.
- vite-plugin-pwa for offline/install (`registerType: 'prompt'`, so never auto-reload; see `src/ui/pwa.ts`). The service worker only exists in production builds; `e2e/pwa.spec.ts` runs against `vite preview`.

## Commands
- `npm install`
- `npm run dev` — local dev server
- `npm run build` — typecheck + production build to `dist/`
- `npm run preview` — serve the built site
- `npm test` — unit tests (Vitest, jsdom); `npm run test:watch` while developing
- `npm run test:e2e` — end-to-end tests (Playwright: Chromium, WebKit, mobile); starts its own dev server
- `npm run check` — typecheck + unit + e2e; run before every commit

## Testing
CI (`.github/workflows/ci.yml`) runs typecheck, unit and e2e tests on every branch push and PR. Deploys to Pages only happen when they pass.
- **Unit tests** sit next to the module as `src/**/*.test.ts`. Core logic (`src/core/`) must stay DOM-light so it's easy to test. Use `vi.useFakeTimers()` + `vi.setSystemTime()` for anything time-based instead of real waits.
- **E2E tests** live in `e2e/`. Use `open(page, seed)` from `e2e/helpers.ts` to start from a known localStorage state (e.g. `focusInProgress(20)` for a session 20 min in) instead of waiting in real time. Import `test` from the helpers, which fail on any uncaught page error.
- New behavior needs tests. Every bug fix needs a regression test that fails without the fix.
- Prefer role/label locators (`getByRole`) over CSS classes where practical, which also exercises accessibility.

## Conventions
- **Timer logic**: never count down with `setInterval`. Store `endsAt` (epoch ms) and derive remaining time from `Date.now()`.
- **Storage**: go through `src/core/storage.ts` only. Keys are namespaced `pomo:v1:*`; wrap every read/write in try/catch and fall back to defaults. Bump the version and add a migration when the schema changes.
- **State**: mutate via the store in `src/core/store.ts`; UI modules subscribe, they don't hold their own copies of persisted state.
- **Theming**: colors are CSS custom properties in `src/themes/tokens.css`; theme presets only set tokens.
- **Motion**: respect `prefers-reduced-motion` — skip three.js scenes and use minimal anime.js transitions.
- **Assets**: reference with paths relative to Vite's `base` (`/pomotimer2/`); sounds live in `public/sounds/` and must be CC0 or otherwise redistributable.
- Keep bundles lean: don't add dependencies for things a few lines of TS can do.

## Reference material
`ref/` is gitignored and holds captures of other Pomodoro sites (e.g. `ref/pomodorotimer.online/`) for studying features and UX. Use it to learn behavior, then write our own implementation. Never copy their code, copy text or assets into `src/`. Summaries of what we learned go in `PLAN.md` → Reference notes.

## Deployment
Push to `main` → GitHub Actions (`.github/workflows/deploy.yml`) builds and publishes to GitHub Pages. Pages source must be set to "GitHub Actions" in repo settings.
