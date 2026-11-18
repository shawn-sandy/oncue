"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.guardSource = guardSource;
exports.verifySource = verifySource;
exports.readDeck = readDeck;
exports.findTool = findTool;
exports.importDeck = importDeck;
exports.readSlides = readSlides;
/**
 * Reads someone else's deck (.pptx, .odp or a PDF export) without ever changing it: the work happens on a copy, and a
 * SHA-256 checksum and modified time taken before and after prove the original is the same file.
 */
const node_child_process_1 = require("node:child_process");
const node_crypto_1 = require("node:crypto");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const node_url_1 = require("node:url");
const jszip_1 = __importDefault(require("jszip"));
const MANIFEST = "source-manifest.json";
function fingerprint(file) {
    const stat = (0, node_fs_1.statSync)(file);
    return { sha256: (0, node_crypto_1.createHash)("sha256").update((0, node_fs_1.readFileSync)(file)).digest("hex"), mtimeMs: stat.mtimeMs, bytes: stat.size };
}
const same = (a, b) => a.sha256 === b.sha256 && a.mtimeMs === b.mtimeMs;
const changed = (source) => new Error(`The original file changed during this run: ${source}. Its checksum or modified time no longer matches ${MANIFEST}. Nothing here writes to it, so check what else did, then import again.`);
/**
 * Runs `fn` on a copy of `source` under `<outDir>/work/`, then fails if the original's checksum or modified time moved.
 * Writes source-manifest.json either way. The output folder may not be the source's own folder.
 */
