---
name: web-best-practices
description: >
  Defines the coding standards and best practices for this project's frontend.
  Use this skill whenever you are writing any new code — components, forms,
  pages, utilities, or anything else. Trigger on requests like "add a form",
  "create a component", "build a page", "add a field", "write a feature", or
  any coding task. This skill is the source of truth for how code should be
  written and must be consulted before writing any component, form, or utility.
---

# Coding Best Practices

These practices must be followed in all new frontend code written for this project.

---

## 1. Tailwind CSS — Always Use It for Styling

All visual styling is done with Tailwind utility classes. Never use inline `style={{}}` for anything that Tailwind can handle, and never write custom CSS unless it is a genuinely one-off animation or something Tailwind cannot express.

**The `cn` utility is always used to compose class names** — never concatenate class strings manually. Import it from `@/utils/cn`:

```typescript
import { cn } from '@/utils/cn';

// Good — conditional classes composed safely
<div className={cn('base-class', isActive && 'active-class', className)} />

// Bad — string concatenation
<div className={'base-class ' + (isActive ? 'active-class' : '')} />
```

**`cn` is implemented with `clsx` + `tailwind-merge`** so conflicting utilities resolve correctly (e.g. `px-4` later overrides `px-2`).

### Tailwind patterns

The **patterns** below are canonical (mobile-first responsive prefixes, state variants, flex layout, error → `border-red-500`). The **specific values** — exact hex colors, radii, font sizes/weights — are illustrative from one project; substitute this project's own design tokens (defined in `globals.css` `@theme`).

```typescript
// Responsive prefixes — pattern: mobile-first, then a breakpoint
'py-3 md:py-4 px-4 md:px-6'       // illustrative spacing; use your scale

// State variants
'hover:bg-neutral-700'            // illustrative color
'disabled:opacity-30 disabled:cursor-not-allowed'
'focus:outline-none'

// Flexbox layout
'flex items-center justify-center gap-2'
'flex flex-col space-y-5'

// Positioning
'absolute left-4 top-1/2 -translate-y-1/2'
'relative w-full'

// Typography — values illustrative; prefer named tokens over arbitrary values where they exist
'text-[14px] font-[500] text-black'
'placeholder:font-[400] placeholder:text-[#C1C1C1]'   // #C1C1C1 is one project's placeholder color

// Borders & radius
'border border-muted rounded-[8px]'   // `border-muted` requires a --color-muted theme token; if undefined it renders no color — define it or use a concrete utility
'border-red-500'                       // error state — canonical

// Transitions
'transition-colors duration-200'
```

---

## 2. Yup — Always Use It for Form Validation

Every form has a corresponding `schema.ts` file in the same feature folder. Schemas are defined with `yup.object()` and imported by the component.

### Schema file pattern (`schema.ts`)

```typescript
import * as yup from 'yup';

// Simple field
export const signInSchema = yup.object({
  email: yup
    .string()
    .required('Email is required')
    .email('Enter a valid email address'),
  password: yup
    .string()
    .required('Password is required')
    .min(6, 'Password must be at least 6 characters'),
});

// With custom test (cross-field or regex)
export const slotSchema = yup.object({
  startTime: yup
    .string()
    .required('Start time is required')
    .matches(/^\d{2}:\d{2}$/, 'Start time must be in HH:MM format (e.g. 10:00)'),
  endTime: yup
    .string()
    .required('End time is required')
    .test('is-after-start', 'End time must be after start time', function (endTime) {
      const { startTime } = this.parent;
      if (!startTime || !endTime) return true;
      return endTime > startTime;
    }),
});
```

### Validation helper — `validateAndSetErrors`

Never call `schema.validate()` directly in components. Use the helper from `@/utils/validation`:

```typescript
import { validateAndSetErrors } from '@/utils/validation';
import { mySchema } from '../schema';

const [errors, setErrors] = useState<Record<string, string>>({});

const handleSubmit = async () => {
  // Returns false and populates errors if invalid, returns true if valid
  if (!(await validateAndSetErrors(mySchema, { email, password }, setErrors))) return;

  // Proceed with API call...
};
```

### Clearing field errors on change

When the user edits a field, clear its specific error immediately — do not wait for re-submission:

```typescript
<Input
  value={email}
  onChange={(e) => {
    setEmail(e.target.value);
    if (errors.email) setErrors((prev) => ({ ...prev, email: '' }));
  }}
  error={errors.email}
/>
```

---

## 3. Common Components — Extract Anything Used More Than Once

If a UI element appears in more than one place, it must be a shared component living in `components/common/`. Never duplicate markup.

### Standard common components (create on first need)

These are the conventional shared primitives this stack relies on. **They may not exist yet in a fresh project** — when you first need one, create it in `components/common/` to the contract below, then import it everywhere. Once it exists, never re-implement it inline.

