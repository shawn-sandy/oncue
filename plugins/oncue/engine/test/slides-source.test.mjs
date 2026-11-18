// @ts-check
/** The original deck is never changed: work happens on a copy, and a checksum and modified time prove it afterwards. */
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { appendFileSync, chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { makeDeck, makePages, run } from "./helpers/make-deck.mjs";

const { guardSource, verifySource } = createRequire(import.meta.url)("../dist/slides.js");
const tmp = mkdtempSync(join(tmpdir(), "oncue-source-"));
after(() => rmSync(tmp, { recursive: true, force: true }));

/** @param {string} file */
const sha = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
/** A fresh deck in its own folder. @param {string} name */
async function fixture(name) {
  mkdirSync(join(tmp, name));
  return makeDeck(join(tmp, name, "deck.pptx"));
}
/** @param {string} out */
const manifest = (out) => JSON.parse(readFileSync(join(out, "source-manifest.json"), "utf8"));

test("a read-only source is copied, the callback sees only the copy, and the manifest proves it unchanged", async () => {
  const src = await fixture("readonly");
  chmodSync(src, 0o444);
  const before = { sha: sha(src), mtime: statSync(src).mtimeMs };
  const out = join(tmp, "readonly-out");
  const seen = await guardSource(src, out, (/** @type {string} */ copy) => {
    assert.notEqual(copy, src);
    assert.ok(copy.startsWith(join(out, "work")), copy);
    appendFileSync(copy, "x"); // the copy is ours to change
    return copy;
  });
  assert.ok(existsSync(seen));
  assert.deepEqual({ sha: sha(src), mtime: statSync(src).mtimeMs }, before);
  const m = manifest(out);
  assert.equal(m.unchanged, true);
  assert.equal(m.sha256, before.sha);
  assert.equal(m.mtimeMs, before.mtime);
  assert.doesNotThrow(() => verifySource(out));
});

test("a source that changes during the run fails it, and the manifest says so", async () => {
  const src = await fixture("mutated");
  const out = join(tmp, "mutated-out");
  await assert.rejects(guardSource(src, out, () => appendFileSync(src, "x")), /changed/);
  assert.equal(manifest(out).unchanged, false);
});

test("a source that changes after import fails the later commands", async () => {
  const src = await fixture("later");
  const out = join(tmp, "later-out");
  await guardSource(src, out, () => {});
  appendFileSync(src, "x");
  assert.throws(() => verifySource(out), /changed/);
});

test("an output folder equal to the source's own folder is refused before anything is written", async () => {
  const src = await fixture("same");
  await assert.rejects(guardSource(src, dirname(src), () => {}), /folder/);
  assert.equal(existsSync(join(dirname(src), "work")), false);
  const cli = run("import", src, "--out", dirname(src), "--pages", await makePages(join(tmp, "same-pages"), 3));
  assert.notEqual(cli.status, 0);
  assert.match(cli.stderr, /folder/);
  assert.equal(existsSync(join(dirname(src), "slides.json")), false);
});

test("a PDF is guarded the same way", async () => {
  mkdirSync(join(tmp, "pdf"));
  const src = join(tmp, "pdf", "deck.pdf");
  writeFileSync(src, "%PDF-1.4\n% fixture\n");
  const before = sha(src);
  const out = join(tmp, "pdf-out");
  await guardSource(src, out, () => {});
  assert.equal(sha(src), before);
  assert.equal(manifest(out).unchanged, true);
});
