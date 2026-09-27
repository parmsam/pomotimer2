# AGENTS.md

Guidance for AI coding agents working in this repo.

**`PLAN.md` is the living plan.** Read it before starting work. When you finish a task, tick its checklist item; when scope or a key decision changes, update the relevant section and add a dated line to the decisions log.

## Project
Aesthetic Pomodoro timer. Static site on GitHub Pages; no backend. All persistence is localStorage.

## Stack
- Vite + TypeScript (strict), **no UI framework** — plain DOM modules.
- anime.js v4 for UI animation; three.js only for optional background scenes, always **lazy-loaded** via dynamic `import()`.
- vite-plugin-pwa for offline/install.

## Commands
- `npm install`
- `npm run dev` — local dev server
- `npm run build` — typecheck + production build to `dist/`
- `npm run preview` — serve the built site

## Conventions
- **Timer logic**: never count down with `setInterval`. Store `endsAt` (epoch ms) and derive remaining time from `Date.now()`.
- **Storage**: go through `src/core/storage.ts` only. Keys are namespaced `pomo:v1:*`; wrap every read/write in try/catch and fall back to defaults. Bump the version and add a migration when the schema changes.
- **State**: mutate via the store in `src/core/store.ts`; UI modules subscribe, they don't hold their own copies of persisted state.
- **Theming**: colors are CSS custom properties in `src/themes/tokens.css`; theme presets only set tokens.
- **Motion**: respect `prefers-reduced-motion` — skip three.js scenes and use minimal anime.js transitions.
- **Assets**: reference with paths relative to Vite's `base` (`/pomotimer2/`); sounds live in `public/sounds/` and must be CC0 or otherwise redistributable.
- Keep bundles lean: don't add dependencies for things a few lines of TS can do.

## Deployment
Push to `main` → GitHub Actions (`.github/workflows/deploy.yml`) builds and publishes to GitHub Pages. Pages source must be set to "GitHub Actions" in repo settings.
