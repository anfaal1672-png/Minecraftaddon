/**
 * 着火。すべての着火手段はここを通る。
 *
 * 着火の条件はバニラのTNTと同じ:
 *   1) 火打石で右クリック
 *   2) 隣が炎か溶岩
 *   3) レッドストーンで通電
 *   4) 燃えている矢が当たる
 *   5) 近くの爆発に巻き込まれる (連鎖。core/chain.js が呼ぶ)
 * これに加えて、このアドオンの遠隔起爆装置でも着火できる。
 */
import { EquipmentSlot, system, world } from "@minecraft/server";
import { attempt } from "./log.js";
import { announce } from "./chat.js";
import { spawnPrimed } from "./fuse.js";
import { DETONATOR_ITEM, gachaCandidates, isTnt, tntConfig } from "./registry.js";
import { pick } from "../lib/math.js";
import { sound } from "../lib/fx.js";

export const FIRE_NEIGHBORS = new Set([
  "minecraft:fire",
  "minecraft:soul_fire",
  "minecraft:lava",
  "minecraft:flowing_lava",
]);

/** onTick から毎回作り直さないよう、隣接6方向をここに置いておく */
const NEIGHBORS = [
  { x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 },
  { x: 0, y: 1, z: 0 }, { x: 0, y: -1, z: 0 },
  { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: -1 },
];

/**
 * いま着火処理が動いている座標。
 *
 * 連鎖爆発では複数の爆発が同じTNTを同時に狙うことがあり、
 * 予約を取らないと1個のブロックから複数のTNTが湧いて爆発が増殖する。
 * 「着火を予定した時点」で必ず予約を取る。
 */
const reserved = new Set();

const keyOf = (dimensionId, loc) => `${dimensionId}:${loc.x},${loc.y},${loc.z}`;

/**
 * その座標の着火権を取る。
 * @returns 取れたら解放用のキー、取れなければ null
 */
export function reserve(dimension, blockLoc) {
  const key = keyOf(dimension.id, blockLoc);
  if (reserved.has(key)) return null;
  reserved.add(key);
  return key;
}

export function release(key) {
  if (key) reserved.delete(key);
}

export function isReserved(dimension, blockLoc) {
  return reserved.has(keyOf(dimension.id, blockLoc));
}

/** 予約をすべて捨てる (テスト用) */
export function clearReservations() {
  reserved.clear();
}

/**
 * TNTブロックに火を点ける。
 *
 * @param blockLoc TNTブロックの座標
 * @param typeId   そのTNTの種類
 * @param options.chained 他の爆発に巻き込まれた着火か
 * @param options.key     既に取ってある予約 (連鎖のときに使う)
 * @returns 着火できたか
 */
export function ignite(dimension, blockLoc, typeId, { chained = false, key = null } = {}) {
  const cfg = tntConfig(typeId);
  if (!cfg) {
    release(key);
    return false;
  }

  const held = key ?? reserve(dimension, blockLoc);
  if (!held) return false; // 他の処理が既に着火を予定している

  // 実際にそのTNTブロックが在ることを条件にする (バニラと同じ)。
  // ここを確かめずに進むと、既に爆発して空気になった座標から
  // もう一度TNTが湧いてしまう。
  const consumed = attempt("ignition:consume", () => {
    const block = dimension.getBlock(blockLoc);
    if (!block || block.typeId !== typeId) return false;
    block.setType("minecraft:air");
    return true;
  }, false);

  if (!consumed) {
    release(held);
    return false;
  }

  const center = { x: blockLoc.x + 0.5, y: blockLoc.y, z: blockLoc.z + 0.5 };
  const effective = cfg.isGacha ? drawGacha(dimension, center, cfg) : cfg;

  const entity = spawnPrimed(dimension, center, effective, { chained });
  release(held);
  return entity !== null;
}

/** ガチャTNT: 着火した瞬間に別の種類を1つ引く */
function drawGacha(dimension, center, cfg) {
  const candidates = gachaCandidates();
  if (candidates.length === 0) return cfg;
  const drawn = pick(candidates);
  sound(dimension, "random.orb", center);
  announce(`§d🎰 ガチャTNT: §e${drawn.name.ja}§d が出た！§r`);
  return drawn;
}

/* ------------------------------------------------------------------ */
/*  着火手段ごとの登録                                                  */
/* ------------------------------------------------------------------ */

