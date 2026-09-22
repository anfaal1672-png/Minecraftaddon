import { system } from "@minecraft/server";
import { queueExplosion, runBlockJob } from "../core/scheduler.js";
import { breakBlock, getBlock, isLiquidType, isProtected, placeBlock, safeTeleport, spawnItemSafe } from "../core/safety.js";
import { nearbyEntities, addEffect, knockbackFrom, pullToward, isPlayer, spawnEntitySafe } from "../core/entities.js";
import { getDef } from "../core/registry.js";
import { spawnLitTnt } from "../core/ignition.js";
import { announce, msg } from "../systems/i18n.js";
import { attempt } from "../util/log.js";
import { distSq, floorLoc, randInt } from "../util/math.js";
import { burst, discLocs, forEachBlock, particle, sound, sphereLocs } from "./common.js";

/* ------------------------------------------------------------------ */
/*  物理・移動系TNTの効果                                              */
/* ------------------------------------------------------------------ */

export function gravityEffect(dimension, center) {
  for (const ent of nearbyEntities(dimension, center, 8, "all")) knockbackFrom(ent, center, 1.4, 0.4);
}

export function antiGravityEffect(dimension, center) {
  for (const ent of nearbyEntities(dimension, center, 8, "all")) {
    attempt("antigravity", () => ent.applyImpulse({ x: 0, y: 1.4, z: 0 }));
    addEffect(ent, "minecraft:levitation", 60, 4, true);
  }
  particle(dimension, "minecraft:huge_explosion_emitter", center);
}

export function magnetBurstEffect(dimension, center) {
  for (const ent of nearbyEntities(dimension, center, 6, "items")) {
    attempt("magnet", () => ent.applyImpulse({ x: (Math.random() - 0.5) * 0.3, y: 0.3, z: (Math.random() - 0.5) * 0.3 }));
  }
  particle(dimension, "minecraft:villager_happy", center);
}

/** 周囲の生き物を、半径12以内の安全な場所へランダムにテレポート (B12) */
export function teleportEffect(dimension, center) {
  for (const ent of nearbyEntities(dimension, center, 8)) {
    for (let tries = 0; tries < 6; tries++) {
      const x = center.x + (Math.random() - 0.5) * 24;
      const z = center.z + (Math.random() - 0.5) * 24;
      if (safeTeleport(ent, dimension, x, z, center.y + 1)) break;
    }
  }
}

/** 一番近い2体の位置を入れ替える (どちらも立っていた場所なので安全) */
export function swapEffect(dimension, center) {
  const ents = nearbyEntities(dimension, center, 10).sort((a, b) => distSq(a.location, center) - distSq(b.location, center));
  if (ents.length < 2) return;
  const [a, b] = ents;
  attempt("swap", () => {
    const locA = { ...a.location };
    const locB = { ...b.location };
    a.teleport(locB, { dimension });
    b.teleport(locA, { dimension });
    particle(dimension, "minecraft:endrod", locA);
    particle(dimension, "minecraft:endrod", locB);
  });
}

export function bouncyEffect(dimension, center) {
  for (const ent of nearbyEntities(dimension, center, 6, "all")) {
    attempt("bounce", () => ent.applyImpulse({ x: (Math.random() - 0.5) * 0.4, y: 1.6, z: (Math.random() - 0.5) * 0.4 }));
    addEffect(ent, "minecraft:jump_boost", 100, 3);
  }
  sound(dimension, "mob.slime.big", center);
}

/**
 * ブラックホールTNT: 数秒かけて中心に吸い込み、中心付近を消し去ってから弾ける。
 * 消し去る範囲も保護ブロック・コンテナの扱いは breakBlock に従う (B11)。
 */
export function blackholeEffect(dimension, center) {
  announce(msg("blackhole"));
  const radius = 16;
  let pulls = 0;
  const pullId = system.runInterval(() => {
    pulls++;
    for (const ent of nearbyEntities(dimension, center, radius, "all")) pullToward(ent, center, 0.3, 0.5);
    for (let n = 0; n < 6; n++) {
      const ang = Math.random() * Math.PI * 2;
      const r = Math.random() * 5;
      particle(dimension, "minecraft:basic_smoke_particle", {
        x: center.x + Math.cos(ang) * r,
        y: center.y + (Math.random() - 0.5) * 3,
        z: center.z + Math.sin(ang) * r,
      });
    }
    if (pulls >= 12) {
      system.clearRun(pullId);
      forEachBlock("blackhole", dimension, sphereLocs(center, 3), (b) => breakBlock(dimension, b));
      queueExplosion(dimension, center, 6, { breaksBlocks: false, causesFire: false });
      for (const ent of nearbyEntities(dimension, center, 16, "all")) knockbackFrom(ent, center, 2.0, 0.5);
    }
  }, 4);
}

/** エンダーマンTNT: プレイヤーを近くの安全な場所へワープさせ、エンダーマンを呼ぶ */
export function endermanEffect(dimension, center) {
  for (const ent of nearbyEntities(dimension, center, 6)) {
    if (!isPlayer(ent)) continue;
    for (let tries = 0; tries < 6; tries++) {
      const loc = ent.location;
      if (safeTeleport(ent, dimension, loc.x + (Math.random() - 0.5) * 16, loc.z + (Math.random() - 0.5) * 16, loc.y)) {
        sound(dimension, "mob.endermen.portal", loc);
        break;
      }
    }
  }
  for (let i = 0; i < 3; i++) {
    spawnEntitySafe(dimension, "minecraft:enderman", { x: center.x + (Math.random() - 0.5) * 4, y: center.y, z: center.z + (Math.random() - 0.5) * 4 });
  }
}

