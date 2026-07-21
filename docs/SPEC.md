# PipeScope - Architecture Spec

PipeScope is a showcase Angular v22 dashboard for exploring simulated in-line pipeline inspection runs.
It is written to be read as a code sample by senior engineers.
Quality bar: every file must look intentional, idiomatic, and modern.
Feature count is secondary to code quality, architecture clarity, and accessibility.

## Non-negotiable conventions

- Angular v22, standalone only, zoneless (default in v22; no zone.js anywhere).
- 2025 file naming style: `runs-overview.ts`, `runs-overview.html`, `runs-overview.scss`, `runs-overview.spec.ts`. No `.component`/`.service` suffixes in file names. Class names have no `Component` suffix either (matches scaffold: root class is `App`).
- Every component: `changeDetection: ChangeDetectionStrategy.OnPush`, `templateUrl` + `styleUrl` (inline only for tiny components), selector prefix `app-`.
- Dependency injection via `inject()`, never constructor parameters.
- Signals for all state: `signal`, `computed`, `linkedSignal` where a writable signal must reset on source change, `effect` only for real side effects (DOM, storage, canvas), never to sync state.
- Signal-based APIs only: `input()` / `input.required()`, `output()`, `model()`, `viewChild()` / `viewChildren()`, `host: {}` object instead of `@HostBinding`/`@HostListener` decorators.
- New control flow only: `@if` / `@for` (with `track`) / `@switch` / `@defer` / `@let`. Never `*ngIf`/`*ngFor`.
- RxJS only for the telemetry stream; bridge to signals with `toSignal` from `@angular/core/rxjs-interop`.
- Typed reactive forms via `NonNullableFormBuilder`. No template-driven forms.
- TypeScript: strict, no `any`, no non-null assertions unless provably safe, prefer union types and `readonly`.
- No comments unless they capture a non-obvious constraint the code cannot express.
- SCSS with design tokens (CSS custom properties). No component library, no CSS framework.
- All D3 imports from scoped submodules (`d3-scale`, `d3-shape`, `d3-array`, `d3-interpolate`), never the `d3` meta package. D3 is used for math/scales/shapes only; Angular owns the DOM (bind positions in templates), except the canvas which is drawn imperatively.
- Accessibility is a hard requirement, specified per feature below.

## File layout

```
src/app/
  app.ts / app.html / app.scss        shell: header, nav, theme switch, <router-outlet>
  app.config.ts                       providers
  app.routes.ts                       lazy routes
  core/
    models.ts                         all domain types
    random.ts                         seeded PRNG utilities
    inspection-data.ts                deterministic generators (pure functions)
    telemetry.ts                      TelemetryService (RxJS stream)
    inspection-store.ts               InspectionStore (NgRx SignalStore)
    theme.ts                          ThemeService
  shared/ui/
    badge/                            severity badge
    button/                           app button
    card/                             stat/content card
    icon/                             inline SVG icon registry component
    theme-switch/                     binary theme toggle (light/dark)
    data-table/                       accessible sortable table
    visually-hidden helpers live in styles (mixin), not a component
  features/
    runs-overview/                    route: /runs
    run-detail/                       route: /runs/:runId  (+ pipeline-map/, anomaly-panel/, heatmap/)
    live-monitor/                     route: /live         (+ waveform-canvas/, telemetry-stat/)
    design-system/                    route: /design-system
```

Routes: `''` redirects to `/runs`; every feature route uses `loadComponent`; titles via route `title`.
404 falls back to redirect to `/runs`.

## Theming

- Design tokens as CSS custom properties in `src/styles.scss`: color scale (bg, surface, surface-raised, border, text, text-muted, accent, accent-contrast, severity colors low/medium/high/critical, chart colors), spacing scale, radius, type scale, focus ring.
- `:root` defines light values; `:root[data-theme='dark']` overrides.
  An inline script in `index.html` runs before app styles load, reads `localStorage['pipescope-theme']` (`'light' | 'dark'`), and stamps `data-theme` with the stored value or the resolved operating system preference so there is zero flash.
