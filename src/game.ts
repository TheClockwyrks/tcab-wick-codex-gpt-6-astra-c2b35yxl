import type { Game } from "@clockwyrks/simple-2d";
import * as C from "./constants";
import type { WickState } from "./types";
import type { WickDebugApi } from "./debug-types";
import { initial, copy, stats, windowAt, xpNext } from "./model";
import { debug } from "./debug";
import { loadAssets } from "./assets";
import { render } from "./render";
import { input } from "./menus";
import { tick } from "./simulation";
export type * from "./types";
export type * from "./debug-types";
export type { WickSnapshot } from "./model";
export const BACKGROUND = "#0b1b23";
export const game: Game<WickState, WickDebugApi> = {
  async initialize(api) {
    for (const action of C.ACTIONS)
      api.input.register(action, { keys: [...C.BINDINGS[action]] });
    await loadAssets(api);
    api.diagnostics.register("Screen", (s) => s.screen);
    api.diagnostics.register("Clock", (s) => s.run.tick / C.TICK_HZ);
    api.diagnostics.register(
      "Level / XP",
      (s) => `${s.run.level} / ${s.run.xp.toFixed(1)} / ${xpNext(s.run.level)}`,
    );
    api.diagnostics.register(
      "Health",
      (s) => `${s.run.player.hp.toFixed(1)} / ${stats(s.run).maxHp}`,
    );
    api.diagnostics.register("Kills", (s) => s.run.kills);
    api.diagnostics.register(
      "Position",
      (s) =>
        `${s.run.player.x.toFixed(1)}, ${s.run.player.y.toFixed(1)} ${s.run.player.facing}`,
    );
    api.diagnostics.register(
      "Enemies / window",
      (s) => `${s.run.enemies.length} / ${windowAt(s.run.tick)}`,
    );
    api.diagnostics.register(
      "Effects",
      (s) => `${s.run.projectiles.length} bolts / ${s.run.zones.length} zones`,
    );
    api.diagnostics.register("Gems", (s) => s.run.gems.length);
    api.diagnostics.register("Tools", (s) =>
      s.run.weapons
        .map((w) => `${w.id} ${w.level} (${w.cooldown.toFixed(2)})`)
        .join(", "),
    );
    api.diagnostics.register("Trinkets", (s) =>
      s.run.passives.map((p) => `${p.id} ${p.level}`).join(", "),
    );
    api.diagnostics.register("Pending levels", (s) => s.run.pendingLevelUps);
    for (const key of [
      "spawning",
      "events",
      "despawning",
      "enemyMotion",
      "enemyContact",
      "weaponFire",
      "effectMotion",
      "drops",
      "progression",
    ] as const)
      api.diagnostics.register(key, (s) => s[key]);
    return [initial(), debug];
  },
  update(state, api, dt) {
    const s = copy(state);
    s.simTime += dt;
    const movement = input(s, api);
    if (s.screen === "playing") {
      s.accumulator += dt;
      while (
        s.screen === "playing" &&
        s.accumulator >= C.TICK_DT - C.TICK_EPSILON
      ) {
        s.accumulator -= C.TICK_DT;
        const cues = tick(s, movement.dx, movement.dy);
        for (const cue of cues) api.audio.play(cue);
      }
      if (Math.abs(s.accumulator) < C.TICK_EPSILON) s.accumulator = 0;
    } else s.accumulator = 0;
    if (s.screen !== "playing") s.accumulator = 0;
    const music = ["playing", "levelup", "chest", "paused"].includes(s.screen);
    const hum =
      s.screen === "playing" &&
      s.run.weapons.some((w) => w.id === "halo" || w.id === "corona");
    for (const [cue, wanted] of [
      [C.CUES.music, music],
      [C.CUES.hum, hum],
    ] as const) {
      if (wanted && !api.audio.looping(cue)) api.audio.loop(cue);
      else if (!wanted && api.audio.looping(cue)) api.audio.stop(cue);
    }
    s.muted = api.audio.muted();
    return s;
  },
  render,
};