| Component | Location | Purpose |
|-----------|----------|---------|
| `Button` | `common/Button` | All buttons — supports `primary`, `secondary`, `outline`, `disabled` variants + `isLoading` |
| `Input` | `common/Input` | Text inputs — supports `error`, `startIcon`, `search` props |
| `Select` | `common/Select` | Dropdowns — supports `searchable`, `fullWidth`, `error`, `startIcon` |
| `SearchInput` | `common/SearchInput` | Debounced search with live API calls |
| `GenericTable` | `common/GenericTable` | Typed, paginated, sortable table |
| `Loader` | `common/Loader` | Animated dot loader |
| `Card` | `common/Card` | Content card wrapper |
| `BackArrow` | `common/BackArrow` | Navigation back button |
| `FormDialog` | `common/form-dialog` | Modal dialog for forms and confirmations |

> Before importing any of these, confirm the folder exists. If it doesn't, create it first (following the contract in §4) rather than assuming it's already there.

### Adding a new common component

When you need a UI element that will be used in 2+ places:

1. Create `components/common/MyComponent/index.tsx`
2. Define a typed props interface that extends the relevant HTML element attributes
3. Accept `className` and spread `...props` through to the underlying element
4. Use `cn()` to merge base styles with incoming `className`

The structure below is the pattern to follow; the literal class values (`rounded-[8px]`, `#C1C1C1`, `border-muted`) are illustrative — swap in this project's design tokens.

```typescript
// Pattern for a new common form field component
import { cn } from '@/utils/cn';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
  label?: string;
}

function Textarea({ error, label, className = '', ...props }: TextareaProps) {
  const baseStyles =
    'py-3 px-4 placeholder:font-[400] placeholder:text-[#C1C1C1] text-black border-muted border border-[1px] focus:outline-none rounded-[8px] w-full resize-none';

  return (
    <div className="w-full">
      {label && <label className="text-black font-[400] text-[14px] mb-1 block">{label}</label>}
      <textarea
        className={cn(baseStyles, error ? 'border-red-500' : '', className)}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

export default Textarea;
```

---

## 4. Form Field Components — Always Componentise Inputs

Every reusable form control (input, textarea, select, checkbox, radio, file upload) must be a standalone component in `common/`. Never write bare `<input>` or `<textarea>` tags inside feature components — always reach for the common component.

### The standard form field contract

Every form field component must support:

- **`error?: string`** — renders a red error message below the field when set
- **`className?: string`** — merged via `cn()` so callers can override spacing etc.
- **`...props`** — spreads all native HTML attributes through (value, onChange, disabled, placeholder, etc.)
- **Responsive sizing** — apply a mobile-first responsive padding pattern (e.g. `py-3 md:py-4 px-4 md:px-6`); use this project's spacing scale rather than these exact values

### Error display pattern

Errors always appear as a `<p>` tag immediately below the field:

```tsx
{error && <p className="mt-1 text-xs text-red-500">{error}</p>}
```

And the field itself gets `border-red-500` when an error is present:

```tsx
className={cn(baseStyles, error ? 'border-red-500' : '', className)}
```

### Form layout pattern

Labels go above inputs, grouped in a `div` with `space-y-2`:

```tsx
<div className="space-y-2 text-left">
  <label className="text-black font-[400] text-[14px]" htmlFor="fieldId">
    Field Label
  </label>
  <Input
    id="fieldId"
    placeholder="Enter value"
    value={value}
    onChange={...}
    error={errors.fieldName}
  />
</div>
```

Multiple form fields are grouped in `<div className="space-y-5">`.

---

## 5. Button Component — Always Use It

Never write raw `<button>` tags in feature components (only in `common/` internals). Always use `<Button>` from `common/Button`. If `common/Button` doesn't exist yet in this project, create it first (to the contract in §4, with `variant` and `isLoading` support), then use it everywhere.

```tsx
import Button from '@/components/common/Button';

// Primary action
<Button onClick={handleSubmit} isLoading={isLoading} className="w-full">
  Save
</Button>

// Destructive action
<Button variant="secondary" onClick={handleDelete}>
  Delete
</Button>

// Disabled state (use variant, not the disabled attribute alone)
<Button variant="disabled" disabled>
  Unavailable
</Button>
```

---

## 6. TypeScript — Always Type Everything

- All component props are defined as `interface`, not `type` (unless union/intersection is needed)
- API response shapes are always typed with an `interface` defined in the same file
- Extend native HTML element attributes when wrapping form fields: `React.InputHTMLAttributes<HTMLInputElement>`, `React.ButtonHTMLAttributes<HTMLButtonElement>`, etc.
- Never use `any` — use `unknown` or a specific interface

---

## 7. General Patterns

- **`'use client'`** at the top of any component that uses `useState`, `useEffect`, event handlers, or browser APIs
- **Server Components** (no directive) for data-fetching pages; they call `apiRequest` from `@/utils/api-request`
- **Client Components** for interactive UI; they call `apiCall` from `@/utils/api-call`
- **Icons** always come from `lucide-react` — not emoji, not custom SVG, not other icon libraries
- **Loading states** always use `<Loader />` from `common/Loader` — never custom spinners (create `common/Loader` if it doesn't exist yet)
- **Path alias** — always use `@/` not relative imports that climb more than one directory
