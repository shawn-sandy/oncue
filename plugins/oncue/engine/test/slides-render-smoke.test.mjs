// @ts-check
/** Real rendering through LibreOffice and poppler. Skipped, never passed, where either tool is missing. */
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makeDeck, run } from "./helpers/make-deck.mjs";

const require = createRequire(import.meta.url);
/** @type {typeof import("sharp")} */ const sharp = require("sharp");
const { findTool } = require("../dist/slides.js");
const missing = ["soffice", "pdftoppm"].filter((bin) => !findTool(bin));
const skip = missing.length ? `${missing.join(" and ")} not installed, so rendering is unverified on this machine` : false;
const tmp = mkdtempSync(join(tmpdir(), "oncue-render-"));
after(() => rmSync(tmp, { recursive: true, force: true }));

test("import renders one PNG per visible slide from a .pptx, and again from the PDF of it", { skip }, async () => {
  mkdirSync(join(tmp, "src"));
  const deck = await makeDeck(join(tmp, "src", "deck.pptx"));
  const out = join(tmp, "from-pptx");
  const res = run("import", deck, "--out", out);
  assert.equal(res.status, 0, res.stderr);
  assert.deepEqual(readdirSync(join(out, "pages")).sort(), ["slide-01.png", "slide-02.png", "slide-03.png"], "the hidden slide is not rendered");
  assert.equal(JSON.parse(readFileSync(join(out, "slides.json"), "utf8")).slides.length, 3);
  const page = sharp(join(out, "pages", "slide-01.png"));
  const { width = 0, height = 0 } = await page.metadata();
  assert.ok(Math.abs(width / height - 16 / 9) < 0.01, `${width}×${height}`);
  assert.ok((await page.stats()).channels.some((c) => c.stdev > 0), "the page is not blank");
  assert.deepEqual(readdirSync(join(tmp, "src")), ["deck.pptx"], "no lock file or export is left beside the deck");

  mkdirSync(join(tmp, "pdf"));
  const pdf = join(tmp, "pdf", "deck.pdf");
  copyFileSync(join(out, "work", "deck.pdf"), pdf);
  const fromPdf = run("import", pdf, "--out", join(tmp, "from-pdf"));
  assert.equal(fromPdf.status, 0, fromPdf.stderr);
  assert.equal(readdirSync(join(tmp, "from-pdf", "pages")).length, 3);
});
