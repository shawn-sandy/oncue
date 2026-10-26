// @ts-check
/** loadSpec is the trust boundary for format: sizes the encoder or the layouts can't handle fail with the field named. */
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import spec from "../dist/spec.js";

const example = JSON.parse(readFileSync(new URL("../examples/gleaner/short.json", import.meta.url), "utf8"));
const dir = mkdtempSync(join(tmpdir(), "oncue-format-"));
after(() => rmSync(dir, { recursive: true, force: true }));

let n = 0;
/** Writes the Gleaner spec with a different format and returns its path. @param {unknown} width @param {unknown} height */
function specAt(width, height) {
  const file = join(dir, `short-${n++}.json`);
  writeFileSync(file, JSON.stringify({ ...example, format: { width, height } }));
  return file;
}

/** [width, height, why, the field the error must name] */
const rejected = [
  [1081, 1920, "odd width", "format.width"],
  [1080.5, 1920, "non-integer width", "format.width"],
  ["1080", 1920, "string width", "format.width"],
  [0, 1920, "zero width", "format.width"],
  [240, 426, "under 320", "format.width"],
  [5000, 2812, "over 4096", "format.width"],
  [1920, 1081, "odd height", "format.height"],
  [1920, 1080.5, "non-integer height", "format.height"],
  [1920, "1080", "string height", "format.height"],
  [640, 300, "height under 320", "format.height"],
  [2048, 4100, "height over 4096", "format.height"],
  [1080, 3000, "beyond 2.4:1", "format"],
];
for (const [w, h, why, field] of rejected) {
  test(`rejects ${JSON.stringify(w)}×${JSON.stringify(h)} (${why}) naming ${field}`, () => {
    assert.throws(() => spec.loadSpec(specAt(w, h)), new RegExp(`^Error: short\\.json ${String(field).replace(".", "\\.")}: `));
  });
}

for (const [w, h] of [[1080, 1920], [1920, 1080], [1080, 1080], [3840, 2160]]) {
  test(`accepts ${w}×${h}`, () => {
    assert.deepEqual(spec.loadSpec(specAt(w, h)).spec.format, { width: w, height: h });
  });
}

test("stageFor keeps the short side at 1080 design px and picks the layout by orientation", () => {
  assert.deepEqual(spec.stageFor({ width: 1080, height: 1920 }), { wide: false, width: 1080, height: 1920, scale: 1 });
  assert.deepEqual(spec.stageFor({ width: 1920, height: 1080 }), { wide: true, width: 1920, height: 1080, scale: 1 });
  assert.deepEqual(spec.stageFor({ width: 3840, height: 2160 }), { wide: true, width: 1920, height: 1080, scale: 2 });
  assert.deepEqual(spec.stageFor({ width: 1080, height: 1080 }), { wide: false, width: 1080, height: 1080, scale: 1 });
});
