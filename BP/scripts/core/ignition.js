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
import { attempt, note } from "./log.js";
import { announce } from "./chat.js";
import { spawnPrimed } from "./fuse.js";
import { gachaCandidates, isTnt, tntConfig } from "./registry.js";
import { pick } from "../lib/math.js";
import { sound } from "../lib/fx.js";

export const FLINT_AND_STEEL = "minecraft:flint_and_steel";

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
  if (!entity) {
    // 起爆中のTNTを出せなかった。ブロックはもう消してしまっているので、
    // このままだと「火を点けたらTNTが消えただけ」になる。元に戻す。
    note("ignition:spawnFailed", `${cfg.id} を出せなかったので、ブロックを戻す`);
    attempt("ignition:restore", () => dimension.getBlock(blockLoc)?.setType(typeId));
  }
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

/** 地雷が反応する距離 (ブロック) */
export const PROXIMITY_RANGE = 2.5;

/** 地雷が反応しないもの */
const IGNORED_BY_MINES = new Set([
  "minecraft:item", "minecraft:xp_orb", "minecraft:tnt", "manytnt:primed_tnt",
]);

/**
 * 地雷TNT。近づいたものを検知して自分から着火する。
 *
 * 置いた本人がすぐ踏むと理不尽なので、置いてから少し経つまでは反応しない
 * (ブロックの定期処理は10tickごとなので、最初の1回は必ず見送る)。
 */
const armedAt = new Map();
const ARM_DELAY_TICKS = 40;

function trippedByProximity(dimension, block) {
  const cfg = tntConfig(block.typeId);
  if (!cfg?.proximity) return false;

  const key = `${dimension.id}:${block.location.x},${block.location.y},${block.location.z}`;
  const now = attempt("ignition:tick", () => system.currentTick, 0) ?? 0;
  const armed = armedAt.get(key);
  if (armed === undefined) {
    armedAt.set(key, now);
    return false;
  }
  if (now - armed < ARM_DELAY_TICKS) return false;

  const center = { x: block.location.x + 0.5, y: block.location.y + 0.5, z: block.location.z + 0.5 };
  const nearby = attempt("ignition:proximity", () =>
    dimension.getEntities({ location: center, maxDistance: PROXIMITY_RANGE }), []);
  // 落ちているアイテムと、飛んでいる最中のTNTでは反応しない
  const tripped = nearby.some((ent) => !IGNORED_BY_MINES.has(ent.typeId));
  if (tripped) armedAt.delete(key);
  return tripped;
}

/** 地雷の待機状態を捨てる (テスト用) */
export function clearMines() {
  armedAt.clear();
}

/**
 * ブロック側の定期処理。炎・溶岩・レッドストーン・地雷による着火を拾う。
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
          if (hasFireOrLavaNeighbor(dimension, block.location) || isPowered(block) ||
              trippedByProximity(dimension, block)) {
            ignite(dimension, block.location, block.typeId);
          }
        },

        // RP/blocks.json の音の設定だけだと機種によって反映されないことがあるので、
        // 設置音と破壊音はスクリプト側でも鳴らす。バニラのTNTと同じ "grass" 系。
        onPlace(event) {
          sound(event.dimension, "dig.grass", event.block.location);
        },

        // 破壊時のコールバックは onPlayerBreak。
        // onPlayerDestroy という名前は存在せず、書いても呼ばれない。
        onPlayerBreak(event) {
          sound(event.dimension, "dig.grass", event.block.location);
        },
      });
    })
  );
}

/**
 * 火打石での着火。
 *
 * 本家では、火打石でTNTを叩くと「TNTに火が点く」だけで、
 * 火のブロックは置かれない。アドオンのブロックにはその特別扱いが無いので、
 * 放っておくとエンジンが叩いた面に火を置いてしまう。
 * その火がTNTに燃え移ると、着火ではなく**燃え尽きて消える**ことになる。
 *
 * そこで beforeEvents で操作そのものを取り消し、火を置かせない。
 * 取り消したうえで、こちらが本家と同じ結果 (TNTに点火・道具の耐久を1減らす) を作る。
 */
export function registerFlintAndSteel() {
  attempt("ignition:flint", () =>
    world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
      // 1回の右クリックで2回来るので、1回目だけを見る。
      // 見ないと耐久が2つ減り、着火も二重に走る。
      if (event.isFirstEvent === false) return;

      const { player, block } = event;
      if (!player || !block || !isTnt(block.typeId)) return;
      if (!holdsFlintAndSteel(player, event.itemStack)) return;

      const dimension = player.dimension;
      const loc = { x: block.location.x, y: block.location.y, z: block.location.z };
      const typeId = block.typeId;
      if (isReserved(dimension, loc)) return;

      // 火を置かせない。ここが本家との違いをいちばん生んでいた
      event.cancel = true;

      // beforeEvents の中では世界を書き換えられないので、次のtickで行う
      attempt("ignition:flintRun", () =>
        system.run(() => {
          wearFlintAndSteel(player);
          sound(dimension, "fire.ignite", loc);
          ignite(dimension, loc, typeId);
        })
      );
    })
  );
}

/** その人が火打石を持っているか */
function holdsFlintAndSteel(player, itemStack) {
  if (itemStack?.typeId === FLINT_AND_STEEL) return true;
  const slot = mainhandOf(player);
  return slot?.hasItem() === true && slot.typeId === FLINT_AND_STEEL;
}

/** 火打石の耐久を1減らす (本家と同じ) */
function wearFlintAndSteel(player) {
  attempt("ignition:durability", () => {
    const slot = mainhandOf(player);
    if (slot?.hasItem() && slot.typeId === FLINT_AND_STEEL) slot.damageDurability(1);
  });
}

function mainhandOf(player) {
  return attempt("ignition:slot", () =>
    player.getComponent("minecraft:equippable")?.getEquipmentSlot(EquipmentSlot.Mainhand), null);
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

/** 着火まわりをまとめて登録する */
export function registerIgnitionSources() {
  registerBlockComponent();
  registerFlintAndSteel();
  registerBurningArrow();
}