- `ThemeService`: the resolved theme follows `prefers-color-scheme` until `toggle()` stores an explicit value; toggling back to the current operating system value clears the override and resumes system tracking.
- WCAG AA contrast for all token pairs in both themes (verify: text vs bg >= 4.5:1, large text / UI graphics >= 3:1).
- `@media (forced-colors: active)`: rely on system colors, keep focus outlines, add explicit borders where surfaces would vanish; charts get `forced-color-adjust: none` only where data colors are essential, with sufficient fallback.
- `@media (prefers-reduced-motion: reduce)`: kill transitions; the live monitor must not auto-animate (see feature spec).

## Domain model (`core/models.ts`)

```ts
type AnomalyType = 'metal-loss' | 'crack' | 'dent' | 'weld-anomaly' | 'corrosion';
type Severity = 'low' | 'medium' | 'high' | 'critical';
type RunStatus = 'completed' | 'processing';

interface PipelineSegment { id: string; name: string; lengthKm: number; diameterInch: number; }

interface InspectionRun {
  id: string;                 // 'run-<seed>-<n>' stable
  segment: PipelineSegment;
  startedAt: string;          // ISO date
  distanceKm: number;         // covered distance <= segment length
  durationMin: number;
  status: RunStatus;
  anomalyCount: number;
  avgVelocityMps: number;
  maxPressureBar: number;
}

interface Anomaly {
  id: string;
  runId: string;
  distanceM: number;          // position along the run
  type: AnomalyType;
  severity: Severity;
  confidence: number;         // 0..1, presented as "AI model confidence"
  depthPct: number;           // wall loss depth percent
  lengthMm: number;
  widthMm: number;
  clockPosition: number;      // 1..12, circumferential position
}

interface TelemetryFrame {
  timestampMs: number;        // relative to stream start
  velocityMps: number;
  pressureBar: number;
  temperatureC: number;
  ultrasound: Float32Array;   // 128 samples, -1..1 waveform
}
```

## Deterministic data (`core/random.ts`, `core/inspection-data.ts`)

- PRNG: mulberry32. `createRng(seed: number): () => number` plus helpers `pick`, `range`, `int`, `gaussian` built on it. Pure, no `Math.random()` anywhere in the app.
- `generateRuns(seed: number, count: number): InspectionRun[]` - dates descending over the past ~18 months, 6 fixed named segments (real-sounding: 'Elbe Crossing North', 'Bergen Feeder Line', ...), plausible physics (velocity 0.8-2.5 m/s, pressure 40-95 bar).
- `generateAnomalies(runId: string, seed derived from runId): Anomaly[]` - count matches `run.anomalyCount`, positions spread over run distance, severity correlated with depth, confidence 0.62-0.99.
- `generateHeatmap(anomalyId: string, rows = 24, cols = 32): Float32Array` - row-major amplitude grid 0..1 with a gaussian hot spot (position/spread derived from the anomaly seed) over structured noise; rendered by the `heatmap` component to a small canvas with a perceptual color ramp (`d3-interpolate` / viridis-like custom ramp that fits the app palette).
- Same seed => identical output, always; unit tests assert snapshots of first items.
- Default app seed is a constant `PIPESCOPE_SEED = 20260720`.

## Store (`core/inspection-store.ts`)

NgRx SignalStore, the only shared store. Note: `@ngrx/signals` is at 21.x (installed with legacy peer deps until NgRx ships v22 support) - API is unchanged.

```ts
InspectionStore = signalStore(
  { providedIn: 'root' },
  withState({ runs: InspectionRun[], anomalies: Record<runId, Anomaly[]>, selectedRunId: string | null, selectedAnomalyId: string | null }),
  withComputed(... selectedRun, selectedRunAnomalies, selectedAnomaly, totals for the overview header ...),
  withMethods(... selectRun(runId) (lazily generates + caches anomalies), selectAnomaly(id | null) ...),
  withHooks({ onInit: seeds runs from generateRuns(PIPESCOPE_SEED, 24) })
)
```

Filtering/sorting state for the overview is local component state (typed form + signals), not store state.
Route is the source of truth for selection: components call `selectRun`/`selectAnomaly` from route params (via `input()` route binding - enable `withComponentInputBinding()`).

## Telemetry stream (`core/telemetry.ts`)

