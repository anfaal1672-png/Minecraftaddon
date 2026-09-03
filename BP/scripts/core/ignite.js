/**
 * TNTへの着火。火打石・炎・レッドストーン・矢・連鎖のすべての入口。
 */
import { world, system, EquipmentSlot } from "@minecraft/server";
import { announce } from "./announce.js";
import { NS, PRIMED_TNT, TAG_PREFIX, TNT_TYPE_IDS, shortName, tntConfig, tntKindIndex } from "./registry.js";
import { playSoundSafe } from "../util/common.js";
import { pullNearbyEntities, pullNearbyItems } from "../util/entities.js";

/* ------------------------------------------------------------------ */
/*  着火条件は通常のTNTと同じ:                                          */
/*   1) 火打石で右クリック                                             */
/*   2) 隣接ブロックが炎・溶岩                                         */
/*   3) レッドストーン通電                                             */
/*   4) 近くの他TNTの爆発に巻き込まれる(連鎖爆発。chainReactionCheckで処理) */
/* ------------------------------------------------------------------ */
export const FIRE_NEIGHBORS = new Set([
  "minecraft:fire",
  "minecraft:soul_fire",
  "minecraft:lava",
  "minecraft:flowing_lava",
]);

// onTick は設置済みTNT1個につき10tickごとに走るので、
// 呼ばれるたびに配列を作り直さないようここに置いておく
export const NEIGHBOR_OFFSETS = [
  { x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 },
  { x: 0, y: 1, z: 0 }, { x: 0, y: -1, z: 0 },
  { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: -1 },
];

export function hasFireOrLavaNeighbor(dimension, loc) {
  for (const o of NEIGHBOR_OFFSETS) {
    try {
      const b = dimension.getBlock({ x: loc.x + o.x, y: loc.y + o.y, z: loc.z + o.z });
      if (b && FIRE_NEIGHBORS.has(b.typeId)) return true;
    } catch (err) {}
  }
  return false;
}

export function isRedstonePowered(block) {
  try {
    const power = block.getRedstonePower();
    return typeof power === "number" && power > 0;
  } catch (err) {
    return false;
  }
}

/** 現在導火線が燃えているブロックの位置を覚えておく (二重着火防止) */
export const litSet = new Set();

export function keyOf(dimId, loc) {
  return `${dimId}:${loc.x},${loc.y},${loc.z}`;
}

/* ------------------------------------------------------------------ */
/*  連鎖爆発の安全上限。                                                 */
/*  TNTを何百個も敷き詰めて一気に連鎖させるとゲームごと落ちる恐れがあるため */
/*  「直近2秒間に連鎖で着火した数」に上限を設け、超過分は無視する。         */
/*  プレイヤーが手動で着火する分には制限なし。                            */
/* ------------------------------------------------------------------ */
export let recentChainIgnitions = 0;

export const CHAIN_IGNITION_CAP = 120;

/** 連鎖着火の数え直し */
export function registerChainCapReset() {
  system.runInterval(() => {
    recentChainIgnitions = 0;
  }, 40);
}

/**
 * その座標の着火権を予約する。既に他の処理が予約済みなら null を返す。
 * 連鎖爆発では複数の爆発が同じTNTを同時に狙うことがあり、予約を取らないと
 * 1個のブロックから複数のTNTエンティティが湧いて爆発が増殖してしまうため、
 * 「着火をスケジュールした時点」で必ず予約を取っておく。
 */
export function reserveIgnition(dimension, blockLoc) {
  const key = keyOf(dimension.id, blockLoc);
  if (litSet.has(key)) return null;
  litSet.add(key);
  return key;
}

