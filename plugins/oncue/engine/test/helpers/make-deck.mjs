// @ts-check
/** Fixture decks and page pictures for the deck-to-video tests. Run directly to write a sample: node test/helpers/make-deck.mjs out.pptx */
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
/** @type {any} */ const PptxGenJS = require("pptxgenjs");
/** @type {typeof import("jszip")} */ const JSZip = require("jszip");
/** @type {typeof import("sharp")} */ const sharp = require("sharp");

export const cli = fileURLToPath(new URL("../../dist/cli.js", import.meta.url));
/** @param {string[]} args */
export const run = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" });

/** @typedef {{ text: string, notes?: string }} FixtureSlide */

/** Four slides: notes on 1 and 4, none on 2, slide 3 hidden. @type {FixtureSlide[]} */
export const FOUR = [
  { text: "First: Q&A", notes: "Welcome to the first slide. It has notes & an ampersand." },
  { text: "Second" },
  { text: "Third (hidden)", notes: "Nobody hears this." },
  { text: "Fourth", notes: "Thanks for watching." },
];

/**
 * Writes a .pptx. `hidden` and `order` are 1-based slide file numbers; `order` rewrites the presentation order.
 * @param {string} file @param {{ slides?: FixtureSlide[], hidden?: number[], order?: number[] }} [o]
 */
export async function makeDeck(file, { slides = FOUR, hidden = slides === FOUR ? [3] : [], order } = {}) {
  const pptx = new PptxGenJS();
  for (const s of slides) {
    const slide = pptx.addSlide();
    slide.addText(s.text, { x: 1, y: 1, w: 8, h: 1 });
    if (s.notes) slide.addNotes(s.notes);
  }
  const zip = await JSZip.loadAsync(await pptx.write({ outputType: "nodebuffer" }));
  for (const n of hidden) {
    const path = `ppt/slides/slide${n}.xml`;
    zip.file(path, (await zip.file(path).async("string")).replace("<p:sld ", '<p:sld show="0" '));
  }
  if (order) {
    const path = "ppt/presentation.xml";
    const xml = await zip.file(path).async("string");
    const ids = xml.match(/<p:sldId\b[^>]*\/>/g) ?? [];
    zip.file(path, xml.replace(/<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>/, `<p:sldIdLst>${order.map((n) => ids[n - 1]).join("")}</p:sldIdLst>`));
  }
  writeFileSync(file, await zip.generateAsync({ type: "nodebuffer" }));
  return file;
}

/** The same four slides as an OpenDocument presentation. @param {string} file */
export async function makeOdp(file) {
  const page = (/** @type {FixtureSlide} */ s, /** @type {number} */ i) =>
    `<draw:page draw:name="page${i + 1}" draw:style-name="${i === 2 ? "dp2" : "dp1"}"><draw:frame><draw:text-box><text:p>${s.text.replaceAll("&", "&amp;").replace(": ", ': <text:span>').replace(/$/, s.text.includes(": ") ? "</text:span>" : "")}</text:p></draw:text-box></draw:frame>` +
    `<presentation:notes><draw:page-thumbnail/>${s.notes ? `<draw:frame presentation:class="notes"><draw:text-box><text:p>${s.notes.replaceAll("&", "&amp;")}</text:p></draw:text-box></draw:frame>` : ""}</presentation:notes></draw:page>`;
  const zip = new JSZip();
  zip.file("mimetype", "application/vnd.oasis.opendocument.presentation");
  zip.file("content.xml", `<?xml version="1.0" encoding="UTF-8"?><office:document-content><office:automatic-styles>` +
    `<style:style style:name="dp1" style:family="drawing-page"><style:drawing-page-properties presentation:visibility="visible"/></style:style>` +
    `<style:style style:name="dp2" style:family="drawing-page"><style:drawing-page-properties presentation:visibility="hidden"/></style:style>` +
    `</office:automatic-styles><office:body><office:presentation>${FOUR.map(page).join("")}</office:presentation></office:body></office:document-content>`);
  writeFileSync(file, await zip.generateAsync({ type: "nodebuffer" }));
  return file;
}

/** A distinct solid colour per slide, far enough apart to survive video encoding. @type {[number, number, number][]} */
export const COLOURS = [[200, 30, 30], [30, 160, 60], [40, 60, 200], [220, 200, 40], [150, 40, 170], [30, 180, 190], [240, 130, 30], [110, 110, 110], [240, 240, 240]];

/** Writes `count` solid 1600×900 PNGs named so that natural order matters (page-2 before page-10). @param {string} dir @param {number} count */
export async function makePages(dir, count) {
  mkdirSync(dir, { recursive: true });
  for (let i = 0; i < count; i++) {
    const [r, g, b] = COLOURS[i % COLOURS.length];
    await sharp({ create: { width: 1600, height: 900, channels: 3, background: { r, g, b } } }).png().toFile(join(dir, `page-${i + 1}.png`));
  }
  return dir;
}

/**
 * Imports a fixture deck through the real CLI with ready-made page pictures. Returns the deck and its project folder.
 * @param {string} tmp @param {FixtureSlide[]} slides
 */
export async function makeProject(tmp, slides) {
  mkdirSync(join(tmp, "src"), { recursive: true });
  const deck = await makeDeck(join(tmp, "src", "deck.pptx"), { slides });
  const out = join(tmp, "project");
  const res = run("import", deck, "--out", out, "--pages", await makePages(join(tmp, "pictures"), slides.length));
  if (res.status !== 0) throw new Error(`import failed: ${res.stderr}`);
  return { deck, out };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) console.log("wrote", await makeDeck(process.argv[2] ?? "fixture.pptx"));
