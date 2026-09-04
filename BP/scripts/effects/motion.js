/**
 * 押す・引く・飛ばす・入れ替えるといった、動きに関わるTNT。
 */
import { ItemStack } from "@minecraft/server";
import { announce } from "../core/chat.js";
import { mayBreakBlocks } from "../core/settings.js";
import { carveSphere, raiseScaffold } from "../lib/terrain.js";
import { burst, later, particle, repeat, ring, shake, sound } from "../lib/fx.js";
import {
  addEffect, applyEffects, dropItem, entitiesNear, itemsNear, knockOutward,
  locationOf, pullInward, push, safeTeleport, spawn,
} from "../lib/entities.js";
import { distSq, randomInDisk, randomInSphere } from "../lib/math.js";

export function gravityEffect(dimension, center) {
  // 導火線の間に引き寄せておいて、爆発でまとめて叩き落とす
  knockOutward(dimension, center, 8, 1.4, { lift: -0.2 });
  applyEffects(dimension, center, 8, [["minecraft:slowness", 60, 2]]);
  ring(dimension, "minecraft:endrod", center, 4, { count: 20, y: 0.2 });
  sound(dimension, "random.anvil_land", center, { pitch: 0.5 });
}

export function antiGravityEffect(dimension, center) {
  for (const ent of entitiesNear(dimension, center, 8)) {
    push(ent, { x: 0, y: 1.4, z: 0 });
    addEffect(ent, "minecraft:levitation", 60, { amplifier: 4, showParticles: true });
    // 落ちてくるときに死なないようにする。打ち上げただけで殺すのは意地が悪い
    addEffect(ent, "minecraft:slow_falling", 140, { amplifier: 0, showParticles: false });
  }
  burst(dimension, "minecraft:endrod", center, { count: 24, radius: 4 });
  sound(dimension, "mob.shulker.teleport", center);
}

export function teleportEffect(dimension, center) {
  for (const ent of entitiesNear(dimension, center, 8)) {
    const from = locationOf(ent);
    safeTeleport(ent, () => ({
      x: center.x + Math.floor((Math.random() - 0.5) * 24),
      y: center.y + 2,
      z: center.z + Math.floor((Math.random() - 0.5) * 24),
    }));
    if (from) particle(dimension, "minecraft:endrod", from);
  }
  sound(dimension, "mob.endermen.portal", center);
}

export function chorusEffect(dimension, center) {
  for (const ent of entitiesNear(dimension, center, 6)) {
    const moved = safeTeleport(ent, () => randomInSphere({ ...center, y: center.y + 2 }, 6));
    if (moved) sound(dimension, "mob.endermen.portal", locationOf(ent) ?? center);
  }
  // エンドらしさ。コーラスの実とパーティクル
  for (let i = 0; i < 3; i++) {
    dropItem(dimension, new ItemStack("minecraft:chorus_fruit", 1), randomInDisk(center, 1, 1));
  }
  if (mayBreakBlocks()) {
    // 足元にエンドストーンの小島を作る
    for (let i = 0; i < 12; i++) {
      const p = randomInDisk({ ...center, y: center.y - 1 }, 3);
      const loc = { x: Math.floor(p.x), y: Math.floor(center.y) - 1, z: Math.floor(p.z) };
      const block = dimension.getBlock?.(loc);
      if (block && block.typeId !== "minecraft:air") {
        try {
          block.setType("minecraft:end_stone");
        } catch (err) {}
      }
    }
  }
  burst(dimension, "minecraft:endrod", center, { count: 16, radius: 3 });
}

export function endermanEffect(dimension, center) {
  for (const ent of entitiesNear(dimension, center, 6)) {
    if (ent.typeId !== "minecraft:player") continue;
    const from = locationOf(ent);
    if (!from) continue;
    safeTeleport(ent, () => ({
      x: from.x + (Math.random() - 0.5) * 16,
      y: from.y,
      z: from.z + (Math.random() - 0.5) * 16,
    }));
  }
  for (let i = 0; i < 3; i++) spawn(dimension, "minecraft:enderman", randomInDisk(center, 2));
  sound(dimension, "mob.endermen.scream", center);
}

export function swapEffect(dimension, center) {
  const targets = entitiesNear(dimension, center, 10, { items: false })
    .sort((a, b) => distSq(a.location, center) - distSq(b.location, center));
  if (targets.length < 2) return;

  const [a, b] = targets;
  const locA = locationOf(a);
  const locB = locationOf(b);
  if (!locA || !locB) return;

  // 片方だけ飛んで重なるのを避けるため、両方成功したときだけ入れ替える
  if (!safeTeleport(a, () => locB, 1)) return;
  if (!safeTeleport(b, () => locA, 1)) {
    safeTeleport(a, () => locA, 1);
    return;
  }
  particle(dimension, "minecraft:endrod", locA);
  particle(dimension, "minecraft:endrod", locB);
  sound(dimension, "mob.endermen.portal", center);
}

export function bouncyEffect(dimension, center) {
  for (const ent of entitiesNear(dimension, center, 6)) {
    push(ent, { x: (Math.random() - 0.5) * 0.4, y: 1.6, z: (Math.random() - 0.5) * 0.4 });
    addEffect(ent, "minecraft:jump_boost", 100, { amplifier: 3 });
    // 跳ね上げた責任は取る
    addEffect(ent, "minecraft:slow_falling", 120, { amplifier: 0 });
  }
  sound(dimension, "mob.slime.big", center);
  ring(dimension, "minecraft:villager_happy", center, 3, { count: 14, y: 0.3 });
}