export function igniteTnt(dimension, blockLoc, typeId, chained = false, reservedKey = null) {
  const cfg = tntConfig(typeId);
  if (!cfg) {
    if (reservedKey) litSet.delete(reservedKey);
    return;
  }
  const k = reservedKey ?? reserveIgnition(dimension, blockLoc);
  if (!k) return; // 既に他の処理が着火を予約済み

  if (chained) {
    if (recentChainIgnitions >= CHAIN_IGNITION_CAP) {
      litSet.delete(k); // 安全上限。予約は必ず返す
      return;
    }
    recentChainIgnitions++;
  }

  // 実際にそのTNTブロックが在ることを着火の条件にする (通常のTNTと同じ)。
  // これを確認せずに進むと、既に爆発して空気になった座標からもう一度
  // TNTエンティティが湧いてしまう。
  let consumed = false;
  try {
    const block = dimension.getBlock(blockLoc);
    if (block && block.typeId === typeId) {
      block.setType("minecraft:air");
      consumed = true;
    }
  } catch (err) {}
  if (!consumed) {
    litSet.delete(k);
    return;
  }

  const center = { x: blockLoc.x + 0.5, y: blockLoc.y, z: blockLoc.z + 0.5 };

  let effectiveTypeId = typeId;
  let effectiveCfg = cfg;
  if (cfg.gacha) {
    const candidates = TNT_TYPE_IDS.filter((id) => id !== typeId && !tntConfig(id).gacha);
    effectiveTypeId = candidates[Math.floor(Math.random() * candidates.length)];
    effectiveCfg = tntConfig(effectiveTypeId);
    const name = shortName(effectiveTypeId);
    try {
      dimension.playSound("random.orb", center);
    } catch (err) {}
    announce(`§d🎰 ガチャTNT: §e${name}§d が出た！§r`);
  }

  // 着火音 (本家のTNTと同じ導火線の音)
  try {
    dimension.playSound("random.fuse", center);
  } catch (err) {}

  let tnt = null;
  try {
    tnt = dimension.spawnEntity(PRIMED_TNT, center);
    tnt.addTag(TAG_PREFIX + effectiveTypeId);
    // 飛んでいる間もそのTNTの見た目になるように、種類の番号を渡す
    try {
      tnt.setProperty(`${NS}:kind`, tntKindIndex(effectiveTypeId) ?? 0);
    } catch (err) {}
    if (effectiveCfg.launchUp) {
      try {
        tnt.applyImpulse({ x: 0, y: 1.8, z: 0 });
      } catch (err) {}
    }
  } catch (err) {}

  litSet.delete(k);
  if (!tnt) return;

  if (chained) {
    // 通常のTNTと同じ仕様: 他の爆発に巻き込まれて着火した場合、
    // 導火線は 0.5〜2秒とかなり短くなる。バニラのTNTと同じ component_group を
    // 足すことで再現しているので、以前のように script 側で先回りして
    // エンティティを消す必要はなくなった。
    try {
      tnt.triggerEvent(`${NS}:short_fuse`);
    } catch (err) {}
  }

  // 飛んでいる間、色つきパーティクルで種類がわかるようにする。
  // ※ entity.isValid() の呼び出しが機種によっては例外を投げて
  //   ループが1回で止まってしまうことがあったため、
  //   「.location にアクセスできるか」だけで生存判定するようにした。
  const trailParticle = effectiveCfg.trail ?? "minecraft:crit_particle";
  let safetyTicks = 0;
  const trackId = system.runInterval(() => {
    safetyTicks += 4;
    let loc;
    try {
      loc = tnt.location;
    } catch (err) {
      system.clearRun(trackId);
      return;
    }
    if (safetyTicks > 120) {
      // 本家の導火線は4秒(80tick)なので、保険として120tickで必ず止める
      system.clearRun(trackId);
      return;
    }
    try {
      dimension.spawnParticle(trailParticle, {
        x: loc.x + (Math.random() - 0.5) * 0.6,
        y: loc.y + 0.6,
        z: loc.z + (Math.random() - 0.5) * 0.6,
      });
    } catch (err) {}
    if (effectiveCfg.gravityPull) pullNearbyEntities(dimension, loc, 8);
    if (effectiveCfg.magnetPull) pullNearbyItems(dimension, loc, 10);
  }, 4);
}

/* ------------------------------------------------------------------ */
/*  近くの他のTNTを巻き込んで着火させる (連鎖爆発)                       */
/* ------------------------------------------------------------------ */
export function chainReactionCheck(dimension, center) {
  const R = 4;
  for (let dx = -R; dx <= R; dx++) {
    for (let dy = -R; dy <= R; dy++) {
      for (let dz = -R; dz <= R; dz++) {
        if (dx === 0 && dy === 0 && dz === 0) continue;
        if (dx * dx + dy * dy + dz * dz > R * R) continue;
        const loc = { x: center.x + dx, y: center.y + dy, z: center.z + dz };
        let blk;
        try {
          blk = dimension.getBlock(loc);
        } catch (err) {
          continue;
        }
        if (!blk || !tntConfig(blk.typeId)) continue;
        // 着火は数tick後だが、予約はいま取る。こうしないと、その待ち時間の間に
        // 別の爆発が同じTNTをもう一度スケジュールしてしまい二重に爆発する。
        const k = reserveIgnition(dimension, loc);
        if (!k) continue;
        const typeId = blk.typeId;
        const delay = 2 + Math.floor(Math.random() * 10);
        system.runTimeout(() => igniteTnt(dimension, loc, typeId, true, k), delay);
      }
    }
  }
}

