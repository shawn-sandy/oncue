// @ts-check
/**
 * Theme tokens: loadSpec checks `theme` and `brand.deckFonts.mono`, `check` warns on low-contrast colour pairs,
 * and both renderers follow each token. A spec without a theme renders as before.
 */
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import deck from "../dist/deck.js";
import scenes from "../dist/scenes.js";
import spec from "../dist/spec.js";

const engine = fileURLToPath(new URL("..", import.meta.url));
const example = new URL("../examples/gleaner/", import.meta.url);
const gleaner = JSON.parse(readFileSync(new URL("short.json", example), "utf8"));
const dir = mkdtempSync(join(tmpdir(), "oncue-theme-"));
copyFileSync(new URL("logo.png", example), join(dir, "logo.png"));
after(() => rmSync(dir, { recursive: true, force: true }));

const VALUES = {
  radius: ["sharp", "soft", "round"],
  type: ["small", "regular", "large"],
  density: ["compact", "regular", "airy"],
  background: ["glow", "subtle", "flat"],
  header: ["brand", "logo", "none"],
};
const DEFAULTS = { radius: "round", type: "regular", density: "regular", background: "glow", header: "brand" };
const CONTENT_SCENES = gleaner.lines.filter((/** @type {any} */ l) => l.scene.kind !== "hook" && l.scene.kind !== "cta").length;

let n = 0;
/** Writes a spec beside the Gleaner logo and returns its path. @param {Record<string, any>} short */
function write(short) {
  const file = join(dir, `short-${n++}.json`);
  writeFileSync(file, JSON.stringify(short));
  return file;
}
/** The Gleaner spec with a theme (and optional brand overrides). @param {unknown} theme @param {Record<string, any>} [brand] */
const themed = (theme, brand = {}) => ({ ...gleaner, theme, brand: { ...gleaner.brand, ...brand } });

