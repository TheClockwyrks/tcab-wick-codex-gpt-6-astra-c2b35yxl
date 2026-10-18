import * as C from "./constants";
import type { WickDebugApi } from "./debug-types";
import type { WickState, EnemyId, WeaponId, PassiveId, Screen } from "./types";
import {
  type Draft,
  copy,
  initial,
  snapshot,
  enter,
  choose,
  spawnEnemy,
  direction,
  cleanHits,
  drop,
} from "./model";
import { projectile, puddle } from "./combat";
import { menuRects, tabRects } from "./menus";
function valid(condition: boolean): asserts condition {
  if (!condition) throw new Error("Invalid Wick debug argument");
}
function number(n: number, min = -Infinity, max = Infinity, integer = false) {
  valid(
    Number.isFinite(n) &&
      n >= min &&
      n <= max &&
      (!integer || Number.isInteger(n)),
  );
}
function member<T extends string>(id: T, ids: readonly string[]) {
  valid(ids.includes(id));
}
function pose(s: WickState, fn: (s: Draft) => void): WickState {
  const next = copy(s);
  fn(next);
  return next;
}
function enemy(s: Draft, id: number) {
  const e = s.run.enemies.find((e) => e.id === id);
  valid(!!e);
  return e;
}
function bool(
  s: WickState,
  key:
    | "spawning"
    | "events"
    | "despawning"
    | "enemyMotion"
    | "enemyContact"
    | "weaponFire"
    | "effectMotion"
    | "drops"
    | "progression",
  on: boolean,
) {
  valid(typeof on === "boolean");
  return { ...s, [key]: on };
}
const weapons = [...C.BASE_WEAPON_IDS, ...C.EVOLUTION_IDS];
const screens: Screen[] = [
  "title",
  "howto",
  "almanac",
  "playing",
  "levelup",
  "chest",
  "paused",
  "fallen",
  "dawn",
];
function runNumber(
  s: WickState,
  key: "tick" | "spawnTimer" | "level" | "xp" | "kills" | "pendingLevelUps",
  value: number,
  min = 0,
  integer = false,
) {
  number(
    value,
    min,
    key === "tick" ? C.DAWN_TIME * C.TICK_HZ - 1 : Infinity,
    integer,
  );
  return { ...s, run: { ...s.run, [key]: value } };
}
function setItem(
  s: WickState,
  slot: number,
  id: WeaponId | PassiveId,
  level: number,
  weapon: boolean,
) {
  return pose(s, (n) => {
    const slots = weapon ? n.run.weapons : n.run.passives;
    number(
      slot,
      0,
      Math.min(slots.length, (weapon ? C.WEAPON_SLOTS : C.PASSIVE_SLOTS) - 1),
      true,
    );
    member(id, weapon ? weapons : C.PASSIVE_IDS);
    number(
      level,
      1,
      weapon
        ? C.EVOLUTION_IDS.includes(id as C.EvolutionId)
          ? 1
          : C.MAX_WEAPON_LEVEL
        : C.PASSIVES[id as PassiveId].maxLevel,
      true,
    );
    valid(
      !slots.some(
        (w, i) =>
          i !== slot &&
          (w.id === id ||
            (weapon &&
              C.EVOLUTION_IDS.some(
                (e) =>
                  (e === id && C.EVOLUTIONS[e].from === w.id) ||
                  (e === w.id && C.EVOLUTIONS[e].from === id),
              ))),
      ),
    );
    if (weapon)
      n.run.weapons[slot] = {
        id: id as WeaponId,
        level,
        cooldown:
          n.run.weapons[slot]?.id === id ? n.run.weapons[slot].cooldown : 0,
      };
    else n.run.passives[slot] = { id: id as PassiveId, level };
  });
}
export const debug: WickDebugApi = {
  version: C.WICK_DEBUG_VERSION,
  reset: (s) => ({ ...initial(), muted: s.muted }),
  snapshot,
  reconcile: (s) => copy(s),
  menuRects,
  tabRects,
  setScreen: (s, name) => {
    member(name, screens);
    return pose(s, (n) => enter(n, name));
  },
  choose: (s, index) => pose(s, (n) => choose(n, index)),
  setSpawning: (s, on) => bool(s, "spawning", on),
  setEvents: (s, on) => bool(s, "events", on),
  setDespawning: (s, on) => bool(s, "despawning", on),
  setEnemyMotion: (s, on) => bool(s, "enemyMotion", on),
  setEnemyContact: (s, on) => bool(s, "enemyContact", on),
  setWeaponFire: (s, on) => bool(s, "weaponFire", on),
  setEffectMotion: (s, on) => bool(s, "effectMotion", on),
  setDrops: (s, on) => bool(s, "drops", on),
  setProgression: (s, on) => bool(s, "progression", on),
  setTick: (s, value) =>
    pose(s, (n) => {
      number(value, 0, C.DAWN_TIME * C.TICK_HZ - 1, true);
      const delta = value - n.run.tick;
      n.run.tick = value;
      // Changing the run clock does not age existing effects or their animation.
      for (const meta of Object.values(n.visual.shapes)) {
        meta.born += delta;
        meta.pulseStart += delta;
        if (meta.pulse >= 0) meta.pulse += delta;
      }
      for (const puff of n.visual.puffs) puff.born += delta;
    }),
  setSpawnTimer: (s, n) => runNumber(s, "spawnTimer", n),
  setLevel: (s, n) => runNumber(s, "level", n, 1, true),
  setXp: (s, n) => runNumber(s, "xp", n),
  setKills: (s, n) => runNumber(s, "kills", n, 0, true),
  setPendingLevelUps: (s, n) => runNumber(s, "pendingLevelUps", n, 0, true),
  setNextSpawnAngle: (s, a) => {
    number(a, 0, 360 - Number.EPSILON);
    valid(a < 360);
    return { ...s, run: { ...s.run, nextSpawnAngle: a } };
  },
  setNextSwarmAngle: (s, a) => {
    number(a, 0, 360);
    valid(a < 360);
    return { ...s, run: { ...s.run, nextSwarmAngle: a } };
  },
  setNextSpawnType: (s, id) => {
    member(id, C.ENEMY_IDS);
    return { ...s, run: { ...s.run, nextSpawnType: id } };
  },
  setNextPuddleOffset: (s, x, y) => {
    number(x);
    number(y);
    valid(Math.hypot(x, y) <= C.OIL_SCATTER);
    return { ...s, run: { ...s.run, nextPuddleOffset: { x, y } } };
  },
  setNextStrikeTarget: (s, id) => {
    number(id, 0, Infinity, true);
    valid(s.run.enemies.some((e) => e.id === id));
    return { ...s, run: { ...s.run, nextStrikeTarget: id } };
  },
  setNextChestItem: (s, id) => {
    member(id, [...C.BASE_WEAPON_IDS, ...C.PASSIVE_IDS]);
    return { ...s, run: { ...s.run, nextChestItem: id } };
  },
  setNextDrop: (s, kind) => {
    member(kind, ["bread", "draft", "none"]);
    return { ...s, run: { ...s.run, nextDrop: kind } };
  },
  rollDrop: (s) => drop({ ...s.run, nextDrop: null }),
  setPlayerPosition: (s, x, y) => {
    number(x);
    number(y);
    return { ...s, run: { ...s.run, player: { ...s.run.player, x, y } } };
  },
  setFacing: (s, facing) => {
    member(facing, ["left", "right"]);
    return { ...s, run: { ...s.run, player: { ...s.run.player, facing } } };
  },
  setHp: (s, hp) => {
    number(hp);
    return { ...s, run: { ...s.run, player: { ...s.run.player, hp } } };
  },
  setNextOffers: (s, ids) => {
    valid(
      ids.length >= 1 &&
        ids.length <= C.OFFER_COUNT &&
        new Set(ids).size === ids.length,
    );
    ids.forEach((id) =>
      member(id, [...weapons, ...C.PASSIVE_IDS, C.LAMP_OIL_ID]),
    );
    return { ...s, run: { ...s.run, nextOffers: [...ids] } };
  },
  setWeapon: (s, slot, id, level) => setItem(s, slot, id, level, true),
  setPassive: (s, slot, id, level) => setItem(s, slot, id, level, false),
  setWeaponCooldown: (s, slot, n) =>
    pose(s, (d) => {
      number(slot, 0, d.run.weapons.length - 1, true);
      number(n, 0);
      d.run.weapons[slot].cooldown = n;
    }),
  removeWeapon: (s, slot) =>
    pose(s, (d) => {
      number(slot, 0, d.run.weapons.length - 1, true);
      d.run.weapons.splice(slot, 1);
    }),
  removePassive: (s, slot) =>
    pose(s, (d) => {
      number(slot, 0, d.run.passives.length - 1, true);
      d.run.passives.splice(slot, 1);
    }),
  spawnEnemy: (s, type, x, y) =>
    pose(s, (n) => {
      member(type, C.ENEMY_IDS);
      number(x);
      number(y);
      spawnEnemy(n.run, type as EnemyId, x, y);
    }),
  setEnemyPosition: (s, id, x, y) =>
    pose(s, (n) => {
      number(x);
      number(y);
      Object.assign(enemy(n, id), { x, y });
    }),
  setEnemyHp: (s, id, hp) =>
    pose(s, (n) => {
      number(hp);
      valid(hp > 0);
      enemy(n, id).hp = hp;
    }),
  setEnemyHeading: (s, id, x, y) =>
    pose(s, (n) => {
      number(x);
      number(y);
      valid(Math.hypot(x, y) > 0);
      enemy(n, id).heading = direction(x, y);
    }),
  setEnemyAge: (s, id, age) =>
    pose(s, (n) => {
      number(age, 0);
      enemy(n, id).age = age;
    }),
  setEnemyContactCooldown: (s, id, seconds) =>
    pose(s, (n) => {
      number(seconds, 0);
      enemy(n, id).contactCooldown = seconds;
    }),
  removeEnemy: (s, id) =>
    pose(s, (n) => {
      enemy(n, id);
      n.run.enemies = n.run.enemies.filter((e) => e.id !== id);
      cleanHits(n.run);
    }),
  clearEnemies: (s) =>
    pose(s, (n) => {
      n.run.enemies = [];
      cleanHits(n.run);
    }),
  spawnProjectile: (s, w, x, y, vx, vy, pierce) =>
    pose(s, (n) => {
      member(w, ["ember", "pin", "shard", "sconce", "beacon", "hail"]);
      [x, y, vx, vy].forEach((v) => number(v));
      number(pierce, C.INFINITE_PIERCE, Infinity, true);
      if (w === "sconce") valid(Math.hypot(vx, vy) > 0);
      projectile(n, w, x, y, vx, vy, pierce);
    }),
  clearProjectiles: (s) =>
    pose(s, (n) => {
      for (const p of n.run.projectiles) delete n.visual.shapes[p.id];
      n.run.projectiles = [];
    }),
  spawnPuddle: (s, w, x, y) =>
    pose(s, (n) => {
      member(w, ["oil-splash", "blaze"]);
      number(x);
      number(y);
      puddle(n, w, x, y, true);
    }),
  clearZones: (s) =>
    pose(s, (n) => {
      for (const z of n.run.zones) delete n.visual.shapes[z.id];
      n.run.zones = [];
    }),
  spawnGem: (s, tier, x, y) =>
    pose(s, (n) => {
      member(tier, C.GEM_TIERS);
      number(x);
      number(y);
      n.run.gems.push({ id: n.run.nextId++, tier, x, y, attracted: false });
    }),
  setGemAttracted: (s, id, attracted) =>
    pose(s, (n) => {
      valid(typeof attracted === "boolean");
      const g = n.run.gems.find((g) => g.id === id);
      valid(!!g);
      g.attracted = attracted;
    }),
  clearGems: (s) =>
    pose(s, (n) => {
      n.run.gems = [];
    }),
  spawnPickup: (s, kind, x, y) =>
    pose(s, (n) => {
      member(kind, C.PICKUP_KINDS);
      number(x);
      number(y);
      n.run.pickups.push({ id: n.run.nextId++, kind, x, y });
    }),
  clearPickups: (s) =>
    pose(s, (n) => {
      n.run.pickups = [];
    }),
};
