/// <reference types="node" />
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { readFile } from "node:fs/promises";
import { Buffer } from "node:buffer";
import {
  createEngine,
  ConstantClock,
  type Engine,
} from "@clockwyrks/simple-2d";
import { game, type WickState, type WickDebugApi } from "./game";
import * as C from "./constants";
import { imagePaths } from "./assets";
import { initial, stats, row, pool } from "./model";

// Adapt browser decoding and events, while using the real engine, assets,
// initialization, update, renderer, cue bus, and fixed clock in every test.
class TestAudioContext {
  readonly state = "suspended";
  readonly currentTime = 0;
  async decodeAudioData(data: ArrayBuffer) {
    const v = new DataView(data);
    expect(v.getUint32(0)).toBe(0x52494646);
    return { duration: data.byteLength / 88200 };
  }
  async resume() {}
}
let engine: Engine<WickState, WickDebugApi>;
let events: EventTarget;
let cues: string[];
let loaded: string[];
const key = (code: string, type = "keydown") =>
  events.dispatchEvent(Object.assign(new Event(type), { code, repeat: false }));
const tap = async (code: string) => {
  key(code);
  await engine.advance(1);
  key(code, "keyup");
};
const pointer = (type: string, x: number, y: number, device = "mouse") =>
  events.dispatchEvent(
    Object.assign(new Event(type), {
      clientX: x,
      clientY: y,
      pointerId: 1,
      pointerType: device,
      isPrimary: true,
      button: type === "pointermove" ? -1 : 0,
      buttons: type === "pointerdown" ? 1 : 0,
    }),
  );
const pose = (fn: (d: WickDebugApi, s: WickState) => WickState) =>
  engine.apply((s) => fn(engine.debug, s));
const run = () => engine.state.run;
async function isolated() {
  pose((d, s) => d.setScreen(s, "playing"));
  for (const setter of [
    "setSpawning",
    "setEvents",
    "setDespawning",
    "setEnemyMotion",
    "setEnemyContact",
  ] as const)
    pose((d, s) => d[setter](s, false));
}
beforeAll(() => {
  vi.stubGlobal(
    "fetch",
    async (path: string) => new Response(await readFile(path)),
  );
  vi.stubGlobal("createImageBitmap", async (blob: Blob) =>
    loadImage(Buffer.from(await blob.arrayBuffer())),
  );
  vi.stubGlobal("AudioContext", TestAudioContext);
});
afterAll(() => vi.unstubAllGlobals());
beforeEach(async () => {
  events = new EventTarget();
  cues = [];
  loaded = [];
  engine = createEngine({
    canvas: createCanvas(C.STAGE_W, C.STAGE_H) as unknown as HTMLCanvasElement,
    width: C.STAGE_W,
    height: C.STAGE_H,
    game,
    background: "#0b1b23",
    clock: new ConstantClock(1000 / C.TICK_HZ),
    surface: {
      cssWidth: () => C.STAGE_W,
      cssHeight: () => C.STAGE_H,
      dpr: () => 1,
      events: () => events,
    },
  });
  engine.events.on("cue:played", (e) => cues.push(e.cue));
  engine.events.on("asset:loaded", (e) => loaded.push(e.path));
  await engine.initialize();
});
afterEach(() => {
  engine.destroy();
  vi.restoreAllMocks();
});