- `TelemetryService.frames$: Observable<TelemetryFrame>` - `interval(25)` (40 Hz) mapped through a stateful but seeded simulation (random-walk velocity/pressure/temperature, composed sine + noise ultrasound buffer reusing one `Float32Array` per emission is NOT allowed to be shared-mutable - allocate per frame, 128 floats is cheap).
- Stream is cold per subscriber; the live monitor is its only consumer.
- Pause/resume is a `paused` signal in the component; implemented by unsubscribing/resubscribing via `switchMap` on `toObservable(paused)` or equivalent; elapsed time continues from where it left off (keep a monotonic frame counter in the service simulation state, reset per subscribe is fine but pause must not reset history already rendered).
- Component bridges with `toSignal(latestFrame$)` for the stat readouts; the canvas consumes a ring buffer fed by a direct subscription (RxJS -> imperative buffer -> rAF draw). This is the RxJS-to-signals showcase; write it cleanly.

## Feature specs

### Runs overview (`/runs`)

- Header with aggregate stat cards (total km inspected, total anomalies, critical count) from store computeds.
- Typed filter form (`NonNullableFormBuilder`): text search (segment name), severity minimum (select), date range presets (select: all / 12m / 6m / 90d). Form value bridged to a signal via `toSignal(form.valueChanges)`; `computed` derives visible runs.
- Sortable columns (date, segment, distance, anomaly count) via the shared `data-table` - sorting state is signals; `aria-sort` on the active header; buttons inside `<th>`.
- Row click / Enter navigates to the run detail route. Whole row is a link semantically (the run id cell contains the `<a>`, row click delegates to it).
- Empty state when filters match nothing, with a clear-filters button.
- `@defer` the stat-cards block (`on idle`) as a tasteful demonstration, not everywhere.

### Run detail (`/runs/:runId`)

- Route param bound via component `input()`; effect-free: `runId = input.required<string>()`, store selection driven in a `computed`-friendly way (call `selectRun` in a lifecycle-safe spot; simplest: `constructor` `effect(() => store.selectRun(this.runId()))` - acceptable effect use).
- Header: segment name, run metadata chips, back link.
- Pipeline map (`pipeline-map/`): responsive SVG, horizontal distance axis (d3-scale linear, ticks in km), pipeline drawn as a rounded rect "tube" with weld tick marks, anomaly markers positioned by scale, marker glyph varies by type, color by severity (plus shape/label so color is not the only channel).
  - Keyboard: the marker group implements roving tabindex. Arrow Left/Right move between markers sorted by distance, Home/End jump to first/last, Enter/Space selects. Focused marker shows a visible focus ring (SVG outline) and a tooltip-like label.
  - Each marker: `role="button"`, `aria-label` like "Metal loss, high severity, at 3,240 m, 87 % confidence", `aria-pressed` for selected state.
  - The SVG has `role="group"` with `aria-label`; a visually-hidden summary paragraph precedes it; a "View as table" disclosure renders the same anomalies through the shared `data-table` (this is the text alternative).
- Selecting a marker (or table row) opens the anomaly panel (`anomaly-panel/`): type, severity badge, confidence rendered as a labelled meter (`<meter>` or ARIA meter pattern), dimensions, clock position, and the ultrasound thumbnail (`heatmap/` canvas, ~256x192 CSS px, `role="img"` with a descriptive `aria-label` including peak amplitude cell).
- Marker selection syncs to `selectedAnomalyId` in the store; deep-linkable via query param `?anomaly=` (router as source of truth).

### Live monitor (`/live`)

