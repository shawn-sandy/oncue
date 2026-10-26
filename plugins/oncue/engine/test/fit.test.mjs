// @ts-check
/**
 * Fit guard: `stills` writes build/fit.json, shrinks a scene that overflows its frame until it fits,
 * and leaves scenes that already fit alone. Skips, with the reason, when Chromium can't launch.
 */
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const engine = fileURLToPath(new URL("..", import.meta.url));
const example = new URL("../examples/gleaner/", import.meta.url);
const gleaner = JSON.parse(readFileSync(new URL("short.json", example), "utf8"));
const dir = mkdtempSync(join(tmpdir(), "oncue-fit-"));
after(() => rmSync(dir, { recursive: true, force: true }));

/** Why the browser tests can't run here, or "" when they can. */
let skip = "";
before(async () => {
  try {
    const { chromium } = await import("playwright");
    await (await chromium.launch()).close();
  } catch (e) {
    skip = `Chromium can't launch: ${String(e instanceof Error ? e.message : e).split("\n")[0]}`;
  }
});

/**
 * Runs `stills` on a spec in its own folder and returns build/fit.json.
 * @param {string} name @param {Record<string, unknown>} short
 * @returns {{ scene: number, scale: number, fits: boolean }[]}
 */
function fitFor(name, short) {
  const folder = join(dir, name);
  mkdirSync(folder);
  copyFileSync(new URL("logo.png", example), join(folder, "logo.png"));
  writeFileSync(join(folder, "short.json"), JSON.stringify(short));
  execFileSync(process.execPath, ["dist/cli.js", "stills", join(folder, "short.json")], { cwd: engine, stdio: "pipe" });
  return JSON.parse(readFileSync(join(folder, "build", "fit.json"), "utf8"));
}

test("the Gleaner example at 1920×1080 needs no shrinking", (t) => {
  if (skip) { t.skip(skip); return; }
  const fit = fitFor("gleaner-16x9", { ...gleaner, format: { width: 1920, height: 1080 } });
  assert.equal(fit.length, gleaner.lines.length);
  assert.deepEqual(fit.filter((f) => f.scale !== 1 || !f.fits), []);
});

test("a 6-item list shrinks to fit at 1920×1080 while a 2-item list stays full size", (t) => {
  if (skip) { t.skip(skip); return; }
  const list = gleaner.lines[1].scene;
  const items = [...list.items, ...list.items].map((it) => ({ ...it, cue: undefined }));
  const fit = fitFor("lists-16x9", {
    ...gleaner,
    format: { width: 1920, height: 1080 },
    lines: [
      { vo: "Two things go wrong.", scene: { ...list, items: items.slice(0, 2) } },
      { vo: "Six things go wrong.", scene: { ...list, items } },
    ],
  });
  assert.equal(fit[0]?.scale, 1);
  assert.ok(fit[1] && fit[1].scale < 1, `6-item list scale is ${fit[1]?.scale}`);
  assert.equal(fit[1]?.fits, true);
});

test("every scene of the Gleaner example fits at 1080×1080", (t) => {
  if (skip) { t.skip(skip); return; }
  const fit = fitFor("gleaner-1x1", { ...gleaner, format: { width: 1080, height: 1080 } });
  assert.equal(fit.length, gleaner.lines.length);
  assert.deepEqual(fit.filter((f) => !f.fits), []);
});
