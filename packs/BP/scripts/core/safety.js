import { BlockVolume, ItemStack } from "@minecraft/server";
import { CONTAINER_BLOCKS, TNT_DEFS } from "../generated/defs.js";
import { getSettings } from "../systems/settings.js";
import { attempt, debug } from "../util/log.js";
import { rand } from "../util/math.js";

/* ------------------------------------------------------------------ */
/*  ワールドを壊しすぎないための共通処理 (B11, B12, B18)                 */
/*  ・どの効果でも壊してはいけないブロック                                */
/*  ・コンテナを壊すときは中身をドロップ                                  */
/*  ・未ロードのチャンクには触らない                                      */
/*  ・テレポート先の安全確認                                            */
/* ------------------------------------------------------------------ */
export const INDESTRUCTIBLE_BLOCKS = new Set([
  "minecraft:bedrock",
  "minecraft:barrier",
  "minecraft:end_portal_frame",
  "minecraft:end_portal",
  "minecraft:end_gateway",
  "minecraft:portal",
  "minecraft:command_block",
  "minecraft:repeating_command_block",
  "minecraft:chain_command_block",
  "minecraft:structure_block",
  "minecraft:structure_void",
  "minecraft:jigsaw",
  "minecraft:allow",
  "minecraft:deny",
  "minecraft:border_block",
  "minecraft:light_block",
  "minecraft:reinforced_deepslate",
]);

const LIQUIDS = new Set(["minecraft:water", "minecraft:flowing_water", "minecraft:lava", "minecraft:flowing_lava"]);
export const TNT_IDS = new Set(TNT_DEFS.map((d) => d.id));
const CONTAINERS = new Set(CONTAINER_BLOCKS);

/** 着地してはいけない・中に入ってはいけないブロック */
const HAZARDS = new Set([
  "minecraft:lava",
  "minecraft:flowing_lava",
  "minecraft:fire",
  "minecraft:soul_fire",
  "minecraft:magma",
  "minecraft:cactus",
  "minecraft:sweet_berry_bush",
  "minecraft:powder_snow",
  "minecraft:web",
  "minecraft:campfire",
  "minecraft:soul_campfire",
  "minecraft:wither_rose",
  "minecraft:pointed_dripstone",
]);

/** 上を通り抜けられる (頭・足の位置にあっても窒息しない) ブロック */
const PASSABLE = new Set([
  "minecraft:air",
  "minecraft:short_grass",
  "minecraft:tall_grass",
  "minecraft:fern",
  "minecraft:large_fern",
  "minecraft:snow_layer",
  "minecraft:dandelion",
  "minecraft:poppy",
  "minecraft:torch",
  "minecraft:vine",
  "minecraft:deadbush",
  "minecraft:light_block",
]);

export function isLoaded(dimension, loc) {
  try {
    return dimension.isChunkLoaded(loc);
  } catch (err) {
    return false;
  }
}

export function inHeightRange(dimension, y) {
  try {
    const r = dimension.heightRange;
    return y >= r.min && y < r.max;
  } catch (err) {
    return true;
  }
}

/** 例外を出さずにブロックを取る (未ロード・範囲外は undefined) */
export function getBlock(dimension, loc) {
  if (!inHeightRange(dimension, loc.y)) return undefined;
  try {
    return dimension.getBlock(loc);
  } catch (err) {
    debug("getBlock", err);
    return undefined;
  }
}

export function isAir(block) {
  return !block || block.typeId === "minecraft:air" || block.typeId === "minecraft:cave_air";
}

export function isLiquidType(typeId) {
  return LIQUIDS.has(typeId);
}

export function isProtected(block) {
  return !block || INDESTRUCTIBLE_BLOCKS.has(block.typeId);
}

/** 地形を変える系の処理をしてよいか (安全モードなら false) */
export function terrainAllowed() {
  return getSettings().terrain;
}

/**
 * ブロックを壊す。保護ブロック・このアドオンのTNT・安全モード中は壊さない。
 * コンテナは中身をその場にドロップしてから壊す。
 */
export function breakBlock(dimension, block, { allowLiquid = true } = {}) {
  if (!block || isAir(block) || isProtected(block) || TNT_IDS.has(block.typeId)) return false;
  if (!terrainAllowed()) return false;
  if (!allowLiquid && isLiquidType(block.typeId)) return false;
  if (CONTAINERS.has(block.typeId)) dropContents(dimension, block);
  return attempt("breakBlock", () => {
    block.setType("minecraft:air");
    return true;
  }) === true;
}

export function dropContents(dimension, block) {
  const container = attempt("inventory", () => block.getComponent("minecraft:inventory")?.container);
  if (!container) return;
  const at = { x: block.location.x + 0.5, y: block.location.y + 0.5, z: block.location.z + 0.5 };
  for (let i = 0; i < container.size; i++) {
    const item = attempt("getItem", () => container.getItem(i));
    if (!item) continue;
    attempt("dropItem", () => {
      container.setItem(i);
      dimension.spawnItem(item, at);
    });
  }
}

