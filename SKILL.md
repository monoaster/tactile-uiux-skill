---
name: tactile-ui
version: 1.1.0
description: >-
  Build graphic, physically responsive UI controls on the web: splines and curve editors with draggable nodes,
  dials and knobs, sliders and scrubbers, liquid segmented switchers, glass cards with tilt, and other
  direct-manipulation components drawn in Canvas/SVG with spring physics. Use when the component is continuously
  manipulated (drag, scrub, flick) and its motion, light and materiality are the point.
  Not for plain forms, tables, static layouts, marketing pages, or anything with no direct manipulation.
  Mobile (SwiftUI, React Native, Flutter) gets the same design language but no reference implementation yet.
---

# Tactile UI Design & Engineering Guideline

A token-driven guideline for **graphic, physically responsive** controls. The reference implementation is web
(Vanilla JS, drops into React). For mobile see section 6.

**Start from [`examples/spline-eq.html`](./examples/spline-eq.html)**: a finished component (spline with two draggable nodes,
liquid preset capsule, telemetry footer, keyboard support, light and dark) that passes `scripts/check.mjs`.
Copy its structure; change the domain, not the engineering.

## 1. Customizability Architecture (Tokens + Physics + Slots)

Never hardcode colors, radii, or physics constants inside components. Expose three customization layers:

1. **Theme & Surface Tokens** (CSS custom properties). Full dark and light sets are in `references/primitives.md` §1.
   - `--tu-canvas` (outer backdrop) · `--tu-well` (recessed stage / track bed) · `--tu-surface` (card gradient)
   - `--tu-border` · `--tu-rim` · `--tu-grid` (minor lines) · `--tu-grid-major` (zero / center line)
   - `--tu-text` · `--tu-muted` (must be >= 4.5:1 on `--tu-well`, in both themes)
   - `--tu-accent` (primary glow/stroke) · `--tu-accent-2` (secondary gradient stop) · `--tu-bead` · `--tu-focus`
   - `--tu-glass-hi` · `--tu-glass-lo` · `--tu-sheen` · `--tu-radius-card` `20px` · `--tu-radius-stage` `13px` · `--tu-radius-pill` `999px`
   - Canvas code reads tokens with `getComputedStyle` so a theme override needs no JS change.
2. **Motion & Physics Config** (one config object at the top of the script):
   - `spring`: `{ stiffness, damping, mass }`. `snappy {380, 28, 1}` (zeta ~0.72) follows a pointer; `lush {220, 18, 1}` (zeta ~0.61) for presets.
   - `response`: `{ stretchFactor, maxStretch, trailLength }`
   - **Units rule:** express every spring in units where one rest threshold means "under half a pixel"
     (normalized 0..1, dB, or px with its own threshold). See the unit table in `references/primitives.md` §3.
3. **Composable Slots**: separate the **header** (label + tag), **graphic stage** (Canvas/SVG layer), and
   **telemetry footer** (tabular readouts + status pill) with `data-slot` attributes so domain content plugs in.

## 2. Graphic Animation Language (Signature Style)

Avoid plain CSS box transitions. Express state changes through **graphic, light-reactive visuals**:

- **Volumetric & Grid Stages**: a `24px` coordinate grid (`--tu-grid`) behind multi-lobe radial glows that track each active value or pointer.
- **Luminous Splines & Ghost Trails**: curves with a multi-stop gradient (`--tu-accent` → `--tu-accent-2`), a soft area fill, and a bright leading bead.
  - **Trail rule:** up to 6 ghost dots, **sampled by distance** (>= 2.5 px apart, not per frame) and **expired by time** (~350 ms).
    Distance sampling keeps slow drags visible; time expiry lets the loop sleep. Ghost alpha falls with rank and age.
- **Precision Tick Rings & Vector Fields**: radial micro-ticks (major every 4th) or oriented needles that lengthen and rotate toward the active value.
- **3D Glass & Specular Sheen**: semi-transparent surfaces with `inset 0 1px 0 var(--tu-rim)` and a diagonal sheen that sweeps with tilt or velocity.
- **Liquid Capsules**: stretch the active pill by `Math.abs(velocity) * stretchFactor` (capped by `maxStretch`), extending the leading edge.

## 3. Graph & Stage Conventions

Decisions that every curve or plot component has to make, settled once:

- **Grid anchored on the center line.** Stage height is `grid * (2 * halfRows + 1)`; the 0 / midpoint line is a grid line, drawn brighter with `--tu-grid-major`.
  One row equals a round value step (for example 3 dB). Choose `halfRows` from width (for example 5 under 560 px, 6 above).
- **Scale labels are required** on any stage that shows values: at least 3 labels per axis, 11 px, `--tu-muted`, tabular figures,
  drawn before the curve. Telemetry duplicates the exact numbers; labels give the stage its scale at a glance.
- **Bead on the line.** A node's bead is drawn at `curve(x)` and dragging solves for the parameter that puts the curve under the pointer.
  Never draw a handle off its own curve. Use soft range limits so summed terms stay inside the stage.