/** ブロック側の定期処理。炎・溶岩・レッドストーンによる着火を拾う */
export function registerIgniteComponent() {
  system.beforeEvents.startup.subscribe((init) => {
    init.blockComponentRegistry.registerCustomComponent(`${NS}:ignite`, {
      // 火打石での着火は、下の world.afterEvents.playerInteractWithBlock 側で検知する。
      // ここに onPlayerInteract を登録すると、ブロック全体が「操作を持つブロック」
      // 扱いになり、しゃがまないと上に物を置けなくなる (Mojang公式Q&Aでも認められている
      // 現状の仕様上の制限)。ワールド全体のイベントで拾えばこの問題を避けられる。

      onTick(e) {
        const { block, dimension } = e;
        const k = keyOf(dimension.id, block.location);
        if (litSet.has(k)) return;
        if (hasFireOrLavaNeighbor(dimension, block.location) || isRedstonePowered(block)) {
          igniteTnt(dimension, block.location, block.typeId);
        }
      },

      // RP/blocks.json の "sound" 設定だけだと機種によって反映されないことがあるため、
      // 設置音・破壊音をスクリプト側でも確実に鳴らす。
      // 本家バニラのTNTは公式に "grass" 系の音を使っているため、それに合わせる。
      onPlace(e) {
        playSoundSafe(e.dimension, "dig.grass", e.block.location);
      },

      onPlayerDestroy(e) {
        playSoundSafe(e.dimension, "dig.grass", e.block.location);
      },
    });
  });
}

/** 火打石での着火 */
export function registerFlintIgnition() {
  // 火打石での着火をワールド全体のイベントで検知する。
  // ブロックの custom_components に onPlayerInteract を登録しないため、
  // TNTブロックは「操作を持たないブロック」のままになり、
  // 上にブロックを置く操作にも一切影響しない。
  // ※ もしこのイベント自体がこの端末のバージョンに存在しなくても、
  //   try/catch で確実に無害化し、スクリプト全体が落ちないようにしてある。
  try {
    world.afterEvents.playerInteractWithBlock.subscribe((e) => {
      try {
        const { player, block } = e;
        if (!player || !block || !tntConfig(block.typeId)) return;

        let heldItemId;
        try {
          heldItemId = e.itemStack?.typeId;
        } catch (err) {}

        const dimension = player.dimension;
        const equippable = player.getComponent("minecraft:equippable");
        const mainhand = equippable?.getEquipmentSlot(EquipmentSlot.Mainhand);
        if (!heldItemId && mainhand?.hasItem()) heldItemId = mainhand.typeId;

        if (heldItemId !== "minecraft:flint_and_steel") return;

        const k = keyOf(dimension.id, block.location);
        if (litSet.has(k)) return;

        try {
          if (mainhand && mainhand.hasItem() && mainhand.typeId === "minecraft:flint_and_steel") {
            mainhand.damageDurability(1);
          }
        } catch (err) {}

        igniteTnt(dimension, block.location, block.typeId);
      } catch (err) {}
    });
  } catch (err) {
    console.warn(`manytnt: playerInteractWithBlock registration failed: ${err}`);
  }
}

/** リモート起爆装置 */
export function registerDetonator() {
  /* ------------------------------------------------------------------ */
  /*  リモート起爆装置: 手に持って使うと、視線の先(最大64ブロック)にある     */
  /*  このアドオンのTNTを遠隔で着火する。                                  */
  /* ------------------------------------------------------------------ */
  try {
    world.afterEvents.itemUse.subscribe((e) => {
      try {
        const player = e.source;
        const item = e.itemStack;
        if (!player || !item || item.typeId !== `${NS}:detonator`) return;

        const hit = player.getBlockFromViewDirection({ maxDistance: 64 });
        if (!hit || !hit.block || !tntConfig(hit.block.typeId)) {
          try {
            player.onScreenDisplay.setActionBar("§7起爆対象のTNTが見つかりません (64ブロック以内)§r");
          } catch (err) {}
          return;
        }

        const block = hit.block;
        const dimension = player.dimension;
        const k = keyOf(dimension.id, block.location);
        if (litSet.has(k)) return;

        try {
          dimension.playSound("random.click", player.location);
        } catch (err) {}
        igniteTnt(dimension, block.location, block.typeId);
      } catch (err) {}
    });
  } catch (err) {
    console.warn(`manytnt: detonator registration failed: ${err}`);
  }
}

/** 燃えている矢での着火 */
export function registerArrowIgnition() {
  /* ------------------------------------------------------------------ */
  /*  炎の矢での着火: 本物のTNTは燃えている矢が当たると着火するので再現する。 */
  /* ------------------------------------------------------------------ */
  try {
    world.afterEvents.projectileHitBlock.subscribe((e) => {
      try {
        const proj = e.projectile;
        if (!proj) return;
        let burning = false;
        try {
          burning = proj.getComponent("minecraft:onfire") !== undefined;
        } catch (err) {}
        if (!burning) return;

        const hit = e.getBlockHit();
        const block = hit?.block;
        if (!block || !tntConfig(block.typeId)) return;

        const dimension = e.dimension;
        const k = keyOf(dimension.id, block.location);
        if (litSet.has(k)) return;
        igniteTnt(dimension, block.location, block.typeId);
      } catch (err) {}
    });
  } catch (err) {
    console.warn(`manytnt: projectileHitBlock registration failed: ${err}`);
  }
}
