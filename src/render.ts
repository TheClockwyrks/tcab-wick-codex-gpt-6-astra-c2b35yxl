import type { RenderApi } from "@clockwyrks/simple-2d";
import * as C from "./constants";
import type { WickState, WeaponId } from "./types";
import { stats, row, xpNext, isWeapon } from "./model";
import { images, FRONTISPIECE } from "./assets";
import { menuRects, tabRects, entries } from "./menus";
const P = {
  bg: "#0b1b23",
  panel: "#11262d",
  ink: "#e4ddc4",
  gold: "#c9a26a",
  muted: "#8aaba5",
  line: "#344b4c",
  teal: "#70b1a1",
};
type Context = CanvasRenderingContext2D;
function text(
  c: Context,
  t: string,
  x: number,
  y: number,
  size = 18,
  color = P.ink,
  align: CanvasTextAlign = "left",
  serif = false,
) {
  c.font = `${serif ? "" : "500 "}${size}px ${serif ? "Georgia, serif" : '"Trebuchet MS", sans-serif'}`;
  c.fillStyle = color;
  c.textAlign = align;
  c.textBaseline = "middle";
  c.fillText(t, x, y);
}
function tracked(
  c: Context,
  t: string,
  x: number,
  y: number,
  size = 13,
  color = P.gold,
  spacing = 3,
) {
  c.font = `${size}px "Trebuchet MS", sans-serif`;
  c.fillStyle = color;
  c.textAlign = "left";
  c.textBaseline = "middle";
  for (const ch of t) {
    c.fillText(ch, x, y);
    x += c.measureText(ch).width + spacing;
  }
}
function line(
  c: Context,
  x: number,
  y: number,
  x2: number,
  y2: number,
  color = P.line,
) {
  c.strokeStyle = color;
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(x2, y2);
  c.stroke();
}
function box(
  c: Context,
  x: number,
  y: number,
  w: number,
  h: number,
  fill = P.panel,
  stroke = P.line,
) {
  c.fillStyle = fill;
  c.fillRect(x, y, w, h);
  c.strokeStyle = stroke;
  c.lineWidth = 1;
  c.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}
function sprite(
  c: Context,
  path: string,
  x: number,
  y: number,
  w?: number,
  h?: number,
  flip = false,
) {
  const image = images[path];
  if (!image) return;
  const width = w ?? image.width,
    height = h ?? image.height;
  c.save();
  c.translate(x, y);
  if (flip) c.scale(-1, 1);
  c.drawImage(image, -width / 2, -height / 2, width, height);
  c.restore();
}
function effectPath(id: WeaponId, frame: number) {
  const e = C.EFFECT_SPRITES[id];
  return e.frames === 1
    ? e.path
    : `${e.path}/${Math.max(0, Math.min(e.frames - 1, frame))}.png`;
}
export const clockText = (tick: number) => {
  const seconds = Math.floor(tick / C.TICK_HZ);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};
