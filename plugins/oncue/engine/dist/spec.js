"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.plain = void 0;
exports.loadSpec = loadSpec;
exports.runs = runs;
/**
 * short.json — the single source of truth for one explainer.
 * The storyboard, the deck, the voiceover script and the animated video all read it.
 */
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const KINDS = new Set(["hook", "list", "card", "chat", "steps", "grid", "media", "cta"]);
const HEX = /^#[0-9a-fA-F]{6}$/;
function fail(path, msg) { throw new Error(`short.json ${path}: ${msg}`); }
function str(v, path) { if (typeof v !== "string" || !v.trim())
    fail(path, "must be a non-empty string"); }
/** Reads and checks short.json; every error names the field to fix. */
function loadSpec(file) {
    const spec = JSON.parse((0, node_fs_1.readFileSync)(file, "utf8"));
    str(spec.title, "title");
    if (!spec.format || !(spec.format.width > 0) || !(spec.format.height > 0))
        fail("format", "needs width and height");
    const b = spec.brand;
    if (!b)
        fail("brand", "is required");
    str(b.name, "brand.name");
    str(b.logo, "brand.logo");
    for (const [k, v] of Object.entries(b.colors ?? {}))
        if (!HEX.test(String(v)))
            fail(`brand.colors.${k}`, "must be #rrggbb");
    const needed = ["ground", "card", "chip", "rule", "ink", "muted", "accent", "highlight", "you", "panel", "panelInk", "panelMuted", "panelRule"];
    for (const k of needed)
        if (!b.colors?.[k])
            fail(`brand.colors.${k}`, "is required");
    str(b.fonts?.sans, "brand.fonts.sans");
    str(b.fonts?.mono, "brand.fonts.mono");
    str(b.deckFonts?.head, "brand.deckFonts.head");
    str(b.deckFonts?.body, "brand.deckFonts.body");
    if (!Array.isArray(spec.lines) || spec.lines.length === 0)
        fail("lines", "needs at least one line");
    spec.lines.forEach((l, i) => {
        str(l.vo, `lines[${i}].vo`);
        if (!l.scene || !KINDS.has(l.scene.kind))
            fail(`lines[${i}].scene.kind`, `must be one of ${[...KINDS].join(", ")}`);
    });
    const dir = (0, node_path_1.dirname)((0, node_path_1.resolve)(file));
    return { spec, dir, logoPath: (0, node_path_1.resolve)(dir, b.logo) };
}
function runs(rich) {
    const out = [];
    const re = /\{([^}]*)\}|`([^`]*)`|([^{`]+)/g;
    for (const m of rich.matchAll(re)) {
        if (m[1] !== undefined)
            out.push({ text: m[1], accent: true, code: false });
        else if (m[2] !== undefined)
            out.push({ text: m[2], accent: false, code: true });
        else if (m[3] !== undefined)
            out.push({ text: m[3], accent: false, code: false });
    }
    return out;
}
const plain = (rich) => runs(rich).map((r) => r.text).join("");
exports.plain = plain;
