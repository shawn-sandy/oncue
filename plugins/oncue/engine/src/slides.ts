/**
 * Reads someone else's deck (.pptx, .odp or a PDF export) without ever changing it: the work happens on a copy, and a
 * SHA-256 checksum and modified time taken before and after prove the original is the same file.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import JSZip from "jszip";

/** `n` counts visible slides and names the page picture; `deck` is the slide's place in the deck, hidden ones included. */
/** A slide's own transition as the .pptx names it: `kind` is the element (`fade`, `push`, `wipe`, ...), `dir` and `spd` its attributes. */
export interface Transition { kind: string; dir?: string; spd?: string }
export interface Slide { n: number; deck: number; page: string; notes: string; text: string; transition?: Transition }

/**
 * The `<p:transition>` of a slide part, or undefined when it has none. PowerPoint wraps newer transitions in
 * `mc:AlternateContent`; the `mc:Fallback` branch holds a classic one every reader understands, so that is the one read.
 */
export function readTransition(xml: string): Transition | undefined {
  const scope = /<mc:Fallback\b[^>]*>([\s\S]*?)<\/mc:Fallback>/.exec(xml)?.[1] ?? xml.replace(/<mc:AlternateContent\b[\s\S]*?<\/mc:AlternateContent>/g, "");
  const m = /<p:transition\b([^>]*?)(?:\/>|>([\s\S]*?)<\/p:transition>)/.exec(scope);
  const effect = m?.[2] && /<p:(\w+)\b([^>]*)/.exec(m[2]);
  if (!m || !effect) return undefined;
  const t: Transition = { kind: effect[1]! };
  const dir = attr(effect[2]!, "dir"), spd = attr(m[1]!, "spd");
  if (dir) t.dir = dir;
  if (spd) t.spd = spd;
  return t;
}
export interface Manifest { source: string; sha256: string; mtimeMs: number; bytes: number; unchanged: boolean; checked: string }

const MANIFEST = "source-manifest.json";

function fingerprint(file: string): Pick<Manifest, "sha256" | "mtimeMs" | "bytes"> {
  const stat = statSync(file);
  return { sha256: createHash("sha256").update(readFileSync(file)).digest("hex"), mtimeMs: stat.mtimeMs, bytes: stat.size };
}
const same = (a: Pick<Manifest, "sha256" | "mtimeMs">, b: Pick<Manifest, "sha256" | "mtimeMs">): boolean => a.sha256 === b.sha256 && a.mtimeMs === b.mtimeMs;
const changed = (source: string, when: "during this run" | "since it was imported"): Error =>
  new Error(`The original file has changed ${when}: ${source}. Its checksum or modified time no longer matches ${MANIFEST}. Nothing here writes to it, so check what else did, then import again.`);

/**
 * Runs `fn` on a copy of `source` under `<outDir>/work/`, then fails if the original's checksum or modified time moved.
 * Writes source-manifest.json either way. The output folder may not be the source's own folder.
 */
export async function guardSource<T>(source: string, outDir: string, fn: (copy: string) => Promise<T> | T): Promise<T> {
  const src = resolve(source), out = resolve(outDir);
  if (!existsSync(src) || !statSync(src).isFile()) throw new Error(`No such file: ${src}`);
  if (out === dirname(src)) throw new Error(`The output folder is the original file's own folder (${out}). Choose another folder, so nothing is written beside the original.`);
  const before = fingerprint(src);
  const work = join(out, "work");
  mkdirSync(work, { recursive: true });
  const copy = join(work, basename(src));
  rmSync(copy, { force: true });
  copyFileSync(src, copy);
  chmodSync(copy, 0o644); // a read-only original gives a read-only copy, which the next import could not replace
  try {
    return await fn(copy);
  } finally {
    const unchanged = same(before, fingerprint(src));
    const manifest: Manifest = { source: src, ...before, unchanged, checked: new Date().toISOString() };
    writeFileSync(join(out, MANIFEST), JSON.stringify(manifest, null, 2));
    if (!unchanged) throw changed(src, "during this run");
  }
}

