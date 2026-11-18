// @ts-check
/** Narration becomes video timing: each slide runs from its first spoken word to the next slide's, and silent slides hold a fixed time. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { buildSlideTimeline, buildTimeline, planSlides, readWords, LEAD, TAIL } = require("../dist/timeline.js");
const { layout, DWELL } = require("../dist/assemble.js");
const { loadSpec } = require("../dist/spec.js");
const here = (/** @type {string} */ p) => new URL(p, import.meta.url);
const { spec } = loadSpec(here("../examples/gleaner/short.json").pathname);
const words = readWords(here("../examples/gleaner/words.json").pathname);
const SECONDS = 74.9;
const near = (/** @type {number} */ a, /** @type {number} */ b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`);

test("each slide spans its first word to the next slide's first word, matching the scene split", () => {
  const slides = spec.lines.map((/** @type {{ vo: string }} */ l, /** @type {number} */ i) => ({ n: i + 1, vo: l.vo }));
  const spans = buildSlideTimeline(slides, words, SECONDS);
  const scenes = buildTimeline(spec, words, SECONDS).scenes;
  assert.equal(spans.length, 9);
  assert.equal(spans[0].start, 0);
  spans.forEach((/** @type {any} */ s, /** @type {number} */ i) => {
    assert.equal(s.n, i + 1);
    if (i > 0) { near(s.start, scenes[i].start - LEAD); assert.equal(s.start, spans[i - 1].end); }
  });
  assert.equal(spans.at(-1).end, SECONDS);
});

test("a slide whose first word is never heard is an error naming it", () => {
  const slides = [{ n: 1, vo: "Ever read something great online?" }, { n: 7, vo: "Zebras were never mentioned." }];
  assert.throws(() => buildSlideTimeline(slides, words, SECONDS), /Slide 7\b/);
});

test("the video holds the lead on the first slide and the tail on the last, and audio from one take stays in one piece", () => {
  const spans = new Map([[1, { run: 1, start: 0, end: 5 }], [2, { run: 1, start: 5, end: 9 }]]);
  const l = layout([1, 2], spans);
  near(l.duration, 9 + LEAD + TAIL);
  assert.deepEqual(l.video, [{ n: 1, seconds: 5 + LEAD }, { n: 2, seconds: 4 + TAIL }]);
  assert.deepEqual(l.audio, [{ from: 0, to: LEAD }, { run: 1, from: 0, to: 9 }, { from: 0, to: TAIL }]);
});

test("a slide with no narration is held for the silent dwell, and the total grows by exactly that", () => {
  const spans = new Map([[1, { run: 1, start: 0, end: 5 }], [3, { run: 1, start: 5, end: 9 }]]);
  const without = layout([1, 3], spans), withSilent = layout([1, 2, 3], spans);
  assert.equal(DWELL, 4);
  near(withSilent.duration - without.duration, DWELL);
  assert.deepEqual(withSilent.video[1], { n: 2, seconds: DWELL });
  assert.deepEqual(withSilent.audio, [{ from: 0, to: LEAD }, { run: 1, from: 0, to: 5 }, { from: 0, to: DWELL }, { run: 1, from: 5, to: 9 }, { from: 0, to: TAIL }],
    "the take is cut at the slide boundary and silence is put in the gap");
});

test("a clean slide, an unplaceable notes slide and a clean slide become three takes, the notes unchanged", () => {
  const lines = [
    { n: 1, source: "notes", vo: "Hello world. So we start." },
    { n: 2, source: "notes", vo: "So we continue." },
    { n: 3, source: "notes", vo: "Finally we finish." },
  ];
  const plan = planSlides(lines);
  assert.deepEqual(plan.runs, [
    { kind: "run", slides: [1], script: "Hello world. So we start." },
    { kind: "clip", slides: [2], script: "So we continue." },
    { kind: "run", slides: [3], script: "Finally we finish." },
  ]);
  assert.equal(plan.warnings.length, 1);
  assert.match(plan.warnings[0], /slide 2\b.*slide 1\b/);
  assert.match(plan.warnings[0], /notes unchanged/);
});

test("slides that place cleanly share one take, across a silent slide, and a repeat the split walks past is fine", () => {
  const plan = planSlides([
    { n: 1, source: "notes", vo: "Tabs pile up. Notes get lost." },
    { n: 2, source: "none", vo: "" },
    { n: 3, source: "drafted", vo: "Gleaner fixes that. Tabs are saved." },
    { n: 4, source: "notes", vo: "Notes stay linked." },
  ]);
  assert.deepEqual(plan.runs.map((/** @type {any} */ r) => [r.kind, r.slides]), [["run", [1, 3, 4]]], "slide 4's Notes was heard in slide 1, but the split is already past it");
  assert.equal(plan.runs[0].script, "Tabs pile up. Notes get lost.\n\nGleaner fixes that. Tabs are saved.\n\nNotes stay linked.");
  assert.deepEqual(plan.warnings, []);
  assert.deepEqual(plan.silent, [2]);
});

test("an unplaceable drafted line is asked to be reworded", () => {
  const plan = planSlides([{ n: 1, source: "notes", vo: "Start here. Now look." }, { n: 2, source: "drafted", vo: "Now we go on." }]);
  assert.match(plan.warnings[0], /reword/);
  assert.doesNotMatch(plan.warnings[0], /notes unchanged/);
});