function hasFireOrLavaNeighbor(dimension, loc) {
  for (const offset of NEIGHBORS) {
    const block = attempt("ignition:neighbor", () =>
      dimension.getBlock({ x: loc.x + offset.x, y: loc.y + offset.y, z: loc.z + offset.z }), null);
    if (block && FIRE_NEIGHBORS.has(block.typeId)) return true;
  }
  return false;
}

function isPowered(block) {
  return attempt("ignition:redstone", () => {
    const power = block.getRedstonePower();
    return typeof power === "number" && power > 0;
  }, false);
}

/**
 * ブロック側の定期処理。炎・溶岩・レッドストーンによる着火を拾う。
 *
 * 火打石の着火をここ (onPlayerInteract) で拾わないのは、
 * それを登録するとブロック全体が「操作を持つブロック」扱いになり、
 * しゃがまないと上に物を置けなくなってしまうため。
 * ワールド全体のイベントで拾えばこの問題を避けられる。
 */
export function registerBlockComponent() {
  attempt("ignition:startup", () =>
    system.beforeEvents.startup.subscribe((init) => {
      init.blockComponentRegistry.registerCustomComponent("manytnt:ignite", {
        onTick(event) {
          const { block, dimension } = event;
          if (isReserved(dimension, block.location)) return;
          if (hasFireOrLavaNeighbor(dimension, block.location) || isPowered(block)) {
            ignite(dimension, block.location, block.typeId);
          }
        },

        // RP/blocks.json の音の設定だけだと機種によって反映されないことがあるので、
        // 設置音と破壊音はスクリプト側でも鳴らす。バニラのTNTと同じ "grass" 系。
        onPlace(event) {
          sound(event.dimension, "dig.grass", event.block.location);
        },

        onPlayerDestroy(event) {
          sound(event.dimension, "dig.grass", event.block.location);
        },
      });
    })
  );
}

/** 火打石での着火 */
export function registerFlintAndSteel() {
  attempt("ignition:flint", () =>
    world.afterEvents.playerInteractWithBlock.subscribe((event) => {
      const { player, block } = event;
      if (!player || !block || !isTnt(block.typeId)) return;

      let heldId = attempt("ignition:heldItem", () => event.itemStack?.typeId, undefined);
      const equippable = attempt("ignition:equip", () => player.getComponent("minecraft:equippable"), null);
      const mainhand = attempt("ignition:slot", () => equippable?.getEquipmentSlot(EquipmentSlot.Mainhand), null);
      if (!heldId && mainhand?.hasItem()) heldId = mainhand.typeId;
      if (heldId !== "minecraft:flint_and_steel") return;

      if (isReserved(player.dimension, block.location)) return;
      attempt("ignition:durability", () => {
        if (mainhand?.hasItem() && mainhand.typeId === "minecraft:flint_and_steel") mainhand.damageDurability(1);
      });
      ignite(player.dimension, block.location, block.typeId);
    })
  );
}

/** 燃えている矢での着火 */
export function registerBurningArrow() {
  attempt("ignition:arrow", () =>
    world.afterEvents.projectileHitBlock.subscribe((event) => {
      const projectile = event.projectile;
      if (!projectile) return;
      const burning = attempt("ignition:onfire", () =>
        projectile.getComponent("minecraft:onfire") !== undefined, false);
      if (!burning) return;

      const block = attempt("ignition:blockHit", () => event.getBlockHit()?.block, null);
      if (!block || !isTnt(block.typeId)) return;
      if (isReserved(event.dimension, block.location)) return;
      ignite(event.dimension, block.location, block.typeId);
    })
  );
}

/** 遠隔起爆装置。視線の先 64 ブロック以内のTNTに火を点ける */
export function registerDetonator() {
  attempt("ignition:detonator", () =>
    world.afterEvents.itemUse.subscribe((event) => {
      const player = event.source;
      if (!player || event.itemStack?.typeId !== DETONATOR_ITEM) return;

      const hit = attempt("ignition:ray", () => player.getBlockFromViewDirection({ maxDistance: 64 }), null);
      const block = hit?.block;
      if (!block || !isTnt(block.typeId)) {
        attempt("ignition:actionBar", () =>
          player.onScreenDisplay.setActionBar("§7起爆できるTNTが見つかりません (64ブロック以内)§r"));
        return;
      }
      if (isReserved(player.dimension, block.location)) return;
      sound(player.dimension, "random.click", player.location);
      ignite(player.dimension, block.location, block.typeId);
    })
  );
}

/** 着火まわりをまとめて登録する */
export function registerIgnitionSources() {
  registerBlockComponent();
  registerFlintAndSteel();
  registerBurningArrow();
  registerDetonator();
}