/** For the commands after import, which never open the original: fails if it no longer matches the manifest. */
export function verifySource(dir: string): void {
  const file = join(dir, MANIFEST);
  if (!existsSync(file)) throw new Error(`No ${MANIFEST} in ${dir}. Run import first.`);
  const manifest = JSON.parse(readFileSync(file, "utf8")) as Manifest;
  if (!existsSync(manifest.source)) { console.warn(`warning: the original file is no longer at ${manifest.source}, so it cannot be re-checked against ${MANIFEST}.`); return; }
  if (!same(manifest, fingerprint(manifest.source))) throw changed(manifest.source, "since it was imported");
}

/** Removes every match, repeated until nothing is left: taking one match out can join the pieces of another around it. */
export function strip(text: string, pattern: RegExp): string {
  for (let before = ""; before !== text;) { before = text; text = text.replace(pattern, ""); }
  return text;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const decode = (s: string): string =>
  s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (all, e: string) =>
    e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENTITIES[e] ?? all);
const attr = (tag: string, name: string): string | undefined => new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1];
/** Non-empty paragraphs of text, one per line. `para` matches one paragraph and captures its content. */
function paragraphs(xml: string, para: RegExp, run: (inner: string) => string): string {
  // Line breaks inside a paragraph are kept, so a reminder line such as "Open with this:" stays recognisable.
  const tidy = (p: string): string => p.split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n");
  return [...xml.matchAll(para)].map((m) => tidy(decode(run(m[1]!)))).filter(Boolean).join("\n");
}

