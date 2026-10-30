// @ts-check
/**
 * `check` warns about a beat the transcript split would start inside an earlier beat, because its first word also
 * starts a sentence there. Repeats the split walks past stay silent, as they do in the Gleaner example.
 */
import { spawnSync } from "node:child_process";
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const example = new URL("../examples/gleaner/short.json", import.meta.url);
const gleaner = JSON.parse(readFileSync(example, "utf8"));
const dir = mkdtempSync(join(tmpdir(), "oncue-split-"));
after(() => rmSync(dir, { recursive: true, force: true }));

const cli = fileURLToPath(new URL("../dist/cli.js", import.meta.url));
/** Runs `check` on a spec file. @param {string} file */
const checkFile = (file) => spawnSync(process.execPath, [cli, "check", file], { encoding: "utf8" });
/** Runs `check` on the Gleaner spec with these voiceover lines. @param {string[]} vos */
function check(vos) {
  const file = join(dir, "short.json");
  writeFileSync(file, JSON.stringify({ ...gleaner, lines: vos.map((vo) => ({ vo, scene: gleaner.lines[0].scene })) }));
  return checkFile(file);
}

test("a beat opening on a sentence start in the beat before warns, naming both beats", () => {
  const run = check(["Did you water it yesterday? Fernleaf reminds you, plant by plant.", "Fernleaf is a phone app for houseplants."]);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stderr, /^warning: .*beat 2\b.*beat 1\b/m);
});

test("each beat the split would misplace warns, not only the first", () => {
  const { stderr } = check(["Start here. Tabs pile up. Notes get lost.", "Tabs are everywhere.", "Notes are nowhere."]);
  assert.match(stderr, /^warning: .*beat 2\b.*beat 1\b/m);
  assert.match(stderr, /^warning: .*beat 3\b.*beat 1\b/m);
});

for (const [name, vos] of /** @type {[string, string[]][]} */ ([
  ["two beats open on the same word", ["You save a page.", "You find it later."]],
  ["the word is only mid-sentence in the beat before", ["Try Fernleaf today.", "Fernleaf is a phone app."]],
  ["the sentence is in a beat the split has passed", ["It works on video. Gleaner saves moments.", "Keep clips anywhere.", "Gleaner is open source."]],
])) {
  test(`no warning when ${name}`, () => {
    const run = check(vos);
    assert.equal(run.status, 0, run.stderr);
    assert.equal(run.stderr, "");
  });
}

test("the Gleaner example stays warning-free", () => {
  const run = checkFile(fileURLToPath(example));
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stderr, "");
});

test("a line the split cannot find still passes check and keeps earlier beats' warnings", () => {
  // Beat 4 follows "why:", so the split skips ahead to the "Tabs" in beat 6 and beat 5 is never found.
  const run = check(["Alpha. Beta here.", "Beta there.", "Here is why:", "Tabs pile up.", "Notes pile up.", "Notes get lost. Tabs again."]);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stderr, /^warning: .*beat 2\b.*beat 1\b/m);
});
