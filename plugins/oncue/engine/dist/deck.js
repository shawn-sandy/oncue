"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeDeck = writeDeck;
/**
 * Writes a native, editable .pptx from short.json: one slide per line, sized to the spec's aspect
 * (5.625" wide), each scene's final state, the line's voiceover in the speaker notes.
 */
const pptxgenjs_1 = __importDefault(require("pptxgenjs"));
const icons_1 = require("./icons");
const spec_1 = require("./spec");
const W = 5.625;
const M = 0.5;
const CW = W - M * 2;
const hex = (c) => c.replace("#", "");
async function writeDeck(loaded, outFile) {
    const { spec, logoPath } = loaded;
    const c = spec.brand.colors;
    const H = (W * spec.format.height) / spec.format.width;
    const head = spec.brand.deckFonts.head;
    const bodyFont = spec.brand.deckFonts.body;
    const pres = new pptxgenjs_1.default();
    pres.defineLayout({ name: "SHORT", width: W, height: H });
    pres.layout = "SHORT";
    pres.title = spec.title;
    pres.theme = { headFontFace: head, bodyFontFace: bodyFont };
    /** Rich text → pptxgenjs runs: accent in the accent colour, code in Courier New. */
    const rt = (text, base = {}) => (0, spec_1.runs)(text).map((r) => ({ text: r.text, options: { ...base, ...(r.accent ? { color: hex(c.accent) } : {}), ...(r.code ? { fontFace: "Courier New" } : {}) } }));
    const card = (s, x, y, w, h, fill, name) => {
        s.addShape(pres.ShapeType.roundRect, { x, y, w, h, fill: { color: hex(fill) }, line: { color: hex(fill), width: 0 }, rectRadius: 0.18, objectName: name });
    };
    const dot = async (s, icon, x, y, d = 0.7) => {
        s.addShape(pres.ShapeType.ellipse, { x, y, w: d, h: d, fill: { color: hex(c.highlight) }, line: { color: hex(c.highlight), width: 0 }, objectName: `dot-${icon}` });
        const p = d * 0.25;
        s.addImage({ data: await (0, icons_1.iconPng)(icon, c.panelInk), x: x + p, y: y + p, w: d - 2 * p, h: d - 2 * p, altText: icon });
    };
    const text = (s, t, o) => {
        s.addText(t, { margin: 0, isTextBox: true, fontFace: bodyFont, color: hex(c.ink), ...o });
    };
    const brandRow = (s) => {
        s.addImage({ path: logoPath, x: M, y: 0.45, w: 0.42, h: 0.42, altText: `${spec.brand.name} logo` });
        text(s, spec.brand.name, { x: M + 0.52, y: 0.45, w: 2.5, h: 0.42, fontSize: 15, bold: true, fontFace: head, valign: "middle" });
    };
    const header = (s, kicker, title) => {
        brandRow(s);
        text(s, kicker.toUpperCase(), { x: M, y: 1.35, w: CW, h: 0.4, fontSize: 13, bold: true, color: hex(c.accent), charSpacing: 2, fontFace: "Courier New" });
        text(s, rt(title), { x: M, y: 1.8, w: CW, h: 1.7, fontSize: 32, bold: true, fontFace: head, valign: "top" });
    };
    const top = 3.8;
    const bottom = H - 1.4; // keep clear of Shorts captions and buttons
    const slideFor = async (s, scene) => {
        switch (scene.kind) {
            case "hook":
                s.addImage({ path: logoPath, x: (W - 2.2) / 2, y: 1.6, w: 2.2, h: 2.2, altText: `${spec.brand.name} logo` });
                text(s, rt(scene.headline), { x: M, y: 4.2, w: CW, h: 2.3, fontSize: 40, bold: true, fontFace: head, align: "center", valign: "middle" });
                if (scene.sub)
                    text(s, rt(scene.sub, { color: hex(c.muted) }).map((r) => r.options?.["color"] === hex(c.accent) ? { ...r, options: { ...r.options, color: hex(c.highlight), bold: true } } : r), { x: M, y: 6.7, w: CW, h: 0.5, fontSize: 18, align: "center" });
                return;
            case "list": {
                const n = scene.items.length, gap = 0.2, h = Math.min(1.3, (bottom - top) / n - gap);
                for (const [i, it] of scene.items.entries()) {
                    const y = top + i * (h + gap);
                    card(s, M, y, CW, h, c.card, `item-${i}`);
                    await dot(s, it.icon, M + 0.3, y + (h - 0.7) / 2);
                    text(s, [{ text: it.title, options: { bold: true, fontSize: 20, breakLine: true } }, ...(it.desc ? rt(it.desc, { fontSize: 15, color: hex(c.muted) }) : [])], { x: M + 1.2, y: y + 0.1, w: CW - 1.4, h: h - 0.2, valign: "middle" });
                }
                return;
            }
            case "card": {
                const k = scene.card, rows = k.rows.length;
                const h = Math.min(bottom - top, 1.5 + rows * 0.8 + (k.tags?.length ? 0.6 : 0));
                card(s, M, top, CW, h, c.panel, "panel");
                const x = M + 0.35, w = CW - 0.7;
                text(s, k.title, { x, y: top + 0.3, w, h: 0.5, fontSize: 20, bold: true, color: hex(c.panelInk), fontFace: head });
                if (k.meta)
                    text(s, k.meta, { x, y: top + 0.8, w, h: 0.35, fontSize: 12, color: hex(c.panelMuted) });
                k.rows.forEach((r, i) => text(s, [{ text: r.label, options: { bold: true, color: hex(c.panelInk), breakLine: true } }, ...rt(r.value, { color: hex(c.panelMuted) })], { x, y: top + 1.35 + i * 0.8, w, h: 0.7, fontSize: 15, valign: "top" }));
                let tx = x;
                for (const t of k.tags ?? []) {
                    const tw = 0.3 + t.length * 0.1;
                    s.addShape(pres.ShapeType.roundRect, { x: tx, y: top + h - 0.7, w: tw, h: 0.4, fill: { color: hex(c.panelRule) }, line: { color: hex(c.panelRule), width: 0 }, rectRadius: 0.2 });
                    text(s, t, { x: tx, y: top + h - 0.7, w: tw, h: 0.4, fontSize: 12, color: hex(c.panelInk), align: "center", valign: "middle", fontFace: "Courier New" });
                    tx += tw + 0.15;
                }
                return;
            }
            case "chat": {
                const n = scene.turns.length, gap = 0.2, h = Math.min(0.95, (bottom - top) / n - gap), bw = 3.9;
                scene.turns.forEach((t, i) => {
                    const you = t.from === "you", y = top + i * (h + gap), x = you ? W - M - bw : M;
                    card(s, x, y, bw, h, you ? c.highlight : c.card, `turn-${i}`);
                    text(s, you ? [{ text: `“${t.text}”`, options: { color: hex(c.panelInk) } }] : [{ text: `${spec.brand.name.toLowerCase()} `, options: { bold: true, color: hex(c.accent) } }, { text: t.text }], { x: x + 0.25, y, w: bw - 0.5, h, fontSize: 15, valign: "middle" });
                });
                return;
            }
            case "steps": {
                const n = scene.steps.length + (scene.result ? 1 : 0), pitch = Math.min(1.55, (bottom - top) / n);
                scene.steps.forEach((st, i) => {
                    const y = top + i * pitch;
                    s.addShape(pres.ShapeType.ellipse, { x: M, y, w: 0.8, h: 0.8, fill: { color: hex(c.highlight) }, line: { color: hex(c.highlight), width: 0 } });
                    text(s, String(i + 1), { x: M, y, w: 0.8, h: 0.8, fontSize: 24, bold: true, color: hex(c.ground), align: "center", valign: "middle", fontFace: head });
                    text(s, [{ text: st.title, options: { bold: true, fontSize: 20, breakLine: true } }, ...(st.desc ? rt(st.desc, { fontSize: 15, color: hex(c.muted) }) : [])], { x: M + 1.1, y: y - 0.05, w: CW - 1.1, h: 1.1, valign: "top" });
                    if (i < scene.steps.length - 1)
                        s.addShape(pres.ShapeType.line, { x: M + 0.4, y: y + 0.9, w: 0, h: pitch - 1.0, line: { color: hex(c.muted), width: 2, dashType: "dash" } });
                });
                if (scene.result) {
                    const y = top + scene.steps.length * pitch;
                    card(s, M, y, CW, 0.8, c.panel, "result");
                    text(s, `✓  ${scene.result.text}`, { x: M + 0.3, y, w: CW - 0.6, h: 0.8, fontSize: 16, bold: true, color: hex(c.panelInk), valign: "middle" });
                }
                return;
            }
            case "grid": {
                const cols = 2, gw = (CW - 0.3) / cols, rowsN = Math.ceil(scene.tiles.length / cols), gh = Math.min(1.35, (bottom - top) / rowsN - 0.25);
                for (const [i, t] of scene.tiles.entries()) {
                    const x = M + (i % cols) * (gw + 0.3), y = top + Math.floor(i / cols) * (gh + 0.25);
                    card(s, x, y, gw, gh, c.card, `tile-${i}`);
                    await dot(s, t.icon, x + 0.25, y + 0.25, 0.55);
                    text(s, t.label, { x: x + 0.25, y: y + gh - 0.5, w: gw - 0.4, h: 0.4, fontSize: 15, bold: true, valign: "middle" });
                }
                return;
            }
            case "media": {
                card(s, M, top, CW, 2.0, c.card, "player");
                await dot(s, "FiPlay", (W - 1.0) / 2, top + 0.5, 1.0);
                scene.moments.forEach((m, i) => {
                    const y = top + 2.3 + i * 0.7;
                    s.addShape(pres.ShapeType.roundRect, { x: M, y, w: 1.0, h: 0.5, fill: { color: hex(c.chip) }, line: { color: hex(c.chip), width: 0 }, rectRadius: 0.25 });
                    text(s, m.time, { x: M, y, w: 1.0, h: 0.5, fontSize: 14, bold: true, color: hex(c.accent), align: "center", valign: "middle", fontFace: "Courier New" });
                    text(s, m.label, { x: M + 1.2, y, w: CW - 1.2, h: 0.5, fontSize: 16, valign: "middle" });
                });
                return;
            }
            case "cta":
                s.addImage({ path: logoPath, x: (W - 1.6) / 2, y: 1.5, w: 1.6, h: 1.6, altText: `${spec.brand.name} logo` });
                text(s, rt(scene.headline), { x: M, y: 3.4, w: CW, h: 1.0, fontSize: 42, bold: true, fontFace: head, align: "center", valign: "middle" });
                if (scene.sub)
                    text(s, rt(scene.sub, { color: hex(c.muted) }), { x: M, y: 4.4, w: CW, h: 0.5, fontSize: 18, align: "center" });
                if (scene.pill) {
                    card(s, M, 5.3, CW, 1.1, c.card, "pill");
                    await dot(s, scene.pill.icon, M + 0.25, 5.5);
                    text(s, scene.pill.text, { x: M + 1.1, y: 5.3, w: CW - 1.25, h: 1.1, fontSize: 16, bold: true, valign: "middle" });
                }
                if (scene.follow)
                    text(s, rt(scene.follow, { color: hex(c.accent) }), { x: M, y: 6.8, w: CW, h: 0.5, fontSize: 16, align: "center" });
                return;
        }
    };
    for (const line of spec.lines) {
        const s = pres.addSlide();
        s.background = { color: hex(c.ground) };
        const sc = line.scene;
        if (sc.kind !== "hook" && sc.kind !== "cta")
            header(s, sc.kicker, sc.title);
        await slideFor(s, sc);
        s.addNotes(line.vo);
    }
    await pres.writeFile({ fileName: outFile });
    return outFile;
}
