// @ts-check
/**
 * Objective: a 1920×1080 short.json renders with every scene inside the frame.
 * Measured with a DOM Range per scene at its held moment, independent of the fit guard's own report.
 * Skips, with the reason, when Chromium can't launch (CI installs Playwright without a browser).
 */
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import scenes from "../dist/scenes.js";
import spec from "../dist/spec.js";
import timeline from "../dist/timeline.js";

const engine = fileURLToPath(new URL("..", import.meta.url));
const example = new URL("../examples/gleaner/", import.meta.url);
const dir = mkdtempSync(join(tmpdir(), "oncue-landscape-"));
after(() => rmSync(dir, { recursive: true, force: true }));

/** @returns {Promise<import("playwright").Browser | string>} the browser, or why it can't start */
async function launch() {
  try {
    const { chromium } = await import("playwright");
    return await chromium.launch();
  } catch (e) {
    return `Chromium can't launch: ${String(e instanceof Error ? e.message : e).split("\n")[0]}`;
  }
}

test("every scene of the Gleaner example at 1920×1080 stays inside the frame", async (t) => {
  const browser = await launch();
  if (typeof browser === "string") { t.skip(browser); return; }
  try {
    const file = join(dir, "short.json");
    const src = JSON.parse(readFileSync(new URL("short.json", example), "utf8"));
    writeFileSync(file, JSON.stringify({ ...src, format: { width: 1920, height: 1080 } }));
    copyFileSync(new URL("logo.png", example), join(dir, "logo.png"));
    const loaded = spec.loadSpec(file);
    const html = scenes.writeScenes(loaded, join(dir, "scenes"), engine);
    const est = timeline.estimateWords(loaded.spec);
    const tl = timeline.buildTimeline(loaded.spec, est.words, est.seconds);

    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    await page.addInitScript(`window.TIMELINE = ${JSON.stringify(tl)};`);
    await page.goto(pathToFileURL(html).href);
    await page.waitForFunction(() => /** @type {any} */ (window).ready === true, undefined, { timeout: 15000 });

    const outside = [];
    for (const [i, s] of tl.scenes.entries()) {
      const r = await page.evaluate(({ i, at }) => {
        /** @type {any} */ (window).renderAt(at);
        const sc = /** @type {Element} */ (document.querySelectorAll("section.scene")[i]);
        // A Range counts text at any depth but only its top-level elements' boxes, so add every element's box too.
        const range = document.createRange();
        range.selectNodeContents(sc);
        const rects = [...range.getClientRects(), ...[...sc.querySelectorAll("*")].map((e) => e.getBoundingClientRect())]
          .filter((r) => r.width > 0 || r.height > 0);
        return {
          left: Math.round(Math.min(...rects.map((r) => r.left))), top: Math.round(Math.min(...rects.map((r) => r.top))),
          right: Math.round(Math.max(...rects.map((r) => r.right))), bottom: Math.round(Math.max(...rects.map((r) => r.bottom))),
        };
      }, { i, at: s.start + 0.85 * (s.end - s.start) });
      if (r.left < 0 || r.top < 0 || r.right > 1920 || r.bottom > 1080) outside.push(`scene ${i + 1} (${src.lines[i].scene.kind}): ${JSON.stringify(r)}`);
    }
    assert.deepEqual(outside, []);
  } finally {
    await browser.close();
  }
});