describe("engine integration and screens", () => {
  it("loads every committed image and cue before the first frame", () => {
    expect(loaded).toHaveLength(
      imagePaths().length + Object.keys(C.CUE_PATHS).length,
    );
    expect(engine.debug.snapshot(engine.state).screen).toBe("title");
    expect(engine.diagnostics().length).toBeGreaterThanOrEqual(20);
    expect(engine.debug.version).toBe(C.WICK_DEBUG_VERSION);
  });
  it("starts a fresh run and consumes the confirming frame", async () => {
    await tap("Enter");
    expect(run().tick).toBe(1);
    expect(run().weapons[0].id).toBe("taper");
    expect(run().enemies).toHaveLength(1);
    expect(cues).toContain(C.CUES.menuConfirm);
  });
  it("wraps menus, returns to the referring title item, and resets abandoned runs", async () => {
    await tap("ArrowUp");
    expect(engine.state.menuIndex).toBe(2);
    await tap("Space");
    expect(engine.state.screen).toBe("howto");
    await tap("Escape");
    expect(engine.state.menuIndex).toBe(2);
    await tap("ArrowDown");
    await tap("Enter");
    await tap("KeyP");
    expect(engine.state.screen).toBe("paused");
    await tap("ArrowDown");
    await tap("Enter");
    expect(engine.state.run).toEqual(initial().run);
  });
  it("keeps simTime running but freezes the night while paused", async () => {
    await isolated();
    await engine.advance(5);
    await tap("Escape");
    const time = run().tick,
      sim = engine.state.simTime;
    await engine.advance(12);
    expect(run().tick).toBe(time);
    expect(engine.state.simTime).toBeCloseTo(sim + 12 * C.TICK_DT);
    await tap("KeyP");
    expect(run().tick).toBe(time + 1);
  });
  it("accepts a same-frame touch tap and never clicks through to the next screen", async () => {
    pointer("pointerdown", 200, 410, "touch");
    pointer("pointerup", 200, 410, "touch");
    await engine.advance(1);
    expect(engine.state.screen).toBe("playing");
    expect(run().tick).toBe(1);
  });
  it("cancels dragged-out presses and supports hover, tabs, and wheel scrolling", async () => {
    pointer("pointerdown", 200, 410);
    await engine.advance(1);
    pointer("pointerup", 800, 500);
    await engine.advance(1);
    expect(engine.state.screen).toBe("title");
    pointer("pointermove", 200, 475);
    await engine.advance(1);
    expect(engine.state.menuIndex).toBe(1);
    await tap("Enter");
    events.dispatchEvent(
      Object.assign(new Event("wheel"), {
        deltaX: 0,
        deltaY: 300,
        deltaMode: 0,
      }),
    );
    await engine.advance(1);
    expect(engine.state.almanacScroll).toBe(3);
    expect(engine.state.menuIndex).toBe(0);
    pointer("pointerdown", 680, 140);
    pointer("pointerup", 680, 140);
    await engine.advance(1);
    expect(engine.state.almanacTab).toBe(2);
    expect(engine.state.almanacScroll).toBe(0);
    await tap("ArrowUp");
    expect(engine.state.menuIndex).toBe(C.ENEMY_IDS.length - 1);
    expect(engine.state.almanacScroll).toBe(
      C.ENEMY_IDS.length - C.ALMANAC_ROWS,
    );
  });
  it("mirrors mute and reset preserves that bit", async () => {
    await tap("KeyM");
    expect(engine.state.muted).toBe(true);
    pose((d, s) => d.reset(s));
    expect(engine.state.muted).toBe(true);
    expect(engine.state.simTime).toBe(0);
  });
  it("renders every almanac entry and all overlay variants without changing state", async () => {
    pose((d, s) => d.setScreen(s, "almanac"));
    for (let tab = 0; tab < 4; tab++) {
      const count = [16, 10, 13, 6][tab];
      for (let i = 0; i < count; i++) {
        await engine.advance(1);
        await tap("ArrowDown");
      }
      await tap("ArrowRight");
    }
    for (const screen of [
      "howto",
      "paused",
      "fallen",
      "dawn",
      "chest",
    ] as const) {
      pose((d, s) => d.setScreen(s, screen));
      await engine.advance(1);
    }
    expect(run().tick).toBe(0);
  });
});

