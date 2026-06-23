---
name: web-structure
description: >
  Defines the canonical folder and file structure for this Next.js project.
  Use this skill whenever you are creating new pages, components, utilities, hooks,
  or any new directory/file. Trigger on requests like "add a new page",
  "create a component", "add a new feature", "scaffold X module", or any time a
  new file needs to be placed somewhere in the project. This skill is the source
  of truth for where things go and how they are named.
---

# Project Structure

This skill captures the canonical folder layout for this project. Always follow this structure when adding new files or features.

## Top-Level Layout

```
project-root/
├── app/                      # Next.js App Router — pages & layouts only
├── components/               # All React UI components
├── utils/                    # Pure utilities, API helpers, routing, validation
├── public/
│   └── assets/               # Static assets (images, fonts, icons)
├── config.ts                 # App-wide config (e.g. apiUrl from env)
├── next.config.ts
├── tsconfig.json
└── .env.local                # Environment variables (never committed)
```

> Application code lives at the repository root (`app/`, `components/`, `utils/`) — there is no `` directory. The `@/*` path alias maps to `./*`.

---

## `app/` — Pages & Layouts

Follows Next.js App Router conventions. **Only** put `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, and server `actions.ts` here. No business logic or reusable components.

```
app/
├── (app)/                    # Route group — wraps the shell/authenticated pages in a shared layout
│   ├── layout.tsx            # App shell (nav, header, etc.)
│   ├── <feature>/
│   │   ├── page.tsx          # List/index page for the feature
│   │   └── [<feature>-details]/
│   │       └── page.tsx      # Detail page, uses a dynamic segment
├── auth/
│   └── sign-in/
│       └── page.tsx
├── actions.ts                # Global server actions
├── layout.tsx                # Root layout (html, body, providers)
└── page.tsx                  # Root index route
```

> The route group name is a convention, not a requirement — use whatever fits the project (`(app)`, `(Dashboard)`, `(authenticated)`, …). The *technique* — grouping shell pages under a parenthesized folder that shares a `layout.tsx` — is the portable part. A project with no shell doesn't need a route group at all.

**Naming rules:**
- Route group folders use parentheses: `(app)`, `(Dashboard)`, etc.
- Dynamic segments use brackets with kebab-case: `[order-details]`
- Feature folders are singular or plural as makes sense for the domain (e.g. `orders`, `category`, `users`)

---

## `components/` — UI Components

Each feature gets its own sub-directory. Common/shared components live in `common/`.

```
components/
├── <feature>/                         # e.g. orders/, category/, area/, users/
│   ├── index.tsx                      # Main entry component for the feature (list view, container)
│   ├── schema.ts                      # Yup/Zod validation schema for forms in this feature
│   └── <feature>-details/             # Detail/inner view sub-components
│       ├── index.tsx
│       └── <sub-section>/
│           └── index.tsx
├── auth/
│   ├── sign-in/
│   │   └── index.tsx
│   └── schema.ts
├── layout/
│   └── header/
│       └── index.tsx
└── common/                            # Reusable, domain-agnostic UI primitives
    ├── Button/
    │   └── index.tsx
    ├── Input/
    │   └── index.tsx
    ├── Card/
    │   └── index.tsx
    ├── Loader/
    │   └── index.tsx
    ├── Select/
    │   └── index.tsx
    ├── SearchInput/
    │   └── index.tsx
    ├── GenericTable/
    │   └── index.tsx
    ├── BackArrow/
    │   └── index.tsx
    └── form-dialog/
        └── index.tsx
```

**Naming rules:**
- Feature folders are lowercase kebab-case: `order-details`, `category-details`
- Each component lives in its own folder with an `index.tsx` entry point
- Common components use PascalCase folder names: `Button/`, `GenericTable/`
- Each feature that has forms gets a `schema.ts` alongside its `index.tsx`

---

## `utils/` — Utilities

```
utils/
├── routes/
│   └── index.tsx             # All UI and API route/endpoint strings (see web-api-patterns skill)
├── api-call/
│   └── index.ts              # Client-side Axios wrapper for browser components
├── api-request/
│   └── index.ts              # Server-side fetch wrapper for Server Components / Server Actions
├── helper/
│   └── index.ts              # Pure helper functions (e.g. unit conversions, formatters)
├── validation/
│   └── index.ts              # Shared validation helpers / custom Yup rules
└── cn.ts                     # Tailwind className merge utility
```

---

## `config.ts` (root-level)

Exports a single `config` object that reads from environment variables:

```typescript
// config.ts
export const config = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL,
};
```

All environment-dependent values are read here and imported from this file — never access `process.env` directly in components or utils.

---

## Key Conventions

1. **Every component in its own folder with `index.tsx`** — this keeps imports clean (`import Foo from '@/components/common/Foo'`) and makes future co-location of styles or tests trivial.

2. **Feature = folder** — when adding a new domain feature (call it `<feature>`), create:
   - `app/(app)/<feature>/page.tsx` (or under whatever route group the project uses, or directly under `app/` if there's no shell)
   - `components/<feature>/index.tsx`
   - `components/<feature>/schema.ts` (if it has forms)
   - Add its API endpoints to `utils/routes/index.tsx` under `routes.api`
   - Add its UI paths to `utils/routes/index.tsx` under `routes.ui`

3. **Schema files stay next to their feature component** — `schema.ts` lives inside the same feature folder, not in a global schemas directory.

4. **Static assets** go in `public/assets/` and are referenced as `/assets/filename.ext`.

5. **Path alias** — always use `@/` instead of relative imports that go up more than one level:
   ```typescript
   // Good
   import apiCall from '@/utils/api-call';
   import { routes } from '@/utils/routes';

   // Avoid
   import apiCall from '../../../utils/api-call';
   ```
