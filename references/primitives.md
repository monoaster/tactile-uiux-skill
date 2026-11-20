# Customizable Tactile UI & Graphic Primitives

Drop-in tokens, spring loops, and Canvas 2D helpers. A complete component built from these lives in
[`examples/spline-eq.html`](../examples/spline-eq.html); copy it before inventing structure.

## 1. CSS Theme Tokens (Override per App or Component)

Dark is the default. Light is a token swap only; no component code changes.

```css
:root {
  color-scheme: dark;
  --tu-canvas: #050608;
  --tu-well: #080a0f;
  --tu-surface: linear-gradient(165deg, rgba(22, 25, 34, 0.96) 0%, rgba(11, 13, 18, 0.98) 100%);
  --tu-border: rgba(255, 255, 255, 0.085);
  --tu-rim: rgba(255, 255, 255, 0.09);
  --tu-grid: rgba(255, 255, 255, 0.045);        /* minor grid lines */
  --tu-grid-major: rgba(255, 255, 255, 0.13);   /* zero / center line */
  --tu-text: #f2f4f8;
  --tu-muted: #8b93a6;                          /* >= 4.5:1 on --tu-well */
  --tu-accent: #38bdf8;
  --tu-accent-2: #a855f7;
  --tu-bead: #ffffff;                           /* bead core */
  --tu-glass-hi: rgba(255, 255, 255, 0.17);
  --tu-glass-lo: rgba(255, 255, 255, 0.05);
  --tu-sheen: rgba(255, 255, 255, 0.26);
  --tu-focus: var(--tu-accent);
  --tu-radius-card: 20px;
  --tu-radius-stage: 13px;
  --tu-radius-pill: 999px;
}

@media (prefers-color-scheme: light) {
  :root:not([data-theme="dark"]) { /* also apply the same block under :root[data-theme="light"] */
    color-scheme: light;
    --tu-canvas: #e9ecf2;
    --tu-well: #f6f7fa;
    --tu-surface: linear-gradient(165deg, rgba(255, 255, 255, 0.98) 0%, rgba(243, 245, 249, 0.98) 100%);
    --tu-border: rgba(10, 14, 25, 0.1);
    --tu-rim: rgba(255, 255, 255, 0.9);
    --tu-grid: rgba(10, 14, 25, 0.06);
    --tu-grid-major: rgba(10, 14, 25, 0.2);
    --tu-text: #131722;
    --tu-muted: #596176;
    --tu-accent: #0284c7;
    --tu-accent-2: #9333ea;
    --tu-bead: #ffffff;
    --tu-glass-hi: rgba(255, 255, 255, 0.95);
    --tu-glass-lo: rgba(255, 255, 255, 0.5);
    --tu-sheen: rgba(255, 255, 255, 0.8);
  }
}

.tu-stage { touch-action: none; user-select: none; -webkit-user-select: none; }

/* Focus ring for a draggable node whose visual is drawn on canvas */
.tu-node:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--tu-well), 0 0 0 4px var(--tu-focus); }
```

## 2. 1:1 Responsive Canvas Binding

Observe the **container**, not the canvas, so setting the canvas height cannot retrigger the observer.
Height is derived from width (and snapped to the grid), then the backing store is sized from both.

```js
export function bindResponsiveCanvas(container, canvas, heightFor, onResize) {
  let W = 0, H = 0;
  const resize = () => {
    const w = container.getBoundingClientRect().width;
    if (!w) return;
    const h = heightFor(w);                          // e.g. grid * (2 * halfRows + 1)
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    if (w === W && h === H) return;
    W = w; H = h;
    container.style.height = `${h}px`;
    canvas.style.width = `${w}px`;  canvas.style.height = `${h}px`;
    canvas.width = Math.round(w * dpr);  canvas.height = Math.round(h * dpr);
    onResize({ W, H, dpr });                         // caller does ctx.setTransform(dpr,0,0,dpr,0,0) then redraws
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  return () => ro.disconnect();
}
```

Never write `<canvas width="300">` and stretch it with CSS. The canvas CSS size and the backing size must stay in the same ratio.

## 3. Spring + Sleep-When-Settled Loop

### Spring (one number)

```js
export const SPRING = {
  snappy: { stiffness: 380, damping: 28, mass: 1 },  // zeta ~ 0.72, tracks a dragging pointer
  lush:   { stiffness: 220, damping: 18, mass: 1 },  // zeta ~ 0.61, preset moves, small overshoot
};
// zeta = damping / (2 * sqrt(stiffness * mass)). zeta < 1 overshoots; keep UI springs between 0.55 and 0.85.

export class Spring {
  // rest = how close counts as settled, in the SAME UNITS as the value (see table below)
  constructor(x, cfg = SPRING.lush, rest = { pos: 0.001, vel: 0.001 }) {
    this.x = x; this.v = 0; this.t = x; this.cfg = cfg; this.rest = rest;
  }
  set(t, cfg) { if (cfg) this.cfg = cfg; this.t = t; if (REDUCED) { this.x = t; this.v = 0; } }
  step(dt) {                       // returns true while still moving. dt must be <= 1/60
    const { stiffness: k, damping: c, mass: m } = this.cfg;
    this.v += ((k * (this.t - this.x) - c * this.v) / m) * dt;   // semi-implicit Euler: update v, then x
    this.x += this.v * dt;
    if (Math.abs(this.t - this.x) > this.rest.pos || Math.abs(this.v) > this.rest.vel) return true;
    this.x = this.t; this.v = 0; return false;
  }
}
export const REDUCED = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
```