describe("fixed ticks and movement", () => {
  it("carries fractional frames and discards only on leaving play", async () => {
    await isolated();
    engine.setClock(new ConstantClock(5));
    await engine.advance(3);
    expect(run().tick).toBe(0);
    expect(engine.state.accumulator).toBeCloseTo(0.015);
    await engine.advance(1);
    expect(run().tick).toBe(1);
    expect(engine.state.accumulator).toBeCloseTo(0.02 - C.TICK_DT);
    pose((d, s) => d.setScreen(s, "paused"));
    expect(engine.state.accumulator).toBe(0);
  });
  it("runs exactly 30 ticks in a half-second and normalizes diagonal speed", async () => {
    await isolated();
    engine.setClock(new ConstantClock(500));
    key("KeyD");
    key("KeyW");
    await engine.advance(1);
    expect(run().tick).toBe(30);
    expect(Math.hypot(run().player.x, run().player.y)).toBeCloseTo(
      C.MOVE_SPEED * 0.5,
    );
    expect(engine.state.accumulator).toBe(0);
  });
  it("cancels opposite directions and preserves horizontal facing when walking vertically", async () => {
    await isolated();
    key("KeyA");
    await engine.advance(1);
    expect(run().player.facing).toBe("left");
    key("KeyD");
    const x = run().player.x;
    key("KeyW");
    await engine.advance(1);
    expect(run().player.x).toBe(x);
    expect(run().player.facing).toBe("left");
  });
  it("keeps prior state and snapshots independent of subsequent frames", async () => {
    await isolated();
    const previous = engine.state;
    const snap = engine.debug.snapshot(previous);
    await engine.advance(2);
    expect(previous.run.tick).toBe(0);
    expect(snap.run.tick).toBe(0);
    expect(run().tick).toBe(2);
    expect("visual" in snap).toBe(false);
  });
});

