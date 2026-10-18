import type { DeepWritable } from "ts-essentials";
import * as C from "./constants";
import type {
  WickState,
  RunState,
  WeaponId,
  PassiveId,
  OfferId,
  EnemyId,
  Screen,
} from "./types";
export type Draft = DeepWritable<WickState>;
export type Run = DeepWritable<RunState>;
export const copy = (s: WickState): Draft => structuredClone(s) as Draft;
export const idleRun = (): Run => ({
  tick: 0,
  level: 1,
  xp: 0,
  kills: 0,
  player: { x: 0, y: 0, facing: "right", hp: C.BASE_MAX_HP },
  hurtFlash: 0,
  weapons: [],
  passives: [],
  enemies: [],
  projectiles: [],
  zones: [],
  gems: [],
  pickups: [],
  offers: [],
  nextOffers: null,
  pendingLevelUps: 0,
  chestResult: null,
  spawnTimer: 0,
  firedEvents: [],
  nextId: 0,
  nextSpawnAngle: null,
  nextSwarmAngle: null,
  nextSpawnType: null,
  nextPuddleOffset: null,
  nextStrikeTarget: null,
  nextChestItem: null,
  nextDrop: null,
});
export const initial = (): WickState => ({
  screen: "title",
  menuIndex: 0,
  almanacTab: 0,
  almanacScroll: 0,
  run: idleRun(),
  accumulator: 0,
  simTime: 0,
  muted: false,
  spawning: true,
  events: true,
  despawning: true,
  enemyMotion: true,
  enemyContact: true,
  weaponFire: true,
  effectMotion: true,
  drops: true,
  progression: true,
  visual: {
    moved: false,
    moveTicks: 0,
    shapes: {},
    puffs: [],
    pointerDown: null,
  },
});
export function enter(s: Draft, screen: Screen) {
  s.screen = screen;
  s.menuIndex = 0;
  s.almanacTab = 0;
  s.almanacScroll = 0;
  s.visual.pointerDown = null;
  if (screen !== "playing") s.accumulator = 0;
}
export function start(s: Draft) {
  s.run = idleRun();
  s.run.weapons.push({ id: "taper", level: 1, cooldown: 0 });
  s.visual = copy(initial()).visual;
  enter(s, "playing");
}
export function title(s: Draft, index = 0) {
  s.run = idleRun();
  s.visual = copy(initial()).visual;
  enter(s, "title");
  s.menuIndex = index;
}
export function stats(r: RunState) {
  const level = (id: PassiveId) =>
    r.passives.find((p) => p.id === id)?.level ?? 0;
  return {
    damageMul: 1 + C.WICK_DAMAGE_PER_LEVEL * level("wick"),
    cooldownMul: 1 - C.OIL_COOLDOWN_PER_LEVEL * level("oil"),
    areaMul: 1 + C.GLASS_AREA_PER_LEVEL * level("glass"),
    armor: C.BRASS_ARMOR_PER_LEVEL * level("brass"),
    amountBonus: C.MIRROR_AMOUNT_PER_LEVEL * level("mirror"),
    moveSpeed:
      C.MOVE_SPEED * (1 + C.BELLOWS_SPEED_PER_LEVEL * level("bellows")),
    maxHp: C.BASE_MAX_HP + C.TALLOW_HP_PER_LEVEL * level("tallow"),
    recovery: C.BASE_RECOVERY + C.TINDER_RECOVERY_PER_LEVEL * level("tinder"),
    xpMul: 1 + C.SOOT_XP_PER_LEVEL * level("soot"),
    pickupRadius:
      C.PICKUP_RADIUS * (1 + C.LURE_PICKUP_PER_LEVEL * level("lure")),
  };
}
export type Row = C.WeaponLevelBase &
  Partial<C.SlashLevel & C.BoltLevel & C.OrbitLevel & C.StrikeLevel>;
const evolved: Record<C.EvolutionId, Row> = {
  pyre: C.PYRE_STATS,
  beacon: C.BEACON_STATS,
  hail: C.HAIL_STATS,
  chandelier: { ...C.CHANDELIER_STATS, cooldown: 0 },
  corona: C.CORONA_STATS,
  blaze: C.BLAZE_STATS,
};
export const isBase = (id: string): id is C.BaseWeaponId =>
  (C.BASE_WEAPON_IDS as readonly string[]).includes(id);
export const isWeapon = (id: string): id is WeaponId => id in C.WEAPON_NAMES;
export const row = (id: WeaponId, level = 1): Row =>
  isBase(id) ? C.WEAPON_LEVELS[id][level - 1] : evolved[id];
export const xpNext = (level: number) => C.XP_BASE + C.XP_STEP * (level - 1);
export const windowAt = (tick: number) =>
  Math.min(
    C.SPAWN_WINDOWS.length - 1,
    Math.floor(tick / C.TICK_HZ / C.SPAWN_WINDOW),
  );
export const commons = (r: RunState) =>
  r.enemies.filter(
    (e) => C.ENEMIES[e.type].rank === "common" && e.type !== "gnat",
  ).length;
export function pool(r: RunState): OfferId[] {
  return [
    ...C.BASE_WEAPON_IDS.filter((id) => {
      const held = r.weapons.find((w) => w.id === id);
      return held
        ? held.level < C.MAX_WEAPON_LEVEL
        : r.weapons.length < C.WEAPON_SLOTS &&
            !r.weapons.some((w) =>
              C.EVOLUTION_IDS.some(
                (e) => e === w.id && C.EVOLUTIONS[e].from === id,
              ),
            );
    }),
    ...C.PASSIVE_IDS.filter((id) => {
      const held = r.passives.find((p) => p.id === id);
      return held
        ? held.level < C.PASSIVES[id].maxLevel
        : r.passives.length < C.PASSIVE_SLOTS;
    }),
  ];
}
export const pick = <T>(xs: readonly T[]): T =>
  xs[Math.floor(Math.random() * xs.length)];
