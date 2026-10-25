"use strict";
/**
 * Deterministic animation engine for the Gleaner Short.
 * Every frame is a pure function of time: `renderAt(t)` positions every element,
 * so the capture can step frame by frame with no real-time playback.
 *
 * Markup contract (scenes.html, written by scenes.ts):
 *   <section class="scene">                one per voiceover line, in order
 *   data-cue="name"                        timeline cue that triggers the element ("line" = first word)
 *   data-delay="0.2"                       seconds after the cue (default 0)
 *   data-fx="up|pop|left|right|fade|drawY|drawX|type"
 *   data-dur="0.5"                         entrance length in seconds
 *   data-spot                              glow for ~1.4s after entering, then settle
 */
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const easeOut = (x) => 1 - Math.pow(1 - x, 3);
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const backOut = (x) => { const c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const FX_SET = new Set(["up", "pop", "left", "right", "fade", "drawY", "drawX", "type"]);
function setup(tl) {
    const scenes = Array.from(document.querySelectorAll("section.scene"));
    if (scenes.length !== tl.scenes.length)
        throw new Error(`scenes: ${scenes.length} in markup, ${tl.scenes.length} in timeline`);
    const anims = scenes.map((sc, i) => {
        const timing = tl.scenes[i];
        return Array.from(sc.querySelectorAll("[data-fx]")).map((el) => {
            const cueName = el.dataset["cue"] ?? "start";
            const base = cueName === "start" ? timing.start : timing.cues[cueName];
            if (base === undefined)
                throw new Error(`scene ${i + 1}: no cue "${cueName}"`);
            const fxName = el.dataset["fx"] ?? "up";
            if (!FX_SET.has(fxName))
                throw new Error(`unknown fx "${fxName}"`);
            const fx = fxName;
            return {
                el,
                at: base + Number(el.dataset["delay"] ?? 0),
                fx,
                dur: Number(el.dataset["dur"] ?? (fx === "type" ? 0 : 0.55)),
                spot: el.hasAttribute("data-spot"),
                text: fx === "type" ? (el.textContent ?? "") : "",
            };
        });
    });
    const blobs = Array.from(document.querySelectorAll(".blob"));
    const floaters = Array.from(document.querySelectorAll("[data-float]"));
    const progress = document.getElementById("progress");
    // Spotlight colour comes from the brand: --hl-rgb is "r, g, b".
    const hl = getComputedStyle(document.documentElement).getPropertyValue("--hl-rgb").trim() || "217, 138, 98";
    return (t) => {
        // Ambient motion: drifting background light so no frame is ever static.
        blobs.forEach((b, i) => {
            const k = i + 1;
            b.style.transform = `translate(${Math.sin(t * 0.21 * k + k) * 90}px, ${Math.cos(t * 0.17 * k + 2 * k) * 120}px) scale(${1 + 0.08 * Math.sin(t * 0.3 + k)})`;
        });
        floaters.forEach((f, i) => { f.style.translate = `0 ${Math.sin(t * 1.4 + i) * 10}px`; });
        if (progress)
            progress.style.transform = `scaleX(${clamp01(t / tl.duration)})`;
        scenes.forEach((sc, i) => {
            const { start, end } = tl.scenes[i];
            const fadeIn = i === 0 ? 1 : easeOut(clamp01((t - start) / 0.4));
            const fadeOut = i === scenes.length - 1 ? 1 : 1 - easeInOut(clamp01((t - (end - 0.12)) / 0.3));
            const vis = Math.min(fadeIn, fadeOut);
            sc.style.opacity = String(vis);
            sc.style.visibility = vis <= 0.001 || t < start - 0.01 ? "hidden" : "visible";
            // Push in on entry, drift slowly while held, lift away on exit.
            const hold = clamp01((t - start) / Math.max(1, end - start));
            const scale = 1.05 - 0.05 * fadeIn + 0.018 * hold - 0.02 * (1 - fadeOut);
            sc.style.transform = `translateY(${(1 - fadeIn) * 50 - (1 - fadeOut) * 60}px) scale(${scale})`;
            if (sc.style.visibility === "hidden")
                return;
            for (const a of anims[i]) {
                const raw = a.dur > 0 ? (t - a.at) / a.dur : t >= a.at ? 1 : 0;
                const p = clamp01(raw);
                const e = easeOut(p);
                const s = a.el.style;
                switch (a.fx) {
                    case "up":
                        s.opacity = String(e);
                        s.transform = `translateY(${(1 - e) * 70}px)`;
                        break;
                    case "fade":
                        s.opacity = String(e);
                        break;
                    case "left":
                        s.opacity = String(e);
                        s.transform = `translateX(${(1 - e) * -120}px)`;
                        break;
                    case "right":
                        s.opacity = String(e);
                        s.transform = `translateX(${(1 - e) * 120}px)`;
                        break;
                    case "pop": {
                        const b = p >= 1 ? 1 : backOut(p);
                        s.opacity = String(clamp01(p * 2));
                        s.transform = `scale(${0.55 + 0.45 * b})`;
                        break;
                    }
                    case "drawY":
                        s.transform = `scaleY(${easeInOut(p)})`;
                        break;
                    case "drawX":
                        s.transform = `scaleX(${easeInOut(p)})`;
                        break;
                    case "type": {
                        const n = Math.max(0, Math.floor((t - a.at) / 0.045));
                        const shown = a.text.slice(0, n);
                        const typing = n < a.text.length && t >= a.at;
                        const caret = typing || (t >= a.at && Math.floor(t * 2.2) % 2 === 0 && t - a.at < a.text.length * 0.045 + 1.2);
                        a.el.textContent = shown + (caret ? "▍" : "");
                        a.el.style.opacity = t >= a.at ? "1" : "0";
                        break;
                    }
                }
                if (a.spot) {
                    // Brief glow when an item is named, so the eye follows the voice.
                    const g = t < a.at ? 0 : Math.max(0, 1 - Math.max(0, t - a.at - 0.9) / 0.6) * clamp01((t - a.at) / 0.25);
                    a.el.style.boxShadow = g > 0 ? `0 0 0 ${3 * g}px rgba(${hl},${0.9 * g}), 0 18px 60px rgba(${hl},${0.28 * g})` : "none";
                }
            }
        });
    };
}
(function boot() {
    const w = window;
    const tl = w.TIMELINE;
    if (!tl)
        throw new Error("TIMELINE missing");
    w.renderAt = setup(tl);
    w.renderAt(0);
    w.ready = true;
})();