/**
 * ブロックを置く。
 * destructive=true の処理 (溶岩・火・既存ブロックの置き換え) は安全モード中は行わない。
 * canReplace(block) が true のときだけ置き換える (既定: 空気のときだけ)。
 */
export function placeBlock(dimension, loc, typeId, { destructive = false, canReplace = isAir } = {}) {
  if (destructive && !terrainAllowed()) return false;
  const block = getBlock(dimension, loc);
  if (!block || isProtected(block) || TNT_IDS.has(block.typeId)) return false;
  if (!canReplace(block)) return false;
  return attempt("placeBlock", () => {
    block.setType(typeId);
    return true;
  }) === true;
}

/**
 * 球状の範囲を、耐爆性を無視して空気にする (craterBurst 用)。
 * dimension.fillBlocks を「1行ずつ」呼ぶことで、1ブロックずつ getBlock するより
 * 桁違いに速い。保護ブロック・このアドオンのTNT・コンテナは除外する
 * (コンテナは同じ場所で起こす本物の爆発が、中身ごと通常どおり壊す)。
 * 外周は行の長さをランダムに削って、ギザギザの自然な輪郭にする。
 * ジェネレーター: 処理したブロック数を yield する。
 */
const FILL_EXCLUDE = [...INDESTRUCTIBLE_BLOCKS, ...TNT_IDS, ...CONTAINERS, "minecraft:air"];
export function* clearSphere(dimension, center, r) {
  if (!terrainAllowed()) return;
  const cx = Math.round(center.x);
  const cy = Math.round(center.y);
  const cz = Math.round(center.z);
  for (let dy = -r; dy <= r; dy++) {
    const y = cy + dy;
    if (!inHeightRange(dimension, y)) continue;
    for (let dz = -r; dz <= r; dz++) {
      const rr = r * r - dy * dy - dz * dz;
      if (rr < 0) continue;
      const half = Math.sqrt(rr);
      const edge = Math.sqrt(dy * dy + dz * dz) / r; // 0 = 中心, 1 = 外周
      const trim = edge > 0.6 ? rand(0, r * 0.25) : rand(0, r * 0.08);
      const xr = Math.floor(half - trim);
      if (xr < 0) continue;
      const from = { x: cx - xr, y, z: cz + dz };
      const to = { x: cx + xr, y, z: cz + dz };
      if (!isLoaded(dimension, from) || !isLoaded(dimension, to)) {
        yield 1;
        continue;
      }
      attempt("fillBlocks", () =>
        dimension.fillBlocks(new BlockVolume(from, to), "minecraft:air", {
          blockFilter: { excludeTypes: FILL_EXCLUDE },
          ignoreChunkBoundErrors: true,
        })
      );
      yield 2 * xr + 1;
    }
  }
}

/** 地面として立てるか */
function isStandable(block) {
  if (!block || isAir(block) || PASSABLE.has(block.typeId)) return false;
  if (isLiquidType(block.typeId) || HAZARDS.has(block.typeId)) return false;
  return true;
}
function isClear(block) {
  return !!block && (isAir(block) || PASSABLE.has(block.typeId));
}

/**
 * (x, z) の列で、yHint の上下 range ブロック以内から安全に立てる場所を探す (B12)。
 * 足元が固体で危険物でなく、足と頭の位置が空いている場所。
 * 見つからなければ undefined (その場合テレポートしない)。
 */
export function findSafeLanding(dimension, x, z, yHint, range = 8) {
  const bx = Math.floor(x);
  const bz = Math.floor(z);
  const base = Math.floor(yHint);
  if (!isLoaded(dimension, { x: bx, y: base, z: bz })) return undefined;
  for (let d = 0; d <= range; d++) {
    for (const y of d === 0 ? [base] : [base + d, base - d]) {
      if (!inHeightRange(dimension, y - 1) || !inHeightRange(dimension, y + 1)) continue;
      const ground = getBlock(dimension, { x: bx, y: y - 1, z: bz });
      if (!isStandable(ground)) continue;
      const feet = getBlock(dimension, { x: bx, y, z: bz });
      const head = getBlock(dimension, { x: bx, y: y + 1, z: bz });
      if (isClear(feet) && isClear(head)) return { x: bx + 0.5, y, z: bz + 0.5 };
    }
  }
  return undefined;
}

/** 安全な場所があればテレポートする。成功したら true */
export function safeTeleport(entity, dimension, x, z, yHint) {
  const dest = findSafeLanding(dimension, x, z, yHint);
  if (!dest) return false;
  return attempt("teleport", () => {
    entity.teleport(dest, { dimension });
    return true;
  }) === true;
}

export function spawnItemSafe(dimension, itemId, amount, loc, impulse) {
  return attempt("spawnItem", () => {
    const e = dimension.spawnItem(new ItemStack(itemId, amount), loc);
    if (impulse) e.applyImpulse(impulse);
    return e;
  });
}
