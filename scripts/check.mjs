#!/usr/bin/env node
// tactile-ui checker: renders a component at desktop and mobile widths and enforces the skill's rules.
//   node scripts/check.mjs <url-or-html-file> [--out shots] [--scheme dark|light|both] [--chrome /path/to/chrome]
// Needs `puppeteer-core` (npm i -D puppeteer-core) and a local Chrome/Chromium (or CHROME_PATH).
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const target = argv.find((a, i) => !a.startsWith("--") && !(i > 0 && argv[i - 1].startsWith("--")));
if (!target || argv.includes("-h") || argv.includes("--help")) {
  console.log("Usage: node scripts/check.mjs <url-or-html-file> [--out dir] [--scheme dark|light|both] [--chrome path]");
  process.exit(target ? 0 : 1);
}
const outDir = flag("--out", null);
const schemes = (s => (s === "both" ? ["dark", "light"] : [s]))(flag("--scheme", "both"));
const url = /^https?:|^file:/.test(target) ? target : pathToFileURL(path.resolve(target)).href;

let puppeteer;
try { puppeteer = (await import("puppeteer-core")).default; }
catch { console.error("Missing dependency. Run: npm i -D puppeteer-core"); process.exit(2); }

const CANDIDATES = [
  flag("--chrome", null), process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
].filter(Boolean);
const executablePath = CANDIDATES.find(p => existsSync(p));
if (!executablePath) { console.error("No Chrome found. Pass --chrome <path> or set CHROME_PATH."); process.exit(2); }
if (outDir) mkdirSync(outDir, { recursive: true });

