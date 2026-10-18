import * as C from "./constants";
import type { WeaponId, ZoneKind } from "./types";
import {
  type Draft,
  type Run,
  row,
  stats,
  direction,
  distance,
  countdown,
  heal,
  drop,
  cleanHits,
} from "./model";
export function projectile(
  s: Draft,
  weapon: WeaponId,
  x: number,
  y: number,
  vx: number,
  vy: number,
  pierce: number,
) {
  const r = s.run,
    st = stats(r),
    w = row(weapon, r.weapons.find((w) => w.id === weapon)?.level);
  const d = direction(vx, vy);
  const id = r.nextId++;
  r.projectiles.push({
    id,
    weapon,
    x,
    y,
    vx,
    vy,
    ax: weapon === "sconce" ? -C.SCONCE_DECEL * d.x : 0,
    ay: weapon === "sconce" ? -C.SCONCE_DECEL * d.y : 0,
    radius: (w.radius ?? 0) * st.areaMul,
    damage: w.damage * st.damageMul,
    ttl: w.duration ?? 0,
    pierce,
    hits: [],
  });
  s.visual.shapes[id] = {
    born: r.tick,
    angle: 0,
    orbit: 0,
    pulseStart: r.tick,
    pulse: -1,
  };
}
function zone(
  s: Draft,
  weapon: WeaponId,
  kind: ZoneKind,
  x: number,
  y: number,
  ttl: number | null,
) {
  const r = s.run,
    st = stats(r),
    w = row(weapon, r.weapons.find((w) => w.id === weapon)?.level),
    id = r.nextId++;
  r.zones.push({
    id,
    weapon,
    kind,
    x,
    y,
    radius: kind === "slash" ? 0 : (w.area ?? w.radius ?? 0) * st.areaMul,
    ...(kind === "slash"
      ? {
          width: (w.width ?? 0) * st.areaMul,
          height: (w.height ?? 0) * st.areaMul,
        }
      : {}),
    damage: w.damage * st.damageMul,
    ttl,
    hits: [],
  });
  s.visual.shapes[id] = {
    born: r.tick,
    angle: 0,
    orbit: (w.orbit ?? 0) * st.areaMul,
    pulseStart: r.tick,
    pulse: -1,
  };
  return r.zones[r.zones.length - 1];
}
export function puddle(
  s: Draft,
  weapon: "oil-splash" | "blaze",
  x: number,
  y: number,
  posed = false,
) {
  const z = zone(
    s,
    weapon,
    "puddle",
    x,
    y,
    row(weapon, s.run.weapons.find((w) => w.id === weapon)?.level).duration ??
      0,
  );
  if (posed) s.visual.shapes[z.id].pulseStart = s.run.tick + 1;
}
function lanterns(s: Draft, id: WeaponId, angle = 0) {
  const w = row(id, s.run.weapons.find((w) => w.id === id)?.level),
    n = (w.amount ?? 1) + stats(s.run).amountBonus;
  for (let i = 0; i < n; i++) {
    const z = zone(
      s,
      id,
      "lantern",
      s.run.player.x,
      s.run.player.y,
      id === "chandelier" ? null : (w.duration ?? 0),
    );
    s.visual.shapes[z.id].angle = angle + (i * 2 * Math.PI) / n;
  }
}
export function weapons(s: Draft) {
  const r = s.run,
    p = r.player,
    st = stats(r);
  const nearest = [...r.enemies].sort(
    (a, b) => distance(a, p) - distance(b, p) || a.id - b.id,
  );
  const pulse = new Set<WeaponId>();
  if (s.weaponFire)
    for (const slot of r.weapons) {
      const id = slot.id,
        w = row(id, slot.level);
      if (id === "chandelier") {
        slot.cooldown = 0;
        continue;
      }
      slot.cooldown = countdown(slot.cooldown);
      if (slot.cooldown) continue;
      slot.cooldown =
        Math.max(C.MIN_COOLDOWN, w.cooldown * st.cooldownMul) +
        (id === "lantern" ? (w.duration ?? 0) : 0);
      const n = (w.amount ?? 1) + st.amountBonus;
      const facing = p.facing === "right" ? 1 : -1;
      if (id === "halo" || id === "corona") {
        pulse.add(id);
        continue;
      }
      if (id === "taper" || id === "pyre") {
        for (let i = 0; i < Math.min(n, C.TAPER_MAX_AMOUNT); i++)
          zone(
            s,
            id,
            "slash",
            p.x + (((w.width ?? 0) * st.areaMul) / 2) * facing * (i ? -1 : 1),
            p.y,
            C.SLASH_FLASH,
          );
      } else if (id === "lantern") lanterns(s, id);
      else if (id === "flare") zone(s, id, "burst", p.x, p.y, C.FLARE_FLASH);
      else if (id === "oil-splash" || id === "blaze") {
        for (let i = 0; i < n; i++) {
          const angle = Math.random() * Math.PI * 2,
            rad = C.OIL_SCATTER * Math.sqrt(Math.random());
          const off = r.nextPuddleOffset ?? {
            x: Math.cos(angle) * rad,
            y: Math.sin(angle) * rad,
          };
          r.nextPuddleOffset = null;
          puddle(s, id, p.x + off.x, p.y + off.y);
        }
      } else if (id === "spark") {
        const targets = nearest.filter((e) => distance(e, p) <= C.SPARK_RANGE);
        const posedTarget = r.nextStrikeTarget;
        if (targets.length) r.nextStrikeTarget = null;
        for (let i = 0; i < n && targets.length; i++) {
          let index = targets.findIndex(
            (e) => e.id === (i === 0 ? posedTarget : null),
          );
          if (index < 0) index = Math.floor(Math.random() * targets.length);
          r.nextStrikeTarget = null;
          const e = targets.splice(index, 1)[0];
          zone(s, id, "strike", e.x, e.y, C.SPARK_FLASH);
        }
      } else {
        if (!nearest.length && ["ember", "beacon", "sconce"].includes(id))
          continue;
        for (let i = 0; i < n; i++) {
          if ((id === "ember" || id === "beacon") && i >= nearest.length) break;
          const target = nearest[id === "ember" || id === "beacon" ? i : 0];
          let d = target
            ? direction(target.x - p.x, target.y - p.y, p.facing)
            : { x: facing, y: 0 };
          let y = p.y;
          if (id === "pin" || id === "hail") {
            d = { x: facing, y: 0 };
            y += (i - (n - 1) / 2) * C.PIN_SPREAD;
          }
          if (id === "shard" || id === "sconce") {
            const a =
              ((i - (n - 1) / 2) *
                (id === "shard" ? C.SHARD_SPREAD : C.SCONCE_SPREAD) *
                Math.PI) /
              180;
            d = {
              x: d.x * Math.cos(a) - d.y * Math.sin(a),
              y: d.x * Math.sin(a) + d.y * Math.cos(a),
            };
          }
          projectile(
            s,
            id,
            p.x,
            y,
            d.x * (w.speed ?? 0),
            d.y * (w.speed ?? 0),
            w.pierce ?? C.INFINITE_PIERCE,
          );
        }
      }
    }
  // Placement remains active even when firing and motion are held.
  r.zones = r.zones.filter(
    (z) =>
      !(z.kind === "aura" || z.kind === "lantern") ||
      r.weapons.some((w) => w.id === z.weapon),
  );
  for (const slot of r.weapons) {
    if (slot.id === "halo" || slot.id === "corona") {
      if (!r.zones.some((z) => z.weapon === slot.id))
        zone(s, slot.id, "aura", p.x, p.y, null);
    }
    if (slot.id === "chandelier") {
      const n = C.CHANDELIER_STATS.amount + st.amountBonus;
      if (r.zones.filter((z) => z.weapon === slot.id).length !== n) {
        const previous = r.zones.find((z) => z.weapon === slot.id);
        const angle = previous ? s.visual.shapes[previous.id].angle : 0;
        r.zones = r.zones.filter((z) => z.weapon !== slot.id);
        lanterns(s, slot.id, angle);
      }
    }
  }
  for (const z of r.zones) {
    if (z.kind === "aura" || z.weapon === "chandelier") {
      const w = row(z.weapon, r.weapons.find((w) => w.id === z.weapon)?.level);
      z.radius = (w.radius ?? 0) * st.areaMul;
      z.damage = w.damage * st.damageMul;
      if (z.weapon === "chandelier")
        s.visual.shapes[z.id].orbit = (w.orbit ?? 0) * st.areaMul;
    }
    if (z.kind === "aura") {
      z.x = p.x;
      z.y = p.y;
      if (pulse.has(z.weapon)) s.visual.shapes[z.id].pulse = r.tick;
    }
    if (z.kind === "lantern") {
      const meta = s.visual.shapes[z.id];
      if (s.effectMotion && meta.born < r.tick)
        meta.angle += (C.LANTERN_ANGULAR_SPEED * C.TICK_DT * Math.PI) / 180;
      z.x = p.x + Math.cos(meta.angle) * meta.orbit;
      z.y = p.y + Math.sin(meta.angle) * meta.orbit;
    }
  }
}
export function effects(s: Draft, cues: Set<C.CueName>) {
  const r = s.run;
  const aliveAtStart = new Set(r.enemies.map((e) => e.id));
  for (const shape of [...r.projectiles, ...r.zones]) {
    const meta = s.visual.shapes[shape.id];
    if (meta.born < r.tick && shape.ttl !== null)
      shape.ttl = countdown(shape.ttl);
    shape.hits = shape.hits
      .map((h) => ({ ...h, cooldown: countdown(h.cooldown) }))
      .filter((h) => h.cooldown > 0);
  }
  r.projectiles = r.projectiles.filter((p) => p.ttl > 0);
  r.zones = r.zones.filter((z) => z.ttl === null || z.ttl > 0);
  for (const p of r.projectiles) {
    if (s.effectMotion && s.visual.shapes[p.id].born < r.tick) {
      p.x += p.vx * C.TICK_DT;
      p.y += p.vy * C.TICK_DT;
      p.vx += p.ax * C.TICK_DT;
      p.vy += p.ay * C.TICK_DT;
      if (p.weapon === "shard") {
        for (const axis of ["x", "y"] as const) {
          const v = axis === "x" ? "vx" : "vy",
            extent = axis === "x" ? C.STAGE_CX : C.STAGE_CY;
          const low = r.player[axis] - extent,
            high = r.player[axis] + extent;
          if (p[axis] < low) {
            p[axis] = low;
            if (p[v] < 0) p[v] *= -1;
          }
          if (p[axis] > high) {
            p[axis] = high;
            if (p[v] > 0) p[v] *= -1;
          }
        }
      }
    }
    for (const e of r.enemies) {
      if (
        p.hits.some((h) => h.enemy === e.id) ||
        distance(p, e) >= p.radius + C.ENEMIES[e.type].radius
      )
        continue;
      e.hp -= p.damage;
      cues.add(C.CUES.hit);
      if (p.pierce === 0) {
        p.ttl = 0;
        break;
      }
      p.hits.push({
        enemy: e.id,
        cooldown:
          p.pierce === C.INFINITE_PIERCE
            ? p.weapon === "sconce"
              ? C.SCONCE_REHIT
              : C.SHARD_REHIT
            : p.ttl,
      });
      if (p.pierce > 0) p.pierce--;
    }
  }
  r.projectiles = r.projectiles.filter((p) => p.ttl > 0);
  for (const z of r.zones) {
    const meta = s.visual.shapes[z.id];
    let active = meta.born === r.tick;
    if (z.kind === "aura") active = meta.pulse === r.tick;
    if (z.kind === "puddle")
      active =
        (r.tick - meta.pulseStart) %
          Math.round(
            (z.weapon === "blaze" ? C.BLAZE_PULSE : C.OIL_PULSE) * C.TICK_HZ,
          ) ===
        0;
    if (z.kind === "lantern") active = true;
    if (!active) continue;
    meta.pulse = r.tick;
    for (const e of r.enemies) {
      const er = C.ENEMIES[e.type].radius;
      let overlap = distance(z, e) < z.radius + er;
      if (z.kind === "burst" || z.kind === "strike")
        overlap = distance(z, e) <= z.radius;
      if (z.kind === "slash") {
        const dx = Math.max(0, Math.abs(e.x - z.x) - (z.width ?? 0) / 2),
          dy = Math.max(0, Math.abs(e.y - z.y) - (z.height ?? 0) / 2);
        overlap = Math.hypot(dx, dy) < er;
      }
      if (
        !overlap ||
        (z.kind === "burst" && C.FLARE_IMMUNE.includes(e.type)) ||
        z.hits.some((h) => h.enemy === e.id)
      )
        continue;
      const before = e.hp;
      e.hp -= z.damage;
      cues.add(C.CUES.hit);
      if (z.kind === "lantern")
        z.hits.push({ enemy: e.id, cooldown: C.LANTERN_REHIT });
      if (z.weapon === "pyre") heal(r, C.PYRE_HEAL);
      if (z.weapon === "corona" && before > 0 && e.hp <= 0)
        heal(r, C.CORONA_HEAL);
    }
  }
  for (const e of r.enemies.filter((e) => e.hp <= 0)) {
    r.kills++;
    cues.add(C.CUES.kill);
    s.visual.puffs.push({ x: e.x, y: e.y, born: r.tick });
    if (!s.drops) continue;
    const spec = C.ENEMIES[e.type];
    if (spec.rank === "elite")
      r.pickups.push({ id: r.nextId++, kind: "chest", x: e.x, y: e.y });
    if (spec.rank === "common") {
      const tier = spec.drop as C.GemTier;
      r.gems.push({ id: r.nextId++, tier, x: e.x, y: e.y, attracted: false });
      const kind = drop(r);
      r.nextDrop = null;
      if (kind !== "none")
        r.pickups.push({ id: r.nextId++, kind, x: e.x, y: e.y });
    }
  }
  r.enemies = r.enemies.filter((e) => e.hp > 0);
  if (r.enemies.length !== aliveAtStart.size) cleanHits(r);
  const ids = new Set([...r.projectiles, ...r.zones].map((p) => p.id));
  for (const id of Object.keys(s.visual.shapes))
    if (!ids.has(Number(id))) delete s.visual.shapes[Number(id)];
}
export function removeEnemy(r: Run, id: number) {
  r.enemies = r.enemies.filter((e) => e.id !== id);
  cleanHits(r);
}