**Pick units so one rest threshold means "under half a pixel":**

| Value | Unit | `rest.pos` | `rest.vel` |
| --- | --- | --- | --- |
| Position along a track or stage | normalized 0..1 | `0.001` | `0.01` |
| Gain / level in dB | dB | `0.005` | `0.02` |
| Pixel offset (capsule x/width) | CSS px | `0.05` | `0.5` |
| Opacity / intensity | 0..1 | `0.002` | `0.01` |

A bare `0.001` on a pixel value waits for a 0.001 px settle and keeps the loop awake far longer than needed.

### Loop (many springs, one `requestAnimationFrame`)

```js
export function createLoop({ step, render, target }) {
  let raf = 0, last = 0, visible = true;
  const tick = (now) => {
    let dt = Math.min(0.032, (now - last) / 1000 || 0.016);
    last = now;
    let awake = false;
    for (; dt > 0; dt -= 1 / 120) awake = step(Math.min(dt, 1 / 120)) || awake;   // substep for stability
    render(now);
    raf = awake ? requestAnimationFrame(tick) : 0;   // sleeps here
  };
  const wake = () => { if (!raf && visible) { last = performance.now(); raf = requestAnimationFrame(tick); } };
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) wake(); else if (raf) { cancelAnimationFrame(raf); raf = 0; }
  }).observe(target);
  return { wake, asleep: () => raf === 0 };
}
```

`step` must report awake while **anything** still animates: springs, ghost trails, glow intensity. Call `wake()` on every pointer, key, focus and state change.

**Reduced motion:** `REDUCED` makes `Spring.set` snap; also skip ghost trails and keep the capsule sheen static.

## 4. Graphic Stage Helpers (Canvas 2D)

### Grid anchored on the center line, plus scale labels

Anchor the grid on the zero/center line so 0 dB (or the midpoint) always lands on a line, and make the stage height
`grid * (2 * halfRows + 1)`. One grid row is a fixed value step (for example 3 dB), so `y = center - value * (grid / valuePerRow)`.

```js
export function drawStage(ctx, W, H, { grid = 24, halfRows = 5, colors }) {
  const cy = H / 2;
  ctx.lineWidth = 1; ctx.strokeStyle = colors.grid; ctx.beginPath();
  for (let x = 0.5; x < W; x += grid) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let k = -halfRows; k <= halfRows; k++) if (k) { const y = Math.round(cy + k * grid) + 0.5; ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke();
  ctx.strokeStyle = colors.gridMajor; ctx.beginPath();
  ctx.moveTo(0, Math.round(cy) + 0.5); ctx.lineTo(W, Math.round(cy) + 0.5); ctx.stroke();
}

// Scale labels: 11px, --tu-muted, tabular figures, at least 3 per axis, drawn BEFORE the curve and beads.
export function drawScale(ctx, { yLabels, xLabels, colors, pad = 6 }) {
  ctx.font = '11px ui-monospace, "SF Mono", Menlo, monospace';
  ctx.fillStyle = colors.muted; ctx.textBaseline = "middle";
  ctx.textAlign = "left";   for (const [y, text] of yLabels) ctx.fillText(text, pad, y);
  ctx.textAlign = "center"; for (const [x, y, text] of xLabels) ctx.fillText(text, x, y);
}
```

Label colors come from `--tu-muted` (contrast is verified at the token pair, because canvas text is invisible to DOM checks).
Keep labels outside the area the curve normally occupies; if one collides with a bead, fade that label, do not move the bead.

### Luminous Bead + Velocity Ghost Trail

Sample ghosts by **distance**, not by frame, so slow drags still show spaced dots; expire them by **time** so the loop can sleep.

