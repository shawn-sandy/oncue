// @ts-check
/** Deck geometry: the slide snaps to 9:16 or 16:9 by orientation, and every shape stays on its slide. */
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import JSZip from "jszip";
import deck from "../dist/deck.js";
import spec from "../dist/spec.js";

const example = new URL("../examples/gleaner/", import.meta.url);
const gleaner = JSON.parse(readFileSync(new URL("short.json", example), "utf8"));
const dir = mkdtempSync(join(tmpdir(), "oncue-deck-"));
copyFileSync(new URL("logo.png", example), join(dir, "logo.png"));
after(() => rmSync(dir, { recursive: true, force: true }));

const EMU = 914400;

/**
 * Writes the deck for a spec and returns its slide size, slide count and every shape off its slide
 * (including any negative extent, which is invalid OOXML).
 * @param {string} name @param {Record<string, any>} short
 */
async function writeAndMeasure(name, short) {
  const file = join(dir, `${name}.json`);
  writeFileSync(file, JSON.stringify(short));
  const out = join(dir, `${name}.pptx`);
  await deck.writeDeck(spec.loadSpec(file), out);

  const zip = await JSZip.loadAsync(readFileSync(out));
  const pres = await zip.file("ppt/presentation.xml")?.async("string");
  const size = /<p:sldSz cx="(\d+)" cy="(\d+)"/.exec(pres ?? "");
  assert.ok(size, "presentation.xml has no p:sldSz");
  const [cx, cy] = [Number(size[1]), Number(size[2])];

  const slides = Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n));
  const outside = [];
  let shapes = 0;
  for (const slide of slides) {
    const xml = (await zip.file(slide)?.async("string")) ?? "";
    for (const m of xml.matchAll(/<a:off x="(-?\d+)" y="(-?\d+)"\/>\s*<a:ext cx="(-?\d+)" cy="(-?\d+)"\/>/g)) {
      const [x, y, ew, eh] = m.slice(1, 5).map(Number);
      shapes++;
      if (x < 0 || y < 0 || ew < 0 || eh < 0 || x + ew > cx || y + eh > cy) outside.push(`${slide}: off ${x},${y} ext ${ew}×${eh}`);
    }
  }
  assert.ok(shapes > slides.length * 4, `only ${shapes} shapes found; the offset pattern no longer matches the XML`);
  return { size: [cx, cy], slides: slides.length, outside };
}

const sizes = [
  [1080, 1920, 5.625, 10],
  [1920, 1080, 10, 5.625],
  [1080, 1350, 5.625, 10],
];

for (const [w, h, sw, sh] of sizes) {
  test(`${w}×${h} spec writes a ${sw}×${sh} in deck with every shape on its slide`, async () => {
    const d = await writeAndMeasure(`gleaner-${w}x${h}`, { ...gleaner, format: { width: w, height: h } });
    assert.deepEqual(d.size, [Math.round(sw * EMU), Math.round(sh * EMU)]);
    assert.equal(d.slides, gleaner.lines.length);
    assert.deepEqual(d.outside, []);
  });
}

// Four steps plus a result leave less than a step's height between steps, where the connector line
// used to get a negative height.
const stepsLine = gleaner.lines.find((/** @type {any} */ l) => l.scene.kind === "steps");
const fourSteps = { ...stepsLine, scene: { ...stepsLine.scene, steps: [...stepsLine.scene.steps, { title: "Share", desc: "Send the clip to a teammate" }] } };
for (const [w, h] of [[1080, 1920], [1920, 1080]]) {
  test(`${w}×${h}: a steps scene with four steps and a result keeps every shape valid`, async () => {
    const d = await writeAndMeasure(`steps-${w}x${h}`, { ...gleaner, format: { width: w, height: h }, lines: [fourSteps] });
    assert.deepEqual(d.outside, []);
  });
}

// Far past the documented counts, rows used to get negative heights and moments ran off the slide.
const of = (/** @type {string} */ kind) => gleaner.lines.find((/** @type {any} */ l) => l.scene.kind === kind);
const times = (/** @type {any[]} */ a, /** @type {number} */ n) => Array.from({ length: n }, (_, i) => ({ ...a[i % a.length], cue: undefined }));
const crowded = [
  { ...of("list"), scene: { ...of("list").scene, items: times(of("list").scene.items, 25) } },
  { ...of("chat"), scene: { ...of("chat").scene, turns: times(of("chat").scene.turns, 25) } },
  { ...of("grid"), scene: { ...of("grid").scene, tiles: times(of("grid").scene.tiles, 40) } },
  { ...of("media"), scene: { ...of("media").scene, moments: times(of("media").scene.moments, 6) } },
];
for (const [w, h] of [[1080, 1920], [1920, 1080]]) {
  test(`${w}×${h}: crowded list, chat, grid and media scenes keep every shape valid and on the slide`, async () => {
    const d = await writeAndMeasure(`crowded-${w}x${h}`, { ...gleaner, format: { width: w, height: h }, lines: crowded });
    assert.deepEqual(d.outside, []);
  });
}
