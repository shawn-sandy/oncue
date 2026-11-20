// @ts-check
/** Slides fade into each other over `--fade` seconds centred on the old cut, and the video keeps its length. */
import { spawnSync } from "node:child_process";
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { COLOURS, makeProject, run } from "./helpers/make-deck.mjs";

const { fadePlan, joinFilters, FADE } = createRequire(import.meta.url)("../dist/assemble.js");
const { LEAD } = createRequire(import.meta.url)("../dist/timeline.js");
const tmp = mkdtempSync(join(tmpdir(), "oncue-crossfade-"));
after(() => rmSync(tmp, { recursive: true, force: true }));

const missing = ["ffmpeg", "ffprobe"].filter((bin) => spawnSync(bin, ["-version"]).error);
const skip = missing.length ? `${missing.join(" and ")} not installed, so the fade is unverified on this machine` : false;

const secs = (/** @type {number[]} */ s) => s.map((seconds) => ({ seconds }));
const sum = (/** @type {number[]} */ a) => a.reduce((t, v) => t + v, 0);

test("FADE defaults to half a second", () => assert.equal(FADE, 0.5));

test("output frames equal round(duration × fps) for fades of 0, 0.5 and 2 s", () => {
  const video = secs([4.3, 4, 5.6]);
  for (const fade of [0, 0.5, 2]) {
    const p = fadePlan(video, fade, 30);
    assert.equal(sum(p.frames) - sum(p.fades.map((/** @type {any} */ f) => f.frames)), Math.round(13.9 * 30), `fade ${fade}`);
  }
});

test("each fade starts fade/2 before its cut and is fade long", () => {
  const p = fadePlan(secs([4.3, 4, 5.6]), 0.5, 30);
  assert.deepEqual(p.fades, [{ start: 129 - 7, frames: 15 }, { start: 249 - 7, frames: 15 }]);
  assert.deepEqual(p.frames, [129 + 8, 120 + 7 + 8, 168 + 7], "each still lasts until its outgoing fade ends and starts when its incoming fade starts");
});

test("a fade of 0 leaves the cuts and no fade frames", () => {
  const p = fadePlan(secs([4.3, 4, 5.6]), 0, 30);
  assert.deepEqual(p.frames, [129, 120, 168]);
  assert.ok(p.fades.every((/** @type {any} */ f) => f.frames === 0));
});

test("every still covers each fade it takes part in, so the xfade chain needs no padding frame", () => {
  for (const [lengths, fade] of [[[4.3, 4, 5.6], 0.5], [[1.37, 2.11, 0.4, 3.9], 1], [[0.1, 0.2, 0.1], 2]]) {
    const p = fadePlan(secs(lengths), fade, 30);
    let start = 0;
    p.fades.forEach((/** @type {any} */ f, /** @type {number} */ i) => {
      assert.ok(f.start + f.frames <= start + p.frames[i], `still ${i + 1} ends before fade ${i + 1} does`);
      start = f.start;
    });
  }
});

test("a fade shortened by one short neighbour stays centred on its cut", () => {
  const lengths = [4.3, 0.2, 5.6];
  const p = fadePlan(secs(lengths), 2, 30);
  let cut = 0;
  p.fades.forEach((/** @type {any} */ f, /** @type {number} */ i) => {
    cut += lengths[i];
    assert.ok(f.frames > 0, `fade ${i + 1} kept`);
    assert.equal(f.start + Math.floor(f.frames / 2), Math.round(cut * 30), `fade ${i + 1} centred`);
  });
});

test("one slide has no fades", () => assert.deepEqual(fadePlan(secs([3]), 0.5, 30), { frames: [90], fades: [] }));

test("a slide shorter than the fade gets fades that never overlap inside it, and never start before frame 0", () => {
  const p = fadePlan(secs([0.1, 0.2, 0.1]), 2, 30);
  assert.ok(p.fades[0].start >= 0);
  p.fades.slice(1).forEach((/** @type {any} */ f, /** @type {number} */ i) =>
    assert.ok(p.fades[i].start + p.fades[i].frames <= f.start, `fade ${i + 1} runs into fade ${i + 2}`));
  assert.equal(sum(p.frames) - sum(p.fades.map((/** @type {any} */ f) => f.frames)), 12);
});

test("rounding does not drift across 40 slides of uneven length", () => {
  const lengths = Array.from({ length: 40 }, (_, i) => 1.37 + ((i * 7) % 11) / 13);
  const p = fadePlan(secs(lengths), 0.5, 30);
  let cut = 0;
  p.fades.forEach((/** @type {any} */ f, /** @type {number} */ i) => {
    cut += lengths[i];
    assert.equal(f.start + Math.floor(f.frames / 2), Math.round(cut * 30), `cut ${i + 1}`);
  });
  assert.equal(sum(p.frames) - sum(p.fades.map((/** @type {any} */ f) => f.frames)), Math.round(sum(lengths) * 30));
});

