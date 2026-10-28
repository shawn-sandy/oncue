/**
 * Writes the animated scenes page for a spec: <out>/scenes.html plus its fonts, logo, pictures and render.js.
 * Layout is designed on a stage whose short side is 1080 px (1080×1920 for 9:16, 1920×1080 for 16:9) and scaled
 * to spec.format. Frames wider than tall get the landscape layout (#stage.wide), arranged per scene kind by WIDE.
 */
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import sharp from "sharp";
import { iconSvg } from "./icons";
import type { Colors, LoadedSpec, Rich, Scene } from "./spec";
import { look, runs, stageFor, WIDE } from "./spec";

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Rich text → HTML: {accent} in the accent colour, `code` in mono. */
function rich(text: Rich): string {
  return runs(text).map((r) => r.accent ? `<span class="acc">${esc(r.text)}</span>` : r.code ? `<span class="code">${esc(r.text)}</span>` : esc(r.text)).join("");
}

function rgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

/** data-* attributes for an animated element. */
function fx(kind: string, cue?: string, extra: { delay?: number; dur?: number; spot?: boolean } = {}): string {
  return [`data-fx="${kind}"`, cue ? `data-cue="${cue}"` : "", extra.delay ? `data-delay="${extra.delay}"` : "",
    extra.dur ? `data-dur="${extra.dur}"` : "", extra.spot ? "data-spot" : ""].filter(Boolean).join(" ");
}

/** A content scene: kicker and title in .head, the rest in .body, so the landscape layout can place them side by side or stacked. */
const content = (kicker: string, title: Rich, inner: string): string =>
  `<div class="content"><div class="head"><div class="kicker" ${fx("up", undefined, { delay: 0.1 })}>${esc(kicker)}</div>\n<h2 ${fx("up", undefined, { delay: 0.2 })}>${rich(title)}</h2></div><div class="body">${inner}</div></div>`;

/** Where beat i's picture is copied, relative to the scenes page: numbered by beat, so names never collide or need escaping. */
const imageFile = (i: number, src: string): string => `images/beat-${i + 1}${extname(src).toLowerCase()}`;

