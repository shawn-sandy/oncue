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
const dir = mkdtempSync(join(tmpdir(), "oncue-deck-"));
copyFileSync(new URL("logo.png", example), join(dir, "logo.png"));
after(() => rmSync(dir, { recursive: true, force: true }));

const EMU = 914400;
const sizes = [
  [1080, 1920, 5.625, 10],
  [1920, 1080, 10, 5.625],
  [1080, 1350, 5.625, 10],
];

for (const [w, h, sw, sh] of sizes) {
  test(`${w}×${h} spec writes a ${sw}×${sh} in deck with every shape on its slide`, async () => {
    const file = join(dir, `short-${w}x${h}.json`);
    const src = JSON.parse(readFileSync(new URL("short.json", example), "utf8"));
    writeFileSync(file, JSON.stringify({ ...src, format: { width: w, height: h } }));
    const out = join(dir, `deck-${w}x${h}.pptx`);
    await deck.writeDeck(spec.loadSpec(file), out);

    const zip = await JSZip.loadAsync(readFileSync(out));
    const pres = await zip.file("ppt/presentation.xml")?.async("string");
    const size = /<p:sldSz cx="(\d+)" cy="(\d+)"/.exec(pres ?? "");
    assert.ok(size, "presentation.xml has no p:sldSz");
    const [cx, cy] = [Number(size[1]), Number(size[2])];
    assert.deepEqual([cx, cy], [Math.round(sw * EMU), Math.round(sh * EMU)]);

    const slides = Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n));
    assert.equal(slides.length, src.lines.length);
    const outside = [];
    let shapes = 0;
    for (const name of slides) {
      const xml = (await zip.file(name)?.async("string")) ?? "";
      for (const m of xml.matchAll(/<a:off x="(-?\d+)" y="(-?\d+)"\/>\s*<a:ext cx="(-?\d+)" cy="(-?\d+)"\/>/g)) {
        const [x, y, ew, eh] = m.slice(1, 5).map(Number);
        shapes++;
        if (x < 0 || y < 0 || ew < 0 || eh < 0 || x + ew > cx || y + eh > cy) outside.push(`${name}: off ${x},${y} ext ${ew}×${eh}`);
      }
    }
    assert.ok(shapes > 9 * 4, `only ${shapes} shapes found; the offset pattern no longer matches the XML`);
    assert.deepEqual(outside, []);
  });
}
