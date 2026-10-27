"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.plain = exports.WIDE = exports.HEADERS = exports.SCALES = void 0;
exports.look = look;
exports.checkFormat = checkFormat;
exports.stageFor = stageFor;
exports.contrast = contrast;
exports.contrastWarnings = contrastWarnings;
exports.loadSpec = loadSpec;
exports.runs = runs;
/**
 * short.json — the single source of truth for one explainer.
 * The storyboard, the deck, the voiceover script and the animated video all read it.
 */
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
/**
 * Each theme value and its multiplier on today's design: radius on card corners, type on font sizes, density on
 * gaps and paddings, background on the glow's opacity. The default (×1) is today's look.
 */
exports.SCALES = {
    radius: { sharp: 0.2, soft: 0.55, round: 1 },
    type: { small: 0.9, regular: 1, large: 1.1 },
    density: { compact: 0.75, regular: 1, airy: 1.3 },
    background: { glow: 1, subtle: 0.4, flat: 0 },
};
/** What content scenes show above the kicker: logo and name, logo only, or nothing. */
exports.HEADERS = ["brand", "logo", "none"];
function look(spec) {
    const t = spec.theme ?? {};
    return {
        radius: exports.SCALES.radius[t.radius ?? "round"], type: exports.SCALES.type[t.type ?? "regular"],
        density: exports.SCALES.density[t.density ?? "regular"], background: exports.SCALES.background[t.background ?? "glow"],
        header: t.header ?? "brand",
    };
}
const KINDS = new Set(["hook", "list", "card", "chat", "steps", "grid", "media", "cta"]);
const HEX = /^#[0-9a-fA-F]{6}$/;
function fail(path, msg) { throw new Error(`short.json ${path}: ${msg}`); }
function str(v, path) { if (typeof v !== "string" || !v.trim())
    fail(path, "must be a non-empty string"); }
/** Sizes the H.264 encoder (yuv420p needs even sides) and both layouts can handle. */
function checkFormat(format) {
    const f = format;
    if (!f || typeof f !== "object")
        fail("format", "needs width and height");
    for (const k of ["width", "height"]) {
        const v = f[k];
        if (typeof v !== "number" || !Number.isInteger(v))
            fail(`format.${k}`, "must be a whole number of pixels");
        if (v < 320 || v > 4096)
            fail(`format.${k}`, `must be between 320 and 4096 (got ${v})`);
        if (v % 2)
            fail(`format.${k}`, `must be even, which H.264 video needs (got ${v})`);
    }
    const { width, height } = f;
    if (Math.max(width, height) / Math.min(width, height) > 2.4)
        fail("format", `the long side may be at most 2.4× the short side (got ${width}×${height})`);
}
function stageFor(format) {
    const wide = format.width > format.height;
    const scale = Math.min(format.width, format.height) / 1080;
    return { wide, width: format.width / scale, height: format.height / scale, scale };
}
exports.WIDE = {
    hook: "stack", list: "side", card: "side", chat: "side", steps: "side", grid: "top", media: "top", cta: "stack",
};
/** theme is optional; each key it has must be a known key with one of its listed values. */
function checkTheme(theme) {
    if (theme === undefined)
        return;
    if (!theme || typeof theme !== "object" || Array.isArray(theme))
        fail("theme", "must be an object such as { \"radius\": \"soft\" }");
    const choices = { ...Object.fromEntries(Object.entries(exports.SCALES).map(([k, v]) => [k, Object.keys(v)])), header: exports.HEADERS };
    for (const [k, v] of Object.entries(theme)) {
        const allowed = Object.hasOwn(choices, k) ? choices[k] : undefined;
        if (!allowed)
            fail(`theme.${k}`, `is not a theme key; use ${Object.keys(choices).join(", ")}`);
        if (!allowed.includes(v))
            fail(`theme.${k}`, `must be one of ${allowed.join(", ")}`);
    }
}
/** WCAG 2 contrast ratio of two #rrggbb colours, from 1 (same) to 21 (black on white). */
function contrast(a, b) {
    const lum = (hex) => {
        const [r, g, bl] = [1, 3, 5].map((i) => {
            const c = parseInt(hex.slice(i, i + 2), 16) / 255;
            return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
    };
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
}
/** Every text colour drawn on every fill, in the video or the deck: [text, fill]. */
const TEXT_PAIRS = [
    ["ink", "ground"], ["ink", "card"], ["muted", "ground"], ["muted", "card"], ["accent", "ground"], ["accent", "card"],
    ["highlight", "ground"], ["accent", "chip"], ["you", "card"], ["panelInk", "panel"], ["panelMuted", "panel"],
    // {accent} and `code` (ink, in the video) inside a card row's value.
    ["accent", "panel"], ["ink", "panel"],
    ["panelInk", "panelRule"], ["ground", "highlight"], ["ground", "accent"],
];
/** One warning per drawn pair under WCAG's 4.5:1 for text, naming both keys. */
function contrastWarnings(c) {
    return TEXT_PAIRS.flatMap(([text, fill]) => {
        const r = contrast(c[text], c[fill]);
        // Rounded down, so a failing 4.498 never prints as a passing-looking 4.50.
        return r < 4.5 ? [`brand.colors.${text} on brand.colors.${fill} is ${(Math.floor(r * 100) / 100).toFixed(2)}:1; text needs 4.5:1 or more.`] : [];
    });
}
/** Reads and checks short.json; every error names the field to fix. */
function loadSpec(file) {
    const spec = JSON.parse((0, node_fs_1.readFileSync)(file, "utf8"));
    str(spec.title, "title");
    checkFormat(spec.format);
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
    if (b.deckFonts.mono !== undefined)
        str(b.deckFonts.mono, "brand.deckFonts.mono");
    checkTheme(spec.theme);
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
