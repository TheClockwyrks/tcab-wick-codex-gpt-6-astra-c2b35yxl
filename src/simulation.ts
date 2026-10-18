import * as C from "./constants";
import {
  type Draft,
  stats,
  direction,
  distance,
  countdown,
  spawnEnemy,
  windowAt,
  commons,
  pick,
  cleanHits,
  heal,
  chest,
  xpNext,
  openLevel,
  enter,
} from "./model";
import { weapons, effects } from "./combat";
export function tick(s: Draft, dx: number, dy: number): Set<C.CueName> {
  const cues = new Set<C.CueName>();
  const r = s.run,
    p = r.player,
    st = stats(r),
    oldGemIds = new Set(r.gems.map((g) => g.id));
  r.tick++;
  const moving = dx !== 0 || dy !== 0;
  s.visual.moved = moving;
  if (moving) {
    const d = direction(dx, dy);
    p.x += d.x * st.moveSpeed * C.TICK_DT;
    p.y += d.y * st.moveSpeed * C.TICK_DT;
    if (dx) p.facing = dx < 0 ? "left" : "right";
    s.visual.moveTicks++;
  }
  heal(r, st.recovery * C.TICK_DT);
  for (const e of r.enemies) {
    const spec = C.ENEMIES[e.type],
      oldAge = e.age;
    e.age += C.TICK_DT;
    if (!s.enemyMotion) continue;
    if (spec.behavior === "weave") {
      const offset =
        C.WISP_AMPLITUDE * Math.sin((2 * Math.PI * oldAge) / C.WISP_PERIOD);
      const anchor = {
        x: e.x + e.heading.y * offset,
        y: e.y - e.heading.x * offset,
      };
      if (distance(anchor, p) === 0) continue;
      e.heading = direction(p.x - anchor.x, p.y - anchor.y, p.facing);
      const next =
        C.WISP_AMPLITUDE * Math.sin((2 * Math.PI * e.age) / C.WISP_PERIOD);
      e.x =
        anchor.x + e.heading.x * spec.speed * C.TICK_DT - e.heading.y * next;
      e.y =
        anchor.y + e.heading.y * spec.speed * C.TICK_DT + e.heading.x * next;
    } else {
      if (spec.behavior === "chase") {
        if (distance(e, p) === 0) continue;
        e.heading = direction(p.x - e.x, p.y - e.y, p.facing);
      }
      e.x += e.heading.x * spec.speed * C.TICK_DT;
      e.y += e.heading.y * spec.speed * C.TICK_DT;
    }
  }
  // Lantern metadata retains its angle across player movement and poses.
  weapons(s);
  effects(s, cues);
  r.hurtFlash = countdown(r.hurtFlash);
  for (const e of r.enemies) {
    e.contactCooldown = countdown(e.contactCooldown);
    const spec = C.ENEMIES[e.type];
    if (
      s.enemyContact &&
      !e.contactCooldown &&
      distance(p, e) < C.PLAYER_RADIUS + spec.radius
    ) {
      p.hp -= Math.max(C.MIN_DAMAGE_TAKEN, spec.damage - st.armor);
      e.contactCooldown = C.CONTACT_COOLDOWN;
      r.hurtFlash = C.HURT_FLASH;
      cues.add(C.CUES.hurt);
    }
  }
  let gotChest = false;
  r.pickups = r.pickups.filter((item) => {
    if (distance(p, item) >= C.PLAYER_RADIUS + C.PICKUP_ITEM_RADIUS)
      return true;
    if (item.kind === "chest") {
      if (gotChest) return true;
      gotChest = true;
      if (chest(r)) cues.add(C.CUES.evolve);
    } else {
      cues.add(C.CUES.pickup);
      if (item.kind === "bread") heal(r, C.BREAD_HEAL);
      else r.gems.forEach((g) => (g.attracted = true));
    }
    return false;
  });
  const gemStats = stats(r); // A collected chest may have upgraded Soot or Lure.
  r.gems = r.gems.filter((g) => {
    let d = distance(p, g);
    if (d <= gemStats.pickupRadius) g.attracted = true;
    if (g.attracted && oldGemIds.has(g.id) && d > 0) {
      const step = Math.min(d, C.GEM_SPEED * C.TICK_DT);
      g.x += ((p.x - g.x) / d) * step;
      g.y += ((p.y - g.y) / d) * step;
      d = distance(p, g);
    }
    if (d > C.COLLECT_RADIUS) return true;
    r.xp += C.GEM_VALUES[g.tier] * gemStats.xpMul;
    cues.add(C.CUES.gem);
    if (s.progression)
      while (r.xp >= xpNext(r.level)) {
        r.xp -= xpNext(r.level);
        r.level++;
        r.pendingLevelUps++;
      }
    return false;
  });
  if (s.despawning) {
    r.enemies = r.enemies.filter(
      (e) =>
        C.ENEMIES[e.type].rank !== "common" ||
        distance(e, p) <= C.DESPAWN_DISTANCE,
    );
    cleanHits(r);
  }
  const spawnRing = (type: C.EnemyId) => {
    const a = ((r.nextSpawnAngle ?? Math.random() * 360) * Math.PI) / 180;
    r.nextSpawnAngle = null;
    spawnEnemy(
      r,
      type,
      p.x + Math.cos(a) * C.SPAWN_DISTANCE,
      p.y + Math.sin(a) * C.SPAWN_DISTANCE,
    );
  };
  if (s.events)
    for (const event of C.EVENTS) {
      if (
        r.tick !== event.time * C.TICK_HZ ||
        r.firedEvents.includes(event.time)
      )
        continue;
      r.firedEvents.push(event.time);
      r.firedEvents.sort((a, b) => a - b);
      if (event.kind === "spawn") spawnRing(event.type);
      else {
        const a = ((r.nextSwarmAngle ?? Math.random() * 360) * Math.PI) / 180;
        r.nextSwarmAngle = null;
        const d = { x: Math.cos(a), y: Math.sin(a) };
        for (let i = 0; i < C.SWARM_SIZE; i++) {
          const offset =
            ((i - (C.SWARM_SIZE - 1) / 2) * C.SWARM_LINE) / (C.SWARM_SIZE - 1);
          spawnEnemy(
            r,
            event.type,
            p.x + d.x * C.SPAWN_DISTANCE - d.y * offset,
            p.y + d.y * C.SPAWN_DISTANCE + d.x * offset,
          );
          r.enemies[r.enemies.length - 1].heading = { x: -d.x, y: -d.y };
        }
      }
    }
  if (s.spawning) {
    const win = C.SPAWN_WINDOWS[windowAt(r.tick)];
    if (windowAt(r.tick) !== windowAt(r.tick - 1)) r.spawnTimer = 0;
    r.spawnTimer = countdown(r.spawnTimer);
    if (!r.spawnTimer && commons(r) < win.cap) {
      const type =
        r.nextSpawnType && win.types.includes(r.nextSpawnType)
          ? r.nextSpawnType
          : pick(win.types);
      r.nextSpawnType = null;
      spawnRing(type);
      r.spawnTimer = win.interval;
    }
  }
  s.visual.puffs = s.visual.puffs.filter(
    (p) => (r.tick - p.born) * C.TICK_DT < C.PUFF_TIME,
  );
  if (r.tick === C.DAWN_TIME * C.TICK_HZ) {
    enter(s, "dawn");
    cues.add(C.CUES.dawn);
  } else if (p.hp <= 0) {
    enter(s, "fallen");
    cues.add(C.CUES.fallen);
  } else if (gotChest) {
    enter(s, "chest");
    cues.add(C.CUES.chest);
  } else if (r.pendingLevelUps > 0) {
    openLevel(s);
    cues.add(C.CUES.levelUp);
  }
  return cues;
}
