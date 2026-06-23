---
name: web-api-patterns
description: >
  Defines the canonical patterns for declaring API/UI routes and making API calls in this project.
  Use this skill whenever you are: adding a new API endpoint, calling a backend endpoint,
  reading data in a Server Component or Server Action, wiring up a form submission, or doing
  anything that touches HTTP requests. Trigger on requests like "call the API", "fetch data",
  "add an endpoint", "make a request to...", "POST to...", "GET ...", or any time backend
  communication is involved. This skill is the source of truth for how routes are declared
  and how API calls are made — both client-side and server-side.
---

# Web API Patterns

Two concerns are covered here:

1. **How to declare endpoints** — the `routes` object in `utils/routes/index.tsx`
2. **How to call endpoints** — `apiCall` (client) and `apiRequest` (server)

---

## 1. Declaring Routes — `utils/routes/index.tsx`

All route strings — both UI navigation paths and API endpoint paths — live in a single `routes` object exported from this file. Nothing else should hard-code a path string.

### Structure

```typescript
export const routes = {
  ui: {
    // Static paths
    indexRoute: "/",
    signIn: "/auth/sign-in",
    featureName: "/feature-name",

    // Dynamic paths — use a function
    featureDetails: (id: string | number) => `feature-name/${id}`,

    // With optional query params
    orderDetails: (id: string | number, number?: string | number) =>
      number ? `orders/${id}?number=${number}` : `orders/${id}`,
  },

  api: {
    // Static endpoints (no leading slash — the base URL is prepended by the caller)
    listFeatures: "features",
    createFeature: "features",

    // Dynamic endpoints — use a function
    getFeature:    (id: string | number) => `features/${id}`,
    updateFeature: (id: string | number) => `features/${id}`,
    deleteFeature: (id: string | number) => `features/${id}`,

    // Sub-resource endpoints
    getFeatureItems: (id: string | number) => `features/${id}/items`,

    // Action endpoints
    markFeatureActive:   (id: string) => `features/${id}/mark-as-active`,
    markFeatureInactive: (id: string) => `features/${id}/mark-as-inactive`,
  },
};
```

### Rules

- **`routes.ui`** — paths for `<Link href={...}>`, `router.push(...)`, `redirect(...)`. Always start with `/`.
- **`routes.api`** — endpoint paths appended to `config.apiUrl`. **No leading slash.** The caller prepends the base URL.
- **Static values** are plain strings. **Dynamic values** are arrow functions that receive an `id` (and optionally other params) and return a string.
- **Never** hard-code a path string anywhere else in the codebase. Always import from `routes`.

### Usage example

```typescript
import { routes } from '@/utils/routes';

// UI navigation
router.push(routes.ui.orderDetails(orderId));

// API endpoint passed to apiCall / apiRequest
const res = await apiCall({ endpoint: routes.api.getOrderDetails(orderId), method: 'GET' });
```

---

## 2. Client-Side API Calls — `utils/api-call/index.ts`

Use `apiCall` inside **Client Components** (`'use client'`) and any browser-side event handler (button clicks, form submissions, etc.).

### Signature

```typescript
apiCall<T = unknown>({
  endpoint,        // string — from routes.api
  method,          // 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  data?,           // Record<string, unknown> — body for POST/PUT/PATCH, params for GET
  headers?,        // Record<string, string> — extra headers
  showSuccessToast?,  // boolean (default: false)
  successMessage?,    // string — custom success toast text
}): Promise<ApiResponse<T>>
```

### `ApiResponse<T>` shape

```typescript
{
  success: boolean;     // true = 2xx, false = error
  data: T | null;       // response body on success, raw error body on failure
  status: number | null;
  message: string;      // human-readable result or error description
}
```

### How it works

- Reads the `authtoken` cookie and attaches it as a `Bearer` token automatically.
- **Caches GET responses** in memory — repeated identical GET calls return the cached result instantly.
- **Clears the cache** on any mutation (POST, PUT, PATCH, DELETE) so the next GET fetches fresh data.
- Shows an error toast automatically on failure — you don't need to handle toasts yourself for errors.
- Pass `showSuccessToast: true` (and optionally `successMessage`) to show a success toast.

### Usage pattern

```typescript
'use client';
import apiCall from '@/utils/api-call';
import { routes } from '@/utils/routes';

// GET
const { success, data } = await apiCall<Order[]>({
  endpoint: routes.api.getOrders,
  method: 'GET',
});

// POST with success toast
const { success, data } = await apiCall<Order>({
  endpoint: routes.api.createRegularItem,
  method: 'POST',
  data: { itemId, quantity },
  showSuccessToast: true,
  successMessage: 'Item added to order',
});

// DELETE
const { success } = await apiCall({
  endpoint: routes.api.deleteOrderItem(itemId),
  method: 'DELETE',
  showSuccessToast: true,
  successMessage: 'Item removed',
});

// Always check success before using data
if (success && data) {
  // use data
}
```

### Error handling

`apiCall` handles all HTTP errors and network errors internally — it shows a toast and returns `{ success: false, ... }`. You only need to check the `success` flag; you don't need try/catch around `apiCall`.

---

## 3. Server-Side API Calls — `utils/api-request/index.ts`

Use `apiRequest` inside **Server Components**, **Server Actions**, and **Route Handlers** — any code that runs on the Node.js server where cookies are accessed via `next/headers`.

### Signature

```typescript
apiRequest({
  endpoint,         // string — from routes.api
  isProtected?,     // boolean (default: false) — attach accessToken cookie if true
  ...fetchOptions,  // any native fetch RequestInit options (method, body, headers, etc.)
}): Promise<any>   // returns the parsed JSON body directly
```

### How it works

- Uses the native `fetch` API with `cache: 'no-store'` (always fresh data).
- If `isProtected: true`, reads the `accessToken` cookie via `next/headers` and attaches it as a `Bearer` token.
- Calls Next.js `unauthorized()` automatically on a 401 response.
- Returns the parsed JSON body directly (not wrapped in a success/data envelope).

### Usage pattern

```typescript
// In a Server Component
import { apiRequest } from '@/utils/api-request';
import { routes } from '@/utils/routes';

// Public endpoint
const categories = await apiRequest({
  endpoint: routes.api.getItemCategories,
});

// Protected endpoint
const orders = await apiRequest({
  endpoint: routes.api.getOrders,
  isProtected: true,
});

// POST from a Server Action
const result = await apiRequest({
  endpoint: routes.api.createItemCategory,
  method: 'POST',
  body: JSON.stringify({ name, description }),
  headers: { 'Content-Type': 'application/json' },
  isProtected: true,
});
```

---

## Choosing Between `apiCall` and `apiRequest`

| Situation | Use |
|-----------|-----|
| Inside a `'use client'` component | `apiCall` |
| Button / form submit handler in the browser | `apiCall` |
| Server Component fetching data at render time | `apiRequest` |
| Server Action (`'use server'`) | `apiRequest` |
| Need caching / deduplication | `apiCall` (has in-memory cache) |
| Need automatic error toasts | `apiCall` |
| Need access to cookies server-side | `apiRequest` |

---

## Quick Checklist When Adding a New Endpoint

1. Add the endpoint string(s) to `routes.api` in `utils/routes/index.tsx`
2. Add the corresponding UI path to `routes.ui` if there's a new page
3. Call the endpoint using `apiCall` (client) or `apiRequest` (server) — never `fetch` or `axios` directly
4. Check `success` (for `apiCall`) or handle errors at the call site (for `apiRequest`)