export function openLevel(s: Draft) {
  const candidates = pool(s.run);
  const posed = s.run.nextOffers;
  let offers: OfferId[] = [];
  if (
    posed &&
    posed.every((id) => candidates.includes(id)) &&
    candidates.length
  )
    offers = [...posed];
  else if (!candidates.length) offers = [C.LAMP_OIL_ID];
  else {
    const remaining = [...candidates];
    while (offers.length < Math.min(C.OFFER_COUNT, candidates.length)) {
      const index = Math.floor(Math.random() * remaining.length);
      offers.push(remaining.splice(index, 1)[0]);
    }
  }
  s.run.nextOffers = null;
  s.run.offers = offers;
  enter(s, "levelup");
}
export const heal = (r: Run, amount: number) => {
  r.player.hp = Math.min(stats(r).maxHp, r.player.hp + amount);
};
export function grant(r: Run, id: OfferId) {
  if (id === C.LAMP_OIL_ID) {
    heal(r, C.LAMP_OIL_HEAL);
    return;
  }
  if (isWeapon(id)) {
    const w = r.weapons.find((w) => w.id === id);
    if (w) w.level++;
    else r.weapons.push({ id, level: 1, cooldown: 0 });
  } else {
    const p = r.passives.find((p) => p.id === id);
    if (p) p.level++;
    else r.passives.push({ id, level: 1 });
    if (id === "tallow") heal(r, C.TALLOW_HP_PER_LEVEL);
  }
}
export function choose(s: Draft, index: number) {
  if (!Number.isInteger(index) || !s.run.offers[index])
    throw new Error("Invalid offer index");
  grant(s.run, s.run.offers[index]);
  s.run.pendingLevelUps--;
  s.run.offers = [];
  if (s.run.pendingLevelUps > 0) openLevel(s);
  else enter(s, "playing");
}
export function chest(r: Run): boolean {
  const nextItem = r.nextChestItem;
  r.nextChestItem = null;
  for (const w of r.weapons) {
    const evo = C.EVOLUTION_IDS.find(
      (e) =>
        C.EVOLUTIONS[e].from === w.id &&
        w.level === C.MAX_WEAPON_LEVEL &&
        r.passives.some((p) => p.id === C.EVOLUTIONS[e].passive),
    );
    if (evo) {
      w.id = evo;
      w.level = 1;
      w.cooldown = 0;
      r.chestResult = { kind: "evolve", weapon: evo };
      return true;
    }
  }
  const items = [
    ...r.weapons.filter((w) => isBase(w.id) && w.level < C.MAX_WEAPON_LEVEL),
    ...r.passives.filter((p) => p.level < C.PASSIVES[p.id].maxLevel),
  ];
  if (items.length) {
    const item = items.find((i) => i.id === nextItem) ?? pick(items);
    r.nextChestItem = null;
    grant(r, item.id);
    r.chestResult = { kind: "level", item: item.id, level: item.level };
  } else {
    heal(r, C.CHEST_HEAL);
    r.chestResult = { kind: "heal" };
  }
  return false;
}
export const distance = (
  a: { x: number; y: number },
  b: { x: number; y: number },
) => Math.hypot(a.x - b.x, a.y - b.y);
export function direction(x: number, y: number, facing = "right") {
  const n = Math.hypot(x, y);
  return n ? { x: x / n, y: y / n } : { x: facing === "right" ? 1 : -1, y: 0 };
}
export const countdown = (n: number) =>
  n - C.TICK_DT < C.TICK_DT / 2 ? 0 : n - C.TICK_DT;
export function spawnEnemy(r: Run, type: EnemyId, x: number, y: number) {
  const spec = C.ENEMIES[type];
  const hp =
    spec.hp *
    (spec.rank === "common"
      ? 1 + C.HP_SCALE_PER_MINUTE * Math.floor(r.tick / C.TICK_HZ / 60)
      : 1);
  r.enemies.push({
    id: r.nextId++,
    type,
    x,
    y,
    hp,
    maxHp: hp,
    heading: direction(r.player.x - x, r.player.y - y, r.player.facing),
    age: 0,
    contactCooldown: 0,
  });
}
export function drop(r: RunState) {
  return (
    r.nextDrop ??
    (Math.random() < C.BREAD_CHANCE
      ? "bread"
      : Math.random() < C.DRAFT_CHANCE
        ? "draft"
        : "none")
  );
}
export function cleanHits(r: Run) {
  const ids = new Set(r.enemies.map((e) => e.id));
  for (const p of [...r.projectiles, ...r.zones])
    p.hits = p.hits.filter((h) => ids.has(h.enemy));
}
export function snapshot(s: WickState) {
  const { visual: _visual, ...state } = s;
  const st = stats(s.run);
  return structuredClone({
    ...state,
    version: C.WICK_DEBUG_VERSION,
    run: {
      ...s.run,
      time: s.run.tick / C.TICK_HZ,
      xpToNext: xpNext(s.run.level),
      maxHp: st.maxHp,
      armor: st.armor,
      moveSpeed: st.moveSpeed,
      pickupRadius: st.pickupRadius,
      spawnWindow: windowAt(s.run.tick),
      aliveCommons: commons(s.run),
      pool: s.screen === "levelup" ? pool(s.run) : [],
    },
  });
}
export type WickSnapshot = ReturnType<typeof snapshot>;