const REQUIRED_TOKENS = ["--tu-canvas", "--tu-well", "--tu-surface", "--tu-border", "--tu-rim", "--tu-grid", "--tu-text", "--tu-muted", "--tu-accent", "--tu-accent-2", "--tu-radius-card"];
const results = [];
const add = (scope, name, status, detail = "") => results.push({ scope, name, status, detail });
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* Runs inside the page: static checks. Returns [{name, status, detail}] */
function pageChecks(REQUIRED_TOKENS) {
  const out = [], add = (name, status, detail = "") => out.push({ name, status, detail });
  const cvs = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  const parse = c => { cvs.clearRect(0, 0, 1, 1); cvs.fillStyle = "#000"; cvs.fillStyle = c; cvs.fillRect(0, 0, 1, 1); const d = cvs.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const over = (top, base) => { const a = top[3]; return [0, 1, 2].map(i => top[i] * a + base[i] * (1 - a)).concat(1); };
  const lum = c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  const root = getComputedStyle(document.documentElement);

  // 1. overflow
  const ov = document.documentElement.scrollWidth - innerWidth;
  add("no horizontal overflow", ov <= 0 ? "pass" : "fail", ov > 0 ? `page is ${ov}px wider than the viewport` : "");

  // 2. canvas 1:1
  const canvases = [...document.querySelectorAll("canvas")];
  if (!canvases.length) add("canvas 1:1", "warn", "no <canvas> found (skipped)");
  for (const c of canvases) {
    const r = c.getBoundingClientRect(), css = r.width / r.height, back = c.width / c.height, dpr = devicePixelRatio;
    const skew = Math.abs(css - back) / css, sharp = c.width >= r.width * dpr * .98;
    add("canvas 1:1 and sharp", skew < .01 && sharp ? "pass" : "fail", `css ${r.width.toFixed(0)}x${r.height.toFixed(0)}, backing ${c.width}x${c.height}, dpr ${dpr}, skew ${(skew * 100).toFixed(2)}%${sharp ? "" : ", backing store is smaller than css*dpr"}`);
  }

  // 3. drag surfaces
  const drags = [...new Set([...document.querySelectorAll("[data-tu-drag], .tu-stage, [role=slider]")])];
  if (!drags.length) add("drag surfaces", "warn", "no [data-tu-drag], .tu-stage or [role=slider] found");
  const badDrag = drags.filter(e => { const s = getComputedStyle(e); return s.touchAction !== "none" || (s.userSelect !== "none" && s.webkitUserSelect !== "none"); });
  if (drags.length) add("touch-action:none + user-select:none on drag surfaces", badDrag.length ? "fail" : "pass", badDrag.map(e => e.id || e.className || e.tagName).join(", "));

  // 4. slider semantics
  const sliders = [...document.querySelectorAll("[role=slider]")];
  const badS = sliders.filter(e => !(e.tabIndex >= 0 && e.hasAttribute("aria-valuenow") && e.hasAttribute("aria-valuemin") && e.hasAttribute("aria-valuemax") && (e.getAttribute("aria-label") || e.getAttribute("aria-labelledby"))));
  if (sliders.length) add("role=slider has tabindex, name, min/max/now", badS.length ? "fail" : "pass", badS.map(e => e.id || e.tagName).join(", "));
  else add("role=slider present", "warn", "no [role=slider] found");

  // 5. tokens
  const missing = REQUIRED_TOKENS.filter(t => !root.getPropertyValue(t).trim());
  add("required --tu-* tokens defined", missing.length ? "fail" : "pass", missing.join(", "));

  // 6. token contrast pairs
  const tok = n => parse(root.getPropertyValue(n).trim() || "#000");
  const well = tok("--tu-well");
  for (const [n, min] of [["--tu-muted", 4.5], ["--tu-text", 4.5]]) {
    const r = ratio(over(tok(n), well), well);
    add(`token contrast ${n} on --tu-well`, r >= min ? "pass" : "fail", `${r.toFixed(2)}:1 (min ${min})`);
  }

  // 7. DOM text contrast (gradient backgrounds: worst case over the gradient's color stops)
  const base = over(parse(getComputedStyle(document.body).backgroundColor), [255, 255, 255, 1]);
  const bgVariants = el => {
    const layers = [];
    for (let n = el; n; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (/gradient/.test(s.backgroundImage)) {
        const stops = (s.backgroundImage.match(/rgba?\([^)]*\)/g) || []).map(parse);
        const under = layers.length ? layers.reduce((acc, l) => over(l, acc), base) : base;
        return stops.length ? stops.map(c => over(c, base)).map(c => layers.reduce((acc, l) => over(l, acc), c)) : [under];
      }
      const bg = parse(s.backgroundColor);
      if (bg[3] > 0) { layers.unshift(bg); if (bg[3] >= .99) break; }
    }
    return [layers.reduce((acc, l) => over(l, acc), base)];
  };
  const low = [], seen = new Set();
  for (const el of document.querySelectorAll("body *")) {
    if (!/^(SCRIPT|STYLE|CANVAS)$/.test(el.tagName) && [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) {
      const s = getComputedStyle(el), r = el.getBoundingClientRect();
      if (s.display === "none" || s.visibility === "hidden" || !r.width || !r.height) continue;
      const size = parseFloat(s.fontSize), big = size >= 24 || (size >= 18.66 && +s.fontWeight >= 700), min = big ? 3 : 4.5;
      const fg = parse(s.color);
      const worst = Math.min(...bgVariants(el).map(b => ratio(over(fg, b), b)));
      if (worst < min) { const k = (el.textContent.trim().slice(0, 24)) + worst.toFixed(1); if (!seen.has(k)) { seen.add(k); low.push(`"${el.textContent.trim().slice(0, 24)}" ${worst.toFixed(2)}:1`); } }
    }
  }
  add("DOM text contrast >= 4.5:1 (3:1 large)", low.length ? "fail" : "pass", low.join("; "));

  // 8. tabular readouts
  const ros = [...document.querySelectorAll("[data-tu-readout]")];
  if (!ros.length) add("tabular readouts", "warn", "no [data-tu-readout] elements marked");
  else {
    const bad = ros.filter(e => { const s = getComputedStyle(e); return !(/tabular-nums/.test(s.fontVariantNumeric) || /mono/i.test(s.fontFamily)); });
    add("readouts use tabular-nums or monospace", bad.length ? "fail" : "pass", bad.map(e => e.id).join(", "));
  }

  // 9. overlapping text
  const boxes = [];
  for (const el of document.querySelectorAll("body *")) {
    if (/^(SCRIPT|STYLE)$/.test(el.tagName) || ![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
    const s = getComputedStyle(el); if (s.display === "none" || s.visibility === "hidden") continue;
    const range = document.createRange(); range.selectNodeContents(el);
    const r = range.getBoundingClientRect(); if (r.width && r.height) boxes.push({ el, r, t: el.textContent.trim().slice(0, 18) });
  }
  const hits = [];
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j]; if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
    const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left), h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
    if (w > 2 && h > 2) hits.push(`"${a.t}" x "${b.t}"`);
  }
  add("no overlapping text labels", hits.length ? "fail" : "pass", hits.join("; "));
  return out;
}

