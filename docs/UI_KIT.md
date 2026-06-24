# Sarathi UI Kit

Production-grade, accessible, reusable React primitives for the Sarathi web app.
Built for a real app used by many people: every component handles loading, empty,
error and edge states, is keyboard- and screen-reader-accessible, responsive, and
themed entirely from CSS tokens.

## Architecture

```
web/src/
├── theme.css                 # design tokens (colors, type, radii) + a11y CSS
│                             #   (focus-visible rings, .sr-only, kit-spin, btn sizes)
├── components/
│   ├── kit.jsx               # ← the kit: stateless, reusable primitives
│   │     Spinner, VisuallyHidden, Button, Card, Skeleton, SkeletonCard,
│   │     EmptyState, ErrorState, DataState, Field, Badge, Stat
│   ├── ui.jsx                # app-specific composites (Dock, Sheet, Toast,
│   │                         #   Ring, PageHeader, CountUp) + motion variants
│   └── Icons.jsx             # SVG icon set
└── lib/motion.js             # useReveal / useRevealAll / useInView / useCountUp
```

**Layering**
1. **Tokens** (`theme.css`) — the only place colors/type/spacing live. Re-theme the
   whole app by editing `:root`.
2. **Kit** (`kit.jsx`) — generic, presentational, app-agnostic. No data fetching.
3. **Composites** (`ui.jsx`) — Sarathi-specific assemblies (nav, sheets, toasts).
4. **Screens** — compose kit + composites; own the data + state, delegate
   rendering of the four states to `<DataState>`.

**Principles**
- Tokens over hardcoded values. Components never hardcode hex — always `var(--…)`.
- Composition over configuration: `Field` takes a `render` prop for any control;
  `Card` accepts `as`/`interactive`; `Button` accepts `as`/`href`.
- Accessible by default; you opt out, never in.
- Reduced-motion respected globally (`theme.css`) and per-component (Spinner).

## Props / API

### `<Button>`
| prop | type | default | notes |
|---|---|---|---|
| `variant` | `primary \| ghost \| danger` | `primary` | maps to `.btn` classes |
| `size` | `sm \| md \| lg` | `md` | |
| `loading` | `bool` | `false` | shows spinner, sets `aria-busy`, blocks clicks |
| `disabled` | `bool` | `false` | |
| `full` | `bool` | `false` | full-width |
| `iconLeft` / `iconRight` | `node` | — | hidden while loading |
| `as` / `href` | — | — | renders `<a>` when `href` set |

### `<Card>`
`as` (default `div`), `interactive` (keyboard-operable: role=button, Enter/Space,
focus ring), `onClick`, `accent` (left border color), `padding`, `style`.

### `<DataState>` — the async state machine
| prop | type | notes |
|---|---|---|
| `loading` | `bool` | renders `skeleton` (default `<SkeletonCard>`) |
| `error` | `bool \| string` | renders `errorState` (default `<ErrorState>`) |
| `empty` | `bool` | renders `emptyState` (default `<EmptyState>`) |
| `onRetry` | `fn` | passed to the default ErrorState |
| `skeleton` / `emptyState` / `errorState` | `node` | custom overrides |
| `children` | `node` | the success view |

Renders exactly one branch inside an `aria-live="polite"` region so assistive tech
announces state changes.

### `<Field>`
`label`, `hint`, `error`, `required`, `htmlFor`. Wires `label↔control` by id and
sets `aria-describedby` (hint/error) + `aria-invalid`. Pass the control via
children, or `render={(a11yProps) => <input {...a11yProps} />}` to receive the
generated id/aria props.

### Others
- `<Skeleton width height radius lines>` / `<SkeletonCard>` — shimmer placeholders (`aria-hidden`).
- `<EmptyState icon title message action>` — dashed card for "no data yet".
- `<ErrorState title message onRetry>` — `role="alert"`, retry button.
- `<Spinner size label>` — `role="status"`; reduced-motion safe.
- `<Badge tone>` — `neutral|accent|cyan|good|warn|danger`.
- `<Stat label value unit trend loading>` — eyebrow + big numeral (+ skeleton).
- `<VisuallyHidden>` — `.sr-only` text for screen readers.

## Usage examples

```jsx
import { DataState, Skeleton, EmptyState, Button, Field, Stat } from '../components/kit.jsx';

// 1. Async section — one component handles loading / error / empty / success
<DataState
  loading={data === undefined}
  error={data?.error}
  empty={data?.items?.length === 0}
  onRetry={reload}
  skeleton={<Skeleton height={120} radius={16} />}
  emptyState={<EmptyState title="No workouts yet"
    message="Log a set or import your history to see trends."
    action={<Button size="sm" onClick={goImport}>Import history</Button>} />}
>
  <Trends items={data.items} />
</DataState>

// 2. Button with loading + icon (blocks double-submit, announces busy)
<Button loading={saving} onClick={save} iconLeft={<IconCheck />}>Save</Button>

// 3. Accessible field with validation
<Field label="Email" required error={touched && !valid ? 'Enter a valid email' : null}
  render={(p) => <input type="email" value={email} onChange={onChange} {...p} />} />

// 4. Stat with count-up + loading
<Stat label="Readiness" value={useCountUp(84, seen)} trend="▲" loading={!ready} />
```

## Best practices

- **Always wrap async UI in `<DataState>`** — never scatter `loading && …` /
  `error && …` ternaries in screens. One pattern, every screen, no missed state.
- **Never render an empty list as nothing** — pass `empty` + an `<EmptyState>`
  with a next action. Empty is a designed state, not a blank.
- **Be honest in empty/error copy** — say what to do next; never fake data.
- **Buttons that do async work take `loading`** — it blocks double-submits and
  announces busy to screen readers.
- **Inputs go through `<Field>`** so label/aria wiring can't be forgotten.
- **Color comes from tokens** — extend `theme.css`, don't hardcode hex in JSX.
- **Respect reduced motion** — it's handled globally; don't re-introduce
  unconditional animation.
- **Keyboard test every interactive thing** — Tab to it, Enter/Space activates,
  a visible focus ring appears (`:focus-visible`).
- **Responsive by composition** — use flex/grid with `minmax`/`flex-wrap`; the
  kit sets no fixed widths that would break small screens.
