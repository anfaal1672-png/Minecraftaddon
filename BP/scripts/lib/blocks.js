/**
 * ブロックの読み書き。
 *
 * このアドオンで一番数が出るのがブロック操作なので、ここだけは
 * 「1マスずつ setType する」書き方をやめてある。縦に連続した範囲は
 * dimension.fillBlocks に1回で渡せるので、半径80の球を消す場合で
 * 呼び出し回数が約200万回から約2万回まで落ちる。
 */
import { BlockVolume } from "@minecraft/server";
import { note } from "../core/log.js";

/**
 * 何があっても壊さないブロック。
 * 壊されては困るもの (岩盤・コマンドブロック) と、
 * 消すと不自然になるもの (水・溶岩) を入れてある。
 */
export const PROTECTED_BLOCKS = [
  "minecraft:bedrock",
  "minecraft:barrier",
  "minecraft:light_block",
  "minecraft:end_portal_frame",
  "minecraft:end_portal",
  "minecraft:end_gateway",
  "minecraft:command_block",
  "minecraft:repeating_command_block",
  "minecraft:chain_command_block",
  "minecraft:structure_block",
  "minecraft:structure_void",
  "minecraft:jigsaw",
  "minecraft:water",
  "minecraft:flowing_water",
  "minecraft:lava",
  "minecraft:flowing_lava",
];

export const PROTECTED_SET = new Set(PROTECTED_BLOCKS);

/** fillBlocks に渡す「触らないもの」の一覧 (空気も書き込む意味が無いので外す) */
const CARVE_EXCLUDE = [...PROTECTED_BLOCKS, "minecraft:air"];

export const WATER_BLOCKS = new Set(["minecraft:water", "minecraft:flowing_water"]);
export const LAVA_BLOCKS = new Set(["minecraft:lava", "minecraft:flowing_lava"]);

/** そのブロック。読めなければ undefined */
export function blockAt(dimension, loc) {
  try {
    return dimension.getBlock(loc);
  } catch (err) {
    return undefined;
  }
}

/** そのブロックのID。読めなければ undefined */
export function typeAt(dimension, loc) {
  return blockAt(dimension, loc)?.typeId;
}

/** 1マス置く。置けたら true */
export function setBlock(dimension, loc, blockId) {
  try {
    const block = dimension.getBlock(loc);
    if (!block) return false;
    block.setType(blockId);
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * 候補を順に試して、置けたものがあれば true。
 * ブロックIDはバージョンによって揺れることがある
 * (cobweb / web, stone_bricks / stonebrick など) ので、
 * 揺れうるブロックはここに候補を並べて置く。
 */
export function trySetBlock(dimension, loc, candidates) {
  for (const id of candidates) {
    if (setBlock(dimension, loc, id)) return true;
  }
  return false;
}

/** 空いている場所にだけ置く。既にある建築を壊さない */
export function setIfEmpty(dimension, loc, blockId) {
  const block = blockAt(dimension, loc);
  if (!block) return false;
  const id = block.typeId;
  if (id !== "minecraft:air" && !WATER_BLOCKS.has(id)) return false;
  try {
    block.setType(blockId);
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * 直方体を一気に埋める。
 * @param exclude 置き換えないブロックのID一覧
 * @returns 触れたかどうか
 */
export function fillBox(dimension, from, to, blockId, exclude = null) {
  try {
    const volume = new BlockVolume(from, to);
    dimension.fillBlocks(volume, blockId, {
      ignoreChunkBoundErrors: true,
      ...(exclude && exclude.length ? { blockFilter: { excludeTypes: exclude } } : {}),
    });
    return true;
  } catch (err) {
    note("blocks:fillBox", err);
    return false;
  }
}

/**
 * 縦1列を空気にする。クレーターや縦穴を掘るときの基本の単位。
 * 岩盤・水・溶岩には触らない。
 */
export function carveColumn(dimension, x, z, yFrom, yTo) {
  const lo = Math.min(yFrom, yTo);
  const hi = Math.max(yFrom, yTo);
  return fillBox(dimension, { x, y: lo, z }, { x, y: hi, z }, "minecraft:air", CARVE_EXCLUDE);
}

/** 縦1列を指定したブロックで埋める */
export function fillColumn(dimension, x, z, yFrom, yTo, blockId, exclude = PROTECTED_BLOCKS) {
  const lo = Math.min(yFrom, yTo);
  const hi = Math.max(yFrom, yTo);
  return fillBox(dimension, { x, y: lo, z }, { x, y: hi, z }, blockId, exclude);
}

/** そのディメンションで置けるy座標の範囲 */
export function heightLimits(dimension) {
  try {
    const range = dimension.heightRange;
    if (range && Number.isFinite(range.min) && Number.isFinite(range.max)) {
      return { min: range.min, max: range.max };
    }
  } catch (err) {}
  return { min: -64, max: 320 };
}

/** 足場になっているか (空気でも液体でもない) */
export function isSolid(dimension, loc) {
  const id = typeAt(dimension, loc);
  if (!id || id === "minecraft:air") return false;
  return !WATER_BLOCKS.has(id) && !LAVA_BLOCKS.has(id);
}

/**
 * その柱の地表の高さを探す。見つからなければ null。
 * 木の葉や草の上ではなく、踏める面を返す。
 */
export function surfaceY(dimension, x, z, fromY, searchDown = 12) {
  for (let y = fromY + 4; y >= fromY - searchDown; y--) {
    if (!isSolid(dimension, { x, y, z })) continue;
    const above = typeAt(dimension, { x, y: y + 1, z });
    if (above === "minecraft:air") return y;
  }
  return null;
}