function body(scene: Scene, c: Colors, i: number): string {
  const ico = (name: string, color = c.accent): string => `<span class="svg">${iconSvg(name, color)}</span>`;
  switch (scene.kind) {
    case "hook": {
      // Build the headline word by word, keeping accent spans intact.
      let i = 0;
      const hw = runs(scene.headline).flatMap((r) => r.text.split(/\s+/).filter(Boolean).map((w) =>
        `<span class="w${r.accent ? " acc" : ""}" ${fx("up", "headline", { delay: Number((0.1 * i++).toFixed(2)) })}>${esc(w)}</span>`)).join(" ");
      return `<div class="center hook"><div data-float><img class="logo-xl" src="logo.png" alt="" ${fx("pop", undefined, { delay: 0.05, dur: 0.7 })}></div>
<h1 class="hookline">${hw}</h1>
${scene.sub ? `<div class="sub" ${fx("up", "sub")}>${rich(scene.sub)}</div>` : ""}</div>`;
    }
    case "list":
      return content(scene.kicker, scene.title, `<div class="stack">${scene.items.map((it, i) =>
        `<div class="card row" ${fx("left", `item${i}`, { spot: true })}><div class="ico">${ico(it.icon)}</div><div><div class="rt">${esc(it.title)}</div>${it.desc ? `<div class="rd">${rich(it.desc)}</div>` : ""}</div></div>`).join("")}</div>`);
    case "card": {
      const k = scene.card;
      return content(scene.kicker, scene.title, `
<div class="panel" ${fx("up", "card", { dur: 0.6 })}><div><div class="pt">${esc(k.title)}</div>${k.meta ? `<div class="pm" ${fx("fade", "meta")}>${esc(k.meta)}</div>` : ""}</div>
<div class="hr" ${fx("drawX", "card", { delay: 0.3, dur: 0.6 })}></div>
${k.rows.map((r, i) => `<div ${fx("left", `row${i}`)}><div class="pk">${esc(r.label)}</div><div class="pv">${rich(r.value)}</div></div>`).join("\n")}
${k.tags?.length ? `<div class="tags">${k.tags.map((t, i) => `<span class="tag" ${fx("pop", "tags", { delay: Number((0.12 * i).toFixed(2)) })}>${esc(t)}</span>`).join("")}</div>` : ""}</div>`);
    }
    case "chat": {
      const firstYou = scene.turns.findIndex((t) => t.from === "you");
      return content(scene.kicker, scene.title, `<div class="thread">
${firstYou >= 0 ? `<div class="string" ${fx("drawY", `turn${firstYou}`, { dur: 4.5 })}></div>` : ""}
${scene.turns.map((t, i) => t.from === "you"
  ? `<div class="bubble" ${fx("up", `turn${i}`)}><div class="wrap" ${fx("pop", `turn${i}`, { delay: 0.2 })}><i></i><i></i></div><div class="who">you</div><div class="said" ${fx("type", `turn${i}`, { delay: 0.15 })}>${esc(t.text)}</div></div>`
  : `<div class="bubble reply" ${fx("up", `turn${i}`, { spot: true })}><b>${esc(BRAND_LABEL)}</b> ${esc(t.text)}</div>`).join("\n")}
</div>`);
    }
    case "steps":
      return content(scene.kicker, scene.title, `<div class="steps"><div class="line" ${fx("drawY", "step0", { dur: 5 })}></div>
${scene.steps.map((s, i) => `<div class="step"><div class="num" ${fx("pop", `step${i}`)}>${i + 1}</div><div ${fx("left", `step${i}`, { delay: 0.1 })}><div class="rt">${esc(s.title)}</div>${s.desc ? `<div class="rd">${rich(s.desc)}</div>` : ""}</div></div>`).join("\n")}</div>
${scene.result ? `<div class="result" ${fx("up", "result", { spot: true })}><span class="svg sm">${iconSvg("FiCheck", c.panelInk)}</span>${esc(scene.result.text)}</div>` : ""}`);
    case "grid":
      return content(scene.kicker, scene.title, `<div class="grid">${scene.tiles.map((t, i) =>
        `<div class="tile" ${fx("pop", `tile${i}`, { spot: true })}><span class="svg md">${iconSvg(t.icon, c.accent)}</span><span>${esc(t.label)}</span></div>`).join("")}</div>`);
    case "media":
      return content(scene.kicker, scene.title, `
<div class="player" ${fx("pop", "media", { dur: 0.6 })}><div class="play" ${fx("pop", "media", { delay: 0.25, spot: true })}><span class="svg lg">${iconSvg("FiPlay", c.ground)}</span></div><div class="scrub" ${fx("drawX", "media", { delay: 0.4, dur: 5 })}></div></div>
<div class="moments">${scene.moments.map((m, i) => `<div class="moment" ${fx("left", `moment${i}`, { spot: true })}><span class="ts">${esc(m.time)}</span><span class="ml">${esc(m.label)}</span></div>`).join("")}</div>`);
    case "image":
      return content(scene.kicker, scene.title, `<div class="photo" ${fx("pop", "image", { spot: true })}><img src="${imageFile(i, scene.src)}" alt=""></div>
${scene.caption ? `<div class="caption" ${fx("up", "caption")}>${rich(scene.caption)}</div>` : ""}`);
    case "cta":
      return `<div class="center"><div data-float><img class="logo-lg" src="logo.png" alt="" ${fx("pop", undefined, { delay: 0.05, dur: 0.7 })}></div>
<h1 class="cta" ${fx("up", undefined, { delay: 0.25 })}>${rich(scene.headline)}</h1>
${scene.sub ? `<div class="sub" ${fx("up", "sub")}>${rich(scene.sub)}</div>` : ""}
${scene.pill ? `<div class="pill" ${fx("pop", "pill", { spot: true })}><span class="svg md">${iconSvg(scene.pill.icon, c.ground)}</span><span>${esc(scene.pill.text)}</span></div>` : ""}
${scene.follow ? `<div class="follow" ${fx("up", "follow")}>${rich(scene.follow)}</div>` : ""}</div>`;
  }
}

let BRAND_LABEL = "";

function fontFile(pkg: string, weight: number, root: string): string {
  const f = join(root, "node_modules", "@fontsource", pkg, "files", `${pkg}-latin-${weight}-normal.woff2`);
  if (!existsSync(f)) throw new Error(`Font file missing: ${f}. Run: npm install @fontsource/${pkg} (in the engine folder).`);
  return f;
}

