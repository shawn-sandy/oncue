// @ts-check
/** Slide order, hidden slides, speaker notes and slide text are read from the deck's own XML, where file numbers are not slide order. */
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FOUR, makeDeck, makeOdp, makePages } from "./helpers/make-deck.mjs";

const { readDeck, importDeck } = createRequire(import.meta.url)("../dist/slides.js");
const tmp = mkdtempSync(join(tmpdir(), "oncue-notes-"));
after(() => rmSync(tmp, { recursive: true, force: true }));

/** @param {{ n: number, deck: number, notes: string, text: string }[]} slides */
function sameAsFixture(slides) {
  assert.deepEqual(slides.map((s) => [s.n, s.deck]), [[1, 1], [2, 2], [3, 4]], "the hidden third slide is skipped");
  assert.deepEqual(slides.map((s) => s.notes), [FOUR[0].notes, "", FOUR[3].notes], "notes as written, entities decoded, slide-number field left out");
  assert.deepEqual(slides.map((s) => s.text), ["First: Q&A", "Second", "Fourth"]);
}

test("a .pptx gives visible slides in order with their notes and text", async () => {
  sameAsFixture(await readDeck(await makeDeck(join(tmp, "four.pptx"))));
});

test("presentation order wins over slide file numbers", async () => {
  const slides = await readDeck(await makeDeck(join(tmp, "reordered.pptx"), { order: [4, 2, 3, 1] }));
  assert.deepEqual(slides.map((s) => s.text), ["Fourth", "Second", "First: Q&A"]);
  assert.deepEqual(slides.map((s) => s.notes), [FOUR[3].notes, "", FOUR[0].notes]);
  assert.deepEqual(slides.map((s) => s.deck), [1, 2, 4]);
});

test("an .odp gives the same order, hidden state, notes and text", async () => {
  sameAsFixture(await readDeck(await makeOdp(join(tmp, "four.odp"))));
});

test("an unsupported file type is refused by name", async () => {
  writeFileSync(join(tmp, "old.ppt"), "x");
  await assert.rejects(readDeck(join(tmp, "old.ppt")), /\.pptx/);
});

test("a PDF skips deck reading: one slide per page picture, in natural page order, with no notes", async () => {
  mkdirSync(join(tmp, "pdf"));
  const src = join(tmp, "pdf", "deck.pdf");
  writeFileSync(src, "%PDF-1.4\n");
  const out = join(tmp, "pdf-out");
  const pictures = await makePages(join(tmp, "pdf-pictures"), 11);
  const slides = await importDeck(src, out, pictures);
  assert.deepEqual(slides.map((s) => s.n), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  assert.ok(slides.every((s) => s.notes === "" && s.text === ""));
  assert.equal(slides[1].page, "pages/slide-02.png");
  assert.deepEqual(readFileSync(join(out, slides[1].page)), readFileSync(join(pictures, "page-2.png")), "page-2 sorts before page-10");
  assert.deepEqual(JSON.parse(readFileSync(join(out, "slides.json"), "utf8")).slides, slides);
});

test("page pictures that do not match the visible slide count are refused, naming both counts", async () => {
  const deck = await makeDeck(join(tmp, "count.pptx"));
  mkdirSync(join(tmp, "count-src"));
  const out = join(tmp, "count-out");
  await assert.rejects(importDeck(deck, out, await makePages(join(tmp, "count-pictures"), 4)), /3 .*4|4 .*3/);
  assert.equal(existsSync(join(out, "slides.json")), false);
});