describe("combat and effects", () => {
  it("slashes only on firing and uses strict rectangle-circle overlap", async () => {
    await isolated();
    pose((d, s) => d.setWeapon(s, 0, "taper", 1));
    pose((d, s) => d.spawnEnemy(s, "rat", 132, 0));
    pose((d, s) => d.spawnEnemy(s, "rat", 131.9, 0));
    await engine.advance(1);
    expect(run().enemies[0].hp).toBe(C.ENEMIES.rat.hp);
    expect(run().enemies[1].hp).toBe(
      C.ENEMIES.rat.hp - C.TAPER_LEVELS[0].damage,
    );
    await engine.advance(5);
    expect(run().enemies[1].hp).toBe(
      C.ENEMIES.rat.hp - C.TAPER_LEVELS[0].damage,
    );
    await engine.advance(1);
    expect(run().zones).toHaveLength(0);
  });
  it("spends finite pierce in ascending enemy id and never re-hits", async () => {
    await isolated();
    pose((d, s) => d.setEffectMotion(s, false));
    for (let i = 0; i < 3; i++) pose((d, s) => d.spawnEnemy(s, "rat", 50, 0));
    pose((d, s) => d.spawnProjectile(s, "pin", 50, 0, 0, 0, 1));
    await engine.advance(1);
    expect(run().enemies.map((e) => e.hp)).toEqual([
      C.ENEMIES.rat.hp - 6,
      C.ENEMIES.rat.hp - 6,
      C.ENEMIES.rat.hp,
    ]);
    expect(run().projectiles).toHaveLength(0);
  });
  it("fires nearest-target bolts with stable ties and no movement on the creation tick", async () => {
    await isolated();
    pose((d, s) => d.setWeapon(s, 0, "ember", 2));
    pose((d, s) => d.spawnEnemy(s, "shade", 100, 0));
    pose((d, s) => d.spawnEnemy(s, "shade", 0, 100));
    await engine.advance(1);
    expect(run().projectiles.map((p) => [p.x, p.y])).toEqual([
      [0, 0],
      [0, 0],
    ]);
    expect(run().projectiles[0].vx).toBe(C.EMBER_LEVELS[1].speed);
    expect(run().projectiles[1].vy).toBe(C.EMBER_LEVELS[1].speed);
    await engine.advance(1);
    expect(run().projectiles[0].x).toBeCloseTo(
      C.EMBER_LEVELS[1].speed * C.TICK_DT,
    );
  });
  it("fires Pin horizontally at staggered origins without a target", async () => {
    await isolated();
    pose((d, s) => d.setFacing(s, "left"));
    pose((d, s) => d.setWeapon(s, 0, "pin", 4));
    await engine.advance(1);
    expect(run().projectiles.map((p) => p.y)).toEqual([
      -C.PIN_SPREAD,
      0,
      C.PIN_SPREAD,
    ]);
    expect(run().projectiles.every((p) => p.vx < 0 && p.vy === 0)).toBe(true);
  });
  it("bounces Shard at the moving view and integrates Sconce position before acceleration", async () => {
    await isolated();
    pose((d, s) => d.spawnProjectile(s, "shard", 639, 0, 500, 0, -1));
    pose((d, s) => d.spawnProjectile(s, "sconce", 0, 200, 600, 0, -1));
    await engine.advance(1);
    expect(run().projectiles[0].x).toBe(C.STAGE_CX);
    expect(run().projectiles[0].vx).toBe(-500);
    expect(run().projectiles[1].x).toBe(10);
    expect(run().projectiles[1].vx).toBe(590);
  });
  it("places aura even with firing disabled, follows the player, and removes it when unheld", async () => {
    await isolated();
    pose((d, s) => d.setWeaponFire(s, false));
    pose((d, s) => d.setWeapon(s, 0, "halo", 1));
    await engine.advance(1);
    expect(run().zones[0].ttl).toBe(null);
    pose((d, s) => d.setPlayerPosition(s, 100, 200));
    pose((d, s) => d.setPassive(s, 0, "glass", 2));
    await engine.advance(1);
    expect(run().zones[0]).toMatchObject({ x: 100, y: 200, radius: 96 });
    pose((d, s) => d.removeWeapon(s, 0));
    await engine.advance(1);
    expect(run().zones).toHaveLength(0);
  });
  it("times per-projectile re-hits while motion is held", async () => {
    await isolated();
    pose((d, s) => d.setEffectMotion(s, false));
    pose((d, s) => d.spawnEnemy(s, "shade", 100, 0));
    pose((d, s) => d.spawnProjectile(s, "shard", 100, 0, 500, 0, -1));
    await engine.advance(1);
    const hp = run().enemies[0].hp;
    await engine.advance(29);
    expect(run().enemies[0].hp).toBe(hp);
    await engine.advance(1);
    expect(run().enemies[0].hp).toBe(hp - C.SHARD_LEVELS[0].damage);
  });
  it("pulses a posed puddle on the next tick, then at its interval", async () => {
    await isolated();
    pose((d, s) => d.spawnEnemy(s, "shade", 90, 0));
    pose((d, s) => d.spawnPuddle(s, "oil-splash", 90, 0));
    await engine.advance(1);
    const hp = run().enemies[0].hp;
    await engine.advance(Math.round(C.OIL_PULSE * C.TICK_HZ) - 1);
    expect(run().enemies[0].hp).toBe(hp);
    await engine.advance(1);
    expect(run().enemies[0].hp).toBe(hp - C.OIL_SPLASH_LEVELS[0].damage);
  });
  it("creates immortal Chandelier lanterns and rebuilds their count when Mirror changes", async () => {
    await isolated();
    pose((d, s) => d.setWeapon(s, 0, "chandelier", 1));
    await engine.advance(2);
    expect(run().zones).toHaveLength(C.CHANDELIER_STATS.amount);
    const old = run().zones[0].id;
    pose((d, s) => d.setPassive(s, 0, "mirror", 1));
    await engine.advance(1);
    expect(run().zones).toHaveLength(C.CHANDELIER_STATS.amount + 1);
    expect(run().zones.every((z) => z.ttl === null && z.id > old)).toBe(true);
  });
  it("Pyre heals on every hit but Corona heals only on its own lethal hits", async () => {
    await isolated();
    pose((d, s) => d.setHp(s, 50));
    pose((d, s) => d.setWeapon(s, 0, "corona", 1));
    pose((d, s) => d.spawnEnemy(s, "shade", 60, 0));
    await engine.advance(1);
    expect(run().player.hp).toBe(50);
    pose((d, s) => d.setEnemyHp(s, run().enemies[0].id, 1));
    pose((d, s) => d.setWeaponCooldown(s, 0, 0));
    await engine.advance(1);
    expect(run().player.hp).toBe(51);
    pose((d, s) => d.setWeapon(s, 0, "pyre", 1));
    pose((d, s) => d.spawnEnemy(s, "shade", 60, 0));
    await engine.advance(1);
    expect(run().player.hp).toBe(52);
  });
  it("Flare leaves the Dark untouched and tests enemy centers", async () => {
    await isolated();
    pose((d, s) => d.setWeapon(s, 0, "flare", 1));
    pose((d, s) => d.spawnEnemy(s, "dark", 10, 0));
    pose((d, s) => d.spawnEnemy(s, "shade", C.FLARE_LEVELS[0].radius + 1, 0));
    await engine.advance(1);
    expect(run().enemies[0].hp).toBe(C.ENEMIES.dark.hp);
    expect(run().enemies[1].hp).toBe(C.ENEMIES.shade.hp);
  });
  it("Spark honors the posed first target and splashes by center distance", async () => {
    await isolated();
    pose((d, s) => d.setWeapon(s, 0, "spark", 1));
    pose((d, s) => d.spawnEnemy(s, "shade", 50, 0));
    pose((d, s) => d.spawnEnemy(s, "shade", 200, 0));
    pose((d, s) => d.setNextStrikeTarget(s, run().enemies[1].id));
    await engine.advance(1);
    expect(run().zones[0]).toMatchObject({ kind: "strike", x: 200, y: 0 });
    expect(run().enemies[0].hp).toBe(C.ENEMIES.shade.hp);
    expect(run().enemies[1].hp).toBe(
      C.ENEMIES.shade.hp - C.SPARK_LEVELS[0].damage,
    );
  });
  it("uses fixed tables for all base and evolved weapons", async () => {
    await isolated();
    for (const id of [...C.BASE_WEAPON_IDS, ...C.EVOLUTION_IDS]) {
      pose((d, s) => d.clearEnemies(s));
      pose((d, s) => d.clearZones(s));
      pose((d, s) => d.clearProjectiles(s));
      pose((d, s) => d.setWeapon(s, 0, id, 1));
      pose((d, s) => d.spawnEnemy(s, "dark", 200, 0));
      await engine.advance(1);
      expect(
        [...run().projectiles, ...run().zones].some((e) => e.weapon === id),
      ).toBe(true);
      expect(row(id).damage).toBeGreaterThan(0);
    }
  });
});

