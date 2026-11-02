// @ts-check
/** Exercise the CLI, so a launch-options helper that is never used cannot pass. */
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const engine = fileURLToPath(new URL("..", import.meta.url));
const example = new URL("../examples/gleaner/", import.meta.url);
const dir = mkdtempSync(join(tmpdir(), "oncue-browser-smoke-"));
after(() => rmSync(dir, { recursive: true, force: true }));
let browserPath = "";
let unavailable = "";

before(async () => {
  try {
    const { chromium } = await import("playwright");
    browserPath = process.env.ONCUE_CHROMIUM_PATH || chromium.executablePath();
    await (await chromium.launch({ executablePath: browserPath })).close();
  } catch (error) {
    unavailable = `Browser prerequisite: ${String(error).split("\n")[0]}`;
  }
});

/** A single image beat gives an independent pixel assertion for real browser output. @param {string} name */
async function fixture(name) {
  const folder = join(dir, name);
  mkdirSync(folder);
  copyFileSync(new URL("logo.png", example), join(folder, "logo.png"));
  await sharp({ create: { width: 1080, height: 1080, channels: 3, background: "#336699" } }).png().toFile(join(folder, "image.png"));
  const spec = JSON.parse(readFileSync(new URL("short.json", example), "utf8"));
  writeFileSync(join(folder, "short.json"), JSON.stringify({ ...spec, format: { width: 1920, height: 1080 }, lines: [{
    vo: "Here is the picture.", scene: { kind: "image", kicker: "Probe", title: "Browser selection", src: "image.png", alt: "A blue test picture", imageCue: { word: "picture" } },
  }] }));
  return folder;
}

test("CLI stills uses an explicit browser even when Playwright's default cache is absent", async (t) => {
  if (unavailable) { t.skip(unavailable); return; }
  const folder = await fixture("explicit");
  const run = spawnSync(process.execPath, ["dist/cli.js", "stills", join(folder, "short.json")], {
    cwd: engine, encoding: "utf8", env: { ...process.env, ONCUE_CHROMIUM_PATH: browserPath, PLAYWRIGHT_BROWSERS_PATH: join(dir, "empty-cache") },
  });
  assert.equal(run.status, 0, run.stderr);
  const png = run.stdout.trim().split("\n")[0];
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual([info.width, info.height], [1920, 1080]);
  let blue = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    if (Math.abs(data[i] - 0x33) < 8 && Math.abs(data[i + 1] - 0x66) < 8 && Math.abs(data[i + 2] - 0x99) < 8) blue++;
  }
  assert.ok(blue > 100_000, `picture missing: ${blue} blue pixels`);
});

test("CLI stills rejects an invalid explicit browser without falling back", async (t) => {
  if (unavailable) { t.skip(unavailable); return; }
  const folder = await fixture("invalid");
  const invalid = join(dir, "missing browser", "chrome");
  const run = spawnSync(process.execPath, ["dist/cli.js", "stills", join(folder, "short.json")], {
    cwd: engine, encoding: "utf8", env: { ...process.env, ONCUE_CHROMIUM_PATH: invalid },
  });
  assert.notEqual(run.status, 0, "an invalid override must not render with the default browser");
  assert.ok(run.stderr.includes(invalid), run.stderr);
});
