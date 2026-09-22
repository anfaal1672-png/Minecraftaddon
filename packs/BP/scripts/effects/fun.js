import { BlockPermutation, system, world } from "@minecraft/server";
import { CONTAINER_BLOCKS } from "../generated/defs.js";
import { getBlock, isAir, isLiquidType, isProtected, TNT_IDS } from "../core/safety.js";
import { nearbyEntities, addEffect, spawnEntitySafe } from "../core/entities.js";
import { announce, msg, tntName } from "../systems/i18n.js";
import { attempt, warn } from "../util/log.js";
import { pick } from "../util/math.js";
import { burst, discLocs, particle, sound } from "./common.js";
import { EFFECTS, RAINBOW_POOL, effectOwner } from "./index.js";

/* ------------------------------------------------------------------ */
/*  お楽しみ系TNTの効果                                                */
/* ------------------------------------------------------------------ */

export function confettiEffect(dimension, center) {
  for (const ent of nearbyEntities(dimension, center, 6)) {
    addEffect(ent, "minecraft:jump_boost", 200, 1);
    addEffect(ent, "minecraft:speed", 200, 1);
  }
  sound(dimension, "random.levelup", center);
  burst(dimension, "minecraft:totem_particle", center, 16, 4, 3);
}

/**
 * 虹TNT: 他のTNTの効果からランダムに1つ発動する。
 * 表示は内部の関数名ではなく「どのTNTの効果か」 (B13)。核の効果は抽選から外した (B28)。
 */
export function rainbowEffect(dimension, center, ctx) {
  const name = pick(RAINBOW_POOL);
  const owner = effectOwner(name);
  if (owner) announce(msg("rainbow_pick", tntName(owner.id)));
  EFFECTS[name](dimension, center, ctx);
}

/* ---------- ディスコTNT (B09) ---------- */
const DISCO_KEY = "manytnt:disco_restore";
const COLORS = [
  "minecraft:red_concrete",
  "minecraft:yellow_concrete",
  "minecraft:lime_concrete",
  "minecraft:light_blue_concrete",
  "minecraft:purple_concrete",
  "minecraft:magenta_concrete",
];
const CONTAINERS = new Set(CONTAINER_BLOCKS);

function loadPending() {
  return attempt("disco.load", () => {
    const raw = world.getDynamicProperty(DISCO_KEY);
    return typeof raw === "string" ? JSON.parse(raw) : [];
  }) ?? [];
}
function savePending(list) {
  attempt("disco.save", () => world.setDynamicProperty(DISCO_KEY, list.length ? JSON.stringify(list) : undefined));
}

/** 床として色を変えてよいブロックか (コンテナ・看板・液体・保護ブロック等は変えない) */
function discoSafe(block) {
  if (!block || isAir(block) || isLiquidType(block.typeId) || isProtected(block)) return false;
  if (TNT_IDS.has(block.typeId) || CONTAINERS.has(block.typeId)) return false;
  if (attempt("sign", () => block.getComponent("minecraft:sign"))) return false;
  return true;
}

function restore(entry) {
  const dimension = attempt("disco.dim", () => world.getDimension(entry.d));
  if (!dimension) return true;
  let allDone = true;
  for (const [x, y, z, typeId, states] of entry.b) {
    const block = getBlock(dimension, { x, y, z });
    if (!block) {
      allDone = false; // 未ロード: 次回ロード時にもう一度試す
      continue;
    }
    if (!COLORS.includes(block.typeId)) continue; // 誰かが置き換えた
    attempt("disco.restore", () => block.setPermutation(BlockPermutation.resolve(typeId, states)));
  }
  return allDone;
}

/** ワールドを開いたとき、前回ディスコの途中で閉じた床を元に戻す */
export function restorePendingDisco() {
  const list = loadPending();
  if (list.length === 0) return;
  const remaining = list.filter((entry) => !restore(entry));
  savePending(remaining);
}