- **Active emphasis.** Active node glow 0.8, dragged 1.0, inactive 0.3. The glow follows the bead through a spring, not instantly.
- **Preset switchers** are a `radiogroup`. Selecting one moves the nodes with the `lush` spring; touching a node afterwards
  sets the pill to "Custom" and dims the capsule instead of pretending a preset is still active.

## 4. Engineering, Performance & Accessibility Discipline

- **1:1 Aspect Ratio Invariant**: measure the laid-out container width with `ResizeObserver`, derive height from it, size the backing store by
  `devicePixelRatio`. Observe the container, not the canvas.
- **Sleep-When-Settled Loops**: stop `requestAnimationFrame` when every spring is within its rest threshold **and** trails/glows have
  expired; wake on pointer, key, focus and state changes; pause offscreen canvases with `IntersectionObserver`.
- **Touch & Drag Hygiene**: `touch-action: none` and `user-select: none` on the stage and on every draggable node; `setPointerCapture` on `pointerdown`;
  handle one pointer at a time; end on `pointerup`, `pointercancel` and `lostpointercapture`.
- **Keyboard**: each node is `role="slider"` with `tabindex="0"`, an accessible name, `aria-valuemin/max/now` and `aria-valuetext`.
  Arrow = 1 step, Shift+Arrow = 4 steps. Visible focus ring using `--tu-focus` on both themes.
- **Contrast & Semantics**: labels and readouts >= 4.5:1 (large text >= 3:1); live numbers use `tabular-nums` (or a monospace face);
  no overlapping labels at 375 px.
- **Reduced motion**: springs snap to target, ghost trails are off, sheen is static. The component must remain fully usable.
- **Theme**: ship dark and light from the same tokens; test both.

## 5. Zero AI Slop Rules (Strict Guardrails)

- **One focal graphic per component.** No decorative icon badges, fake KPIs (`+42%`, `99.9%`), or filler subtitles or hint text on a control.
- **Restrained color.** One primary accent and one optional gradient stop per component. No rainbow neon borders or random multi-color shadows.
- **No generic CSS boilerplate.** Never `transition: all`, never `hover:scale-105`; drive motion from pointer and spring state.
- **No stretched canvases.** Never a hardcoded `<canvas width="300">` scaled by CSS.
- **No idle battery drain.** `requestAnimationFrame` must be asleep when settled or offscreen.
- **Mandatory verification.** Run the checker, then look at it:
  ```bash
  node scripts/check.mjs <url-or-file.html> --out shots/      # add --scheme light to test the light theme
  ```
  It checks, at 1200 px and 375 px: horizontal overflow, canvas 1:1, `touch-action`/`user-select` on drag surfaces, slider semantics,
  token presence, token contrast pairs (dark and light), DOM text contrast, tabular readouts, overlapping labels, forbidden CSS patterns,
  and that `requestAnimationFrame` goes idle after load and after a drag. It writes screenshots for you to inspect.
  **Still manual:** a real touch drag on a phone, reduced motion, and judging whether it looks right.

## 6. Platform Scope

| Concept | Web (reference) | SwiftUI | React Native |
| --- | --- | --- | --- |
| Spring | `Spring` class, `snappy` / `lush` | `.spring(response:dampingFraction:)` / `interpolatingSpring` | Reanimated `withSpring({ stiffness, damping, mass })` |
| Graphic layer | Canvas 2D / SVG | `Canvas` + `TimelineView` | `@shopify/react-native-skia` |
| 1:1 geometry | `ResizeObserver` | `GeometryReader` | `onLayout` |
| Sleep when settled | stop `rAF` | pause `TimelineView(.animation(paused:))` | stop `useFrameCallback` |
| Pointer capture | `setPointerCapture` | `DragGesture(minimumDistance: 0)` | `Gesture.Pan()` |
| Haptics | `navigator.vibrate` | `UIImpactFeedbackGenerator` | `Haptics.selectionAsync()` |

The web path is complete (reference component + checker). Mobile follows the same tokens, units rule, trail rule and slop rules,
but has **no reference implementation or automated check yet**; treat the table as a mapping, not a recipe.

## 7. Workflow for Designing Any New Component

1. **Choose the metaphor** (rotary tick dial, spline with ghost trail, vector field, liquid capsule, 3D glass sheet).
2. **Define the API** (theme tokens + physics config + slots).
3. **Wire input to graphic response** (`touch-action: none` + `setPointerCapture` → spring state → Canvas/SVG draw, sleeping when settled).
4. **Verify**: run `scripts/check.mjs`, view both widths and both themes, then test touch, keyboard and reduced motion by hand.

References: [`references/primitives.md`](./references/primitives.md) (tokens, springs, loop, stage, trail, gestures) ·
[`examples/spline-eq.html`](./examples/spline-eq.html) (complete component) · [`CHANGELOG.md`](./CHANGELOG.md).
