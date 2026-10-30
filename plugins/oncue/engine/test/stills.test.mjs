// @ts-check
/**
 * Where the default stills land: after a late cue's entrance and inside the beat.
 * The pixels are checked in image-stills.test.mjs; this file needs no browser, so it also runs in CI.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import timeline from "../dist/timeline.js";

/** render.ts: the default entrance length, and how long before its end a scene starts to fade out. */
const ENTRANCE = 0.55, EXIT = 0.12;

const icon = "FiCheck";
const head = { kicker: "Kicker", title: "Title" };
const before = { vo: "Every clip you save lands here first.", scene: { kind: "hook", headline: "Save" } };
const after = { vo: "One more line follows it.", scene: { kind: "hook", headline: "After" } };
const vo = "Three of these arrive early, and the last waits patiently for the very closing word.";
const late = { word: "closing" };

/** The kinds that lost an element at the old fixed point, each with its last element cued late in the line. */
const beats = {
  grid: { ...head, kind: "grid", tiles: [{ icon, label: "One" }, { icon, label: "Two" }, { icon, label: "Three" }, { icon, label: "Four", cue: late }] },
  list: { ...head, kind: "list", items: [{ icon, title: "One" }, { icon, title: "Two" }, { icon, title: "Three", cue: late }] },
  media: { ...head, kind: "media", moments: [{ time: "0:01", label: "One" }, { time: "0:02", label: "Two" }, { time: "0:03", label: "Three", cue: late }] },
};

/** Timeline of a three-line spec with `line` in the middle, on estimated timing. @param {{ vo: string, scene: unknown }} line */
function timed(line) {
  const spec = /** @type {any} */ ({ lines: [before, line, after] });
  const est = timeline.estimateWords(spec);
  return timeline.buildTimeline(spec, est.words, est.seconds);
}

for (const [kind, scene] of Object.entries(beats)) {
  test(`${kind}: the default still comes after a late cue's entrance`, () => {
    const tl = timed({ vo, scene });
    assert.deepEqual(tl.warnings, []);
    const beat = tl.scenes[1];
    assert.ok(beat);
    const entered = Math.max(...Object.values(beat.cues)) + ENTRANCE;
    // Late enough that a fixed point at 85% of the beat caught this element on its way in.
    assert.ok(beat.start + 0.85 * (beat.end - beat.start) < entered);
    const t = timeline.stillTimes(tl)[1];
    assert.ok(t !== undefined && t >= entered, `${t} is before the last entrance ends at ${entered}`);
    assert.ok(t <= beat.end - EXIT + 0.005, `${t} is in the fade out of a beat ending at ${beat.end}`);
  });
}

test("every default still stays inside its beat, before the fade out", () => {
  const tl = timed({ vo, scene: beats.grid });
  const times = timeline.stillTimes(tl);
  assert.equal(times.length, 3);
  tl.scenes.forEach((s, i) => {
    const t = times[i];
    assert.ok(t !== undefined && t > s.start && t <= s.end - EXIT + 0.005, `${t} is outside ${s.start}–${s.end}`);
  });
});

test("a beat shorter than the fade out keeps its still at its own start", () => {
  const scene = { start: 2, end: 2.05, cues: {} };
  assert.deepEqual(timeline.stillTimes({ lead: 0, tail: 0, duration: 3, scenes: [scene], warnings: [] }), [2]);
});