export async function writeScenes(loaded: LoadedSpec, outDir: string, engineRoot: string): Promise<string> {
  const { spec, logoPath } = loaded;
  const c = spec.brand.colors;
  BRAND_LABEL = spec.brand.name.toLowerCase();
  mkdirSync(join(outDir, "fonts"), { recursive: true });
  const faces: string[] = [];
  for (const w of [400, 600, 700, 800]) {
    copyFileSync(fontFile(spec.brand.fonts.sans, w, engineRoot), join(outDir, "fonts", `sans-${w}.woff2`));
    faces.push(`@font-face{font-family:"Sans";src:url(fonts/sans-${w}.woff2) format("woff2");font-weight:${w}}`);
  }
  for (const w of [400, 600]) {
    copyFileSync(fontFile(spec.brand.fonts.mono, w, engineRoot), join(outDir, "fonts", `mono-${w}.woff2`));
    faces.push(`@font-face{font-family:"Mono";src:url(fonts/mono-${w}.woff2) format("woff2");font-weight:${w}}`);
  }
  copyFileSync(logoPath, join(outDir, "logo.png"));
  copyFileSync(resolve(engineRoot, "dist", "render.js"), join(outDir, "render.js"));
  // Pictures are copied upright and at most 2160 px on the long side, never enlarged, so a large phone photo
  // doesn't slow every captured frame. The deck uses the original.
  mkdirSync(join(outDir, "images"), { recursive: true });
  await Promise.all(spec.lines.map((l, i) => l.scene.kind === "image"
    ? sharp(resolve(loaded.dir, l.scene.src)).autoOrient().resize(2160, 2160, { fit: "inside", withoutEnlargement: true }).toFile(join(outDir, imageFile(i, l.scene.src)))
    : undefined));

  const stage = stageFor(spec.format);
  // Theme scales on today's design px: every default is ×1, so a spec without a theme writes the same page.
  const L = look(spec);
  const px = (v: number): string => `${Math.round(v * 100) / 100}px`;
  const r = (v: number): string => px(v * L.radius), t = (v: number): string => px(v * L.type), d = (v: number): string => px(v * L.density);
  const o = (v: number): string => String(Math.round(v * L.background * 1000) / 1000);
  const brandRow = L.header === "none" ? "" : `<div class="brand"><img src="logo.png" alt="">${L.header === "brand" ? esc(spec.brand.name) : ""}</div>`;
  const blobs = L.background ? `<div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div>` : "";
  const sceneHtml = spec.lines.map((l, i) =>
    `<!-- ${i + 1} · ${l.scene.kind} -->\n<section class="scene${stage.wide ? ` is-${WIDE[l.scene.kind]}` : ""}">${l.scene.kind === "hook" || l.scene.kind === "cta" ? "" : brandRow}\n${body(l.scene, c, i)}\n</section>`).join("\n\n");

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${esc(spec.title)}</title>
<style>
${faces.join("\n")}
:root{--ground:${c.ground};--card:${c.card};--chip:${c.chip};--rule:${c.rule};--ink:${c.ink};--muted:${c.muted};--accent:${c.accent};--hl:${c.highlight};--hl-rgb:${rgb(c.highlight)};--you:${c.you};--panel:${c.panel};--panel-ink:${c.panelInk};--panel-muted:${c.panelMuted};--panel-rule:${c.panelRule}}
*{box-sizing:border-box}html,body{margin:0;background:var(--ground);overflow:hidden}
#stage{position:relative;width:${stage.width}px;height:${stage.height}px;overflow:hidden;background:var(--ground);font-family:"Sans",sans-serif;color:var(--ink);transform:scale(${stage.scale});transform-origin:0 0}
.blob{position:absolute;border-radius:50%;filter:blur(90px);opacity:${o(0.55)}}
.b1{width:900px;height:900px;left:-300px;top:-200px;background:var(--panel)}
.b2{width:760px;height:760px;right:-320px;top:700px;background:var(--chip)}
.b3{width:620px;height:620px;left:120px;bottom:-260px;background:var(--hl);opacity:${o(0.12)}}
#progress{position:absolute;left:0;top:0;width:100%;height:10px;background:var(--hl);transform-origin:left;transform:scaleX(0);z-index:5}
.scene{position:absolute;inset:0;visibility:hidden;transform-origin:50% 40%}
.brand{position:absolute;left:90px;top:96px;display:flex;align-items:center;gap:20px;font-weight:700;font-size:${t(44)}}
.brand img{width:76px;height:76px;object-fit:contain}
.content{position:absolute;left:90px;right:90px;top:230px;bottom:360px;display:flex;flex-direction:column;justify-content:center;gap:${d(34)}}
.head,.body{display:flex;flex-direction:column;gap:${d(34)}}
.center{position:absolute;left:90px;right:90px;top:260px;bottom:340px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${d(44)};text-align:center}
.kicker{font-family:"Mono",monospace;font-size:${t(32)};letter-spacing:.14em;text-transform:uppercase;color:var(--accent)}
h1,h2{margin:0;font-weight:800;letter-spacing:-.02em;line-height:1.08}
h2{font-size:${t(80)}}.hookline{font-size:${t(104)}}.cta{font-size:${t(120)}}
.w{display:inline-block}
.acc{color:var(--accent)}.code{font-family:"Mono",monospace;color:var(--ink)}
.logo-xl{width:360px;height:360px;display:block;object-fit:contain}.logo-lg{width:260px;height:260px;display:block;object-fit:contain}
.sub{font-size:${t(46)};color:var(--muted)}.sub .acc{color:var(--hl);font-weight:700}
.follow{font-size:${t(44)};color:var(--accent)}
.svg{display:inline-flex;width:54px;height:54px}.svg svg{width:100%;height:100%}
.svg.sm{width:56px;height:56px}.svg.md{width:64px;height:64px}.svg.lg{width:84px;height:84px}
.stack{display:flex;flex-direction:column;gap:${d(30)};margin-top:${d(10)}}
.card{background:var(--card);border:2px solid var(--rule);border-radius:${r(36)}}
.row{display:flex;gap:${d(34)};align-items:center;padding:${d(34)} ${d(38)}}
.ico{width:110px;height:110px;flex:none;border-radius:50%;background:var(--chip);display:flex;align-items:center;justify-content:center}
.rt{font-size:${t(46)};font-weight:700;line-height:1.15}.rd{font-size:${t(34)};color:var(--muted);line-height:1.3;margin-top:6px}
.panel{background:var(--panel);border-radius:${r(44)};padding:${d(48)} ${d(50)};display:flex;flex-direction:column;gap:${d(26)};color:var(--panel-ink)}
.pt{font-size:${t(52)};font-weight:800}.pm{font-family:"Mono",monospace;font-size:${t(28)};color:var(--panel-muted)}
.hr{height:3px;background:var(--panel-rule);transform-origin:left}
.pk{font-size:${t(38)};font-weight:700}.pv{font-size:${t(34)};color:var(--panel-muted);margin-top:2px}
.tags{display:flex;gap:${d(16)};flex-wrap:wrap}.tag{font-family:"Mono",monospace;font-size:${t(32)};padding:${d(10)} ${d(28)};border-radius:999px;background:var(--panel-rule);color:var(--panel-ink)}
.thread{position:relative;padding-left:110px;display:flex;flex-direction:column;gap:${d(30)};margin-top:${d(10)}}
.string{position:absolute;left:44px;top:30px;bottom:30px;width:8px;border-radius:4px;background:var(--hl);transform-origin:top}
.wrap{position:absolute;left:-80px;top:52px;width:54px;display:flex;flex-direction:column;gap:9px}.wrap i{display:block;height:7px;border-radius:4px;background:var(--hl)}
.bubble{position:relative;background:var(--card);border:2px solid var(--rule);border-radius:${r(30)};padding:${d(28)} ${d(36)}}
.who{font-family:"Mono",monospace;font-size:${t(26)};letter-spacing:.14em;text-transform:uppercase;color:var(--you)}
.said{font-family:"Mono",monospace;font-size:${t(42)};margin-top:8px;min-height:${t(52)}}
.reply{font-size:${t(38)};line-height:1.3}.reply b{color:var(--accent)}
.steps{position:relative;display:flex;flex-direction:column;gap:${d(64)};margin-top:${d(20)}}
.steps .line{position:absolute;left:61px;top:70px;bottom:70px;width:8px;border-radius:4px;background:var(--hl);transform-origin:top}
.step{position:relative;display:flex;gap:${d(40)};align-items:flex-start}
.num{width:130px;height:130px;flex:none;border-radius:50%;background:var(--hl);color:var(--ground);font-size:${t(58)};font-weight:800;display:flex;align-items:center;justify-content:center}
.result{display:flex;align-items:center;gap:${d(24)};padding:${d(28)} ${d(36)};border-radius:${r(30)};background:var(--panel);color:var(--panel-ink);font-size:${t(38)};font-weight:700;margin-top:${d(10)}}
.player{position:relative;height:500px;border-radius:${r(44)};background:var(--card);border:2px solid var(--rule);display:flex;align-items:center;justify-content:center;overflow:hidden}
.play{width:190px;height:190px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center}
.scrub{position:absolute;left:0;bottom:0;height:12px;width:100%;background:var(--hl);transform-origin:left}
.moments{display:flex;flex-direction:column;gap:${d(14)}}.moment{display:flex;align-items:center;gap:${d(32)};padding:${d(20)} ${d(26)};border-radius:999px}
.ts{font-family:"Mono",monospace;font-size:${t(36)};font-weight:600;padding:${d(12)} ${d(32)};border-radius:999px;background:var(--chip);color:var(--accent)}.ml{font-size:${t(40)}}
.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:${d(30)};margin-top:${d(10)}}
.tile{display:flex;flex-direction:column;gap:${d(30)};padding:${d(40)} ${d(36)};border-radius:${r(36)};background:var(--card);border:2px solid var(--rule)}.tile>span:last-child{font-size:${t(40)};font-weight:700;line-height:1.15}
.body:has(>.photo){flex:1;min-height:0}
/* The picture takes the height left under the title, but never under a third of the short side: in a frame too
   short for that (a square one), the scene overflows and the fit guard shrinks it and warns. */
