#!/usr/bin/env node
import { cpSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
if (args.includes("-h") || args.includes("--help")) {
  console.log(`Usage: npx github:monoaster/tactile-uiux-skill [--global]

Installs the tactile-ui skill (SKILL.md, CHANGELOG.md, references/, examples/, scripts/):
  default   .agents/skills/tactile-ui/ in the current project
  --global  ~/.gemini/config/skills/tactile-ui/

The checker needs puppeteer-core and a local Chrome:
  npm i -D puppeteer-core && node <skill-dir>/scripts/check.mjs <url-or-file.html>`);
  process.exit(0);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const isGlobal = args.includes("--global") || args.includes("-g");
const dest = isGlobal
  ? path.join(homedir(), ".gemini", "config", "skills", "tactile-ui")
  : path.join(process.cwd(), ".agents", "skills", "tactile-ui");

mkdirSync(dest, { recursive: true });
for (const item of ["SKILL.md", "CHANGELOG.md", "references", "examples", "scripts"]) {
  cpSync(path.join(root, item), path.join(dest, item), { recursive: true });
}

console.log(`Installed tactile-ui skill to ${dest}`);
