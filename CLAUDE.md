# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Critical: Next.js 16 — verify APIs against bundled docs

This project runs **Next.js 16.2.7** (App Router) on **React 19.2** and **Tailwind CSS v4**. These are newer than typical training data, and Next.js 16 ships breaking changes. Before writing or changing framework code, read the relevant guide in `node_modules/next/dist/docs/` rather than relying on memorized APIs. Useful entry points:

- `node_modules/next/dist/docs/01-app/01-getting-started/` — App Router fundamentals
- `node_modules/next/dist/docs/01-app/03-api-reference/` — exact current API signatures
- `node_modules/next/dist/docs/01-app/02-guides/` — task-oriented guides
- `node_modules/next/dist/docs/03-architecture/` — compiler, Fast Refresh, supported browsers

## Commands

```bash
npm run dev     # start dev server at http://localhost:3000
npm run build   # production build
npm run start   # serve the production build (run build first)
npm run lint    # ESLint (flat config, next/core-web-vitals + next/typescript)
```

There is no test runner configured in this project.

## Architecture

App Router project; all routes and UI live under `app/`:

- `app/layout.tsx` — root layout. Loads the Geist / Geist Mono fonts via `next/font/google`, exposing them as the `--font-geist-sans` / `--font-geist-mono` CSS variables, and sets `<html>`/`<body>` base classes. Wrap global providers here.
- `app/page.tsx` — the `/` route.
- `app/globals.css` — global styles, imported once from the root layout.

### Styling — Tailwind CSS v4

Tailwind v4 is configured entirely in CSS, not via a `tailwind.config.js`. In `app/globals.css`:

- `@import "tailwindcss";` pulls in the framework.
- The `@theme inline { ... }` block is where design tokens are declared (e.g. `--color-background`, `--font-sans` mapped to the Geist font variables). Add or change tokens here — they become Tailwind utilities (`bg-background`, `font-sans`, etc.).
- Dark mode currently follows the OS via a `prefers-color-scheme` media query that overrides the `:root` color variables.

PostCSS wires this up through the `@tailwindcss/postcss` plugin (`postcss.config.mjs`).

### TypeScript

The `@/*` path alias maps to the repository root (e.g. `import x from "@/app/..."`), configured in `tsconfig.json`. `strict` mode is on.
