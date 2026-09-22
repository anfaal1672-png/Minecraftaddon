import { GameMode } from "@minecraft/server";
import { attempt, debug } from "../util/log.js";

/* ------------------------------------------------------------------ */
/*  エンティティ関連の共通処理                                          */
/* ------------------------------------------------------------------ */
const ITEM_LIKE = new Set(["minecraft:item", "minecraft:xp_orb"]);
const NEVER_AFFECT = new Set(["minecraft:tnt", "minecraft:lightning_bolt", "minecraft:fireworks_rocket", "minecraft:arrow"]);

/**
 * 近くのエンティティ。スペクテイターは常に除外する (B19)。
 * kind: "all" | "living" (体力のあるもの) | "items" (アイテムと経験値)
 */
export function nearbyEntities(dimension, center, radius, kind = "living", extra = {}) {
  let list = [];
  try {
    list = dimension.getEntities({
      location: center,
      maxDistance: radius,
      excludeGameModes: [GameMode.Spectator],
      ...extra,
    });
  } catch (err) {
    debug("getEntities", err);
    return [];
  }
  if (kind === "items") return list.filter((e) => ITEM_LIKE.has(e.typeId));
  if (kind === "living") return list.filter(isLiving);
  return list.filter((e) => !NEVER_AFFECT.has(e.typeId));
}

/** 体力を持つ生き物か (防具立て・額縁・アイテムなどを除く。B20) */
export function isLiving(entity) {
  if (ITEM_LIKE.has(entity.typeId) || NEVER_AFFECT.has(entity.typeId)) return false;
  if (entity.typeId === "minecraft:armor_stand") return false;
  return attempt("health", () => entity.getComponent("minecraft:health") !== undefined) === true;
}

export function isPlayer(entity) {
  return entity?.typeId === "minecraft:player";
}

/**
 * center から外向きに吹き飛ばす (B03)。
 * @minecraft/server 2.x の applyKnockback(horizontalForce: VectorXZ, verticalStrength)
 * に合わせて、水平方向の強さ h と垂直方向の強さ v を別々に指定する。
 * アイテムなど applyKnockback が使えないものは applyImpulse で代用する。
 */
export function knockbackFrom(entity, center, h, v) {
  const f = knockbackVector(entity.location, center, h);
  try {
    entity.applyKnockback(f, v);
  } catch (err) {
    attempt("applyImpulse", () => entity.applyImpulse({ x: f.x * 0.5, y: v * 0.5, z: f.z * 0.5 }));
  }
}

/** 水平方向のノックバック量 (テストしやすいよう分離) */
export function knockbackVector(loc, center, h) {
  const dx = loc.x - center.x;
  const dz = loc.z - center.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  if (dist < 0.001) {
    const a = Math.random() * Math.PI * 2;
    return { x: Math.cos(a) * h, z: Math.sin(a) * h };
  }
  return { x: (dx / dist) * h, z: (dz / dist) * h };
}

/** center へ向かって引き寄せる */
export function pullToward(entity, center, strength, yFactor = 0.5) {
  attempt("pull", () => {
    const loc = entity.location;
    const dx = center.x - loc.x;
    const dy = center.y - loc.y;
    const dz = center.z - loc.z;
    const dist = Math.max(0.5, Math.sqrt(dx * dx + dy * dy + dz * dz));
    entity.applyImpulse({ x: (dx / dist) * strength, y: (dy / dist) * strength * yFactor, z: (dz / dist) * strength });
  });
}

export function addEffect(entity, effect, ticks, amplifier = 0, showParticles = false) {
  attempt("addEffect", () => entity.addEffect(effect, ticks, { amplifier, showParticles }));
}

export function spawnEntitySafe(dimension, typeId, loc) {
  return attempt("spawnEntity", () => dimension.spawnEntity(typeId, loc));
}