export function discoEffect(dimension, center) {
  announce(msg("disco"));
  const originals = [];
  for (const loc of discLocs(center, 4, -1, -1)) {
    const b = getBlock(dimension, loc);
    if (!discoSafe(b)) continue;
    const perm = b.permutation;
    originals.push({ loc, perm, rec: [loc.x, loc.y, loc.z, perm.type.id, attempt("states", () => perm.getAllStates()) ?? {}] });
  }
  if (originals.length === 0) return;

  // 先に復元データを保存してから床を変える (途中でワールドを閉じても戻せる)
  const entry = { id: `${system.currentTick}:${Math.random()}`, d: dimension.id, b: originals.map((o) => o.rec) };
  const pending = loadPending();
  if (pending.length >= 20) {
    warn("disco", "too many pending disco floors; skipping");
    return;
  }
  savePending([...pending, entry]);

  for (const ent of nearbyEntities(dimension, center, 6)) {
    addEffect(ent, "minecraft:speed", 140, 1);
    addEffect(ent, "minecraft:jump_boost", 140, 1);
  }

  let beat = 0;
  const beatId = system.runInterval(() => {
    beat++;
    for (const o of originals) {
      const b = getBlock(dimension, o.loc);
      if (b && (b.typeId === o.perm.type.id || COLORS.includes(b.typeId))) attempt("disco", () => b.setType(pick(COLORS)));
    }
    sound(dimension, "random.orb", center);
    burst(dimension, "minecraft:totem_particle", center, 2, 4);
    if (beat >= 7) {
      system.clearRun(beatId);
      for (const o of originals) {
        const b = getBlock(dimension, o.loc);
        if (b && COLORS.includes(b.typeId)) attempt("disco.end", () => b.setPermutation(o.perm));
      }
      savePending(loadPending().filter((e) => e.id !== entry.id));
    }
  }, 8);
}

export function fireworksEffect(dimension, center) {
  announce(msg("fireworks"));
  for (let i = 0; i < 14; i++) {
    system.runTimeout(() => {
      const rocket = spawnEntitySafe(dimension, "minecraft:fireworks_rocket", {
        x: center.x + (Math.random() - 0.5) * 6,
        y: center.y + Math.random() * 2,
        z: center.z + (Math.random() - 0.5) * 6,
      });
      if (rocket) attempt("rocket", () => rocket.applyImpulse({ x: (Math.random() - 0.5) * 0.2, y: 1.2 + Math.random() * 0.6, z: (Math.random() - 0.5) * 0.2 }));
    }, i * 3);
  }
}

export function musicEffect(dimension, center) {
  [0, 4, 7, 12, 7, 4, 0].forEach((n, i) => {
    system.runTimeout(() => {
      sound(dimension, "note.harp", center, { pitch: Math.pow(2, n / 12) });
      burst(dimension, "minecraft:note_particle", { x: center.x, y: center.y + 1, z: center.z }, 1, 2, 1);
    }, i * 4);
  });
}

export function daynightEffect(dimension, center) {
  attempt("time", () => world.setTimeOfDay(world.getTimeOfDay() < 13000 ? 13000 : 0));
  sound(dimension, "random.orb", center);
}

export function healEffect(dimension, center) {
  for (const ent of nearbyEntities(dimension, center, 6)) {
    addEffect(ent, "minecraft:regeneration", 100, 2, true);
    addEffect(ent, "minecraft:absorption", 200, 1);
  }
  burst(dimension, "minecraft:heart_particle", center, 8);
}

export function invisibilityEffect(dimension, center) {
  for (const ent of nearbyEntities(dimension, center, 6)) addEffect(ent, "minecraft:invisibility", 200, 0);
  particle(dimension, "minecraft:basic_smoke_particle", center);
}

export function speedEffect(dimension, center) {
  for (const ent of nearbyEntities(dimension, center, 6)) addEffect(ent, "minecraft:speed", 300, 3);
}
