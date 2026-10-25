/** The animated slots in each scene kind, with their cue ids. Shared by the timeline and the scene builder. */
import type { Cue, Scene } from "./spec";

export interface Slot { id: string; cue?: Cue | undefined }

export function slots(scene: Scene): Slot[] {
  switch (scene.kind) {
    case "hook": return [{ id: "headline", cue: scene.headlineCue }, { id: "sub", cue: scene.subCue }];
    case "list": return scene.items.map((it, i) => ({ id: `item${i}`, cue: it.cue }));
    case "card": return [
      { id: "card", cue: scene.card.cue }, { id: "meta", cue: scene.card.metaCue },
      ...scene.card.rows.map((r, i) => ({ id: `row${i}`, cue: r.cue })),
      { id: "tags", cue: scene.card.tagsCue },
    ];
    case "chat": return scene.turns.map((t, i) => ({ id: `turn${i}`, cue: t.cue }));
    case "steps": return [...scene.steps.map((s, i) => ({ id: `step${i}`, cue: s.cue })), { id: "result", cue: scene.result?.cue }];
    case "grid": return scene.tiles.map((t, i) => ({ id: `tile${i}`, cue: t.cue }));
    case "media": return [{ id: "media", cue: scene.mediaCue }, ...scene.moments.map((m, i) => ({ id: `moment${i}`, cue: m.cue }))];
    case "cta": return [{ id: "sub", cue: scene.subCue }, { id: "pill", cue: scene.pill?.cue }, { id: "follow", cue: scene.followCue }];
  }
}