/* Runs in node: scans raw source for the zero-slop patterns */
function sourceChecks(src) {
  const rules = [
    [/transition(-property)?\s*:\s*all\b/i, "transition: all"],
    [/hover:scale-/i, "hover:scale-* utility"],
    [/:hover\s*\{[^}]*scale\(/i, ":hover with scale()"],
    [/<canvas\b[^>]*\swidth\s*=/i, "hardcoded <canvas width=...>"],
  ];
  const bad = rules.filter(([re]) => re.test(src)).map(r => r[1]);
  add("source", "no forbidden patterns", bad.length ? "fail" : "pass", bad.join(", "));
  const hasRO = /ResizeObserver/.test(src), hasIO = /IntersectionObserver/.test(src), hasRM = /prefers-reduced-motion/.test(src), hasPC = /setPointerCapture/.test(src);
  add("source", "ResizeObserver used for canvas sizing", hasRO ? "pass" : "fail");
  add("source", "IntersectionObserver pauses offscreen loop", hasIO ? "pass" : "warn", hasIO ? "" : "offscreen canvases keep animating");
  add("source", "honors prefers-reduced-motion", hasRM ? "pass" : "fail");
  add("source", "setPointerCapture on drag", hasPC ? "pass" : "warn");
}

const browser = await puppeteer.launch({ executablePath, headless: true, args: ["--no-sandbox"] });
let srcDone = false;
try {
  for (const scheme of schemes) for (const [label, width, height, mobile] of [["desktop", 1200, 800, false], ["mobile", 375, 812, true]]) {
    const scope = `${scheme} ${width}px`;
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile });
    await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: scheme }]);
    await page.evaluateOnNewDocument(() => { window.__raf = 0; const o = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = cb => { window.__raf++; return o(cb); }; });
    const errors = []; page.on("pageerror", e => errors.push(e.message)); page.on("console", m => m.type() === "error" && errors.push(m.text()));
    const resp = await page.goto(url, { waitUntil: "networkidle0" });
    if (!srcDone) { srcDone = true; sourceChecks(await resp.text()); }
    await sleep(2500);

    for (const r of await page.evaluate(pageChecks, REQUIRED_TOKENS)) add(scope, r.name, r.status, r.detail);
    add(scope, "no console or page errors", errors.length ? "fail" : "pass", errors.slice(0, 2).join(" | "));

    const rafOver = async ms => { await page.evaluate(() => (window.__raf = 0)); await sleep(ms); return page.evaluate(() => window.__raf); };
    const idle = await rafOver(1000);
    add(scope, "rAF asleep when idle", idle === 0 ? "pass" : "fail", `${idle} frames in 1s`);

    const slider = await page.$("[role=slider]");
    if (slider) {
      const box = await slider.boundingBox(), cx = box.x + box.width / 2, cy = box.y + box.height / 2;
      const val = () => slider.evaluate(e => e.getAttribute("aria-valuetext") || e.getAttribute("aria-valuenow"));
      const before = await val(), scrollBefore = await page.evaluate(() => scrollY);
      await page.evaluate(() => (window.__raf = 0));
      if (mobile) {
        await page.touchscreen.touchStart(cx, cy);
        for (let i = 1; i <= 12; i++) { await page.touchscreen.touchMove(cx - i * 8, cy - i * 5); await sleep(16); }
        await page.touchscreen.touchEnd();
      } else {
        await page.mouse.move(cx, cy); await page.mouse.down();
        for (let i = 1; i <= 12; i++) { await page.mouse.move(cx - i * 8, cy - i * 5); await sleep(16); }
        await page.mouse.up();
      }
      const during = await page.evaluate(() => window.__raf);
      const after = await val(), scrolled = (await page.evaluate(() => scrollY)) !== scrollBefore;
      add(scope, `${mobile ? "touch" : "mouse"} drag moves the slider`, after !== before ? "pass" : "fail", `${before} -> ${after}`);
      if (mobile) add(scope, "touch drag does not scroll the page", scrolled ? "fail" : "pass");
      add(scope, "animation runs while dragging", during > 0 ? "pass" : "warn", `${during} frames`);
      await sleep(2800);
      const idle2 = await rafOver(1000);
      add(scope, "rAF asleep after a drag settles", idle2 === 0 ? "pass" : "fail", `${idle2} frames in 1s`);

      await slider.focus(); const k0 = await val(); await page.keyboard.press("ArrowRight"); await page.keyboard.press("ArrowUp"); await sleep(300);
      add(scope, "arrow keys nudge the slider", (await val()) !== k0 ? "pass" : "fail", `${k0} -> ${await val()}`);
      const ring = await slider.evaluate(e => { const s = getComputedStyle(e); return s.boxShadow !== "none" || s.outlineStyle !== "none"; });
      add(scope, "visible focus ring on focused slider", ring ? "pass" : "fail");
    }

    if (!mobile && scheme === schemes[0]) { // reduced motion: separate page so the media feature applies from load
      const rp = await browser.newPage(); await rp.setViewport({ width, height });
      await rp.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }, { name: "prefers-color-scheme", value: scheme }]);
      await rp.evaluateOnNewDocument(() => { window.__raf = 0; const o = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = cb => { window.__raf++; return o(cb); }; });
      await rp.goto(url, { waitUntil: "networkidle0" }); await sleep(800);
      const s = await rp.$("[role=slider]");
      if (s) {
        const b = await s.boundingBox(); await rp.mouse.move(b.x + 22, b.y + 22); await rp.mouse.down(); await rp.mouse.move(b.x - 60, b.y - 40, { steps: 8 }); await rp.mouse.up();
        await sleep(500); await rp.evaluate(() => (window.__raf = 0)); await sleep(800);
        const n = await rp.evaluate(() => window.__raf);
        add("reduced motion", "loop sleeps within 500ms of input (springs snap)", n === 0 ? "pass" : "fail", `${n} frames`);
      }
      await rp.close();
    }

    if (outDir) { const f = path.join(outDir, `${scheme}-${width}.png`); await page.screenshot({ path: f }); add(scope, "screenshot", "pass", f); }
    await page.close();
  }
} finally { await browser.close(); }

const icon = { pass: "PASS", fail: "FAIL", warn: "WARN" };
let scopeNow = "";
for (const r of results) {
  if (r.scope !== scopeNow) { scopeNow = r.scope; console.log(`\n== ${scopeNow}`); }
  console.log(`  ${icon[r.status]}  ${r.name}${r.detail ? "  (" + r.detail + ")" : ""}`);
}
const n = s => results.filter(r => r.status === s).length;
console.log(`\n${n("pass")} passed, ${n("fail")} failed, ${n("warn")} warnings`);
console.log("Still manual: real-device touch, judging the visuals, theme overrides.");
process.exit(n("fail") ? 1 : 0);