```js
export function createTrail({ length = 6, minDist = 2.5, ttl = 350 } = {}) {
  const pts = [];                                         // past positions, newest first
  let lx = null, ly = 0;                                  // last sampled position. Keep it OUT of pts: if the check reads
                                                          // pts[0], an expired (empty) trail re-pushes the head every frame
                                                          // and the loop never sleeps (scripts/check.mjs catches this).
  return {
    push(x, y, now) {
      if (lx === null) { lx = x; ly = y; return; }
      if (Math.hypot(x - lx, y - ly) >= minDist) { pts.unshift({ x: lx, y: ly, t: now }); lx = x; ly = y; if (pts.length > length) pts.length = length; }
    },
    prune(now) { while (pts.length && now - pts[pts.length - 1].t > ttl) pts.pop(); },
    get active() { return pts.length > 0; },              // keep the loop awake while true
    draw(ctx, now, [r, g, b], headX, headY, { headRadius = 5.5, core = "#fff" } = {}) {
      for (let i = pts.length - 1; i >= 0; i--) {
        const age = 1 - Math.min(1, (now - pts[i].t) / ttl);
        ctx.beginPath(); ctx.arc(pts[i].x, pts[i].y, Math.max(1.5, 3.5 - i * 0.4), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${Math.max(0.08, 0.6 - i * 0.08) * age})`; ctx.fill();
      }
      ctx.save(); ctx.shadowColor = `rgba(${r},${g},${b},.9)`; ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.arc(headX, headY, headRadius + 3, 0, Math.PI * 2); ctx.fillStyle = `rgba(${r},${g},${b},.45)`; ctx.fill(); ctx.restore();
      ctx.beginPath(); ctx.arc(headX, headY, headRadius, 0, Math.PI * 2); ctx.fillStyle = core; ctx.fill();
    },
  };
}
```

### Multi-lobe radial glow

```js
export function drawGlow(ctx, W, H, x, y, [r, g, b], intensity, lobes = [[150, 0.2], [64, 0.3]]) {
  for (const [radius, alpha] of lobes) {
    const gr = ctx.createRadialGradient(x, y, 2, x, y, radius);
    gr.addColorStop(0, `rgba(${r},${g},${b},${alpha * intensity})`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
  }
}
```

### Radial Precision Tick Ring
```js
export function drawTickRing(ctx, cx, cy, R, activeAngle, { count = 48, majorEvery = 4, activeColor = "#fbbf24", idleColor = "rgba(255,255,255,0.16)" } = {}) {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 - Math.PI / 2;
    const major = i % majorEvery === 0;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * (R + 6), cy + Math.sin(a) * (R + 6));
    ctx.lineTo(cx + Math.cos(a) * (R + (major ? 14 : 10)), cy + Math.sin(a) * (R + (major ? 14 : 10)));
    ctx.strokeStyle = a <= activeAngle ? activeColor : idleColor;
    ctx.lineWidth = major ? 2 : 1.2;
    ctx.stroke();
  }
}
```

## 5. Gesture, Keyboard, Tilt, Stretch & Haptics

### Draggable node (pointer capture, one pointer, keyboard)

```js
node.addEventListener("pointerdown", (e) => {
  if (drag) return;                                        // ignore a second finger
  e.preventDefault(); node.setPointerCapture(e.pointerId);
  drag = { id: e.pointerId, dx: e.clientX - rect().left - beadX, dy: e.clientY - rect().top - beadY };
  wake();
});
node.addEventListener("pointermove", (e) => { if (drag?.id === e.pointerId) moveTo(e); });
for (const t of ["pointerup", "pointercancel", "lostpointercapture"]) node.addEventListener(t, () => { drag = null; wake(); });

node.addEventListener("keydown", (e) => {                  // role="slider", tabindex="0"
  const big = e.shiftKey ? 4 : 1;                          // Arrow = 1 step, Shift+Arrow = 4 steps
  const move = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
  if (!move) return;
  e.preventDefault(); nudge(move[0] * big, move[1] * big);
});
```

- A 2-axis node still uses `role="slider"` with `aria-valuetext="6.00 kHz, -3.0 dB"`; keep `aria-valuenow` on the primary axis.
- A segmented capsule is a `radiogroup`: roving `tabindex`, Left/Right move **and** select, `aria-checked` on the buttons.
- Focus ring: see `.tu-node:focus-visible` in section 1. The ring must be visible on both themes.

### Node that sits on a drawn curve

The bead must lie exactly on the line you draw. Draw the bead at `curve(x)`, and when the user drags to a pointer `y`,
solve for the parameter that makes `curve(x) = y` (subtract the other terms' contribution at that `x`). Then dragging
never "slips" off the line, even when two bands overlap.

### Other primitives

- **Proximity falloff**: `const prox = Math.max(0, 1 - dist / radius); const boost = prox * prox;`
- **Liquid velocity stretch**: `const stretch = Math.min(maxStretch * width, Math.abs(spring.v) * stretchFactor);` extend the leading edge: `left = x - (v < 0 ? stretch : 0)`.
- **Specular sheen**: a diagonal gradient layer whose `translateX` follows `clamp(v / 900, -1, 1) * 40%`; static when reduced motion is on.
- **3D tilt + sheen**: `rotateX(${-ny * tiltMaxDeg}deg) rotateY(${nx * tiltMaxDeg}deg)` + sheen `translateX(${nx * 25}%)`.
- **Haptics**: `UIImpactFeedbackGenerator(.light)` (iOS), `Haptics.selectionAsync()` (Expo), `navigator.vibrate?.(6)` (Android Web) on detent crossings and preset selection.
