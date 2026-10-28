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

for (const [w, h] of [[1080, 1920], [1920, 1080]]) {
  test(`${w}×${h}: an image beat's picture shows in its still, from a 2160 px build copy`, async (t) => {
    if (skip) { t.skip(skip); return; }
    const folder = join(dir, `${w}x${h}`);
    mkdirSync(folder);
    copyFileSync(new URL("logo.png", example), join(folder, "logo.png"));
    await sharp({ create: { width: 3000, height: 2000, channels: 3, background: "#336699" } }).jpeg({ quality: 95 }).toFile(join(folder, "photo.jpg"));
    writeFileSync(join(folder, "short.json"), JSON.stringify({
      ...gleaner,
      format: { width: w, height: h },
      lines: [gleaner.lines[0], { vo: "Here is the picture of a saved clip.", scene: { kind: "image", kicker: "Saved", title: "A {real} picture", src: "photo.jpg", alt: "A blue test card", imageCue: { word: "picture" }, caption: "Solid test colour" } }],
    }));
    const run = spawnSync(process.execPath, ["dist/cli.js", "stills", join(folder, "short.json")], { cwd: engine, encoding: "utf8" });
    assert.equal(run.status, 0, run.stderr);
    assert.doesNotMatch(run.stderr, /warning/);
    const copy = await sharp(join(folder, "build", "scenes", "images", "beat-2.jpg")).metadata();
    assert.deepEqual([copy.width, copy.height], [2160, 1440]);
    const still = run.stdout.trim().split("\n")[1];
    assert.ok(still, run.stdout);
    const n = await blue(still);
    assert.ok(n > 100_000, `only ${n} pixels of the picture's colour in ${still}`);
  });
}