// ponytail: the XML is read with regular expressions, which is enough for the handful of elements needed here; switch to a
// real parser if a deck ever nests these in a way a non-greedy match gets wrong.
async function readPptx(zip: JSZip): Promise<Omit<Slide, "page">[]> {
  const read = async (path: string): Promise<string> => (await zip.file(path)?.async("string")) ?? "";
  /** Relationship id → target, for the rels file beside `part`. */
  const rels = async (part: string): Promise<{ id: string; type: string; target: string }[]> =>
    [...(await read(join(dirname(part), "_rels", `${basename(part)}.rels`))).matchAll(/<Relationship\b[^>]*>/g)].map(([tag]) => {
      const target = attr(tag, "Target") ?? "";
      return { id: attr(tag, "Id") ?? "", type: attr(tag, "Type") ?? "", target: target.startsWith("/") ? target.slice(1) : join(dirname(part), target) };
    });
  const text = (xml: string): string => paragraphs(xml, /<a:p\b[^>]*>([\s\S]*?)<\/a:p>/g, (p) => [...p.replace(/<a:br\b[^>]*\/>/g, "<a:t>\n</a:t>").matchAll(/<a:t\b[^>]*>([^<]*)<\/a:t>/g)].map((t) => t[1]).join(""));

  const pres = "ppt/presentation.xml";
  const presRels = await rels(pres);
  const order = [...(await read(pres)).matchAll(/<p:sldId\b[^>]*>/g)].map(([tag]) => presRels.find((r) => r.id === attr(tag, "r:id"))?.target);
  if (!order.length) throw new Error("No slides found in this .pptx.");
  const slides: Omit<Slide, "page">[] = [];
  for (const [i, path] of order.entries()) {
    const xml = path ? await read(path) : "";
    if (!path || !xml) throw new Error(`Slide ${i + 1} is listed in the presentation but missing from the file.`);
    if (attr(/<p:sld\b[^>]*>/.exec(xml)?.[0] ?? "", "show") === "0") continue;
    const notesPath = (await rels(path)).find((r) => r.type.endsWith("/notesSlide"))?.target;
    // Only the notes body: the notes page also holds a slide-number field and sometimes a header, footer or date.
    const body = notesPath ? [...(await read(notesPath)).matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map((m) => m[0]).filter((sp) => /<p:ph\b[^>]*type="body"/.test(sp)).join("") : "";
    const transition = readTransition(xml);
    slides.push({ n: slides.length + 1, deck: i + 1, notes: text(body), text: text(xml), ...(transition && { transition }) });
  }
  return slides;
}

async function readOdp(zip: JSZip): Promise<Omit<Slide, "page">[]> {
  const content = (await zip.file("content.xml")?.async("string")) ?? "";
  const styles = content + ((await zip.file("styles.xml")?.async("string")) ?? "");
  const hidden = new Set([...styles.matchAll(/<style:style\b[^>]*>[\s\S]*?<\/style:style>/g)]
    .filter((m) => /presentation:visibility="hidden"/.test(m[0])).map((m) => attr(m[0], "style:name")));
  // Spacing elements become a space, every other tag goes. Real < and > in slide text are still entities here and are decoded afterwards.
  const text = (xml: string): string => paragraphs(xml, /<text:p\b[^>]*>([\s\S]*?)<\/text:p>/g, (p) => strip(p.replace(/<text:line-break\b[^>]*\/>/g, "\n").replace(/<text:(?:s|tab)\b[^>]*\/>/g, " "), /<[^>]*>/g));
  const pages = [...content.matchAll(/<draw:page\b[^>]*>[\s\S]*?<\/draw:page>/g)].map((m) => m[0]);
  if (!pages.length) throw new Error("No slides found in this .odp.");
  const slides: Omit<Slide, "page">[] = [];
  pages.forEach((page, i) => {
    if (hidden.has(attr(page, "draw:style-name"))) return;
    const notes = /<presentation:notes\b[^>]*>[\s\S]*?<\/presentation:notes>/.exec(page)?.[0] ?? "";
    slides.push({ n: slides.length + 1, deck: i + 1, notes: text(notes), text: text(page.replace(notes, "")) });
  });
  return slides;
}

/** The visible slides of a .pptx or .odp in presentation order, with speaker notes and slide text. */
export async function readDeck(file: string): Promise<Omit<Slide, "page">[]> {
  const ext = extname(file).toLowerCase();
  if (ext !== ".pptx" && ext !== ".odp") throw new Error(`Cannot read ${ext || "this file"}. Use a .pptx, an .odp or a PDF export; from Google Slides, use File → Download.`);
  const zip = await JSZip.loadAsync(readFileSync(file));
  return ext === ".pptx" ? readPptx(zip) : readOdp(zip);
}

const MAC_SOFFICE = "/Applications/LibreOffice.app/Contents/MacOS/soffice";

/** The command for `soffice` or `pdftoppm` if it can be run here, else null. */
export function findTool(bin: "soffice" | "pdftoppm"): string | null {
  for (const cmd of bin === "soffice" ? [bin, MAC_SOFFICE] : [bin]) {
    try { execFileSync(cmd, [bin === "soffice" ? "--version" : "-v"], { stdio: "ignore" }); return cmd; } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") return cmd; // it ran; a non-zero exit from a version flag still means it exists
    }
  }
  return null;
}

function tool(bin: "soffice" | "pdftoppm", args: string[]): void {
  const cmd = findTool(bin);
  if (!cmd) throw new Error(`${bin} is not installed, so the slides cannot be rendered here (${bin === "soffice" ? "it comes with LibreOffice" : "it comes with poppler"}). Install it, export the deck as a PDF yourself, or pass --pages with a folder of slide images exported from the deck.`);
  try { execFileSync(cmd, args, { stdio: ["ignore", "ignore", "pipe"], timeout: 300_000 }); } catch (e) {
    throw new Error(`${bin} failed: ${String((e as { stderr?: Buffer }).stderr ?? "").trim() || (e as Error).message}`);
  }
}

