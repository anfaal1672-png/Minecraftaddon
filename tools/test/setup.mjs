/**
 * テストの下準備。
 *
 * BP/scripts/main.js を1回だけ読み込んでイベントを登録し、
 * テストごとに世界と内部状態を初期状態へ戻せるようにする。
 */
import { overworld, resetMock, system, world } from "./mock/server.mjs";
import { clearResponses, clearShown } from "./mock/server-ui.mjs";

import "../../BP/scripts/main.js";
import { cancelAll } from "../../BP/scripts/core/jobs.js";
import { clearReservations } from "../../BP/scripts/core/ignition.js";
import { clearActive } from "../../BP/scripts/core/fuse.js";
import { resetChainCount } from "../../BP/scripts/core/chain.js";
import { resetStats } from "../../BP/scripts/core/stats.js";
import { resetDedupe } from "../../BP/scripts/core/chat.js";
import { load as loadSettings, reset as resetSettings } from "../../BP/scripts/core/settings.js";
import { resetReplication } from "../../BP/scripts/effects/chaos.js";
import { clearFailures, failureReport } from "../../BP/scripts/core/log.js";
import { PRIMED_TNT, TAG_PREFIX, tntConfig } from "../../BP/scripts/core/registry.js";

// ブロックのカスタムコンポーネントは startup で登録される。
// 1回だけ発火させて、その中身を控えておく。
export const blockComponents = new Map();
system.beforeEvents.startup.emit({
  blockComponentRegistry: {
    registerCustomComponent(name, component) {
      blockComponents.set(name, component);
    },
  },
});

/** 世界と、アドオンが抱えている状態をまとめて初期化する */
export function freshWorld() {
  cancelAll();
  resetMock();
  clearReservations();
  clearActive();
  resetChainCount();
  resetDedupe();
  resetReplication();
  clearResponses();
  clearShown();
  clearFailures();
  resetStats();
  resetSettings();
  loadSettings();
  world.afterEvents.worldLoad.emit({});
  return overworld();
}

/** 石で埋まった地面を用意する。中心は (0, y, 0) */
export function solidGround(dimension, { radius = 40, top = 80, bottom = 40 } = {}) {
  dimension.fill({ x: -radius, y: bottom, z: -radius }, { x: radius, y: top, z: radius }, "minecraft:stone");
  return { top, bottom };
}

/** TNTブロックを置く */
export function placeTnt(dimension, loc, id) {
  dimension._setBlock(loc.x, loc.y, loc.z, `manytnt:${id}`);
  return loc;
}

/** ブロックのカスタムコンポーネントの onTick を1回走らせる */
export function tickBlock(dimension, loc) {
  const component = blockComponents.get("manytnt:ignite");
  component.onTick({ dimension, block: dimension.getBlock(loc) });
}

/** 起爆中のTNTを探す */
export function primedEntities(dimension) {
  return dimension.getEntities().filter((e) => e.typeId === PRIMED_TNT);
}

/** 起爆中のTNTが、どの種類として飛んでいるか */
export function primedType(entity) {
  const tag = entity.getTags().find((t) => t.startsWith(TAG_PREFIX));
  return tag ? tag.slice(TAG_PREFIX.length) : null;
}

/**
 * 導火線が燃え切ったことにして、爆発イベントを流し込む。
 * 実際のゲームでは minecraft:explode コンポーネントがこれを起こす。
 */
export function burnFuse(dimension, entity) {
  const event = {
    dimension,
    source: entity,
    cancel: false,
    getImpactedBlocks: () => [],
  };
  world.beforeEvents.explosion.emit(event);
  entity.remove();
  return event;
}

/**
 * 置いてあるTNTを着火して爆発まで進める、テストでいちばんよく使う流れ。
 * @returns 爆発した起爆中エンティティの一覧
 */
export function detonate(dimension, loc, { ticks = 10 } = {}) {
  tickBlockIgnite(dimension, loc);
  const primed = primedEntities(dimension);
  for (const entity of primed) burnFuse(dimension, entity);
  system.advance(ticks);
  return primed;
}

/** 火を隣に置いて着火する。置いた火は元のブロックに戻す */
export function tickBlockIgnite(dimension, loc) {
  const key = `${loc.x + 1},${loc.y},${loc.z}`;
  const original = dimension._blocks.get(key);
  dimension._setBlock(loc.x + 1, loc.y, loc.z, "minecraft:fire");
  tickBlock(dimension, loc);
  if (original) dimension._blocks.set(key, original);
  else dimension._blocks.delete(key);
}

/** 石で埋まった範囲のうち、消えたブロックの数 */
export function countAir(dimension, center, radius) {
  let air = 0;
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dz = -radius; dz <= radius; dz++) {
        const key = `${center.x + dx},${center.y + dy},${center.z + dz}`;
        if (!dimension._blocks.has(key)) air++;
      }
    }
  }
  return air;
}

export { failureReport, tntConfig, system, world, overworld };
