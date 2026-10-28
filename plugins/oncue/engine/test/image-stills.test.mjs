// @ts-check
/**
 * An image beat in a real still: `stills` renders a solid #336699 picture, larger than the 2160 px build copy,
 * into its scene's frame. Skips, with the reason, when Chromium can't launch (as in CI): unverified, not passed.
 */
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
const gleaner = JSON.parse(readFileSync(new URL("short.json", example), "utf8"));
const dir = mkdtempSync(join(tmpdir(), "oncue-image-stills-"));
after(() => rmSync(dir, { recursive: true, force: true }));

let skip = "";
before(async () => {
  try {
    const { chromium } = await import("playwright");
    await (await chromium.launch()).close();
  } catch (e) {
    skip = `Chromium can't launch: ${String(e instanceof Error ? e.message : e).split("\n")[0]}`;
  }
});

/** Pixels within 8 per channel of #336699 in a PNG. @param {string} file */
async function blue(file) {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let n = 0;
  for (let i = 0; i < info.width * info.height * 3; i += 3) {
    if (Math.abs(data[i] - 0x33) <= 8 && Math.abs(data[i + 1] - 0x66) <= 8 && Math.abs(data[i + 2] - 0x99) <= 8) n++;
  }
  return n;
}

/**
 * Writes a two-beat spec (hook, then an image beat with a 3000×2000 #336699 picture) and runs `stills` on it.
 * @param {string} name @param {number} w @param {number} h @param {string} title
 */
async function stills(name, w, h, title) {
  const folder = join(dir, name);
  mkdirSync(folder);
  copyFileSync(new URL("logo.png", example), join(folder, "logo.png"));
  await sharp({ create: { width: 3000, height: 2000, channels: 3, background: "#336699" } }).jpeg({ quality: 95 }).toFile(join(folder, "photo.jpg"));
  writeFileSync(join(folder, "short.json"), JSON.stringify({
    ...gleaner,
    format: { width: w, height: h },
    lines: [gleaner.lines[0], { vo: "Here is the picture of a saved clip.", scene: { kind: "image", kicker: "Saved", title, src: "photo.jpg", alt: "A blue test card", imageCue: { word: "picture" }, caption: "Solid test colour" } }],
  }));
  const run = spawnSync(process.execPath, ["dist/cli.js", "stills", join(folder, "short.json")], { cwd: engine, encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  /** @type {{ scene: number, scale: number, fits: boolean }[]} */
  const fit = JSON.parse(readFileSync(join(folder, "build", "fit.json"), "utf8"));
  return { folder, run, fit };
}

for (const [w, h] of [[1080, 1920], [1920, 1080]]) {
  test(`${w}×${h}: an image beat's picture shows in its still, from a 2160 px build copy`, async (t) => {
    if (skip) { t.skip(skip); return; }
    const { folder, run } = await stills(`${w}x${h}`, w, h, "A {real} picture");
    assert.doesNotMatch(run.stderr, /warning/);
    const copy = await sharp(join(folder, "build", "scenes", "images", "beat-2.jpg")).metadata();
    assert.deepEqual([copy.width, copy.height], [2160, 1440]);
    const still = run.stdout.trim().split("\n")[1];
    assert.ok(still, run.stdout);
    const n = await blue(still);
    assert.ok(n > 100_000, `only ${n} pixels of the picture's colour in ${still}`);
  });
}

// A square frame leaves the portrait layout under 500 px for the title and picture. The picture keeps a minimum
// size, so the scene overflows and the fit guard shrinks it and warns, instead of squeezing the picture to a sliver.
test("1080×1080: an image beat that does not fit shrinks with a warning, and its picture stays large", async (t) => {
  if (skip) { t.skip(skip); return; }
  const { run, fit } = await stills("1080x1080", 1080, 1080, "Every page becomes a {tagged, summarized clip.}");
  const scene = fit.find((f) => f.scene === 2);
  assert.ok(scene && scene.scale < 1 && scene.fits, JSON.stringify(scene));
  assert.match(run.stderr, /warning: scene 2 \(image\) shrunk/);
  const still = run.stdout.trim().split("\n")[1];
  assert.ok(still, run.stdout);
  const n = await blue(still);
  // About 70,000 now; the squeezed frame this guards against showed about 23,000.
  assert.ok(n > 50_000, `only ${n} pixels of the picture's colour in ${still}`);
});