describe("enemies, contact, and the director", () => {
  it("ages held enemies, keeps coincident chasers still, and applies contact cooldown separately", async () => {
    await isolated();
    pose((d, s) => d.setEnemyContact(s, true));
    pose((d, s) => d.setEnemyMotion(s, true));
    pose((d, s) => d.spawnEnemy(s, "moth", 0, 0));
    pose((d, s) => d.spawnEnemy(s, "moth", 0, 0));
    await engine.advance(1);
    expect(run().enemies[0].x).toBe(0);
    expect(run().player.hp).toBe(C.BASE_MAX_HP - 2 * C.ENEMIES.moth.damage);
    await engine.advance(29);
    expect(run().player.hp).toBe(C.BASE_MAX_HP - 2 * C.ENEMIES.moth.damage);
    await engine.advance(1);
    expect(run().player.hp).toBe(C.BASE_MAX_HP - 4 * C.ENEMIES.moth.damage);
  });
  it("scales only common enemy health and does not re-scale existing enemies", async () => {
    await isolated();
    pose((d, s) => d.setTick(s, 120 * C.TICK_HZ));
    pose((d, s) => d.spawnEnemy(s, "rat", 200, 0));
    pose((d, s) => d.spawnEnemy(s, "owl", 300, 0));
    expect(run().enemies[0].hp).toBe(
      C.ENEMIES.rat.hp * (1 + C.HP_SCALE_PER_MINUTE * 2),
    );
    expect(run().enemies[1].hp).toBe(C.ENEMIES.owl.hp);
  });
  it("holds spawning timers, then spawns on the new window boundary", async () => {
    await isolated();
    pose((d, s) => d.setSpawnTimer(s, 20));
    pose((d, s) => d.setTick(s, 30 * C.TICK_HZ - 1));
    await engine.advance(1);
    expect(run().spawnTimer).toBe(20);
    pose((d, s) => d.setTick(s, 60 * C.TICK_HZ - 1));
    pose((d, s) => d.setSpawning(s, true));
    pose((d, s) => d.setNextSpawnAngle(s, 90));
    pose((d, s) => d.setNextSpawnType(s, "rat"));
    await engine.advance(1);
    expect(run().enemies[0].type).toBe("rat");
    expect(run().enemies[0].y).toBeCloseTo(C.SPAWN_DISTANCE);
    expect(run().spawnTimer).toBe(C.SPAWN_WINDOWS[2].interval);
  });
  it("spawns a parallel 24-gnat line exactly once and skips events crossed while disabled", async () => {
    await isolated();
    pose((d, s) => d.setEvents(s, true));
    pose((d, s) => d.setTick(s, 60 * C.TICK_HZ - 1));
    pose((d, s) => d.setNextSwarmAngle(s, 0));
    await engine.advance(1);
    expect(run().enemies).toHaveLength(C.SWARM_SIZE);
    expect(run().enemies[0].y).toBe(-C.SWARM_LINE / 2);
    expect(run().enemies[run().enemies.length - 1]?.y).toBe(C.SWARM_LINE / 2);
    expect(
      run().enemies.every(
        (e) => e.heading.x === -1 && e.x === C.SPAWN_DISTANCE,
      ),
    ).toBe(true);
    pose((d, s) => d.setTick(s, 60 * C.TICK_HZ - 1));
    await engine.advance(1);
    expect(run().enemies).toHaveLength(C.SWARM_SIZE);
    pose((d, s) => d.setTick(s, 120 * C.TICK_HZ));
    await engine.advance(1);
    expect(run().enemies.some((e) => e.type === "mothwing")).toBe(false);
  });
  it("despawns commons and cleans hit records but preserves elites", async () => {
    await isolated();
    pose((d, s) => d.setDespawning(s, true));
    pose((d, s) => d.spawnEnemy(s, "rat", C.DESPAWN_DISTANCE + 1, 0));
    pose((d, s) => d.spawnEnemy(s, "owl", C.DESPAWN_DISTANCE + 1, 0));
    await engine.advance(1);
    expect(run().enemies.map((e) => e.type)).toEqual(["owl"]);
  });
  it("gives dawn precedence over a fatal hit and discards excess time", async () => {
    await isolated();
    pose((d, s) => d.setTick(s, C.DAWN_TIME * C.TICK_HZ - 1));
    pose((d, s) => d.setHp(s, 0));
    engine.setClock(new ConstantClock(500));
    await engine.advance(1);
    expect(engine.state.screen).toBe("dawn");
    expect(run().tick).toBe(C.DAWN_TIME * C.TICK_HZ);
    expect(engine.state.accumulator).toBe(0);
    expect(cues).toContain(C.CUES.dawn);
    expect(cues).not.toContain(C.CUES.fallen);
  });
});

