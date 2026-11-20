// @ts-check
/** A .pptx slide's own transition is read at import and played in the MP4: fade, push and wipe keep their motion, anything else fades. */
import { spawnSync } from "node:child_process";
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { COLOURS, makeProject, run } from "./helpers/make-deck.mjs";

const require = createRequire(import.meta.url);
const { readTransition } = require("../dist/slides.js");
const { xfadeKind } = require("../dist/assemble.js");
const { LEAD } = require("../dist/timeline.js");
const tmp = mkdtempSync(join(tmpdir(), "oncue-transitions-"));
after(() => rmSync(tmp, { recursive: true, force: true }));

const missing = ["ffmpeg", "ffprobe"].filter((bin) => spawnSync(bin, ["-version"]).error);
const skip = missing.length ? `${missing.join(" and ")} not installed, so transitions in the video are unverified on this machine` : false;

const sld = (/** @type {string} */ t) => `<p:sld><p:cSld><p:spTree/></p:cSld>${t}</p:sld>`;

test("readTransition reads fade, push and wipe with their direction and speed", () => {
  assert.deepEqual(readTransition(sld('<p:transition spd="slow"><p:fade/></p:transition>')), { kind: "fade", spd: "slow" });
  for (const dir of ["l", "r", "u", "d"]) {
    assert.deepEqual(readTransition(sld(`<p:transition><p:push dir="${dir}"/></p:transition>`)), { kind: "push", dir });
    assert.deepEqual(readTransition(sld(`<p:transition><p:wipe dir="${dir}"/></p:transition>`)), { kind: "wipe", dir });
  }
  assert.deepEqual(readTransition(sld("<p:transition><p:zoom/></p:transition>")), { kind: "zoom" });
});

test("readTransition takes the fallback of an mc:AlternateContent transition", () => {
  const xml = sld('<mc:AlternateContent><mc:Choice Requires="p14"><p:transition spd="slow" p14:dur="2000"><p14:vortex dir="r"/></p:transition></mc:Choice>' +
    '<mc:Fallback><p:transition spd="slow"><p:push dir="u"/></p:transition></mc:Fallback></mc:AlternateContent>');
  assert.deepEqual(readTransition(xml), { kind: "push", dir: "u", spd: "slow" });
});

test("an unrelated mc:AlternateContent before the transition does not hide it", () => {
  const shape = '<mc:AlternateContent><mc:Choice Requires="a14"><p:sp/></mc:Choice><mc:Fallback><p:sp/></mc:Fallback></mc:AlternateContent>';
  assert.deepEqual(readTransition(sld(`${shape}<p:transition><p:wipe dir="d"/></p:transition>`)), { kind: "wipe", dir: "d" });
  assert.deepEqual(readTransition(sld(`${shape}<mc:AlternateContent><mc:Choice Requires="p14"><p:transition><p14:vortex/></p:transition></mc:Choice>` +
    '<mc:Fallback><p:transition><p:push dir="r"/></p:transition></mc:Fallback></mc:AlternateContent>')), { kind: "push", dir: "r" });
});

test("readTransition is undefined with no transition, or an empty one", () => {
  assert.equal(readTransition(sld("")), undefined);
  assert.equal(readTransition(sld("<p:transition/>")), undefined);
});

test("xfadeKind maps push and wipe by direction and everything else to fade", () => {
  const dirs = { l: "left", r: "right", u: "up", d: "down" };
  for (const [d, w] of Object.entries(dirs)) {
    assert.equal(xfadeKind({ kind: "push", dir: d }), `slide${w}`);
    assert.equal(xfadeKind({ kind: "wipe", dir: d }), `wipe${w}`);
  }
  assert.equal(xfadeKind({ kind: "push" }), "slideleft");
  for (const t of [{ kind: "fade" }, { kind: "zoom" }, { kind: "cut" }, undefined]) assert.equal(xfadeKind(t), "fade");
});

// ---- end to end ----

/** Average colour of one half of the frame at `t`. @param {string} file @param {number} t @param {"left" | "right"} half */
const halfAt = (file, t, half) => [...spawnSync("ffmpeg", ["-v", "error", "-ss", t.toFixed(3), "-i", file, "-frames:v", "1",
  "-vf", `crop=iw/4:ih:${half === "left" ? "0" : "iw*3/4"}:0,scale=1:1`, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]).stdout];
const near = (/** @type {number[]} */ got, /** @type {number[]} */ want) => got.length === 3 && got.every((v, i) => Math.abs(v - want[i]) <= 16);

const SLIDES = [{ text: "A", transition: "<p:fade/>" }, { text: "B", transition: '<p:push dir="l"/>' }, { text: "C", transition: "<p:zoom/>" }];
const CUT = LEAD + 4; // three silent slides, each held 4 s; the first also holds the lead.

test("import records each slide's transition in slides.json", { skip }, async () => {
  const { out } = await makeProject(join(tmp, "json"), SLIDES);
  const { slides } = JSON.parse(readFileSync(join(out, "slides.json"), "utf8"));
  assert.deepEqual(slides.map((/** @type {any} */ s) => s.transition), [{ kind: "fade" }, { kind: "push", dir: "l" }, { kind: "zoom" }]);
});

test("a push left is a push in the MP4: mid-change the frame's two edges show different slides", { skip }, async () => {
  const { out } = await makeProject(join(tmp, "push"), SLIDES);
  const mp4 = join(out, "push.mp4"), cut = join(out, "cut.mp4");
  for (const [file, extra] of [[mp4, []], [cut, ["--fade", "0"]]]) {
    const res = run("assemble", out, "--out", /** @type {string} */ (file), .../** @type {string[]} */ (extra));
    assert.equal(res.status, 0, res.stderr);
  }
  const [a, b, c] = [COLOURS[0], COLOURS[1], COLOURS[2]];
  // A push left moves the old slide off to the left, so the new one enters from the right.
  const [left, right] = [halfAt(mp4, CUT, "left"), halfAt(mp4, CUT, "right")];
  assert.ok(near(left, a) && near(right, b), `at the cut expected slide 1 left and slide 2 right, got ${left} and ${right}`);
  // Slide 3's zoom is not supported, so it is a plain fade: both edges show the same blend.
  const [l3, r3] = [halfAt(mp4, CUT + 4, "left"), halfAt(mp4, CUT + 4, "right")];
  assert.ok(l3.every((v, i) => Math.abs(v - r3[i]) <= 8) && !near(l3, b) && !near(l3, c), `zoom became a blend: ${l3} / ${r3}`);
  // --fade 0 still cuts.
  assert.ok(near(halfAt(cut, CUT + 0.1, "left"), b) && near(halfAt(cut, CUT + 0.1, "right"), b), "--fade 0 is a hard cut");
});