// ---- end to end ----

test("a one-frame slide joins with a cut, not a zero-length xfade, and keeps the planned frame count", { skip }, () => {
  const lengths = [4.3, 1 / 30, 1 / 30, 5.6];
  const p = fadePlan(secs(lengths), 0.5, 30);
  assert.ok(p.fades.some((/** @type {any} */ f) => f.frames === 0), "the one-frame slides leave no room for a fade");
  const colours = ["red", "green", "blue", "yellow"];
  const inputs = p.frames.flatMap((/** @type {number} */ n, /** @type {number} */ i) => ["-f", "lavfi", "-i", `color=${colours[i]}:s=64x64:r=30,trim=end_frame=${n}`]);
  const graph = [...p.frames.map((/** @type {any} */ _, /** @type {number} */ i) => `[${i}:v]setpts=PTS-STARTPTS[v${i}]`), ...joinFilters(p.fades, ["fade", "fade", "fade"], 30)].join(";");
  const out = spawnSync("ffmpeg", ["-hide_banner", ...inputs, "-filter_complex", graph, "-map", "[v]", "-f", "null", "-"], { encoding: "utf8" });
  assert.equal(out.status, 0, out.stderr);
  const frames = Number(/frame=\s*(\d+)(?![\s\S]*frame=)/.exec(out.stderr)?.[1]);
  assert.equal(frames, Math.round(lengths.reduce((t, v) => t + v, 0) * 30));
});

/** @param {string} file */
const seconds = (file) => Number(spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { encoding: "utf8" }).stdout.trim());
/** @param {string} file */
const videoFrames = (file) => Number(spawnSync("ffprobe", ["-v", "error", "-select_streams", "v", "-count_frames", "-show_entries", "stream=nb_read_frames", "-of", "csv=p=0", file], { encoding: "utf8" }).stdout.trim());
/** @param {string} file @param {number} t */
const colourAt = (file, t) => [...spawnSync("ffmpeg", ["-v", "error", "-ss", t.toFixed(3), "-i", file, "-frames:v", "1", "-vf", "scale=1:1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]).stdout];
const near = (/** @type {number[]} */ got, /** @type {number[]} */ want) => got.length === 3 && got.every((v, i) => Math.abs(v - want[i]) <= 16);
const blend = (/** @type {number[]} */ got, /** @type {number[]} */ a, /** @type {number[]} */ b) =>
  got.length === 3 && got.every((v, i) => Math.abs(a[i] - b[i]) < 64 || (v > Math.min(a[i], b[i]) + 16 && v < Math.max(a[i], b[i]) - 16));

const CUT = LEAD + 4; // three silent slides: each is held 4 s, the first also holds the lead.

test("the first slide change is a blend, settled 0.4 s later, same length as --fade 0, and --fade 1 is still mid-fade after 0.3 s", { skip }, async () => {
  const { out } = await makeProject(join(tmp, "fade"), [{ text: "A" }, { text: "B" }, { text: "C" }]);
  const files = { fade: join(out, "fade.mp4"), cut: join(out, "cut.mp4"), long: join(out, "long.mp4") };
  for (const [file, extra] of [[files.fade, []], [files.cut, ["--fade", "0"]], [files.long, ["--fade", "1"]]]) {
    const res = run("assemble", out, "--out", /** @type {string} */ (file), .../** @type {string[]} */ (extra));
    assert.equal(res.status, 0, res.stderr);
  }
  const [a, b] = [COLOURS[0], COLOURS[1]];
  const mid = colourAt(files.fade, CUT);
  assert.ok(blend(mid, a, b), `at the cut expected a blend of ${a} and ${b}, got ${mid}`);
  assert.ok(near(colourAt(files.fade, CUT + 0.4), b), "0.4 s after the cut the second slide is settled");
  assert.ok(near(colourAt(files.cut, CUT + 0.1), b), "--fade 0 is a hard cut");
  assert.ok(blend(colourAt(files.long, CUT + 0.3), a, b), "--fade 1 is still blending 0.3 s after the cut, where 0.5 s has settled");
  for (const f of [files.cut, files.long]) assert.equal(videoFrames(f), videoFrames(files.fade), `${f} has the same number of frames`);
});

test("--fade rejects a non-number, a negative, more than 5 and a missing value, naming it", { skip }, async () => {
  const { out } = await makeProject(join(tmp, "bad"), [{ text: "A" }, { text: "B" }]);
  for (const [value, shown] of [["abc", '"abc"'], ["-1", '"-1"'], ["6", '"6"'], [undefined, '""']]) {
    const res = value === undefined ? run("assemble", out, "--fade") : run("assemble", out, "--fade", value);
    assert.notEqual(res.status, 0, `--fade ${value}`);
    assert.ok(res.stderr.includes(shown), `${value}: ${res.stderr}`);
  }
});