describe("progression, passives, drops, and debug contracts", () => {
  it("attracts gems, spends XP only on gains, and freezes at the exact level-up tick", async () => {
    await isolated();
    pose((d, s) => d.setXp(s, 4));
    pose((d, s) => d.spawnGem(s, "small", 0, 0));
    engine.setClock(new ConstantClock(500));
    await engine.advance(1);
    expect(engine.state.screen).toBe("levelup");
    expect(run().tick).toBe(1);
    expect(run().level).toBe(2);
    expect(run().xp).toBe(0);
    expect(run().offers).toHaveLength(C.OFFER_COUNT);
    expect(engine.state.accumulator).toBe(0);
    expect(cues).toContain(C.CUES.levelUp);
  });
  it("honors valid posed offers, consumes them once, and queues sequential levels", async () => {
    await isolated();
    pose((d, s) => d.setPendingLevelUps(s, 2));
    pose((d, s) => d.setNextOffers(s, ["tallow", "ember"]));
    await engine.advance(1);
    expect(run().offers).toEqual(["tallow", "ember"]);
    pose((d, s) => d.choose(s, 0));
    expect(run().passives[0]).toEqual({ id: "tallow", level: 1 });
    expect(run().player.hp).toBe(C.BASE_MAX_HP + C.TALLOW_HP_PER_LEVEL);
    expect(engine.state.screen).toBe("levelup");
    expect(run().nextOffers).toBe(null);
    pose((d, s) => d.choose(s, 0));
    expect(engine.state.screen).toBe("playing");
  });
  it("discards invalid posed offers and excludes transformed base weapons from the pool", async () => {
    await isolated();
    pose((d, s) => d.setWeapon(s, 0, "pyre", 1));
    pose((d, s) => d.setPendingLevelUps(s, 1));
    pose((d, s) => d.setNextOffers(s, ["taper"]));
    await engine.advance(1);
    expect(pool(run())).not.toContain("taper");
    expect(run().offers).not.toContain("taper");
  });
  it("evolves the earliest eligible slot and consumes a chest pose for any result", async () => {
    await isolated();
    pose((d, s) => d.setWeapon(s, 0, "taper", C.MAX_WEAPON_LEVEL));
    pose((d, s) => d.setPassive(s, 0, "wick", 1));
    pose((d, s) => d.setNextChestItem(s, "wick"));
    pose((d, s) => d.spawnPickup(s, "chest", 0, 0));
    await engine.advance(1);
    expect(engine.state.screen).toBe("chest");
    expect(run().chestResult).toEqual({ kind: "evolve", weapon: "pyre" });
    expect(run().weapons[0]).toEqual({ id: "pyre", level: 1, cooldown: 0 });
    expect(run().nextChestItem).toBe(null);
    await tap("Enter");
    expect(run().chestResult).toBe(null);
  });
  it("collects only the lowest-id chest per tick while bread and draft collect together", async () => {
    await isolated();
    pose((d, s) => d.setHp(s, 20));
    pose((d, s) => d.spawnPickup(s, "chest", 0, 0));
    pose((d, s) => d.spawnPickup(s, "chest", 0, 0));
    pose((d, s) => d.spawnPickup(s, "bread", 0, 0));
    pose((d, s) => d.spawnPickup(s, "draft", 0, 0));
    pose((d, s) => d.spawnGem(s, "large", 900, 0));
    await engine.advance(1);
    expect(run().pickups).toHaveLength(1);
    expect(run().player.hp).toBe(80);
    expect(run().gems[0].attracted).toBe(true);
    expect(run().gems[0].x).toBe(890);
  });
  it("keeps gains unspent while progression is off and spends overflow on the next gain", async () => {
    await isolated();
    pose((d, s) => d.setProgression(s, false));
    pose((d, s) => d.spawnGem(s, "large", 0, 0));
    await engine.advance(1);
    expect(run().xp).toBe(10);
    expect(run().level).toBe(1);
    pose((d, s) => d.setProgression(s, true));
    await engine.advance(1);
    expect(run().level).toBe(1);
    pose((d, s) => d.spawnGem(s, "small", 0, 0));
    await engine.advance(1);
    expect(run().level).toBe(2);
    expect(run().xp).toBe(6);
  });
  it("drops a gem and a posed pickup without moving the new gem on the death tick", async () => {
    await isolated();
    pose((d, s) => d.setWeapon(s, 0, "taper", 1));
    pose((d, s) => d.setNextDrop(s, "bread"));
    pose((d, s) => d.spawnEnemy(s, "moth", 40, 0));
    await engine.advance(1);
    expect(run().kills).toBe(1);
    expect(run().gems[0]).toMatchObject({ x: 40, attracted: true });
    expect(run().pickups[0].kind).toBe("bread");
    expect(run().nextDrop).toBe(null);
    expect(cues.filter((c) => c === C.CUES.hit)).toHaveLength(1);
  });
  it("derives every passive independently and clamps healing on the next tick", async () => {
    await isolated();
    for (const id of C.PASSIVE_IDS) {
      pose((d, s) => d.setPassive(s, 0, id, 1));
      const st = stats(run());
      expect(st.maxHp).toBe(
        C.BASE_MAX_HP + (id === "tallow" ? C.TALLOW_HP_PER_LEVEL : 0),
      );
      expect(st.damageMul).toBe(
        1 + (id === "wick" ? C.WICK_DAMAGE_PER_LEVEL : 0),
      );
      expect(st.moveSpeed).toBe(
        C.MOVE_SPEED * (1 + (id === "bellows" ? C.BELLOWS_SPEED_PER_LEVEL : 0)),
      );
    }
    pose((d, s) => d.setHp(s, 999));
    expect(run().player.hp).toBe(999);
    await engine.advance(1);
    expect(run().player.hp).toBe(stats(run()).maxHp);
  });
  it("rejects invalid poses without changing state", () => {
    const s = engine.state;
    expect(() => engine.debug.setTick(s, C.DAWN_TIME * C.TICK_HZ)).toThrow();
    expect(() => engine.debug.setNextChestItem(s, "pyre")).toThrow();
    expect(() => engine.debug.setWeapon(s, 2, "taper", 1)).toThrow();
    expect(() => engine.debug.setNextOffers(s, ["ember", "ember"])).toThrow();
    expect(() => engine.debug.setHp(s, NaN)).toThrow();
    expect(() => engine.debug.setNextSpawnAngle(s, 360)).toThrow();
    expect(() => engine.debug.setNextPuddleOffset(s, 401, 0)).toThrow();
    expect(() => engine.debug.setEnemyHp(s, 4, 0)).toThrow();
    expect(() => engine.debug.choose(s, 0)).toThrow();
    expect(engine.state).toBe(s);
  });
  it("rollDrop ignores the posed outcome, and reconcile advances nothing", () => {
    pose((d, s) => d.setNextDrop(s, "bread"));
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    expect(engine.debug.rollDrop(engine.state)).toBe("none");
    expect(run().nextDrop).toBe("bread");
    expect(engine.debug.reconcile(engine.state)).toEqual(engine.state);
  });
});

