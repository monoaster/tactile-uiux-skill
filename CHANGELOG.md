# Changelog

Tokens, primitives and rules are versioned together. Components built against one version can be diffed against the next.

## 1.1.0

**Guidance gaps filled**
- Scale labels are now required on any stage that shows values (rule, drawing helper, example).
- Graph & stage conventions: grid anchored on the center line, stage height derived from grid rows, node "bead on the line" invariant, active-glow levels.
- Trail rule: ghost dots sampled by distance and expired by time, so slow drags stay visible and the loop can still sleep.
- Light theme: full token set. Added `--tu-grid-major`, `--tu-bead`, `--tu-glass-hi/lo`, `--tu-sheen`, `--tu-focus`.
- Focus-ring spec, keyboard step conventions (Arrow = 1, Shift = 4), radiogroup pattern, single-pointer drag guard.
- Reduced-motion behavior defined: springs snap, trails off, sheen static.

**Physics**
- `Spring` rewritten as a standard damped spring `(k*(t-x) - c*v) / m` with substeps, replacing the exponential-damping hybrid. Added the damping ratio guide.
- Rest thresholds are now per unit (normalized, dB, px, opacity) with a table; a bare `0.001` on a pixel value kept loops awake.
- `createLoop` helper with `IntersectionObserver` pause; loop must stay awake while trails and glows animate.
- `bindResponsiveCanvas` observes the container so setting the canvas height cannot retrigger the observer.

**Verification**
- New `scripts/check.mjs`: overflow, canvas 1:1, drag-surface CSS, slider semantics, tokens, contrast (tokens and DOM text), tabular readouts,
  overlapping labels, forbidden patterns, idle `requestAnimationFrame` after load and after a drag, touch and mouse drag, keyboard, focus ring,
  reduced motion, console errors, screenshots. Dark and light.

**Reference**
- New `examples/spline-eq.html`: a complete component that passes the checker.

**Scope & triggering**
- Description narrowed with "not for" cases. Mobile is documented honestly as a mapping table with no reference implementation yet.
- README and installer now ship `examples/` and `scripts/`.

## 1.0.0

Initial release: tokens, physics config, graphic animation language, zero-slop rules, primitives.