export function speedEffect(dimension, center) {
  applyEffects(dimension, center, 6, [
    ["minecraft:speed", 300, 3],
    ["minecraft:jump_boost", 300, 1],
    ["minecraft:haste", 300, 2],
  ]);
  ring(dimension, "minecraft:basic_crit_particle", center, 3, { count: 18, y: 0.4 });
  sound(dimension, "random.levelup", center, { pitch: 1.6 });
}

/**
 * ビームTNT。4方向に伸びる光線が、触れたものを焼く。
 * 光線が届いた先までしっかり見えるよう、1tickに1マスずつ伸ばしている。
 */
export function beamEffect(dimension, center) {
  const dirs = [{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }];
  const LENGTH = 14;
  for (const dir of dirs) {
    for (let step = 1; step <= LENGTH; step++) {
      const loc = { x: center.x + dir.x * step, y: center.y + 1, z: center.z + dir.z * step };
      later(step, () => {
        particle(dimension, "minecraft:endrod", loc);
        for (const ent of entitiesNear(dimension, loc, 1.2, { items: false })) {
          try {
            ent.applyDamage(4, { cause: "entityExplosion" });
          } catch (err) {}
        }
      });
    }
  }
  sound(dimension, "beacon.activate", center);
}

export function magnetBurstEffect(dimension, center) {
  // 導火線の間に吸い寄せたぶんを、まとめて撒き散らす
  for (const ent of itemsNear(dimension, center, 6)) {
    try {
      ent.applyImpulse(randomInSphere({ x: 0, y: 0.3, z: 0 }, 0.3));
    } catch (err) {}
  }
  burst(dimension, "minecraft:villager_happy", center, { count: 16, radius: 3 });
  sound(dimension, "random.orb", center, { pitch: 0.8 });
}

export function slimeEffect(dimension, center) {
  for (let i = 0; i < 3; i++) spawn(dimension, "minecraft:slime", randomInDisk(center, 1.5));
  for (const ent of entitiesNear(dimension, center, 5)) push(ent, { x: 0, y: 0.8, z: 0 });
  if (mayBreakBlocks()) {
    for (let i = 0; i < 8; i++) {
      const p = randomInDisk(center, 3);
      const loc = { x: Math.floor(p.x), y: Math.floor(center.y), z: Math.floor(p.z) };
      const block = dimension.getBlock?.(loc);
      if (block && block.typeId === "minecraft:air") {
        try {
          block.setType("minecraft:slime");
        } catch (err) {}
      }
    }
  }
  sound(dimension, "mob.slime.small", center);
}

/**
 * ブラックホールTNT。数秒かけて周囲を吸い込み、
 * 中心のブロックを消し去ったあと、最後に一気に弾ける。
 */
export function blackholeEffect(dimension, center) {
  announce("§5§l● ブラックホールTNTが空間を歪めた ●§r");
  sound(dimension, "portal.portal", center, { pitch: 0.5 });

  const RADIUS = 16;
  repeat(12, 4, (i) => {
    pullInward(dimension, center, RADIUS, 1.2, { vertical: 0.5, cap: 0.4 });
    // 渦を巻く事象の地平面
    ring(dimension, "minecraft:basic_smoke_particle", center, 2 + (i % 5), {
      count: 10, spin: i * 0.4, y: (i % 3) - 1,
    });
  });

  later(48, () => {
    if (mayBreakBlocks()) carveSphere(dimension, center, { radius: 3, priority: 5 });
    try {
      dimension.createExplosion(center, 6, { breaksBlocks: false, causesFire: false });
    } catch (err) {}
    knockOutward(dimension, center, RADIUS, 2.0);
    shake(dimension, center, { radius: 30, intensity: 0.5, seconds: 1.2 });
    sound(dimension, "random.explode", center, { pitch: 0.6 });
  });
}

/* ------------------------------------------------------------------ */
/*  エレベーター・突進                                                 */
/* ------------------------------------------------------------------ */

export function elevatorEffect(dimension, center) {
  announce("§b⇧ エレベーターTNT: 上へ運ばれる ⇧§r");
  raiseScaffold(dimension, center, {
    height: 30,
    candidates: ["minecraft:scaffolding", "minecraft:oak_planks"],
    priority: 3,
  });
  // 柱が立つのに合わせて、周りのものも一緒に持ち上がる
  for (const ent of entitiesNear(dimension, center, 6)) {
    addEffect(ent, "minecraft:levitation", 100, { amplifier: 3, showParticles: true });
    addEffect(ent, "minecraft:slow_falling", 240, { amplifier: 0 });
  }
  repeat(15, 4, (i) => ring(dimension, "minecraft:endrod", center, 2, { count: 8, y: i * 2 }));
  sound(dimension, "beacon.activate", center, { pitch: 1.4 });
}

export function dashEffect(dimension, center) {
  knockOutward(dimension, center, 10, 3.2, { lift: 0.55 });
  for (const ent of entitiesNear(dimension, center, 10)) {
    // 突き飛ばした責任は取る。着地で死なせない
    addEffect(ent, "minecraft:slow_falling", 160, { amplifier: 0 });
    addEffect(ent, "minecraft:speed", 200, { amplifier: 2 });
  }
  repeat(6, 2, (i) => ring(dimension, "minecraft:basic_crit_particle", center, i * 2, { count: 12 + i * 4, y: 0.5 }));
  sound(dimension, "random.bow", center, { pitch: 0.6 });
}