- Stat row: velocity, pressure, temperature as `telemetry-stat` cards fed by `toSignal(frames$)`, values formatted with units, small trend arrow.
- Waveform canvas (`waveform-canvas/`): renders the current ultrasound amplitude trace oscilloscope-style with a persistence trail of recent frames, at a measured 60 fps.
  - `requestAnimationFrame` loop decoupled from the 40 Hz stream; ring buffer of frames; no allocations inside the draw loop; `devicePixelRatio`-aware sizing via `ResizeObserver`; draw with `CanvasRenderingContext2D` paths only.
  - The rAF loop runs outside Angular's reactivity on purpose; document this in a short comment only if needed per comment policy (constraint: zoneless means rAF does not trigger CD - that IS non-obvious, one comment allowed).
  - Pause/Resume button (single toggle button, `aria-pressed`, label switches); pausing freezes the canvas and unsubscribes the stream.
  - `prefers-reduced-motion: reduce` => stream starts paused with an explanatory note; user can still explicitly press Play.
  - Page visibility: pause drawing when the tab is hidden.
  - Canvas fallback: `aria-hidden` canvas wrapped in a `role="img"` container with live text alternative - a visually-hidden `aria-live="polite"` summary throttled to every ~2 s ("velocity 1.4 m/s, pressure 62 bar"), plus a "Latest readings" table (last 10 downsampled frames) behind a disclosure.
- A small "stream health" line: frames received, effective fps (measured, displayed; this doubles as the 60 fps verification hook - expose measured draw fps).

### Design system (`/design-system`)

- One page documenting: color tokens (swatches with computed contrast ratios shown), type scale, spacing, and live examples of badge, button, card, icon, theme-switch, data-table, heatmap, and the severity legend.
- Each example: rendered component + short usage note. No prop-table generator; keep it hand-written and honest.
- This page is also the visual regression surface for the shared UI.

## Shell / navigation

- Header: app name (link to /runs), nav links (`routerLinkActive`, `aria-current="page"` via routerLinkActive attribute behavior - set `ariaCurrentWhenActive`), theme switch.
- Skip link as first focusable element targeting `<main id="main" tabindex="-1">`.
- Focus management on route change: move focus to `main` (router event effect in shell), so keyboard/SR users land at content.
- `<html lang="en">`; every page sets a route `title` (strategy: default TitleStrategy with template `X · PipeScope`? Use a small custom TitleStrategy: `${routeTitle} · PipeScope`).
- Responsive: nav collapses gracefully (no JS hamburger needed if links fit; if not, wrap-friendly layout - prefer CSS over JS).

## Testing

- Unit (Vitest via `ng test`): `inspection-data.spec.ts` (determinism: same seed identical, different seed different, physics invariants, anomaly count matches run), `inspection-store.spec.ts` (init, selection, lazy anomaly caching, computeds), one component spec with `TestBed` - `runs-overview.spec.ts` (renders rows, filter narrows, sort toggles `aria-sort`) using zoneless TestBed defaults.
- E2E (Playwright, `e2e/` dir, `playwright.config.ts` with `webServer: ng serve`, chromium project only in CI): flow 1 overview -> filter -> sort -> open run; flow 2 detail map -> keyboard through markers -> select -> panel + query param; flow 3 live monitor -> stream running (fps counter > 0, canvas changes) -> pause -> resume; plus theme switch persists across reload and no-flash sanity.
- `npm run e2e` script; keep tests independent and parallel-safe.

## CI (GitHub Actions `.github/workflows/ci.yml`)

- Trigger: push to main + PRs.
- Node 24 (from `.nvmrc`), npm cache, `npm ci`, `npm run lint`, `npm test -- --run` (headless), `npm run build`, install Playwright chromium with cache, run E2E against the production build served statically (`npx playwright test`), upload Playwright report artifact on failure.

## Azure Static Web Apps

- `staticwebapp.config.json` at repo root: `navigationFallback` to `/index.html` excluding `/assets/*`, `*.js`, `*.css`, mime types default; add basic security headers (CSP kept permissive enough for the app, `X-Content-Type-Options`, `Referrer-Policy`).
- README section: create SWA resource, `app_location: /`, `output_location: dist/pipe-scope/browser`, CI via SWA GitHub Action or `swa deploy`.

## README

Sells the project in 30 seconds: what it is (screenshot placeholders at top), why-architecture section (signals + zoneless change detection story, canvas vs SVG decision, deterministic data), quickstart (run/test/e2e/lint), a11y notes, deployment (Azure SWA), honest note on @ngrx/signals peer-dep situation.

## Budgets / performance

- `ng build` must produce zero budget warnings; keep initial bundle lean (lazy routes, D3 submodules only, no moment-style deps).
- No unnecessary re-renders: OnPush + signals everywhere; the only rAF loop is the canvas; document in README.
