"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deckSize = deckSize;
exports.writeDeck = writeDeck;
/**
 * Writes a native, editable .pptx from short.json: one slide per line, each scene's final state, the line's
 * voiceover in the speaker notes. The slide snaps to the two sizes its layouts are drawn for: 5.625×10 in
 * for portrait and square specs, 10×5.625 in for landscape ones, arranged per scene kind like the video (WIDE).
 */
const pptxgenjs_1 = __importDefault(require("pptxgenjs"));
const icons_1 = require("./icons");
const spec_1 = require("./spec");
const M = 0.5;
const hex = (c) => c.replace("#", "");
/** pptxgenjs writes font names into typeface="…" unescaped, so a name with & < > or " would break the XML. */
const xmlAttr = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/** Slide size in inches, by the spec's orientation only; custom aspects apply to the video. */
function deckSize(format) {
    return (0, spec_1.stageFor)(format).wide ? { width: 10, height: 5.625 } : { width: 5.625, height: 10 };
}
/**
 * Where a content scene's kicker and title (head) and body go. Portrait is the original 9:16 slide, its body
 * kept clear of Shorts captions and buttons; landscape follows the scene kind's arrangement.
 */
function contentBoxes(W, H, wide, arr) {
    if (!wide)
        return { head: { x: M, y: 1.35, w: W - M * 2, h: 2.15 }, titleSize: 32, body: { x: M, y: 3.8, w: W - M * 2, h: H - 1.4 - 3.8 } };
    if (arr === "top")
        return { head: { x: M, y: 1.0, w: W - M * 2, h: 1.25 }, titleSize: 28, body: { x: M, y: 2.45, w: W - M * 2, h: H - M - 2.45 } };
    return { head: { x: M, y: 1.4, w: 3.3, h: 3.05 }, titleSize: 28, body: { x: 4.3, y: 0.55, w: W - M - 4.3, h: H - M - 0.55 } };
}
/** Hand-placed hook and cta positions: the original 9:16 slide, or landscape "stack" (logo above) or "side" (logo left). */
function heroSpots(W, H, wide, arr) {
    const CW = W - M * 2;
    if (!wide)
        return {
            align: "center",
            hook: { logo: { x: (W - 2.2) / 2, y: 1.6, w: 2.2, h: 2.2 }, headline: { x: M, y: 4.2, w: CW, h: 2.3 }, sub: { x: M, y: 6.7, w: CW, h: 0.5 } },
            cta: { logo: { x: (W - 1.6) / 2, y: 1.5, w: 1.6, h: 1.6 }, headline: { x: M, y: 3.4, w: CW, h: 1.0 }, sub: { x: M, y: 4.4, w: CW, h: 0.5 },
                pill: { x: M, y: 5.3, w: CW, h: 1.1 }, follow: { x: M, y: 6.8, w: CW, h: 0.5 } },
        };
    if (arr === "side") {
        const x = 3.9, w = W - M - x, logo = { x: 0.8, y: (H - 2.6) / 2, w: 2.6, h: 2.6 };
        return {
            align: "left",
            hook: { logo, headline: { x, y: 1.2, w, h: 2.3 }, sub: { x, y: 3.6, w, h: 0.5 } },
            cta: { logo, headline: { x, y: 0.95, w, h: 0.9 }, sub: { x, y: 1.85, w, h: 0.5 }, pill: { x, y: 2.55, w: 4.6, h: 1.0 }, follow: { x, y: 3.85, w, h: 0.5 } },
        };
    }
    return {
        align: "center",
        hook: { logo: { x: (W - 1.6) / 2, y: 0.55, w: 1.6, h: 1.6 }, headline: { x: M, y: 2.35, w: CW, h: 1.6 }, sub: { x: M, y: 4.1, w: CW, h: 0.5 } },
        cta: { logo: { x: (W - 1.1) / 2, y: 0.4, w: 1.1, h: 1.1 }, headline: { x: M, y: 1.65, w: CW, h: 0.8 }, sub: { x: M, y: 2.45, w: CW, h: 0.45 },
            pill: { x: (W - 5) / 2, y: 3.05, w: 5, h: 1.0 }, follow: { x: M, y: 4.3, w: CW, h: 0.5 } },
    };
}
async function writeDeck(loaded, outFile) {
    const { spec, logoPath } = loaded;
    const c = spec.brand.colors;
    const { wide } = (0, spec_1.stageFor)(spec.format);
    const { width: W, height: H } = deckSize(spec.format);
    const head = xmlAttr(spec.brand.deckFonts.head);
    const bodyFont = xmlAttr(spec.brand.deckFonts.body);
    const mono = xmlAttr(spec.brand.deckFonts.mono ?? "Courier New");
    // The theme at the deck's 192 px per inch: the same multipliers as the video, ×1 by default.
    const L = (0, spec_1.look)(spec);
    const pres = new pptxgenjs_1.default();
    pres.defineLayout({ name: "SHORT", width: W, height: H });
    pres.layout = "SHORT";
    pres.title = spec.title;
    pres.theme = { headFontFace: head, bodyFontFace: bodyFont };
    /** Rich text → pptxgenjs runs: accent in the accent colour, code in the deck's mono font. */
    const rt = (text, base = {}) => (0, spec_1.runs)(text).map((r) => ({ text: r.text, options: { ...base, ...(r.accent ? { color: hex(c.accent) } : {}), ...(r.code ? { fontFace: mono } : {}) } }));
    const card = (s, x, y, w, h, fill, name, radius = 0.18 * L.radius) => {
        s.addShape(pres.ShapeType.roundRect, { x, y, w, h, fill: { color: hex(fill) }, line: { color: hex(fill), width: 0 }, rectRadius: radius, objectName: name });
    };
    const dot = async (s, icon, x, y, d = 0.7) => {
        s.addShape(pres.ShapeType.ellipse, { x, y, w: d, h: d, fill: { color: hex(c.highlight) }, line: { color: hex(c.highlight), width: 0 }, objectName: `dot-${icon}` });
        const p = d * 0.25;
        s.addImage({ data: await (0, icons_1.iconPng)(icon, c.ground), x: x + p, y: y + p, w: d - 2 * p, h: d - 2 * p, altText: icon });
    };
    /** Every slide's text goes through here, so the theme's type scale applies to each box and each run. */
    const text = (s, t, o) => {
        const sized = (p) => (typeof p?.["fontSize"] === "number" ? { ...p, fontSize: p["fontSize"] * L.type } : p);
        s.addText((typeof t === "string" ? t : t.map((r) => ({ ...r, options: sized(r.options) }))), sized({ margin: 0, isTextBox: true, fontFace: bodyFont, color: hex(c.ink), ...o }));
    };
    const brandRow = (s) => {
        if (L.header === "none")
            return;
        s.addImage({ path: logoPath, x: M, y: 0.45, w: 0.42, h: 0.42, altText: `${spec.brand.name} logo` });
        if (L.header === "brand")
            text(s, spec.brand.name, { x: M + 0.52, y: 0.45, w: 2.5, h: 0.42, fontSize: 15, bold: true, fontFace: head, valign: "middle" });
    };
    const header = (s, kicker, title, b, size) => {
        brandRow(s);
        text(s, kicker.toUpperCase(), { x: b.x, y: b.y, w: b.w, h: 0.4, fontSize: 13, bold: true, color: hex(c.accent), charSpacing: 2, fontFace: mono });
        text(s, rt(title), { x: b.x, y: b.y + 0.45, w: b.w, h: b.h - 0.45, fontSize: size, bold: true, fontFace: head, valign: "top" });
    };
    /** Draws a scene's final state; content scenes fill the body box, hook and cta use the hand-placed spots. */
    const slideFor = async (s, scene, box, arr) => {
        // The body box under the names the fixed 9:16 slide used (margin, top, content width), so the layouts read as before.
        const { x: M, y: top, w: CW, h: bh } = box;
        const spot = heroSpots(W, H, wide, arr);
        switch (scene.kind) {
            case "hook": {
                const { logo, headline, sub } = spot.hook;
                s.addImage({ path: logoPath, ...logo, altText: `${spec.brand.name} logo` });
                text(s, rt(scene.headline), { ...headline, fontSize: 40, bold: true, fontFace: head, align: spot.align, valign: "middle" });
                if (scene.sub)
                    text(s, rt(scene.sub, { color: hex(c.muted) }).map((r) => r.options?.["color"] === hex(c.accent) ? { ...r, options: { ...r.options, color: hex(c.highlight), bold: true } } : r), { ...sub, fontSize: 18, align: spot.align });
                return;
            }
            case "list": {
                // Gaps (and the icon and text padding) shrink only when the rows would not otherwise fit, so every
                // count keeps positive heights inside the box; the documented 2-4 items lay out as they always have.
                const n = scene.items.length, gap = Math.min(0.2 * L.density, bh / n / 4), h = Math.min(1.3, bh / n - gap), d = Math.min(0.7, h), pad = Math.min(0.1, h / 4);
                for (const [i, it] of scene.items.entries()) {
                    const y = top + i * (h + gap);
                    card(s, M, y, CW, h, c.card, `item-${i}`);
                    await dot(s, it.icon, M + 0.3, y + (h - d) / 2, d);
                    text(s, [{ text: it.title, options: { bold: true, fontSize: 20, breakLine: true } }, ...(it.desc ? rt(it.desc, { fontSize: 15, color: hex(c.muted) }) : [])], { x: M + 1.2, y: y + pad, w: CW - 1.4, h: h - 2 * pad, valign: "middle" });
                }
                return;
            }
            case "card": {
                const k = scene.card, rows = k.rows.length;
                // Rows close up when the box is shorter than the card wants (0.8 in apart on the 9:16 slide).
                const pitch = Math.min(0.8, (bh - 1.35 - (k.tags?.length ? 0.75 : 0.1)) / rows);
                const h = Math.min(bh, 1.5 + rows * pitch + (k.tags?.length ? 0.6 : 0));
                card(s, M, top, CW, h, c.panel, "panel");
                const x = M + 0.35, w = CW - 0.7;
                text(s, k.title, { x, y: top + 0.3, w, h: 0.5, fontSize: 20, bold: true, color: hex(c.panelInk), fontFace: head });
                if (k.meta)
                    text(s, k.meta, { x, y: top + 0.8, w, h: 0.35, fontSize: 12, color: hex(c.panelMuted) });
                k.rows.forEach((r, i) => text(s, [{ text: r.label, options: { bold: true, color: hex(c.panelInk), breakLine: true } }, ...rt(r.value, { color: hex(c.panelMuted) })], { x, y: top + 1.35 + i * pitch, w, h: Math.min(0.7, pitch), fontSize: 15, valign: "top" }));
                let tx = x;
                for (const t of k.tags ?? []) {
                    const tw = 0.3 + t.length * 0.1;
                    s.addShape(pres.ShapeType.roundRect, { x: tx, y: top + h - 0.7, w: tw, h: 0.4, fill: { color: hex(c.panelRule) }, line: { color: hex(c.panelRule), width: 0 }, rectRadius: 0.2 });
                    text(s, t, { x: tx, y: top + h - 0.7, w: tw, h: 0.4, fontSize: 12, color: hex(c.panelInk), align: "center", valign: "middle", fontFace: mono });
                    tx += tw + 0.15;
                }
                return;
            }
            case "chat": {
                const n = scene.turns.length, gap = Math.min(0.2 * L.density, bh / n / 4), h = Math.min(0.95, bh / n - gap), bw = 3.9;
                scene.turns.forEach((t, i) => {
                    const you = t.from === "you", y = top + i * (h + gap), x = you ? M + CW - bw : M;
                    card(s, x, y, bw, h, you ? c.highlight : c.card, `turn-${i}`);
                    text(s, you ? [{ text: `“${t.text}”`, options: { color: hex(c.ground) } }] : [{ text: `${spec.brand.name.toLowerCase()} `, options: { bold: true, color: hex(c.accent) } }, { text: t.text }], { x: x + 0.25, y, w: bw - 0.5, h, fontSize: 15, valign: "middle" });
                });
                return;
            }
            case "steps": {
                const n = scene.steps.length + (scene.result ? 1 : 0), pitch = Math.min(0.8 + 0.75 * L.density, bh / n);
                scene.steps.forEach((st, i) => {
                    const y = top + i * pitch;
                    s.addShape(pres.ShapeType.ellipse, { x: M, y, w: 0.8, h: 0.8, fill: { color: hex(c.highlight) }, line: { color: hex(c.highlight), width: 0 } });
                    text(s, String(i + 1), { x: M, y, w: 0.8, h: 0.8, fontSize: 24, bold: true, color: hex(c.ground), align: "center", valign: "middle", fontFace: head });
                    text(s, [{ text: st.title, options: { bold: true, fontSize: 20, breakLine: true } }, ...(st.desc ? rt(st.desc, { fontSize: 15, color: hex(c.muted) }) : [])], { x: M + 1.1, y: y - 0.05, w: CW - 1.1, h: 1.1, valign: "top" });
                    // No connector when the steps sit closer than a circle and its gap: its height would be negative, which is invalid OOXML.
                    if (i < scene.steps.length - 1 && pitch > 1.0)
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
                // Three columns when the body runs across the width; short tiles put the label beside the icon.
                // Row gaps shrink only when the rows would not otherwise fit, as in list.
                const cols = CW > 2 * bh ? 3 : 2, cg = 0.3 * L.density, gw = (CW - cg * (cols - 1)) / cols, rowsN = Math.ceil(scene.tiles.length / cols);
                const rg = Math.min(0.25 * L.density, bh / rowsN / 4), gh = Math.min(1.35, bh / rowsN - rg), d = Math.min(0.55, gh);
                const beside = gh < 1.3;
                for (const [i, t] of scene.tiles.entries()) {
                    const x = M + (i % cols) * (gw + cg), y = top + Math.floor(i / cols) * (gh + rg);
                    card(s, x, y, gw, gh, c.card, `tile-${i}`);
                    await dot(s, t.icon, x + 0.25, beside ? y + (gh - d) / 2 : y + 0.25, d);
                    text(s, t.label, beside ? { x: x + 0.95, y, w: gw - 1.1, h: gh, fontSize: 15, bold: true, valign: "middle" }
                        : { x: x + 0.25, y: y + gh - 0.5, w: gw - 0.4, h: 0.4, fontSize: 15, bold: true, valign: "middle" });
                }
                return;
            }
            case "media": {
                // Across the width: player left, moments right. Otherwise the player sits above the moments.
                const across = arr === "top" && wide;
                const pw = across ? CW * 0.58 : CW, ph = across ? bh : 2.0;
                card(s, M, top, pw, ph, c.card, "player");
                await dot(s, "FiPlay", M + (pw - 1.0) / 2, top + (across ? (ph - 1.0) / 2 : 0.5), 1.0);
                const mx = across ? M + pw + 0.4 : M, mw = across ? CW - pw - 0.4 : CW;
                // Moments sit 0.7 in apart (0.5 in chips, 0.2 in gaps at regular density); when more than fit, they close up
                // together (k < 1) so the last stays in the box.
                const g = 0.2 * L.density, n = scene.moments.length, room = across ? bh : bh - 2.3, k = Math.min(1, room / (n * (0.5 + g) - g));
                const pitch = (0.5 + g) * k, mh = 0.5 * k;
                const my = across ? top + (bh - n * pitch + g * k) / 2 : top + 2.3;
                scene.moments.forEach((m, i) => {
                    const y = my + i * pitch;
                    s.addShape(pres.ShapeType.roundRect, { x: mx, y, w: 1.0, h: mh, fill: { color: hex(c.chip) }, line: { color: hex(c.chip), width: 0 }, rectRadius: 0.25 * k });
                    text(s, m.time, { x: mx, y, w: 1.0, h: mh, fontSize: 14, bold: true, color: hex(c.accent), align: "center", valign: "middle", fontFace: mono });
                    text(s, m.label, { x: mx + 1.2, y, w: mw - 1.2, h: mh, fontSize: 16, valign: "middle" });
                });
                return;
            }
            case "cta": {
                const { logo, headline, sub, pill, follow } = spot.cta;
                s.addImage({ path: logoPath, ...logo, altText: `${spec.brand.name} logo` });
                text(s, rt(scene.headline), { ...headline, fontSize: 42, bold: true, fontFace: head, align: spot.align, valign: "middle" });
                if (scene.sub)
                    text(s, rt(scene.sub, { color: hex(c.muted) }), { ...sub, fontSize: 18, align: spot.align });
                if (scene.pill) {
                    card(s, pill.x, pill.y, pill.w, pill.h, c.card, "pill", 0.18); // a pill in the video, so radius leaves it alone
                    await dot(s, scene.pill.icon, pill.x + 0.25, pill.y + (pill.h - 0.7) / 2);
                    text(s, scene.pill.text, { x: pill.x + 1.1, y: pill.y, w: pill.w - 1.25, h: pill.h, fontSize: 16, bold: true, valign: "middle" });
                }
                if (scene.follow)
                    text(s, rt(scene.follow, { color: hex(c.accent) }), { ...follow, fontSize: 16, align: spot.align });
                return;
            }
        }
    };
    for (const line of spec.lines) {
        const s = pres.addSlide();
        s.background = { color: hex(c.ground) };
        const sc = line.scene;
        const arr = spec_1.WIDE[sc.kind];
        const { head: hb, titleSize, body } = contentBoxes(W, H, wide, arr);
        if (sc.kind !== "hook" && sc.kind !== "cta")
            header(s, sc.kicker, sc.title, hb, titleSize);
        await slideFor(s, sc, body, arr);
        s.addNotes(line.vo);
    }
    await pres.writeFile({ fileName: outFile });
    return outFile;
}