describe("complete night and phase ordering", () => {
  it("runs the complete ten-minute director schedule to dawn", async () => {
    await isolated();
    pose((d, s) => d.setEvents(s, true));
    pose((d, s) => d.setSpawning(s, true));
    engine.setClock(new ConstantClock(C.DAWN_TIME * 1000));
    await engine.advance(1);
    expect(engine.state.screen).toBe("dawn");
    expect(run().tick).toBe(C.DAWN_TIME * C.TICK_HZ);
    expect(run().firedEvents).toEqual(C.EVENTS.map((e) => e.time));
    expect(run().enemies.filter((e) => e.type === "mothwing")).toHaveLength(2);
    expect(run().enemies.filter((e) => e.type === "owl")).toHaveLength(1);
    expect(run().enemies.filter((e) => e.type === "dark")).toHaveLength(1);
    expect(run().enemies.filter((e) => e.type === "gnat")).toHaveLength(
      3 * C.SWARM_SIZE,
    );
    expect(engine.debug.snapshot(engine.state).run.aliveCommons).toBe(
      C.SPAWN_WINDOWS[C.SPAWN_WINDOWS.length - 1].cap,
    );
  }, 20000);

  it("applies a chest upgrade before the same tick collects gems", async () => {
    await isolated();
    pose((d, s) => d.setPassive(s, 0, "soot", 1));
    pose((d, s) => d.setNextChestItem(s, "soot"));
    pose((d, s) => d.spawnPickup(s, "chest", 0, 0));
    pose((d, s) => d.spawnGem(s, "small", 0, 0));
    await engine.advance(1);
    expect(run().xp).toBeCloseTo(1 + 2 * C.SOOT_XP_PER_LEVEL);
    expect(run().chestResult).toEqual({
      kind: "level",
      item: "soot",
      level: 2,
    });
    expect(engine.state.screen).toBe("chest");
  });

  it("changes the run clock without aging a live effect", async () => {
    await isolated();
    pose((d, s) => d.spawnPuddle(s, "oil-splash", 300, 0));
    await engine.advance(5);
    const ttl = run().zones[0].ttl;
    const age = run().tick - engine.state.visual.shapes[run().zones[0].id].born;
    pose((d, s) => d.setTick(s, 12000));
    expect(run().zones[0].ttl).toBe(ttl);
    expect(
      run().tick - engine.state.visual.shapes[run().zones[0].id].born,
    ).toBe(age);
    await engine.advance(1);
    expect(run().zones[0].ttl).toBeCloseTo((ttl ?? 0) - C.TICK_DT);
  });
});
