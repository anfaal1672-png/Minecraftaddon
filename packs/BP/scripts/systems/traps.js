import { world } from "@minecraft/server";
import { igniteBlock } from "../core/ignition.js";
import { attempt } from "../util/log.js";
import { locKey } from "../util/math.js";

/* ------------------------------------------------------------------ */
/*  地雷TNT。                                                          */
/*  設置したプレイヤーを覚えておき、本人としゃがんでいるプレイヤー以外が   */
/*  上に乗ったら短い導火線で起爆する。                                    */
/* ------------------------------------------------------------------ */
const KEY = "manytnt:mines";
const MAX_MINES = 512;
const IGNORE = new Set(["minecraft:item", "minecraft:xp_orb", "minecraft:tnt", "minecraft:arrow", "minecraft:fireworks_rocket"]);

let owners = null; // locKey -> playerId

function load() {
  if (owners) return owners;
  owners = new Map(
    attempt("mines.load", () => {
      const raw = world.getDynamicProperty(KEY);
      return typeof raw === "string" ? Object.entries(JSON.parse(raw)) : [];
    }) ?? []
  );
  return owners;
}

function save() {
  attempt("mines.save", () => world.setDynamicProperty(KEY, JSON.stringify(Object.fromEntries(owners))));
}

export function rememberMine(dimensionId, loc, playerId) {
  const m = load();
  m.set(locKey(dimensionId, loc), playerId);
  while (m.size > MAX_MINES) m.delete(m.keys().next().value); // 古いものから忘れる
  save();
}

export function forgetMine(dimensionId, loc) {
  const m = load();
  if (m.delete(locKey(dimensionId, loc))) save();
}

export function mineOwner(dimensionId, loc) {
  return load().get(locKey(dimensionId, loc));
}

/** 地雷を踏んだときの判定 (テストしやすいよう分離) */
export function shouldTrigger(entity, ownerId) {
  if (!entity || IGNORE.has(entity.typeId)) return false;
  if (entity.typeId === "minecraft:player") {
    if (entity.id === ownerId) return false;
    if (attempt("sneak", () => entity.isSneaking) === true) return false;
  }
  return true;
}

export function onMineStepOn(event) {
  const { block, dimension, entity } = event;
  if (!shouldTrigger(entity, mineOwner(dimension.id, block.location))) return;
  attempt("mineClick", () => dimension.playSound("random.click", block.location, { pitch: 0.6 }));
  igniteBlock(dimension, block.location, { fuse: 8, force: true });
}