export function itemName(id: string): string {
  if (id === C.LAMP_OIL_ID) return C.LAMP_OIL_NAME;
  if (isWeapon(id)) return C.WEAPON_NAMES[id];
  if (id in C.PASSIVES) return C.PASSIVES[id as C.PassiveId].name;
  if (id in C.ENEMIES) return C.ENEMIES[id as C.EnemyId].name;
  if (id in C.GEM_NAMES) return C.GEM_NAMES[id as C.GemTier];
  return C.PICKUP_NAMES[id as C.PickupKind];
}
export function description(id: string): string {
  if (id === C.LAMP_OIL_ID) return C.LAMP_OIL_DESCRIPTION;
  if (isWeapon(id)) return C.WEAPON_DESCRIPTIONS[id];
  if (id in C.PASSIVE_DESCRIPTIONS)
    return C.PASSIVE_DESCRIPTIONS[id as C.PassiveId];
  if (id in C.ENEMY_DESCRIPTIONS) return C.ENEMY_DESCRIPTIONS[id as C.EnemyId];
  if (id in C.GEM_DESCRIPTIONS) return C.GEM_DESCRIPTIONS[id as C.GemTier];
  return C.PICKUP_DESCRIPTIONS[id as C.PickupKind];
}
function vignette(c: Context) {
  const g = c.createRadialGradient(
    C.STAGE_CX,
    C.STAGE_CY,
    100,
    C.STAGE_CX,
    C.STAGE_CY,
    740,
  );
  g.addColorStop(0, "#07121900");
  g.addColorStop(1, "#030b13bb");
  c.fillStyle = g;
  c.fillRect(0, 0, C.STAGE_W, C.STAGE_H);
}
function world(c: Context, s: WickState) {
  const r = s.run,
    p = r.player;
  const left = p.x - C.STAGE_CX,
    top = p.y - C.STAGE_CY;
  for (
    let y = Math.floor(top / C.GROUND_TILE_SIZE) * C.GROUND_TILE_SIZE;
    y < top + C.STAGE_H;
    y += C.GROUND_TILE_SIZE
  )
    for (
      let x = Math.floor(left / C.GROUND_TILE_SIZE) * C.GROUND_TILE_SIZE;
      x < left + C.STAGE_W;
      x += C.GROUND_TILE_SIZE
    )
      sprite(
        c,
        C.GROUND_TILE_PATH,
        x - left + C.GROUND_TILE_SIZE / 2,
        y - top + C.GROUND_TILE_SIZE / 2,
      );
  const sx = (x: number) => x - left,
    sy = (y: number) => y - top;
  // The light is chrome; every actor and weapon shape uses its produced artwork.
  const light = c.createRadialGradient(
    C.STAGE_CX,
    C.STAGE_CY,
    8,
    C.STAGE_CX,
    C.STAGE_CY,
    230,
  );
  light.addColorStop(0, "#d5a75316");
  light.addColorStop(1, "#d5a75300");
  c.fillStyle = light;
  c.fillRect(0, 0, C.STAGE_W, C.STAGE_H);
  for (const z of r.zones) {
    const meta = s.visual.shapes[z.id];
    const age = (r.tick - (meta?.born ?? r.tick)) * C.TICK_DT;
    let frame =
      Math.floor(age / C.WALK_FRAME_TIME) % C.EFFECT_SPRITES[z.weapon].frames;
    if (z.kind === "strike") frame = Math.floor(age / (C.SPARK_FLASH / 4));
    if (z.kind === "burst") frame = Math.floor(age / (C.FLARE_FLASH / 6));
    c.save();
    if (z.kind === "aura" || z.kind === "puddle")
      c.globalAlpha = meta?.pulse === r.tick ? 1 : 0.55;
    sprite(
      c,
      effectPath(z.weapon, frame),
      sx(z.x),
      sy(z.y),
      z.width ?? z.radius * 2,
      z.height ?? z.radius * 2,
      z.kind === "slash" && z.x < p.x,
    );
    c.restore();
  }
  for (const g of r.gems) sprite(c, C.GEM_PATHS[g.tier], sx(g.x), sy(g.y));
  for (const item of r.pickups)
    sprite(c, C.PICKUP_PATHS[item.kind], sx(item.x), sy(item.y));
  for (const e of r.enemies) {
    const size = C.ENEMIES[e.type].radius * 2;
    sprite(
      c,
      `${C.ENEMY_SHEET_DIR}/${e.type}/${Math.floor((e.age + 1e-8) / C.WALK_FRAME_TIME) % C.ENEMY_FRAMES}.png`,
      sx(e.x),
      sy(e.y),
      size,
      size,
      e.heading.x < 0,
    );
    if (C.ENEMIES[e.type].rank !== "common") {
      box(c, sx(e.x) - 30, sy(e.y) - size / 2 - 13, 60, 4, "#08131b");
      c.fillStyle = P.gold;
      c.fillRect(
        sx(e.x) - 29,
        sy(e.y) - size / 2 - 12,
        58 * Math.max(0, e.hp / e.maxHp),
        2,
      );
    }
  }
  for (const puff of s.visual.puffs) {
    const f = Math.floor(
      ((r.tick - puff.born) * C.TICK_DT) / (C.PUFF_TIME / C.PUFF_SHEET.frames),
    );
    if (f < C.PUFF_SHEET.frames)
      sprite(c, `${C.PUFF_SHEET.dir}/${f}.png`, sx(puff.x), sy(puff.y));
  }
  for (const b of r.projectiles) {
    const age = (r.tick - (s.visual.shapes[b.id]?.born ?? r.tick)) * C.TICK_DT;
    sprite(
      c,
      effectPath(
        b.weapon,
        Math.floor(age / C.WALK_FRAME_TIME) % C.EFFECT_SPRITES[b.weapon].frames,
      ),
      sx(b.x),
      sy(b.y),
      b.radius * 2,
      b.radius * 2,
    );
  }
  const playerPath = s.visual.moved
    ? `${C.LAMPLIGHTER_WALK_SHEET.dir}/${Math.floor((s.visual.moveTicks * C.TICK_DT) / C.WALK_FRAME_TIME) % C.LAMPLIGHTER_WALK_SHEET.frames}.png`
    : C.LAMPLIGHTER_IDLE_PATH;
  sprite(
    c,
    playerPath,
    C.STAGE_CX,
    C.STAGE_CY,
    C.LAMPLIGHTER_SPRITE_WIDTH,
    C.LAMPLIGHTER_SPRITE_HEIGHT,
    p.facing === "left",
  );
  vignette(c);
  if (r.hurtFlash > 0) {
    c.fillStyle = `rgba(173,49,39,${(0.19 * r.hurtFlash) / C.HURT_FLASH})`;
    c.fillRect(0, 0, C.STAGE_W, C.STAGE_H);
  }
}
function hud(c: Context, s: WickState) {
  const r = s.run,
    st = stats(r);
  box(c, 24, 22, 310, 78, "#0b1b23e8");
  tracked(c, "LAMPLIGHTER", 40, 39, 10, P.muted, 2);
  text(
    c,
    `${Math.ceil(r.player.hp)} / ${st.maxHp}`,
    315,
    40,
    14,
    P.ink,
    "right",
  );
  box(c, 40, 55, 278, 8, "#233737");
  c.fillStyle = "#b99b63";
  c.fillRect(41, 56, 276 * Math.max(0, Math.min(1, r.player.hp / st.maxHp)), 6);
  text(c, `${C.LEVEL_LABEL} ${r.level}`, 40, 80, 12, P.teal);
  box(c, 117, 76, 201, 5, "#233737");
  c.fillStyle = P.teal;
  c.fillRect(
    118,
    77,
    199 * Math.max(0, Math.min(1, r.xp / xpNext(r.level))),
    3,
  );
  box(c, 552, 22, 176, 71, "#0b1b23e8");
  text(c, clockText(r.tick), 640, 49, 31, P.ink, "center", true);
  tracked(c, "UNTIL DAWN", 590, 78, 9, P.muted, 2);
  box(c, 1096, 22, 160, 62, "#0b1b23e8");
  tracked(c, "VANQUISHED", 1113, 39, 9, P.muted, 2);
  text(
    c,
    String(r.kills).padStart(3, "0"),
    1238,
    62,
    23,
    P.gold,
    "right",
    true,
  );
  for (const [kind, slots, count, y] of [
    ["TOOLS", r.weapons, C.WEAPON_SLOTS, 620],
    ["TRINKETS", r.passives, C.PASSIVE_SLOTS, 620],
  ] as const) {
    const left = kind === "TOOLS" ? 28 : 894;
    tracked(c, kind, left, y - 13, 10, P.muted, 2);
    for (let i = 0; i < count; i++) {
      const x = left + i * 59;
      box(c, x, y, 49, 49, "#0b1b23e8");
      const slot = slots[i];
      if (slot) {
        sprite(c, C.ICON_PATHS[slot.id], x + 24, y + 23, 32, 32);
        if ("cooldown" in slot && slot.cooldown > 0) {
          const w = row(slot.id, slot.level);
          const max =
            Math.max(C.MIN_COOLDOWN, w.cooldown * st.cooldownMul) +
            (slot.id === "lantern" ? (w.duration ?? 0) : 0);
          c.fillStyle = "#08131baa";
          const h = 40 * Math.min(1, slot.cooldown / max);
          c.fillRect(x + 5, y + 44 - h, 39, h);
          c.fillStyle = P.gold;
          c.fillRect(
            x + 3,
            y + 46,
            43 * (1 - Math.min(1, slot.cooldown / max)),
            2,
          );
        }
        for (let j = 0; j < slot.level; j++) {
          c.fillStyle = kind === "TOOLS" ? P.gold : P.teal;
          c.fillRect(x + 2 + j * 6, y + 54, 4, 3);
        }
      }
    }
  }
  text(c, "WASD / ARROWS   MOVE", C.STAGE_CX, 660, 11, P.muted, "center");
  text(
    c,
    `P  PAUSE     M  ${s.muted ? "UNMUTE" : "MUTE"}`,
    C.STAGE_CX,
    681,
    10,
    P.muted,
    "center",
  );
}
function frame(c: Context) {
  box(c, 28, 28, C.STAGE_W - 56, C.STAGE_H - 56, P.bg, P.line);
  line(c, 45, 45, 78, 45, P.gold);
  line(c, 45, 45, 45, 78, P.gold);
  line(c, 1235, 675, 1202, 675, P.gold);
  line(c, 1235, 675, 1235, 642, P.gold);
}
function menu(c: Context, s: WickState, labels: readonly string[]) {
  menuRects(s).forEach((r, i) => {
    const selected = s.menuIndex === i;
    box(
      c,
      r.x,
      r.y,
      r.width,
      r.height,
      selected ? "#233b3d" : "#0d2028",
      selected ? P.gold : P.line,
    );
    if (selected) {
      c.fillStyle = P.gold;
      c.fillRect(r.x, r.y, 3, r.height);
    }
    text(
      c,
      selected ? "◆" : "·",
      r.x + 22,
      r.y + r.height / 2,
      14,
      selected ? P.gold : P.muted,
    );
    tracked(
      c,
      labels[i] ?? "",
      r.x + 48,
      r.y + r.height / 2,
      14,
      selected ? P.ink : P.muted,
      1.8,
    );
    text(
      c,
      selected ? "↵" : "",
      r.x + r.width - 24,
      r.y + r.height / 2,
      18,
      P.gold,
      "center",
    );
  });
}
function titleScreen(c: Context, s: WickState) {
  c.fillStyle = P.bg;
  c.fillRect(0, 0, C.STAGE_W, C.STAGE_H);
  sprite(c, FRONTISPIECE, 914, 360, 720, 720);
  const fade = c.createLinearGradient(500, 0, 760, 0);
  fade.addColorStop(0, P.bg);
  fade.addColorStop(1, "#0b1b2300");
  c.fillStyle = fade;
  c.fillRect(500, 0, 260, 720);
  vignette(c);
  line(c, 72, 67, 1208, 67);
  tracked(c, "A SMALL LIGHT. A LONG NIGHT.", 132, 122, 11, P.muted, 2.8);
  text(c, C.TITLE_TEXT, 125, 230, 126, P.ink, "left", true);
  tracked(c, C.TAGLINE_TEXT, 136, 310, 17, P.gold, 6);
  line(c, 134, 350, 492, 350);
  menu(c, s, C.TITLE_ITEMS);
  text(
    c,
    "The city is sleeping. The dark is not.",
    133,
    611,
    17,
    P.muted,
    "left",
    true,
  );
  tracked(c, "TEN MINUTES TO DAWN", 133, 648, 10, P.gold, 2.5);
  text(c, "ENTER / CLICK TO BEGIN", 1140, 649, 10, P.muted, "right");
  line(c, 72, 681, 1208, 681);
}
function howto(c: Context, s: WickState) {
  frame(c);
  tracked(c, "A LAMPLIGHTER’S FIELD GUIDE", 80, 79, 11);
  text(c, "Keep walking. Keep the light.", 80, 130, 42, P.ink, "left", true);
  const lessons = [
    [
      "01",
      "WALK INTO THE NIGHT",
      "Move with WASD or the arrow keys. Your tools fire themselves.",
      "Everything is drawn to your light. Keep clear: the dark hurts on touch.",
    ],
    [
      "02",
      "GATHER WHAT FALLS",
      "Walk near gems to gather experience. Each level offers one of three gifts.",
      "Carry six tools and six trinkets. Choose a combination that keeps you alive.",
    ],
    [
      "03",
      "TRANSFORM YOUR TOOLS",
      "The great creatures leave chests. A tool at level eight can transform",
      "when you carry its matching trinket. The Almanac holds every item and foe.",
    ],
    [
      "04",
      "OUTLAST THE DARK",
      "The night grows crowded. At nine minutes, the Dark itself arrives.",
      "Survive until 10:00. Dawn is your only way out.",
    ],
  ];
  lessons.forEach((l, i) => {
    const y = 207 + i * 89;
    text(c, l[0], 82, y, 28, P.gold, "left", true);
    tracked(c, l[1], 143, y - 5, 12);
    text(c, l[2], 143, y + 20, 16, P.ink);
    text(c, l[3], 143, y + 42, 15, P.muted);
  });
  text(
    c,
    "ENTER / SPACE  Confirm     ESC  Back / pause     P  Pause     M  Mute",
    640,
    578,
    14,
    P.muted,
    "center",
  );
  text(
    c,
    "Every menu also answers mouse and touch.",
    640,
    550,
    13,
    P.muted,
    "center",
  );
  menu(c, s, ["BACK TO TITLE"]);
}
function almanac(c: Context, s: WickState) {
  frame(c);
  tracked(c, "FIELD NOTES / THE CITY AFTER DARK", 70, 65, 10);
  text(c, C.ALMANAC_TEXT, 70, 91, 32, P.ink, "left", true);
  text(
    c,
    "← →  TABS     ↑ ↓  BROWSE     ESC  BACK",
    1205,
    79,
    11,
    P.muted,
    "right",
  );
  tabRects(s).forEach((r, i) => {
    box(
      c,
      r.x,
      r.y,
      r.width,
      r.height,
      s.almanacTab === i ? "#2a403e" : P.bg,
      s.almanacTab === i ? P.gold : P.line,
    );
    tracked(
      c,
      C.ALMANAC_TABS[i],
      r.x + 22,
      r.y + 22,
      12,
      s.almanacTab === i ? P.ink : P.muted,
      2,
    );
  });
  const ids = entries(s.almanacTab);
  menuRects(s).forEach((r, i) => {
    const index = i + s.almanacScroll;
    const selected = index === s.menuIndex;
    box(
      c,
      r.x,
      r.y,
      r.width,
      r.height,
      selected ? "#29413f" : P.bg,
      selected ? P.gold : P.bg,
    );
    text(
      c,
      String(index + 1).padStart(2, "0"),
      r.x + 16,
      r.y + 19,
      11,
      P.muted,
    );
    text(
      c,
      itemName(ids[index]),
      r.x + 53,
      r.y + 19,
      17,
      selected ? P.ink : P.muted,
    );
    if (selected) text(c, "›", r.x + r.width - 20, r.y + 19, 21, P.gold);
  });
  line(c, 412, 190, 412, 613);
  text(c, `${s.menuIndex + 1} / ${ids.length}`, 75, 633, 11, P.muted);
  text(c, "SCROLL TO EXPLORE", 375, 633, 10, P.muted, "right");
  const id = ids[s.menuIndex];
  if (!id) return;
  tracked(
    c,
    s.almanacTab === 0
      ? C.EVOLUTION_IDS.includes(id as C.EvolutionId)
        ? "EVOLVED TOOL"
        : "TOOL / LEVEL 1"
      : C.ALMANAC_TABS[s.almanacTab],
    454,
    207,
    10,
  );
  text(c, itemName(id), 454, 249, 44, P.ink, "left", true);
  const cx = 805,
    cy = 380;
  const rad = c.createRadialGradient(cx, cy, 5, cx, cy, 115);
  rad.addColorStop(0, "#b6a25722");
  rad.addColorStop(1, "#b6a25700");
  c.fillStyle = rad;
  c.fillRect(cx - 120, cy - 120, 240, 240);
  let lines: string[] = [];
  if (isWeapon(id)) {
    const w = row(id);
    sprite(c, C.ICON_PATHS[id], 530, 370, 72, 72);
    const e = C.EFFECT_SPRITES[id];
    sprite(
      c,
      effectPath(id, Math.floor(s.simTime / C.WALK_FRAME_TIME) % e.frames),
      cx,
      cy,
      Math.min(220, e.width * 3),
      Math.min(170, e.height * 3),
    );
    lines = [
      `DAMAGE   ${w.damage}`,
      ...(id === "chandelier" ? [] : [`COOLDOWN   ${w.cooldown}s`]),
    ];
  } else if (id in C.PASSIVES) {
    sprite(c, C.ICON_PATHS[id as C.PassiveId], cx, cy, 120, 120);
    lines = [`MAX LEVEL   ${C.PASSIVES[id as C.PassiveId].maxLevel}`];
  } else if (id in C.ENEMIES) {
    const e = C.ENEMIES[id as C.EnemyId];
    sprite(
      c,
      `${C.ENEMY_SHEET_DIR}/${id}/${Math.floor(s.simTime / C.WALK_FRAME_TIME) % C.ENEMY_FRAMES}.png`,
      cx,
      cy,
      e.radius * 4,
      e.radius * 4,
    );
    lines = [`HEALTH   ${e.hp}`, `SPEED   ${e.speed}`, `DAMAGE   ${e.damage}`];
  } else if (id in C.GEM_PATHS) {
    sprite(c, C.GEM_PATHS[id as C.GemTier], cx, cy, 64, 64);
    lines = [`EXPERIENCE   ${C.GEM_VALUES[id as C.GemTier]}`];
  } else {
    sprite(c, C.PICKUP_PATHS[id as C.PickupKind], cx, cy, 96, 96);
    if (id === "bread") lines = [`HEALS   ${C.BREAD_HEAL}`];
  }
  lines.forEach((t, i) => tracked(c, t, 456 + i * 225, 510, 11, P.gold, 1));
  line(c, 454, 544, 1196, 544);
  const desc = description(id);
  text(c, desc, 454, 577, desc.length > 77 ? 13 : 15, P.muted);
  if (isWeapon(id)) {
    const recipe = C.EVOLUTION_IDS.find(
      (e) => e === id || C.EVOLUTIONS[e].from === id,
    );
    if (recipe) {
      const r = C.EVOLUTIONS[recipe];
      text(
        c,
        `${C.WEAPON_NAMES[r.from]} VIII  +  ${C.PASSIVES[r.passive].name}  +  Chest   →   ${C.WEAPON_NAMES[recipe]}`,
        454,
        618,
        14,
        P.gold,
      );
    }
  }
}
function overlay(c: Context, s: WickState) {
  c.fillStyle = "#061219d9";
  c.fillRect(0, 0, C.STAGE_W, C.STAGE_H);
  box(c, 240, 142, 800, 496, "#0f242bee", P.line);
  tracked(c, "W I C K  /  KEEP THE LIGHT", 289, 177, 10, P.muted, 2);
  line(c, 285, 201, 995, 201);
  if (s.screen === "levelup") {
    text(c, C.LEVEL_UP_TEXT, 640, 246, 32, P.ink, "center", true);
    menuRects(s).forEach((r, i) => {
      const id = s.run.offers[i],
        held = [...s.run.weapons, ...s.run.passives].find((x) => x.id === id);
      const selected = i === s.menuIndex;
      box(
        c,
        r.x,
        r.y,
        r.width,
        r.height,
        selected ? "#2a413e" : "#132a30",
        selected ? P.gold : P.line,
      );
      sprite(c, C.ICON_PATHS[id], r.x + 37, r.y + 35, 40, 40);
      text(
        c,
        itemName(id),
        r.x + 78,
        r.y + 35,
        23,
        selected ? P.ink : P.muted,
        "left",
        true,
      );
      tracked(
        c,
        held ? `${C.LEVEL_LABEL} ${held.level + 1}` : C.OFFER_NEW_TEXT,
        r.x + r.width - 111,
        r.y + 35,
        10,
        P.gold,
        1,
      );
    });
    text(
      c,
      description(s.run.offers[s.menuIndex] ?? C.LAMP_OIL_ID),
      640,
      566,
      15,
      P.muted,
      "center",
    );
    text(
      c,
      "↑ ↓  CHOOSE YOUR GIFT     ENTER  TAKE IT",
      640,
      608,
      11,
      P.gold,
      "center",
    );
  } else if (s.screen === "chest") {
    text(c, C.CHEST_TEXT, 640, 249, 37, P.ink, "center", true);
    const result = s.run.chestResult;
    if (result && result.kind !== "heal") {
      const id = result.kind === "evolve" ? result.weapon : result.item;
      sprite(c, C.ICON_PATHS[id], 640, 350, 88, 88);
      text(c, itemName(id), 640, 428, 36, P.gold, "center", true);
      tracked(
        c,
        result.kind === "evolve"
          ? "TRANSFORMED"
          : `${C.LEVEL_LABEL} ${result.level}`,
        551,
        478,
        13,
        P.teal,
        3,
      );
    } else {
      text(
        c,
        `The lamp recovers ${C.CHEST_HEAL} health.`,
        640,
        380,
        28,
        P.gold,
        "center",
        true,
      );
    }
    menu(c, s, ["CONTINUE"]);
  } else {
    const heading =
      s.screen === "paused"
        ? C.PAUSED_TEXT
        : s.screen === "dawn"
          ? C.DAWN_TEXT
          : C.FALLEN_TEXT;
    text(
      c,
      heading,
      640,
      273,
      s.screen === "paused" ? 58 : 42,
      P.ink,
      "center",
      true,
    );
    if (s.screen === "paused")
      text(
        c,
        "A moment of quiet in the long night.",
        640,
        350,
        18,
        P.muted,
        "center",
        true,
      );
    else {
      text(
        c,
        s.screen === "dawn"
          ? "The city wakes. Your light is still burning."
          : "Even a small light leaves its mark.",
        640,
        333,
        18,
        P.muted,
        "center",
        true,
      );
      text(
        c,
        `${clockText(s.run.tick)} SURVIVED     /     LEVEL ${s.run.level}     /     ${s.run.kills} VANQUISHED`,
        640,
        380,
        13,
        P.gold,
        "center",
      );
    }
    menu(c, s, s.screen === "paused" ? C.PAUSE_ITEMS : C.END_ITEMS);
  }
}
export function render(s: WickState, api: RenderApi) {
  const c = api.ctx;
  c.imageSmoothingEnabled = false;
  if (s.screen === "title") {
    titleScreen(c, s);
    return;
  }
  if (s.screen === "howto") {
    howto(c, s);
    return;
  }
  if (s.screen === "almanac") {
    almanac(c, s);
    return;
  }
  world(c, s);
  hud(c, s);
  if (s.screen !== "playing") overlay(c, s);
}
