// @ts-check
/** narration.md holds one line per slide and an approval flag; nothing is recorded until the person sets it. */
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FOUR, makeProject, run } from "./helpers/make-deck.mjs";

const { formatNarration, parseNarration } = createRequire(import.meta.url)("../dist/narration.js");
const tmp = mkdtempSync(join(tmpdir(), "oncue-narration-"));
after(() => rmSync(tmp, { recursive: true, force: true }));

/** @param {string} out @param {(md: string) => string} change */
function edit(out, change) {
  const file = join(out, "narration.md");
  writeFileSync(file, change(readFileSync(file, "utf8")));
}
const approve = (/** @type {string} */ md) => md.replace("approved: false", "approved: true");

test("narration.md round-trips with a source marker per slide", () => {
  const slides = [
    { n: 1, deck: 1, page: "pages/slide-01.png", notes: "First para.\n\nSecond para.", text: "Title" },
    { n: 2, deck: 2, page: "pages/slide-02.png", notes: "", text: "Bullets --> here" },
  ];
  const md = formatNarration(slides);
  assert.deepEqual(parseNarration(md), {
    approved: false,
    lines: [{ n: 1, source: "notes", vo: "First para. Second para." }, { n: 2, source: "none", vo: "" }],
  }, "the slide text shown as a drafting hint is not narration");
  const drafted = md.replace("## Slide 2 (none)", "## Slide 2 (drafted)\n\nA drafted line.");
  assert.deepEqual(parseNarration(approve(drafted)).lines[1], { n: 2, source: "drafted", vo: "A drafted line." });
  assert.equal(parseNarration(approve(drafted)).approved, true);
});

test("a comment marker hidden inside another comment never becomes narration", () => {
  const md = "---\napproved: false\n---\n\n## Slide 1 (none)\n\n<!<!-- a -->-- hidden -->\n";
  assert.deepEqual(parseNarration(md).lines, [{ n: 1, source: "none", vo: "" }]);
});

test("import writes the deck's notes verbatim and marks slides without notes", async () => {
  const { out } = await makeProject(join(tmp, "import"), FOUR.filter((_, i) => i !== 2));
  const { lines } = parseNarration(readFileSync(join(out, "narration.md"), "utf8"));
  assert.deepEqual(lines.map((l) => [l.source, l.vo]), [["notes", FOUR[0].notes], ["none", ""], ["notes", FOUR[3].notes]]);
});

test("narration --approved exits non-zero until narration.md says approved: true", async () => {
  const { out } = await makeProject(join(tmp, "gate"), [{ text: "A", notes: "Hello there." }, { text: "B", notes: "Goodbye now." }]);
  const blocked = run("narration", out, "--approved");
  assert.notEqual(blocked.status, 0);
  assert.match(blocked.stderr, /approved: true/);
  assert.equal(blocked.stdout, "", "no script is handed over before approval");
  assert.equal(run("narration", out).status, 0, "reading the draft needs no approval");
  edit(out, approve);
  const ok = run("narration", out, "--approved");
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /Hello there\.\s+Goodbye now\./);
  assert.deepEqual(JSON.parse(readFileSync(join(out, "recording-plan.json"), "utf8")).runs.map((/** @type {any} */ r) => [r.kind, r.slides, r.audio, r.words]),
    [["run", [1, 2], "voiceover-01.mp3", "words-01.json"]]);
});

test("an opening word already heard at a sentence start in an earlier slide warns, naming both slides", async () => {
  const { out } = await makeProject(join(tmp, "repeat"), [{ text: "A", notes: "Hello world. So we start." }, { text: "B", notes: "So we continue." }]);
  const res = run("narration", out);
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stderr, /^warning: .*slide 2\b.*slide 1\b/m);
  assert.match(res.stderr, /own clip/);
});

test("slides with no narration are listed with their silent hold", async () => {
  const { out } = await makeProject(join(tmp, "blank"), [{ text: "A", notes: "Hello there." }, { text: "B" }, { text: "C", notes: "Goodbye now." }]);
  const res = run("narration", out);
  assert.match(res.stdout, /slide 2\b.*no narration.*4 ?s/i);
});

test("a section whose marker and text disagree, or a missing section, is an error naming the slide", async () => {
  const { out } = await makeProject(join(tmp, "bad"), [{ text: "A", notes: "Hello there." }, { text: "B" }]);
  edit(out, (md) => md.replace("## Slide 2 (none)", "## Slide 2 (none)\n\nText without a marker change."));
  const mismatch = run("narration", out);
  assert.notEqual(mismatch.status, 0);
  assert.match(mismatch.stderr, /[Ss]lide 2\b.*drafted/);
  edit(out, (md) => md.slice(0, md.indexOf("## Slide 2")));
  const missing = run("narration", out);
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /1 .*2|2 .*1/);
});

test("notes edited in narration.md but still marked notes warn, since notes are used as written", async () => {
  const { out } = await makeProject(join(tmp, "edited"), [{ text: "A", notes: "Hello there." }]);
  edit(out, (md) => md.replace("Hello there.", "Hello everyone."));
  assert.match(run("narration", out).stderr, /^warning: .*slide 1\b.*notes/m);
});

test("notes that read as reminders to the presenter are flagged, naming the slide, and ordinary notes are not", async () => {
  const { out } = await makeProject(join(tmp, "reminders"), [
    { text: "A", notes: "Open with the problem in one line:\nPeople lose what they read." },
    { text: "B", notes: "Personal anecdote: the time I lost a link. [pause]" },
    { text: "C", notes: "Here is the thing. It saves every page you read." },
  ]);
  const { stderr } = run("narration", out);
  assert.match(stderr, /^warning: slide 1\b.*reminder/m);
  assert.match(stderr, /^warning: slide 2\b.*reminder/m);
  assert.doesNotMatch(stderr, /^warning: slide 3\b/m);
});

test("text a voice would read badly is flagged before recording, naming the slide and the words", async () => {
  const { out } = await makeProject(join(tmp, "spoken"), [
    { text: "A", notes: "Run /triage-stats since YYYY-MM-DD for the numbers." },
    { text: "B", notes: "It costs $0.00014 a call, with a 200K context and 1M on Opus." },
    { text: "C", notes: "See example.com or use the --verbose flag and my_config." },
    { text: "D", notes: "Plain sentences, read as written. It costs ten cents." },
  ]);
  const { stderr } = run("narration", out);
  const line = (/** @type {number} */ n) => stderr.split("\n").find((l) => l.startsWith(`warning: slide ${n} `) && /read/.test(l)) ?? "";
  for (const word of ["/triage-stats", "YYYY-MM-DD"]) assert.ok(line(1).includes(word), line(1));
  for (const word of ["$0.00014", "200K", "1M"]) assert.ok(line(2).includes(word), line(2));
  for (const word of ["example.com", "--verbose", "my_config"]) assert.ok(line(3).includes(word), line(3));
  assert.equal(line(4), "");
});
