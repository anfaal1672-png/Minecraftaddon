/**
 * 兵器カテゴリのTNT。
 *
 * 核系が「規模」で押すのに対して、こちらは「どう炸裂するか」で違いを出す。
 * 空中で分裂する、地中に潜る、踏むまで待つ、といった仕掛けが中心。
 */
import { announce } from "../core/chat.js";
import { mayBreakBlocks, maySetFire } from "../core/settings.js";
import { blockAt } from "../lib/blocks.js";
import { carveSphere, scanSphere } from "../lib/terrain.js";
import { burst, later, particle, repeat, ring, scatter, shake, sound } from "../lib/fx.js";
import { applyEffects, damageArea, entitiesNear, knockOutward } from "../lib/entities.js";
import { randomInDisk } from "../lib/math.js";
import { igniteFires } from "./elemental.js";

/** 実際の爆発を1発起こす。設定に従うのを忘れないよう1か所にまとめる */
function blast(dimension, loc, power, { fire = false } = {}) {
  try {
    dimension.createExplosion(loc, power, {
      breaksBlocks: mayBreakBlocks(),
      causesFire: fire && maySetFire(),
    });
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * クラスターTNT。打ち上がった先で分裂し、子爆弾がばらばらに落ちて炸裂する。
 */
export function clusterEffect(dimension, center) {
  announce("§7✸ クラスターTNT: 分裂した ✸§r");
  sound(dimension, "random.explode", center, { pitch: 1.3 });

  const BOMBLETS = 9;
  for (let i = 0; i < BOMBLETS; i++) {
    const spot = randomInDisk(center, 14);
    const delay = 6 + i * 4;
    // 落ちていく子爆弾を見せる
    for (let s = 0; s < 6; s++) {
      later(delay - 6 + s, () =>
        particle(dimension, "minecraft:basic_smoke_particle", { ...spot, y: center.y + (6 - s) * 1.2 })
      );
    }
    later(delay, () => {
      blast(dimension, spot, 5);
      burst(dimension, "minecraft:basic_flame_particle", spot, { count: 6, radius: 2 });
    });
  }
}

/**
 * 焼夷弾。広い範囲に火を撒き、しばらく撒き続ける。
 */
export function napalmEffect(dimension, center) {
  announce("§6🔥 焼夷弾: 一帯が燃え始めた 🔥§r");
  repeat(6, 20, () => {
    igniteFires(dimension, center, 10, 0.25);
    scatter(dimension, "minecraft:basic_flame_particle", center, { count: 20, radius: 10, height: 3 });
  });
  for (const ent of entitiesNear(dimension, center, 10, { items: false })) {
    try {
      ent.setOnFire(12, true);
    } catch (err) {}
  }
  sound(dimension, "mob.ghast.fireball", center, { volume: 2 });
}

/**
 * 地雷TNT。着火そのものは core/ignition.js が近接検知で行うので、
 * ここは「踏んだ側を確実に巻き込む」ぶんだけを受け持つ。
 */
export function mineEffect(dimension, center) {
  sound(dimension, "random.click", center);
  damageArea(dimension, center, 6, 18, { launch: 1.0 });
  knockOutward(dimension, center, 6, 1.8, { lift: 0.8 });
  burst(dimension, "minecraft:basic_crit_particle", center, { count: 24, radius: 3 });
}

/**
 * ミサイルTNT。弧を描いて飛ぶのは着火側 (launchArc) の仕事で、
 * ここは着弾したときの威力を受け持つ。
 */
export function missileEffect(dimension, center) {
  announce("§7➤ ミサイルTNT: 着弾§r");
  shake(dimension, center, { radius: 40, intensity: 0.7, seconds: 2 });
  igniteFires(dimension, center, 6);
  knockOutward(dimension, center, 16, 2.2);
  damageArea(dimension, center, 14, 30);
  for (let i = 0; i < 3; i++) {
    later(i * 4, () => blast(dimension, randomInDisk(center, 4), 6, { fire: true }));
  }
}

/**
 * 榴散弾TNT。破片が飛ぶ範囲を、遮蔽を無視するダメージで表す。
 */
export function shrapnelEffect(dimension, center) {
  sound(dimension, "random.explode", center, { pitch: 1.4 });
  // 飛び散る破片
  for (let i = 0; i < 24; i++) {
    const angle = (Math.PI * 2 * i) / 24;
    for (let step = 1; step <= 10; step++) {
      later(step, () =>
        particle(dimension, "minecraft:basic_crit_particle", {
          x: center.x + Math.cos(angle) * step,
          y: center.y + 0.8 + step * 0.1,
          z: center.z + Math.sin(angle) * step,
        })
      );
    }
  }
  // 壁の裏にも届く
  damageArea(dimension, center, 12, 22, { minDamage: 3 });
  applyEffects(dimension, center, 12, [["minecraft:slowness", 100, 1]]);
}

/**
 * EMP TNT。地形は壊さず、光源とレッドストーン装置だけを黙らせる。
 */
export const EMP_TARGETS = new Set([
  "minecraft:torch", "minecraft:soul_torch", "minecraft:redstone_torch",
  "minecraft:lantern", "minecraft:soul_lantern", "minecraft:redstone_lamp",
  "minecraft:sea_lantern", "minecraft:glowstone", "minecraft:shroomlight",
  "minecraft:repeater", "minecraft:comparator", "minecraft:redstone_wire",
  "minecraft:lever", "minecraft:observer", "minecraft:dispenser", "minecraft:dropper",
]);

export function empEffect(dimension, center) {
  announce("§b⚡ EMP TNT: 明かりと回路が落ちた ⚡§r");
  if (mayBreakBlocks()) {
    scanSphere(dimension, center, { radius: 14, name: "emp" }, (dim, loc) => {
      const block = blockAt(dim, loc);
      if (block && EMP_TARGETS.has(block.typeId)) block.setType("minecraft:air");
    });
  }
  applyEffects(dimension, center, 14, [["minecraft:blindness", 60, 0]]);
  // 走る電光
  repeat(8, 3, (i) => ring(dimension, "minecraft:endrod", center, i * 1.8, { count: 12 + i * 2, y: 1 }));
  sound(dimension, "beacon.deactivate", center, { pitch: 1.6 });
}

/**
 * 貫通爆弾。地中に潜ってから炸裂するので、地表より下が大きく抜ける。
 */
export function bunkerEffect(dimension, center) {
  announce("§8▼ 貫通爆弾: 地中で炸裂した ▼§r");
  const DEPTH = 18;

  // 潜っていく様子
  repeat(9, 2, (i) => {
    const y = center.y - i * 2;
    particle(dimension, "minecraft:basic_smoke_particle", { x: center.x, y, z: center.z });
    sound(dimension, "dig.stone", { x: center.x, y, z: center.z }, { pitch: 0.6 });
  });

  later(20, () => {
    const deep = { x: center.x, y: center.y - DEPTH, z: center.z };
    carveSphere(dimension, deep, { radius: 14, priority: 6 });
    // 地表まで抜ける縦穴
    carveSphere(dimension, { x: center.x, y: center.y - DEPTH / 2, z: center.z }, { radius: 5, priority: 6 });
    blast(dimension, deep, 20);
    shake(dimension, center, { radius: 60, intensity: 0.9, seconds: 3 });
    sound(dimension, "random.explode", center, { volume: 4, pitch: 0.4 });
  });
}

/**
 * 煙幕TNT。害は無いが、しばらく何も見えなくなる。
 */
export function smokeEffect(dimension, center) {
  sound(dimension, "random.fizz", center, { volume: 2 });
  repeat(20, 5, () => {
    scatter(dimension, "minecraft:basic_smoke_particle", center, { count: 24, radius: 8, height: 4 });
    applyEffects(dimension, center, 8, [["minecraft:blindness", 60, 0]]);
  });
}

/**
 * 毒ガスTNT。地面を這う重い雲。範囲を出ても少しの間は残る。
 */
export function gasEffect(dimension, center) {
  announce("§2☣ 毒ガスTNT: 雲が広がった ☣§r");
  sound(dimension, "random.fizz", center, { pitch: 0.6 });
  repeat(25, 10, (i, progress) => {
    const radius = 4 + progress * 8;
    scatter(dimension, "minecraft:witchspell_emitter", center, { count: 10, radius, height: 2 });
    applyEffects(dimension, center, radius, [
      ["minecraft:poison", 120, 1, true],
      ["minecraft:weakness", 120, 0],
    ]);
  });
}

/**
 * 対空TNT。上空で連続して炸裂し、飛んでいるものを叩き落とす。
 */
export function flakEffect(dimension, center) {
  announce("§7✷ 対空TNT: 弾幕が上がった ✷§r");
  for (let i = 0; i < 12; i++) {
    later(i * 5, () => {
      const spot = randomInDisk({ x: center.x, y: center.y + 8 + Math.random() * 14, z: center.z }, 10);
      burst(dimension, "minecraft:basic_smoke_particle", spot, { count: 8, radius: 1.5 });
      burst(dimension, "minecraft:basic_flame_particle", spot, { count: 4, radius: 1 });
      sound(dimension, "random.explode", spot, { pitch: 1.5 });
      // 空にいるものだけを撃ち落とす
      for (const ent of entitiesNear(dimension, spot, 5, { items: false })) {
        try {
          ent.applyDamage(10, { cause: "entityExplosion" });
        } catch (err) {}
      }
    });
  }
}