async function guardSource(source, outDir, fn) {
    const src = (0, node_path_1.resolve)(source), out = (0, node_path_1.resolve)(outDir);
    if (!(0, node_fs_1.existsSync)(src) || !(0, node_fs_1.statSync)(src).isFile())
        throw new Error(`No such file: ${src}`);
    if (out === (0, node_path_1.dirname)(src))
        throw new Error(`The output folder is the original file's own folder (${out}). Choose another folder, so nothing is written beside the original.`);
    const before = fingerprint(src);
    const work = (0, node_path_1.join)(out, "work");
    (0, node_fs_1.mkdirSync)(work, { recursive: true });
    const copy = (0, node_path_1.join)(work, (0, node_path_1.basename)(src));
    (0, node_fs_1.rmSync)(copy, { force: true });
    (0, node_fs_1.copyFileSync)(src, copy);
    (0, node_fs_1.chmodSync)(copy, 0o644); // a read-only original gives a read-only copy, which the next import could not replace
    try {
        return await fn(copy);
    }
    finally {
        const unchanged = same(before, fingerprint(src));
        const manifest = { source: src, ...before, unchanged, checked: new Date().toISOString() };
        (0, node_fs_1.writeFileSync)((0, node_path_1.join)(out, MANIFEST), JSON.stringify(manifest, null, 2));
        if (!unchanged)
            throw changed(src);
    }
}
/** For the commands after import, which never open the original: fails if it no longer matches the manifest. */
function verifySource(dir) {
    const file = (0, node_path_1.join)(dir, MANIFEST);
    if (!(0, node_fs_1.existsSync)(file))
        throw new Error(`No ${MANIFEST} in ${dir}. Run import first.`);
    const manifest = JSON.parse((0, node_fs_1.readFileSync)(file, "utf8"));
    if (!(0, node_fs_1.existsSync)(manifest.source)) {
        console.warn(`warning: the original file is no longer at ${manifest.source}, so it cannot be re-checked against ${MANIFEST}.`);
        return;
    }
    if (!same(manifest, fingerprint(manifest.source)))
        throw changed(manifest.source);
}
const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const decode = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (all, e) => e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENTITIES[e] ?? all);
const attr = (tag, name) => new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1];
/** Non-empty paragraphs of text, one per line. `para` matches one paragraph and captures its content. */
function paragraphs(xml, para, run) {
    return [...xml.matchAll(para)].map((m) => decode(run(m[1])).replace(/\s+/g, " ").trim()).filter(Boolean).join("\n");
}
// ponytail: the XML is read with regular expressions, which is enough for the handful of elements needed here; switch to a
// real parser if a deck ever nests these in a way a non-greedy match gets wrong.
async function readPptx(zip) {
    const read = async (path) => (await zip.file(path)?.async("string")) ?? "";
    /** Relationship id → target, for the rels file beside `part`. */
    const rels = async (part) => [...(await read((0, node_path_1.join)((0, node_path_1.dirname)(part), "_rels", `${(0, node_path_1.basename)(part)}.rels`))).matchAll(/<Relationship\b[^>]*>/g)].map(([tag]) => {
        const target = attr(tag, "Target") ?? "";
        return { id: attr(tag, "Id") ?? "", type: attr(tag, "Type") ?? "", target: target.startsWith("/") ? target.slice(1) : (0, node_path_1.join)((0, node_path_1.dirname)(part), target) };
    });
    const text = (xml) => paragraphs(xml, /<a:p\b[^>]*>([\s\S]*?)<\/a:p>/g, (p) => [...p.matchAll(/<a:t\b[^>]*>([^<]*)<\/a:t>/g)].map((t) => t[1]).join(""));
    const pres = "ppt/presentation.xml";
    const presRels = await rels(pres);
    const order = [...(await read(pres)).matchAll(/<p:sldId\b[^>]*>/g)].map(([tag]) => presRels.find((r) => r.id === attr(tag, "r:id"))?.target);
    if (!order.length)
        throw new Error("No slides found in this .pptx.");
    const slides = [];
    for (const [i, path] of order.entries()) {
        const xml = path ? await read(path) : "";
        if (!path || !xml)
            throw new Error(`Slide ${i + 1} is listed in the presentation but missing from the file.`);
        if (attr(/<p:sld\b[^>]*>/.exec(xml)?.[0] ?? "", "show") === "0")
            continue;
        const notesPath = (await rels(path)).find((r) => r.type.endsWith("/notesSlide"))?.target;
        // Only the notes body: the notes page also holds a slide-number field and sometimes a header, footer or date.
        const body = notesPath ? [...(await read(notesPath)).matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map((m) => m[0]).filter((sp) => /<p:ph\b[^>]*type="body"/.test(sp)).join("") : "";
        slides.push({ n: slides.length + 1, deck: i + 1, notes: text(body), text: text(xml) });
    }
    return slides;
}
async function readOdp(zip) {
    const content = (await zip.file("content.xml")?.async("string")) ?? "";
    const styles = content + ((await zip.file("styles.xml")?.async("string")) ?? "");
    const hidden = new Set([...styles.matchAll(/<style:style\b[^>]*>[\s\S]*?<\/style:style>/g)]
        .filter((m) => /presentation:visibility="hidden"/.test(m[0])).map((m) => attr(m[0], "style:name")));
    // Tags go first, then any stray bracket: real < and > in slide text are still entities here and are decoded afterwards.
    const text = (xml) => paragraphs(xml, /<text:p\b[^>]*>([\s\S]*?)<\/text:p>/g, (p) => p.replace(/<text:(?:s|tab|line-break)\b[^>]*\/>/g, " ").replace(/<[^>]+>/g, "").replace(/[<>]/g, ""));
    const pages = [...content.matchAll(/<draw:page\b[^>]*>[\s\S]*?<\/draw:page>/g)].map((m) => m[0]);
    if (!pages.length)
        throw new Error("No slides found in this .odp.");
    const slides = [];
    pages.forEach((page, i) => {
        if (hidden.has(attr(page, "draw:style-name")))
            return;
        const notes = /<presentation:notes\b[^>]*>[\s\S]*?<\/presentation:notes>/.exec(page)?.[0] ?? "";
        slides.push({ n: slides.length + 1, deck: i + 1, notes: text(notes), text: text(page.replace(notes, "")) });
    });
    return slides;
}
/** The visible slides of a .pptx or .odp in presentation order, with speaker notes and slide text. */
async function readDeck(file) {
    const ext = (0, node_path_1.extname)(file).toLowerCase();
    if (ext !== ".pptx" && ext !== ".odp")
        throw new Error(`Cannot read ${ext || "this file"}. Use a .pptx, an .odp or a PDF export; from Google Slides, use File → Download.`);
    const zip = await jszip_1.default.loadAsync((0, node_fs_1.readFileSync)(file));
    return ext === ".pptx" ? readPptx(zip) : readOdp(zip);
}
const MAC_SOFFICE = "/Applications/LibreOffice.app/Contents/MacOS/soffice";
/** The command for `soffice` or `pdftoppm` if it can be run here, else null. */
function findTool(bin) {
    for (const cmd of bin === "soffice" ? [bin, MAC_SOFFICE] : [bin]) {
        try {
            (0, node_child_process_1.execFileSync)(cmd, [bin === "soffice" ? "--version" : "-v"], { stdio: "ignore" });
            return cmd;
        }
        catch (e) {
            if (e.code !== "ENOENT")
                return cmd; // it ran; a non-zero exit from a version flag still means it exists
        }
    }
    return null;
}
function tool(bin, args) {
    const cmd = findTool(bin);
    if (!cmd)
        throw new Error(`${bin} is not installed, so the slides cannot be rendered here (${bin === "soffice" ? "it comes with LibreOffice" : "it comes with poppler"}). Install it, export the deck as a PDF yourself, or pass --pages with a folder of slide images exported from the deck.`);
    try {
        (0, node_child_process_1.execFileSync)(cmd, args, { stdio: ["ignore", "ignore", "pipe"], timeout: 300_000 });
    }
    catch (e) {
        throw new Error(`${bin} failed: ${String(e.stderr ?? "").trim() || e.message}`);
    }
}
const pageName = (i, ext) => `slide-${String(i + 1).padStart(2, "0")}${ext}`;
/** Renders the copy to `<outDir>/pages/slide-NN.png`: through a PDF for a deck, directly for a PDF. Returns the page paths. */
function renderPages(copy, outDir) {
    const work = (0, node_path_1.dirname)(copy), pages = (0, node_path_1.join)(outDir, "pages");
    let pdf = copy;
    if ((0, node_path_1.extname)(copy).toLowerCase() !== ".pdf") {
        // Its own profile folder, so a LibreOffice the person has open is neither needed nor disturbed.
        tool("soffice", ["--headless", `-env:UserInstallation=${(0, node_url_1.pathToFileURL)((0, node_path_1.join)(work, "office-profile")).href}`, "--convert-to", "pdf", "--outdir", work, copy]);
        pdf = (0, node_path_1.join)(work, `${(0, node_path_1.basename)(copy, (0, node_path_1.extname)(copy))}.pdf`);
        if (!(0, node_fs_1.existsSync)(pdf))
            throw new Error("soffice ran but wrote no PDF; the deck may be damaged or password-protected.");
    }
    tool("pdftoppm", ["-r", "150", "-png", pdf, (0, node_path_1.join)(pages, "p")]);
    // pdftoppm pads page numbers to the width of the page count, so order them by number, not by name.
    const made = (0, node_fs_1.readdirSync)(pages).filter((f) => /^p-\d+\.png$/.test(f)).sort((a, b) => parseInt(a.slice(2), 10) - parseInt(b.slice(2), 10));
    return made.map((f, i) => { (0, node_fs_1.renameSync)((0, node_path_1.join)(pages, f), (0, node_path_1.join)(pages, pageName(i, ".png"))); return `pages/${pageName(i, ".png")}`; });
}
/** Copies ready-made slide images, in natural file-name order, to `<outDir>/pages/`. Returns the page paths. */
function copyPages(from, outDir) {
    const images = (0, node_fs_1.readdirSync)(from).filter((f) => /\.(png|jpe?g)$/i.test(f)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    return images.map((f, i) => {
        const name = pageName(i, (0, node_path_1.extname)(f).toLowerCase());
        (0, node_fs_1.copyFileSync)((0, node_path_1.join)(from, f), (0, node_path_1.join)(outDir, "pages", name));
        return `pages/${name}`;
    });
}
/**
 * Turns a deck into a project folder: page pictures, slides.json and source-manifest.json. `pagesFrom` supplies slide
 * images already exported from the deck instead of rendering them here. A PDF has no notes or hidden slides, so its
 * slides are its pages.
 */
async function importDeck(source, outDir, pagesFrom) {
    const out = (0, node_path_1.resolve)(outDir);
    return guardSource(source, out, async (copy) => {
        const deck = (0, node_path_1.extname)(copy).toLowerCase() === ".pdf" ? null : await readDeck(copy);
        (0, node_fs_1.rmSync)((0, node_path_1.join)(out, "pages"), { recursive: true, force: true });
        (0, node_fs_1.mkdirSync)((0, node_path_1.join)(out, "pages"), { recursive: true });
        const pages = pagesFrom ? copyPages((0, node_path_1.resolve)(pagesFrom), out) : renderPages(copy, out);
        if (!pages.length)
            throw new Error(pagesFrom ? `No .png or .jpg images in ${pagesFrom}.` : "Rendering produced no pages.");
        if (deck && deck.length !== pages.length)
            throw new Error(`The deck has ${deck.length} visible slides but there are ${pages.length} page pictures. Hidden slides are skipped; supply one picture per visible slide, in order.`);
        const slides = pages.map((page, i) => ({ n: i + 1, deck: deck?.[i]?.deck ?? i + 1, page, notes: deck?.[i]?.notes ?? "", text: deck?.[i]?.text ?? "" }));
        (0, node_fs_1.writeFileSync)((0, node_path_1.join)(out, "slides.json"), JSON.stringify({ source: (0, node_path_1.resolve)(source), slides }, null, 2));
        return slides;
    });
}
function readSlides(dir) {
    const file = (0, node_path_1.join)(dir, "slides.json");
    if (!(0, node_fs_1.existsSync)(file))
        throw new Error(`No slides.json in ${dir}. Run import first.`);
    return JSON.parse((0, node_fs_1.readFileSync)(file, "utf8")).slides;
}