const pageName = (i: number, ext: string): string => `slide-${String(i + 1).padStart(2, "0")}${ext}`;

/** Renders the copy to `<outDir>/pages/slide-NN.png`: through a PDF for a deck, directly for a PDF. Returns the page paths. */
function renderPages(copy: string, outDir: string): string[] {
  const work = dirname(copy), pages = join(outDir, "pages");
  let pdf = copy;
  if (extname(copy).toLowerCase() !== ".pdf") {
    // Its own profile folder, so a LibreOffice the person has open is neither needed nor disturbed.
    tool("soffice", ["--headless", `-env:UserInstallation=${pathToFileURL(join(work, "office-profile")).href}`, "--convert-to", "pdf", "--outdir", work, copy]);
    pdf = join(work, `${basename(copy, extname(copy))}.pdf`);
    if (!existsSync(pdf)) throw new Error("soffice ran but wrote no PDF; the deck may be damaged or password-protected.");
  }
  // Long side at the video's 1920 px, so a 16:9 slide comes out exactly 1920×1080 instead of an odd size from a fixed DPI.
  tool("pdftoppm", ["-scale-to", "1920", "-png", pdf, join(pages, "p")]);
  // pdftoppm pads page numbers to the width of the page count, so order them by number, not by name.
  const made = readdirSync(pages).filter((f) => /^p-\d+\.png$/.test(f)).sort((a, b) => parseInt(a.slice(2), 10) - parseInt(b.slice(2), 10));
  return made.map((f, i) => { renameSync(join(pages, f), join(pages, pageName(i, ".png"))); return `pages/${pageName(i, ".png")}`; });
}

/** Copies ready-made slide images, in natural file-name order, to `<outDir>/pages/`. Returns the page paths. */
function copyPages(from: string, outDir: string): string[] {
  const images = readdirSync(from).filter((f) => /\.(png|jpe?g)$/i.test(f)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return images.map((f, i) => {
    const name = pageName(i, extname(f).toLowerCase());
    copyFileSync(join(from, f), join(outDir, "pages", name));
    return `pages/${name}`;
  });
}

/**
 * Turns a deck into a project folder: page pictures, slides.json and source-manifest.json. `pagesFrom` supplies slide
 * images already exported from the deck instead of rendering them here. A PDF has no notes or hidden slides, so its
 * slides are its pages.
 */
export async function importDeck(source: string, outDir: string, pagesFrom?: string): Promise<Slide[]> {
  const out = resolve(outDir);
  return guardSource(source, out, async (copy) => {
    const deck = extname(copy).toLowerCase() === ".pdf" ? null : await readDeck(copy);
    rmSync(join(out, "pages"), { recursive: true, force: true });
    mkdirSync(join(out, "pages"), { recursive: true });
    const pages = pagesFrom ? copyPages(resolve(pagesFrom), out) : renderPages(copy, out);
    if (!pages.length) throw new Error(pagesFrom ? `No .png or .jpg images in ${pagesFrom}.` : "Rendering produced no pages.");
    if (deck && deck.length !== pages.length)
      throw new Error(`The deck has ${deck.length} visible slides but there are ${pages.length} page pictures. Hidden slides are skipped; supply one picture per visible slide, in order.`);
    const slides: Slide[] = pages.map((page, i) => {
      const d = deck?.[i];
      return { n: i + 1, deck: d?.deck ?? i + 1, page, notes: d?.notes ?? "", text: d?.text ?? "", ...(d?.transition && { transition: d.transition }) };
    });
    writeFileSync(join(out, "slides.json"), JSON.stringify({ source: resolve(source), slides }, null, 2));
    return slides;
  });
}

export function readSlides(dir: string): Slide[] {
  const file = join(dir, "slides.json");
  if (!existsSync(file)) throw new Error(`No slides.json in ${dir}. Run import first.`);
  return (JSON.parse(readFileSync(file, "utf8")) as { slides: Slide[] }).slides;
}