.photo{position:relative;flex:1;min-height:360px;background:var(--card);border:2px solid var(--rule);border-radius:${r(36)};overflow:hidden}
.photo img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}
.caption{font-size:${t(36)};color:var(--muted);line-height:1.3}
.pill{display:flex;align-items:center;gap:${d(24)};padding:${d(34)} ${d(52)};border-radius:999px;background:var(--accent);color:var(--ground)}.pill>span:last-child{font-family:"Mono",monospace;font-size:${t(44)};font-weight:600}
/* Landscape: a 1080 px tall canvas with no Shorts safe zone (YouTube overlays only captions and the progress bar). */
.wide .b2{top:240px}
.wide .brand{top:64px}
.wide .content{top:180px;bottom:90px}
.wide .center{top:110px;bottom:110px}
.wide .logo-xl{width:300px;height:300px}.wide .logo-lg{width:220px;height:220px}
.wide .player{height:380px}
/* Content "side": kicker and title in a column beside the body. */
.wide .is-side .content{flex-direction:row;align-items:center;gap:${d(100)}}
.wide .is-side .head{flex:0 0 36%}.wide .is-side .body{flex:1;min-width:0}.wide .is-side .body:has(>.photo){align-self:stretch}
/* Content "top": kicker and title above a body laid out across the width. */
.wide .is-top .stack,.wide .is-top .steps{flex-direction:row;gap:${d(30)}}
.wide .is-top .stack>*,.wide .is-top .step{flex:1;min-width:0}
.wide .is-top .row{flex-direction:column;align-items:flex-start}.wide .is-top .steps .line{display:none}
.wide .is-top .grid{grid-template-columns:repeat(3,minmax(0,1fr))}
.wide .is-top .body:has(>.player){flex-direction:row;align-items:center}.wide .is-top .player{flex:1.4}.wide .is-top .moments{flex:1}
/* hook and cta "stack" keeps the portrait column; "side" moves the logo left of a left-aligned text column. */
.wide .is-side .center{align-items:flex-start;text-align:left;padding-left:420px}
.wide .is-side .center>[data-float]{position:absolute;left:0;top:0;bottom:0;display:flex;align-items:center}
.wide .is-side .logo-xl,.wide .is-side .logo-lg{width:320px;height:320px}
</style></head>
<body><div id="stage"${stage.wide ? ' class="wide"' : ""}>${blobs}<div id="progress"></div>
${sceneHtml}
</div><script src="render.js"></script></body></html>`;
  const file = join(outDir, "scenes.html");
  writeFileSync(file, html);
  return file;
}
