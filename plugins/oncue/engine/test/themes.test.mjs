// @ts-check
/**
 * Every preset in themes/, in every mode: the Gleaner lines plus the preset load, pass every contrast pair,
 * resolve their fonts and render the look the preset asks for. Adding a theme is one JSON file, and this is its guard.
 */
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import scenes from "../dist/scenes.js";
import spec from "../dist/spec.js";

const engine = fileURLToPath(new URL("..", import.meta.url));
const themesDir = join(engine, "themes");
const example = new URL("../examples/gleaner/", import.meta.url);
const gleaner = JSON.parse(readFileSync(new URL("short.json", example), "utf8"));
const dir = mkdtempSync(join(tmpdir(), "oncue-themes-"));
copyFileSync(new URL("logo.png", example), join(dir, "logo.png"));
after(() => rmSync(dir, { recursive: true, force: true }));

let presets = /** @type {string[]} */ ([]);
try { presets = readdirSync(themesDir).filter((f) => f.endsWith(".json")); } catch { /* no folder: the next test fails */ }

test("at least one preset ships in themes/", () => {
  assert.ok(presets.length > 0, `no *.json in ${themesDir}`);
});

for (const file of presets) {
  const preset = JSON.parse(readFileSync(join(themesDir, file), "utf8"));
  for (const [mode, { colors }] of Object.entries(preset.modes ?? {})) {
    test(`${file} ${mode}: loads, passes contrast, resolves fonts and renders its look`, async () => {
      const short = { ...gleaner, brand: { ...gleaner.brand, colors, fonts: preset.fonts, deckFonts: preset.deckFonts }, theme: preset.theme };
      const path = join(dir, `${file}-${mode}.json`);
      writeFileSync(path, JSON.stringify(short));
      const loaded = spec.loadSpec(path);
      assert.deepEqual(spec.contrastWarnings(loaded.spec.brand.colors), []);
      // writeScenes throws "Font file missing" when a preset names a font that is not installed.
      const html = readFileSync(await scenes.writeScenes(loaded, join(dir, `scenes-${file}-${mode}`), engine), "utf8");
      if (preset.theme?.stroke === "hairline") assert.match(html, /\.card\{[^}]*border:1px solid/);
      if (preset.theme?.weight === "semibold") assert.match(html, /h1,h2\{[^}]*font-weight:600/);
    });
  }
}