export function chorusEffect(dimension, center) {
  for (const ent of nearbyEntities(dimension, center, 6)) {
    for (let tries = 0; tries < 6; tries++) {
      if (safeTeleport(ent, dimension, center.x + (Math.random() - 0.5) * 10, center.z + (Math.random() - 0.5) * 10, center.y + 2)) {
        sound(dimension, "mob.endermen.portal", center);
        break;
      }
    }
  }
  for (let i = 0; i < 3; i++) {
    spawnItemSafe(dimension, "minecraft:chorus_fruit", 1, { x: center.x + (Math.random() - 0.5) * 2, y: center.y + 0.5, z: center.z + (Math.random() - 0.5) * 2 });
  }
}

export function beamEffect(dimension, center) {
  for (const d of [{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }]) {
    for (let dist = 1; dist <= 14; dist++) {
      const loc = { x: center.x + d.x * dist, y: center.y + 0.5, z: center.z + d.z * dist };
      system.runTimeout(() => {
        particle(dimension, "minecraft:endrod", loc);
        for (const ent of nearbyEntities(dimension, loc, 1.2)) attempt("beam", () => ent.applyDamage(4, { cause: "entityExplosion" }));
      }, dist);
    }
  }
}

export function arrowEffect(dimension, center) {
  const count = 16;
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count;
    const arrow = spawnEntitySafe(dimension, "minecraft:arrow", { x: center.x, y: center.y + 1, z: center.z });
    if (arrow) attempt("arrow", () => arrow.applyImpulse({ x: Math.cos(angle) * 1.2, y: 0.1, z: Math.sin(angle) * 1.2 }));
  }
}

/** 地震TNT: 足元の地面をところどころ崩す (保護ブロックは崩さない。B11) */
export function earthquakeEffect(dimension, center) {
  for (const ent of nearbyEntities(dimension, center, 7, "all")) knockbackFrom(ent, center, 0.9, 0.3);
  const locs = [];
  for (const loc of discLocs(center, 4, -1, -1)) if (Math.random() < 0.3) locs.push(loc);
  forEachBlock("earthquake", dimension, locs, (b) => breakBlock(dimension, b, { allowLiquid: false }));
  attempt("quakeShake", () => {
    const c = floorLoc(center);
    dimension.runCommand(`camerashake add @a[x=${c.x},y=${c.y},z=${c.z},r=16] 0.5 1.5 positional`);
  });
}

/** 縦穴TNT: 真下へ最大40ブロック。保護ブロック・液体に当たったら止まる (B11) */
export function shaftEffect(dimension, center) {
  const base = floorLoc(center);
  runBlockJob("shaft", function* () {
    for (let depth = 1; depth <= 40; depth++) {
      const block = getBlock(dimension, { x: base.x, y: base.y - depth, z: base.z });
      if (!block || isProtected(block) || isLiquidType(block.typeId)) return;
      breakBlock(dimension, block);
      yield 1;
    }
  });
}

/** 真空TNT: 周囲の水と溶岩を吸い取る (地形は壊さないので安全モードでも動く) */
export function vacuumEffect(dimension, center) {
  forEachBlock("vacuum", dimension, sphereLocs(center, 6, -3, 3), (b, loc) => {
    if (isLiquidType(b.typeId)) placeBlock(dimension, loc, "minecraft:air", { canReplace: (x) => isLiquidType(x.typeId) });
  });
  burst(dimension, "minecraft:bubble_particle", center, 12, 6);
}

/** 時間停止TNT: 周囲のモブ (プレイヤー以外) を8秒間その場に止める */
export function timestopEffect(dimension, center) {
  announce(msg("timestop"));
  const mobs = nearbyEntities(dimension, center, 10).filter((e) => !isPlayer(e));
  for (const m of mobs) {
    addEffect(m, "minecraft:slowness", 170, 255);
    addEffect(m, "minecraft:weakness", 170, 255);
    addEffect(m, "minecraft:mining_fatigue", 170, 255);
  }
  sound(dimension, "block.bell.hit", center, { pitch: 0.5 });
  let t = 0;
  const id = system.runInterval(() => {
    t += 2;
    for (const m of mobs) attempt("freeze", () => m.clearVelocity());
    if (t % 10 === 0) burst(dimension, "minecraft:endrod", center, 6, 10, 3);
    if (t >= 160) system.clearRun(id);
  }, 2);
}

/** 分裂TNT: 小さなTNT6個に分裂して飛び散る */
export function clusterEffect(dimension, center) {
  const mini = getDef("manytnt:mini_tnt");
  if (!mini) return;
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI * 2 * i) / 6 + Math.random() * 0.4;
    spawnLitTnt(dimension, { x: center.x, y: center.y + 0.5, z: center.z }, mini, {
      fuse: randInt(20, 35),
      impulse: { x: Math.cos(a) * 0.45, y: 0.55, z: Math.sin(a) * 0.45 },
    });
  }
}
