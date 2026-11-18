// @ts-check
/**
 * The whole route: a .pptx with speaker notes plus an approved narration and a recorded voiceover becomes an MP4 whose
 * slides change on the narrated words, and the .pptx is byte-for-byte unchanged. Needs ffmpeg and ffprobe, not LibreOffice:
 * the page pictures are supplied.
 */
import { spawnSync } from "node:child_process";
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { appendFileSync, copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { COLOURS, makeProject, run } from "./helpers/make-deck.mjs";

const { buildSlideTimeline, readWords, LEAD, TAIL } = createRequire(import.meta.url)("../dist/timeline.js");
const example = (/** @type {string} */ f) => fileURLToPath(new URL(`../examples/gleaner/${f}`, import.meta.url));
const tmp = mkdtempSync(join(tmpdir(), "oncue-deck-video-"));
after(() => rmSync(tmp, { recursive: true, force: true }));

/** @param {string} file */
const fingerprint = (file) => ({ sha: createHash("sha256").update(readFileSync(file)).digest("hex"), mtime: statSync(file).mtimeMs });
/** @param {string} file */
const seconds = (file) => Number(spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { encoding: "utf8" }).stdout.trim());
/** @param {string} file */
function streams(file) {
  const out = spawnSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type,codec_name,width,height,r_frame_rate", "-of", "json", file], { encoding: "utf8" });
  return JSON.parse(out.stdout).streams;
}
/** The average colour of the frame at `t`. @param {string} file @param {number} t */
function colourAt(file, t) {
  const out = spawnSync("ffmpeg", ["-v", "error", "-ss", t.toFixed(3), "-i", file, "-frames:v", "1", "-vf", "scale=1:1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]);
  return [...out.stdout];
}
/** @param {string} file @param {number} t @param {number} slide 1-based */
function showsSlide(file, t, slide) {
  const got = colourAt(file, t), want = COLOURS[slide - 1];
  assert.ok(got.length === 3 && got.every((v, i) => Math.abs(v - want[i]) <= 16), `at ${t.toFixed(2)}s expected slide ${slide} ${want}, got ${got}`);
}
const approve = (/** @type {string} */ out) => writeFileSync(join(out, "narration.md"), readFileSync(join(out, "narration.md"), "utf8").replace("approved: false", "approved: true"));
/** @param {string} out */
const manifest = (out) => JSON.parse(readFileSync(join(out, "source-manifest.json"), "utf8"));

test("a deck with notes and the Gleaner voiceover becomes a 1920×1080 MP4 with each slide on its words, source untouched", async () => {
  const vo = JSON.parse(readFileSync(example("short.json"), "utf8")).lines.map((/** @type {{ vo: string }} */ l) => l.vo);
  const { deck, out } = await makeProject(join(tmp, "gleaner"), vo.map((/** @type {string} */ notes, /** @type {number} */ i) => ({ text: `Slide ${i + 1}`, notes })));
  const before = fingerprint(deck);
  approve(out);
  const script = run("narration", out, "--approved");
  assert.equal(script.status, 0, script.stderr);
  copyFileSync(example("voiceover.mp3"), join(out, "voiceover-01.mp3"));
  copyFileSync(example("words.json"), join(out, "words-01.json"));

  const res = run("assemble", out);
  assert.equal(res.status, 0, res.stderr);
  const mp4 = join(out, "deck.mp4");
  const [video, audio] = streams(mp4).sort((/** @type {any} */ a) => (a.codec_type === "video" ? -1 : 1));
  assert.deepEqual([video.codec_name, video.width, video.height, video.r_frame_rate, audio.codec_name], ["h264", 1920, 1080, "30/1", "aac"]);
  const audioSeconds = seconds(example("voiceover.mp3"));
  assert.ok(Math.abs(seconds(mp4) - (audioSeconds + LEAD + TAIL)) < 0.1, `${seconds(mp4)}s vs ${audioSeconds} + ${LEAD} + ${TAIL}`);

  const spans = buildSlideTimeline(vo.map((/** @type {string} */ v, /** @type {number} */ i) => ({ n: i + 1, vo: v })), readWords(example("words.json")), audioSeconds);
  for (const s of spans) showsSlide(mp4, LEAD + (s.start + s.end) / 2, s.n);
  showsSlide(mp4, 0.05, 1);
  showsSlide(mp4, LEAD + spans[1].start + 0.15, 2);
  showsSlide(mp4, LEAD + spans[1].start - 0.15, 1);

  assert.deepEqual(fingerprint(deck), before, "the deck's checksum and modified time are unchanged");
  assert.deepEqual([manifest(out).unchanged, manifest(out).sha256], [true, before.sha]);
});

test("a fallback clip between two takes, and a silent slide, land in slide order with the right total", async () => {
  const { deck, out } = await makeProject(join(tmp, "runs"), [
    { text: "A", notes: "Hello world. So we start." },
    { text: "B", notes: "So we continue." },
    { text: "C" },
    { text: "D", notes: "Finally we finish." },
  ]);
  const before = fingerprint(deck);
  approve(out);
  const plan = run("narration", out, "--approved");
  assert.equal(plan.status, 0, plan.stderr);
  const runs = JSON.parse(readFileSync(join(out, "recording-plan.json"), "utf8")).runs;
  assert.deepEqual(runs.map((/** @type {any} */ r) => [r.kind, r.slides]), [["run", [1]], ["clip", [2]], ["run", [4]]]);

  const silent = run("assemble", out);
  assert.equal(silent.status, 0, silent.stderr);
  assert.ok(existsSync(join(out, "preview-silent.mp4")), "with no recordings the result is a silent preview");
  assert.equal(streams(join(out, "preview-silent.mp4")).some((/** @type {any} */ s) => s.codec_type === "audio"), true);

  const lengths = [2, 1.5, 2.5];
  runs.forEach((/** @type {any} */ r, /** @type {number} */ k) => {
    const tone = spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", `sine=frequency=${300 + 200 * k}:duration=${lengths[k]}`, join(out, r.audio)]);
    assert.equal(tone.status, 0, String(tone.stderr));
    const texts = r.script.split(/\s+/);
    writeFileSync(join(out, r.words), JSON.stringify({ words: texts.map((/** @type {string} */ text, /** @type {number} */ i) => ({ text, type: "word", start: 0.1 + i * 0.25, end: 0.3 + i * 0.25 })) }));
  });
  const clips = runs.map((/** @type {any} */ r) => seconds(join(out, r.audio)));

  const res = run("assemble", out);
  assert.equal(res.status, 0, res.stderr);
  const mp4 = join(out, "deck.mp4");
  const total = clips[0] + clips[1] + 4 + clips[2] + LEAD + TAIL;
  assert.ok(Math.abs(seconds(mp4) - total) < 0.1, `${seconds(mp4)}s vs ${total}s`);
  showsSlide(mp4, LEAD + clips[0] / 2, 1);
  showsSlide(mp4, LEAD + clips[0] + clips[1] / 2, 2);
  showsSlide(mp4, LEAD + clips[0] + clips[1] + 2, 3);
  showsSlide(mp4, LEAD + clips[0] + clips[1] + 4 + clips[2] / 2, 4);
  assert.deepEqual(fingerprint(deck), before);

  rmSync(join(out, "voiceover-02.mp3"));
  const partial = run("assemble", out);
  assert.notEqual(partial.status, 0, "a take that is missing is an error, not a silent gap");
  assert.match(partial.stderr, /voiceover-02\.mp3/);
});

test("a deck that changed after import stops narration and assemble", async () => {
  const { deck, out } = await makeProject(join(tmp, "changed"), [{ text: "A", notes: "Hello there." }]);
  appendFileSync(deck, "x");
  for (const cmd of ["narration", "assemble"]) {
    const res = run(cmd, out);
    assert.notEqual(res.status, 0, cmd);
    assert.match(res.stderr, /changed/);
  }
  assert.equal(existsSync(join(out, "preview-silent.mp4")), false);
});
