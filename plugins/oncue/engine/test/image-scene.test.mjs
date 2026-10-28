// @ts-check
/**
 * An image beat through the timeline and both renderers: its cue lands on its word, the scenes page gets a
 * downscaled, beat-numbered copy, and the deck embeds the picture with its alt text, on the slide.
 */
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import sharp from "sharp";
import deck from "../dist/deck.js";
import scenes from "../dist/scenes.js";
import spec from "../dist/spec.js";
import timeline from "../dist/timeline.js";

const engine = fileURLToPath(new URL("..", import.meta.url));
const example = new URL("../examples/gleaner/", import.meta.url);
const gleaner = JSON.parse(readFileSync(new URL("short.json", example), "utf8"));
const dir = mkdtempSync(join(tmpdir(), "oncue-image-scene-"));
after(() => rmSync(dir, { recursive: true, force: true }));
copyFileSync(new URL("logo.png", example), join(dir, "logo.png"));

const solid = (/** @type {number} */ width, /** @type {number} */ height) => sharp({ create: { width, height, channels: 3, background: "#336699" } });
await solid(4000, 3000).jpeg().toFile(join(dir, "big.jpg"));
await solid(640, 360).png().toFile(join(dir, "small.PNG"));

const ALT = "A diagram of how a clip gets saved";
/** Beat 2 is cued and captioned, beat 3 has neither, beat 4 reuses beat 2's file. */
const lines = [
  gleaner.lines[0],
  { vo: "Here is a diagram of how a clip gets saved.", scene: { kind: "image", kicker: "How it works", title: "One clip, {every source}", src: "big.jpg", alt: ALT, imageCue: { word: "diagram" }, caption: "Drawn diagram, 16:9", captionCue: { word: "saved" } } },
  { vo: "This picture enters with no cue at all.", scene: { kind: "image", kicker: "In the app", title: "Say {save this page}", src: "small.PNG", alt: "A small screenshot" } },
  { vo: "The same picture shows again here.", scene: { kind: "image", kicker: "Again", title: "The {same} file", src: "big.jpg", alt: ALT } },
];

/** @param {string} name @param {Record<string, any>} short */
function write(name, short) {
  const file = join(dir, `${name}.json`);
  writeFileSync(file, JSON.stringify(short));
  return spec.loadSpec(file);
}

test("imageCue lands on its word, and a beat without one is spaced evenly", () => {
  const { spec: s } = write("timeline", { ...gleaner, lines });
  const est = timeline.estimateWords(s);
  const tl = timeline.buildTimeline(s, est.words, est.seconds);
  assert.deepEqual(tl.warnings, []);
  const diagram = est.words.find((/** @type {{ text: string }} */ w) => w.text === "diagram");
  assert.ok(diagram);
  assert.equal(tl.scenes[1]?.cues["image"], timeline.LEAD + diagram.start);

  // Beat 3's words follow beats 1 and 2 in the estimate; two slots split the line into quarters.
  const before = lines.slice(0, 2).reduce((n, l) => n + l.vo.split(/\s+/).length, 0);
  const own = est.words.slice(before, before + lines[2].vo.split(/\s+/).length);
  const start = timeline.LEAD + own[0].start, end = timeline.LEAD + own.at(-1).end;
  const span = Math.max(0.6, end - start);
  assert.equal(tl.scenes[2]?.cues["image"], start + 0.25 * span);
  assert.equal(tl.scenes[2]?.cues["caption"], start + 0.75 * span);
});

test("writeScenes copies each beat's picture, downscaled to 2160 px at most, and marks it for its cue", async () => {
  const out = join(dir, "scenes");
  const html = readFileSync(await scenes.writeScenes(write("scenes", { ...gleaner, lines }), out, engine), "utf8");
  const big = await sharp(join(out, "images", "beat-2.jpg")).metadata();
  assert.deepEqual([big.width, big.height], [2160, 1620]);
  const small = await sharp(join(out, "images", "beat-3.png")).metadata();
  assert.deepEqual([small.width, small.height], [640, 360]);
  // Two beats sharing one file each get their own copy.
  assert.ok(existsSync(join(out, "images", "beat-4.jpg")), "beat 4 has its own copy");

  const sections = html.split("<section").slice(1);
  assert.equal(sections.length, lines.length);
  assert.match(sections[1] ?? "", /<img [^>]*src="images\/beat-2\.jpg"/);
  assert.match(sections[1] ?? "", /data-cue="image"/);
  assert.match(sections[1] ?? "", /data-cue="caption"[^>]*>Drawn diagram, 16:9</);
  assert.match(sections[2] ?? "", /<img [^>]*src="images\/beat-3\.png"/);
  // No caption, no caption element.
  assert.doesNotMatch(sections[2] ?? "", /caption/);
});

const EMU = 914400;
/** The deck's JPEGs under ppt/media/, its alt texts, and every shape off its slide. @param {string} name @param {Record<string, any>} short */
async function deckOf(name, short) {
  const out = join(dir, `${name}.pptx`);
  await deck.writeDeck(write(name, short), out);
  const zip = await JSZip.loadAsync(readFileSync(out));
  const pres = (await zip.file("ppt/presentation.xml")?.async("string")) ?? "";
  const size = /<p:sldSz cx="(\d+)" cy="(\d+)"/.exec(pres);
  assert.ok(size);
  const [cx, cy] = [Number(size[1]), Number(size[2])];
  const outside = [], descr = [];
  for (const slide of Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))) {
    const xml = (await zip.file(slide)?.async("string")) ?? "";
    for (const m of xml.matchAll(/descr="([^"]*)"/g)) descr.push(m[1]);
    for (const m of xml.matchAll(/<a:off x="(-?\d+)" y="(-?\d+)"\/>\s*<a:ext cx="(-?\d+)" cy="(-?\d+)"\/>/g)) {
      const [x, y, w, h] = m.slice(1, 5).map(Number);
      if (x < 0 || y < 0 || w < 0 || h < 0 || x + w > cx + 1 || y + h > cy + 1) outside.push(`${slide}: off ${x},${y} ext ${w}×${h}`);
    }
  }
  return { jpegs: Object.keys(zip.files).filter((n) => /^ppt\/media\/.*\.jpe?g$/i.test(n)), descr, outside, size: [cx / EMU, cy / EMU] };
}

test("the deck embeds an image beat's JPEG, which the same spec without that beat lacks", async () => {
  const withImage = await deckOf("deck-image", { ...gleaner, lines: lines.slice(0, 2) });
  const without = await deckOf("deck-plain", { ...gleaner, lines: lines.slice(0, 1) });
  assert.ok(withImage.jpegs.length > 0, "no JPEG under ppt/media/");
  assert.deepEqual(without.jpegs, []);
  assert.ok(withImage.descr.includes(ALT), `alt text missing; got ${JSON.stringify(withImage.descr)}`);
});

for (const [w, h] of [[1080, 1920], [1920, 1080]]) {
  test(`${w}×${h}: image slides keep every shape on the slide`, async () => {
    const d = await deckOf(`deck-${w}x${h}`, { ...gleaner, format: { width: w, height: h }, lines });
    assert.deepEqual(d.outside, []);
  });
}