/** Writes the scenes page for a spec and returns its HTML. @param {Record<string, any>} short */
function page(short) {
  return readFileSync(scenes.writeScenes(spec.loadSpec(write(short)), join(dir, `scenes-${n++}`), engine), "utf8");
}
/** One property of one CSS rule in the scenes page, e.g. prop(html, ".card", "border-radius") → "36px". */
function prop(/** @type {string} */ html, /** @type {string} */ selector, /** @type {string} */ name) {
  const sel = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[}\\n])${sel}\\{(?:[^}]*?;)?${name}:([^;}]+)`, "m").exec(html)?.[1];
}

/** Writes the deck for a spec and returns each slide's XML, in order. @param {Record<string, any>} short */
async function slides(short) {
  const out = join(dir, `deck-${n++}.pptx`);
  await deck.writeDeck(spec.loadSpec(write(short)), out);
  const zip = await JSZip.loadAsync(readFileSync(out));
  const names = Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))
    .sort((a, b) => Number(/\d+/.exec(a)?.[0]) - Number(/\d+/.exec(b)?.[0]));
  return Promise.all(names.map(async (f) => (await zip.file(f)?.async("string")) ?? ""));
}
const LIST = gleaner.lines.findIndex((/** @type {any} */ l) => l.scene.kind === "list");
const CHAT = gleaner.lines.findIndex((/** @type {any} */ l) => l.scene.kind === "chat");
/** Corner `adj` values of every rounded rectangle on a slide. @param {string} xml */
const corners = (xml) => [...xml.matchAll(/prst="roundRect">\s*<a:avLst>\s*<a:gd name="adj" fmla="val (\d+)"/g)].map((m) => Number(m[1]));
/** Point size (in hundredths) of the run holding `text`. @param {string} xml @param {string} text */
const size = (xml, text) => Number(new RegExp(`<a:rPr[^>]*sz="(\\d+)"(?:(?!</a:r>).)*<a:t>${text}`, "s").exec(xml)?.[1]);
/** Top edges (EMU) of the rounded rectangles on a slide, in order. @param {string} xml */
const tops = (xml) => [...xml.matchAll(/<a:off x="\d+" y="(\d+)"\/>\s*<a:ext cx="\d+" cy="\d+"\/>\s*<\/a:xfrm>\s*<a:prstGeom prst="roundRect"/g)].map((m) => Number(m[1]));

// loadSpec

for (const key of Object.keys(VALUES)) {
  test(`rejects an unknown theme.${key} value, naming the field and the allowed values`, () => {
    const allowed = VALUES[/** @type {keyof typeof VALUES} */ (key)].join(", ");
    assert.throws(() => spec.loadSpec(write(themed({ [key]: "pill" }))), new RegExp(`theme\\.${key}\\b.*${allowed}`));
  });
}

test("rejects an unknown theme key, naming it", () => {
  assert.throws(() => spec.loadSpec(write(themed({ shape: "round" }))), /theme\.shape\b/);
});

// JSON.parse keeps "__proto__" as an own key, and both names exist on every object's prototype.
for (const key of ["toString", "__proto__"]) {
  test(`rejects theme key ${key}, naming it`, () => {
    const file = write(gleaner);
    writeFileSync(file, readFileSync(file, "utf8").replace(/^\{/, `{"theme":{"${key}":"round"},`));
    assert.throws(() => spec.loadSpec(file), new RegExp(`short\\.json theme\\.${key}\\b`));
  });
}

for (const bad of ["round", [], null, 3]) {
  test(`rejects theme ${JSON.stringify(bad)}, which is not an object`, () => {
    assert.throws(() => spec.loadSpec(write(themed(bad))), /short\.json theme: /);
  });
}

test("accepts every theme value, and no theme", () => {
  for (const [key, values] of Object.entries(VALUES)) for (const v of values) assert.equal(spec.loadSpec(write(themed({ [key]: v }))).spec.theme?.[key], v);
  assert.equal(spec.loadSpec(write(gleaner)).spec.theme, undefined);
});

test("brand.deckFonts.mono is optional but must be a font name when given", () => {
  assert.throws(() => spec.loadSpec(write(themed(undefined, { deckFonts: { ...gleaner.brand.deckFonts, mono: "" } }))), /brand\.deckFonts\.mono/);
  assert.throws(() => spec.loadSpec(write(themed(undefined, { deckFonts: { ...gleaner.brand.deckFonts, mono: 5 } }))), /brand\.deckFonts\.mono/);
  assert.equal(spec.loadSpec(write(themed(undefined, { deckFonts: { ...gleaner.brand.deckFonts, mono: "Menlo" } }))).spec.brand.deckFonts.mono, "Menlo");
});

// Contrast

test("contrast follows the WCAG formula", () => {
  assert.equal(spec.contrast("#000000", "#ffffff").toFixed(2), "21.00");
  assert.equal(spec.contrast("#767676", "#ffffff").toFixed(2), "4.54");
  assert.equal(spec.contrast("#ffffff", "#767676"), spec.contrast("#767676", "#ffffff"));
  assert.equal(spec.contrast("#336699", "#336699"), 1);
});

test("the Gleaner palette has no low-contrast pair", () => {
  assert.deepEqual(spec.contrastWarnings(gleaner.brand.colors), []);
});

test("a drawn pair under 4.5:1 warns naming both keys", () => {
  const c = gleaner.brand.colors;
  // muted as dark as card is also too dark on ground; only pairs drawing muted may warn.
  const warnings = spec.contrastWarnings({ ...c, muted: c.card });
  assert.ok(warnings.every((w) => /colors\.muted\b/.test(w)), warnings.join("\n"));
  assert.ok(warnings.some((w) => /muted\b.*\bcard\b/.test(w)), warnings.join("\n"));
  assert.match(spec.contrastWarnings({ ...c, highlight: c.ground }).join("\n"), /ground\b.*\bhighlight\b/);
  // {accent} and `code` inside a card row's value sit on the panel.
  assert.match(spec.contrastWarnings({ ...c, panel: "#226e63" }).join("\n"), /accent on brand\.colors\.panel\b/);
  assert.match(spec.contrastWarnings({ ...c, ink: c.panel }).join("\n"), /ink on brand\.colors\.panel\b/);
});

test("a ratio just under 4.5:1 never prints as 4.50:1", () => {
  // #b5502b on #f6f1e7 is 4.498:1: rounding to two places would print a failing pair as passing.
  const c = { ...gleaner.brand.colors, ground: "#f6f1e7", highlight: "#b5502b" };
  assert.ok(spec.contrast(c.highlight, c.ground) < 4.5);
  const w = spec.contrastWarnings(c).find((x) => /highlight on brand\.colors\.ground\b/.test(x));
  assert.ok(w, "no warning for highlight on ground");
  assert.match(w, / 4\.49:1/);
});

test("check prints contrast warnings for a weak palette and none for Gleaner", () => {
  const run = (/** @type {string} */ file) => spawnSync(process.execPath, ["dist/cli.js", "check", file], { cwd: engine, encoding: "utf8" });
  const good = run(write(gleaner));
  assert.equal(good.status, 0, good.stderr);
  assert.doesNotMatch(good.stderr, /warning/);
  const weak = run(write(themed(undefined, { colors: { ...gleaner.brand.colors, muted: gleaner.brand.colors.card } })));
  assert.equal(weak.status, 0, weak.stderr);
  assert.match(weak.stderr, /warning:.*muted\b.*\bcard\b/);
});

// Scenes page

test("no theme and a theme listing every default write the same scenes page and deck", async () => {
  assert.equal(page(themed(DEFAULTS)), page(gleaner));
  assert.deepEqual(await slides(themed(DEFAULTS)), await slides(gleaner));
});

test("radius scales card corners and leaves pills round", () => {
  assert.equal(prop(page(gleaner), ".card", "border-radius"), "36px");
  assert.equal(prop(page(themed({ radius: "soft" })), ".card", "border-radius"), "19.8px");
  const sharp = page(themed({ radius: "sharp" }));
  assert.equal(prop(sharp, ".card", "border-radius"), "7.2px");
  assert.equal(prop(sharp, ".panel", "border-radius"), "8.8px");
  assert.equal(prop(sharp, ".pill", "border-radius"), "999px");
});

test("type scales every font size", () => {
  assert.equal(prop(page(gleaner), "h2", "font-size"), "80px");
  const large = page(themed({ type: "large" }));
  assert.equal(prop(large, "h2", "font-size"), "88px");
  assert.equal(prop(large, ".kicker", "font-size"), "35.2px");
  assert.equal(prop(page(themed({ type: "small" })), "h2", "font-size"), "72px");
});

test("density scales gaps and paddings, not the frame margins", () => {
  assert.equal(prop(page(gleaner), ".stack", "gap"), "30px");
  const airy = page(themed({ density: "airy" }));
  assert.equal(prop(airy, ".stack", "gap"), "39px");
  assert.equal(prop(airy, ".content", "left"), "90px");
  assert.equal(prop(page(themed({ density: "compact" })), ".stack", "gap"), "22.5px");
});

test("background: glow keeps three lights, subtle dims them, flat has none", () => {
  const count = (/** @type {string} */ html) => (html.match(/class="blob /g) ?? []).length;
  const glow = page(gleaner);
  assert.equal(count(glow), 3);
  assert.equal(prop(glow, ".blob", "opacity"), "0.55");
  const subtle = page(themed({ background: "subtle" }));
  assert.equal(count(subtle), 3);
  assert.equal(prop(subtle, ".blob", "opacity"), "0.22");
  assert.equal(count(page(themed({ background: "flat" }))), 0);
});

test("header: brand shows logo and name, logo drops the name, none drops the row", () => {
  const rows = (/** @type {string} */ html) => [...html.matchAll(/<div class="brand">(.*?)<\/div>/g)].map((m) => m[1] ?? "");
  const brand = rows(page(gleaner));
  assert.equal(brand.length, CONTENT_SCENES);
  assert.ok(brand.every((r) => r.includes("<img") && r.includes(gleaner.brand.name)));
  const logo = rows(page(themed({ header: "logo" })));
  assert.equal(logo.length, CONTENT_SCENES);
  assert.ok(logo.every((r) => r.includes("<img") && !r.includes(gleaner.brand.name)));
  assert.equal(rows(page(themed({ header: "none" }))).length, 0);
});

// Deck

test("objective: sharp, no header and flat change both outputs", async () => {
  const theme = { radius: "sharp", header: "none", background: "flat" };
  const html = page(themed(theme));
  assert.doesNotMatch(html, /class="blob /);
  assert.doesNotMatch(html, /class="brand"/);
  assert.equal(prop(html, ".card", "border-radius"), "7.2px");
  const [base, sharp] = await Promise.all([slides(gleaner), slides(themed(theme))]);
  const was = corners(base[LIST] ?? ""), now = corners(sharp[LIST] ?? "");
  assert.ok(was.length >= 3, `only ${was.length} rounded shapes on the list slide`);
  assert.deepEqual(now.map((v, i) => Math.abs(v - (was[i] ?? 0) / 5) <= 1), was.map(() => true), `${now} vs ${was}`);
  assert.match(base[LIST] ?? "", /<a:t>Gleaner<\/a:t>/);
  assert.doesNotMatch(sharp[LIST] ?? "", /<a:t>Gleaner<\/a:t>/);
  assert.doesNotMatch(sharp[LIST] ?? "", /descr="Gleaner logo"/);
});

test("deck: radius leaves the call-to-action pill's corners alone", async () => {
  const last = (/** @type {string[]} */ d) => corners(d[d.length - 1] ?? "");
  const [base, sharp] = await Promise.all([slides(gleaner), slides(themed({ radius: "sharp" }))]);
  assert.ok(last(base).length > 0, "no rounded shapes on the cta slide");
  assert.deepEqual(last(sharp), last(base));
});

test("deck: header logo keeps the logo and drops the name", async () => {
  const [s] = [(await slides(themed({ header: "logo" })))[LIST] ?? ""];
  assert.match(s, /descr="Gleaner logo"/);
  assert.doesNotMatch(s, /<a:t>Gleaner<\/a:t>/);
});

test("deck: type scales point sizes", async () => {
  const [base, large, small] = await Promise.all([slides(gleaner), slides(themed({ type: "large" })), slides(themed({ type: "small" }))]);
  assert.equal(size(base[LIST] ?? "", "THE PROBLEM"), 1300);
  assert.equal(size(large[LIST] ?? "", "THE PROBLEM"), 1430);
  assert.equal(size(base[LIST] ?? "", "Saving things"), 3200);
  assert.equal(size(large[LIST] ?? "", "Saving things"), 3520);
  assert.equal(size(small[LIST] ?? "", "Saving things"), 2880);
});

test("deck: density spreads or closes up the list rows", async () => {
  const pitch = (/** @type {string[]} */ deckXml) => { const t = tops(deckXml[LIST] ?? ""); return (t[1] ?? 0) - (t[0] ?? 0); };
  const [base, airy, compact] = await Promise.all([slides(gleaner), slides(themed({ density: "airy" })), slides(themed({ density: "compact" }))]);
  assert.equal(pitch(base), Math.round(1.5 * 914400), "Gleaner's list rows sit 1.5 in apart, as before themes");
  assert.ok(pitch(airy) > pitch(base) && pitch(base) > pitch(compact), `${pitch(compact)} < ${pitch(base)} < ${pitch(airy)}`);
});

test("deck: deckFonts.mono sets the mono runs, Courier New without it", async () => {
  const menlo = (await slides(themed(undefined, { deckFonts: { ...gleaner.brand.deckFonts, mono: "Menlo" } })))[LIST] ?? "";
  assert.match(menlo, /typeface="Menlo"/);
  assert.doesNotMatch(menlo, /Courier New/);
  assert.match((await slides(gleaner))[LIST] ?? "", /typeface="Courier New"/);
});

test("deck: font names with XML characters are escaped once, in the slides and the theme", async () => {
  const out = join(dir, `deck-${n++}.pptx`);
  await deck.writeDeck(spec.loadSpec(write(themed(undefined, { deckFonts: { head: "A&B Sans", body: "Calibri", mono: "M<N> \"Mono\"" } }))), out);
  const zip = await JSZip.loadAsync(readFileSync(out));
  const parts = await Promise.all(Object.keys(zip.files).filter((f) => /^ppt\/(slides\/slide\d+|theme\/theme\d+)\.xml$/.test(f))
    .map(async (f) => [f, (await zip.file(f)?.async("string")) ?? ""]));
  // pptxgenjs writes fontFace into typeface="…" as is: a bare & or a stray quote makes the XML malformed.
  const bad = parts.filter(([, xml]) => /&(?!(?:amp|lt|gt|quot|apos);|#\d+;)|typeface="[^"]*[<>][^"]*"/.test(xml)).map(([f]) => f);
  assert.deepEqual(bad, []);
  const all = parts.map(([, xml]) => xml).join("\n");
  assert.match(all, /typeface="A&amp;B Sans"/);
  assert.match(all, /typeface="M&lt;N&gt; &quot;Mono&quot;"/);
});

test("deck: the you bubble's text is the ground colour on highlight", async () => {
  const chat = (await slides(gleaner))[CHAT] ?? "";
  const you = /<a:rPr[^>]*>\s*<a:solidFill>\s*<a:srgbClr val="([0-9A-F]{6})"\/>(?:(?!<\/a:r>).)*<a:t>“/s.exec(chat);
  assert.ok(you, "no you bubble text on the chat slide");
  assert.equal(you[1], gleaner.brand.colors.ground.slice(1).toUpperCase());
});
