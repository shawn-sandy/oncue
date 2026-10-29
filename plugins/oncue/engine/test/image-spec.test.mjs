// @ts-check
/**
 * The image scene kind in the contract: loadSpec checks src and alt, naming the field, `check` decodes the picture,
 * and slots() gives its cues.
 */
import { spawnSync } from "node:child_process";
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import spec from "../dist/spec.js";
import cues from "../dist/cues.js";

const example = new URL("../examples/gleaner/", import.meta.url);
const gleaner = JSON.parse(readFileSync(new URL("short.json", example), "utf8"));
const dir = mkdtempSync(join(tmpdir(), "oncue-image-spec-"));
after(() => rmSync(dir, { recursive: true, force: true }));
copyFileSync(new URL("logo.png", example), join(dir, "logo.png"));

const tiny = () => sharp({ create: { width: 64, height: 36, channels: 3, background: "#336699" } });
await tiny().png().toFile(join(dir, "pic.png"));
await tiny().png().toFile(join(dir, "UPPER.PNG"));
await tiny().jpeg().toFile(join(dir, "pic.jpeg"));
await tiny().jpeg().toFile(join(dir, "my picture.jpg"));
// Real files with the wrong extension, so a rejection can only come from the extension.
await tiny().webp().toFile(join(dir, "pic.webp"));
await tiny().gif().toFile(join(dir, "pic.gif"));
writeFileSync(join(dir, "pic.svg"), '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="36"/>');
// The right extension on the wrong bytes, so a rejection can only come from reading the file.
await tiny().webp().toFile(join(dir, "webp.png"));
writeFileSync(join(dir, "text.jpg"), "not a picture\n");
const jpeg = await sharp({ create: { width: 640, height: 360, channels: 3, background: "#336699" } }).jpeg().toBuffer();
writeFileSync(join(dir, "truncated.jpg"), jpeg.subarray(0, jpeg.length >> 1));
// Cut after its header, so only a full decode finds the damage.
assert.equal((await sharp(join(dir, "truncated.jpg")).metadata()).format, "jpeg");

/** @param {Record<string, unknown>} scene */
const image = (scene) => ({ kind: "image", kicker: "How it works", title: "One clip, {every source}", src: "pic.png", alt: "A diagram of a saved clip", ...scene });

/** Writes a spec whose second beat is the given image scene; returns its path. @param {Record<string, unknown>} scene @param {string} [folder] */
function write(scene, folder = dir) {
  const file = join(folder, "short.json");
  const short = { ...gleaner, brand: { ...gleaner.brand, logo: join(dir, "logo.png") }, lines: [gleaner.lines[0], { vo: "This is how a clip gets saved.", scene: image(scene) }] };
  writeFileSync(file, JSON.stringify(short));
  return file;
}
/** @param {Record<string, unknown>} scene @param {string} [folder] */
const load = (scene, folder = dir) => spec.loadSpec(write(scene, folder));
const cli = fileURLToPath(new URL("../dist/cli.js", import.meta.url));
/** Runs `check` on a spec whose second beat is the given image scene. @param {Record<string, unknown>} scene */
const check = (scene) => spawnSync(process.execPath, [cli, "check", write(scene)], { encoding: "utf8" });

test("an image beat with a PNG and alt text loads", () => {
  assert.equal(load({}).spec.lines[1]?.scene.kind, "image");
});

test("missing src is rejected, naming lines[1].scene.src", () => {
  assert.throws(() => load({ src: undefined }), /lines\[1\]\.scene\.src/);
  assert.throws(() => load({ src: "  " }), /lines\[1\]\.scene\.src/);
});

test("a src that does not exist is rejected, naming lines[1].scene.src", () => {
  assert.throws(() => load({ src: "nowhere.png" }), /short\.json lines\[1\]\.scene\.src: .*nowhere\.png/);
});

for (const ext of ["webp", "svg", "gif"]) {
  test(`.${ext} is rejected, naming lines[1].scene.src`, () => {
    assert.throws(() => load({ src: `pic.${ext}` }), /lines\[1\]\.scene\.src: .*PNG or JPEG/);
  });
}

test(".PNG and .jpeg are accepted", () => {
  assert.doesNotThrow(() => load({ src: "UPPER.PNG" }));
  assert.doesNotThrow(() => load({ src: "pic.jpeg" }));
});

test("empty alt is rejected, naming lines[1].scene.alt", () => {
  assert.throws(() => load({ alt: "" }), /lines\[1\]\.scene\.alt/);
  assert.throws(() => load({ alt: undefined }), /lines\[1\]\.scene\.alt/);
});

test("a src with spaces is accepted", () => {
  assert.doesNotThrow(() => load({ src: "my picture.jpg" }));
});

test("a src naming a folder is rejected, naming lines[1].scene.src", () => {
  mkdirSync(join(dir, "folder.png"), { recursive: true });
  assert.throws(() => load({ src: "folder.png" }), /lines\[1\]\.scene\.src/);
});

test("src resolves relative to short.json, not the working directory", (t) => {
  const project = join(dir, "project");
  mkdirSync(join(project, "images"), { recursive: true });
  copyFileSync(join(dir, "pic.png"), join(project, "images", "beat-02.png"));
  const cwd = process.cwd();
  process.chdir(tmpdir());
  t.after(() => process.chdir(cwd));
  assert.doesNotThrow(() => load({ src: "images/beat-02.png" }, project));
  assert.throws(() => load({ src: "beat-02.png" }, project), /lines\[1\]\.scene\.src/);
});

for (const [src, what] of [["webp.png", "a WebP named .png"], ["text.jpg", "a text file named .jpg"], ["truncated.jpg", "a truncated JPEG"]]) {
  test(`check rejects ${what}, naming lines[1].scene.src`, () => {
    const run = check({ src });
    assert.equal(run.status, 1, run.stdout);
    assert.match(run.stderr, /^short\.json lines\[1\]\.scene\.src: /);
  });
}

test("check passes a real PNG and JPEG", () => {
  for (const src of ["pic.png", "pic.jpeg"]) {
    const run = check({ src });
    assert.equal(run.status, 0, run.stderr);
  }
});

test("slots() gives an image beat image then caption, with their cues", () => {
  const imageCue = { word: "clip" }, captionCue = { word: "saved" };
  const got = cues.slots(/** @type {any} */ (image({ imageCue, caption: "Drawn diagram", captionCue })));
  assert.deepEqual(got, [{ id: "image", cue: imageCue }, { id: "caption", cue: captionCue }]);
});
