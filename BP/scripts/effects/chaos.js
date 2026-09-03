/**
 * 常軌を逸したTNT。
 *
 * 威力の数字を上げただけのものは核系にあるので、ここに置くのは
 * 「仕組みそのものがおかしい」ものだけにしてある。
 */
import { announce } from "../core/chat.js";
import { mayBreakBlocks, scaledRadius } from "../core/settings.js";
import { blockAt, heightLimits, trySetBlock } from "../lib/blocks.js";
import { carveShaft, carveSphere, crumbleTerrain } from "../lib/terrain.js";
import { deepBoom, later, mushroomCloud, particle, repeat, ring, scatter, shake, sound } from "../lib/fx.js";
import {
  entitiesNear, irradiate, knockOutward, locationOf, pullInward, push,
} from "../lib/entities.js";
import { blockPos, rand, randomInDisk } from "../lib/math.js";
import { radiationZone } from "./nuclear.js";

/* ------------------------------------------------------------------ */
/*  特異点TNT                                                          */
/*                                                                     */
/*  6秒かけて周囲を吸い込みながら、球状に空間そのものを消していく。      */
/*  吸い込みが終わると、溜め込んだものを一気に吐き出して弾ける。         */
/*  ブラックホールTNTが「引き寄せて中心を少し抉る」のに対して、          */
/*  こちらは半径26ブロックの球がまるごと消える。                        */
/* ------------------------------------------------------------------ */
export const SINGULARITY_RADIUS = 26;
export const SINGULARITY_TICKS = 120;

export function singularityEffect(dimension, center) {
  announce("§0§l⬤ 特異点TNT: 空間が閉じていく ⬤§r");
  sound(dimension, "portal.portal", center, { pitch: 0.4 });

  // 近いものほど強く引く。逃げ切るには走り出しが要る
  repeat(SINGULARITY_TICKS / 2, 2, (i) => {
    pullInward(dimension, center, 44, 14, { vertical: 0.7, cap: 1.4 });
    const spin = i * 0.7;
    for (let n = 0; n < 5; n++) {
      const ringRadius = 3 + n * 2.5;
      ring(dimension, "minecraft:basic_smoke_particle", center, ringRadius, { count: 4, spin, y: rand(-3, 3) });
      ring(dimension, "minecraft:endrod", center, ringRadius * 0.6, { count: 3, spin: -spin, y: rand(-2, 2) });
    }
  });

  // 吸い込みと並行して、内側から順に空間が消えていく
  if (mayBreakBlocks()) {
    carveSphere(dimension, center, { radius: scaledRadius(SINGULARITY_RADIUS), priority: 10 });
  }

  later(SINGULARITY_TICKS, () => {
    announce("§5§l⬤ ...そして弾けた ⬤§r");
    shake(dimension, center, { radius: 120, intensity: 1.0, seconds: 3.0 });
    deepBoom(dimension, center);
    knockOutward(dimension, center, 56, 5.0);
    irradiate(dimension, center, 44, 120);
    mushroomCloud(dimension, center, {
      stemHeight: 40, capRadius: 34, duration: 140, lingerTicks: 200, densityMult: 1.8,
    });
    try {
      dimension.createExplosion(center, 60, {
        breaksBlocks: mayBreakBlocks(), causesFire: false, allowUnderwater: true,
      });
    } catch (err) {}
  });
}

/* ------------------------------------------------------------------ */
/*  時間停止TNT                                                        */
/*                                                                     */
/*  周囲のすべてを8秒間その場に縫い止める。止まっている間は何も起きず、  */
/*  時が動き出した瞬間に、溜め込んだ分の衝撃がまとめて襲いかかる。       */
/*  位置を毎tick元に戻すことで「止まっている」を作っている。             */
/* ------------------------------------------------------------------ */
export const TIMESTOP_RADIUS = 26;
export const TIMESTOP_TICKS = 160;

export function timestopEffect(dimension, center) {
  announce("§b§l⏳ 時間停止TNT: 世界が止まった ⏳§r");
  sound(dimension, "beacon.deactivate", center, { pitch: 0.5 });

  const frozen = [];
  for (const ent of entitiesNear(dimension, center, TIMESTOP_RADIUS, { items: false })) {
    const loc = locationOf(ent);
    if (!loc) continue;
    frozen.push({ ent, loc });
    // 止まっている感を出すのと、位置を戻される違和感を減らすため
    try {
      ent.addEffect("minecraft:slowness", TIMESTOP_TICKS + 20, { amplifier: 6, showParticles: false });
    } catch (err) {}
  }

  repeat(TIMESTOP_TICKS, 1, (i) => {
    for (const item of frozen) {
      // 向きは戻さない。周りを見回すことはできる
      try {
        item.ent.teleport(item.loc);
      } catch (err) {}
    }
    if (i % 4 === 0) {
      scatter(dimension, "minecraft:endrod", center, { count: 6, radius: TIMESTOP_RADIUS * 0.5, height: 6 });
    }
  });

  later(TIMESTOP_TICKS, () => {
    announce("§b§l⏳ ...時は動き出す ⏳§r");
    sound(dimension, "random.explode", center);
    // 止めていた8秒分が一度に来る
    for (const item of frozen) {
      try {
        item.ent.applyDamage(28, { cause: "entityExplosion" });
      } catch (err) {}
      const loc = locationOf(item.ent);
      if (!loc) continue;
      const dx = loc.x - center.x, dz = loc.z - center.z;
      const d = Math.max(0.5, Math.sqrt(dx * dx + dz * dz));
      push(item.ent, { x: (dx / d) * 2.2, y: 1.4, z: (dz / d) * 2.2 });
    }
    shake(dimension, center, { radius: 60, intensity: 0.9, seconds: 2.0 });
    try {
      dimension.createExplosion(center, 24, { breaksBlocks: mayBreakBlocks(), causesFire: false });
    } catch (err) {}
  });
}

/* ------------------------------------------------------------------ */
/*  地殻貫通TNT                                                        */
/*                                                                     */
/*  空から岩盤の手前まで、直径19ブロックの穴を一直線に開ける。           */
/*  縦穴TNTが1マス幅で40ブロック掘るのに対し、こちらは世界を貫通する。   */
/* ------------------------------------------------------------------ */
export function drillEffect(dimension, center) {
  announce("§7§l⛏ 地殻貫通TNT: 岩盤まで貫く ⛏§r");
  sound(dimension, "random.explode", center, { pitch: 0.5 });

  if (mayBreakBlocks()) {
    const limits = heightLimits(dimension);
    // 岩盤の少し上まで。掘る量が青天井にならないよう深さに上限を設ける
    const down = -Math.min(170, Math.max(1, Math.floor(center.y) - limits.min - 4));
    carveShaft(dimension, center, { radius: 9, top: 34, bottom: down, priority: 10 });
  }

  // 掘り進んでいく様子を見せる光の柱
  for (let step = 0; step < 40; step++) {
    later(step * 2, () => {
      const y = center.y + 30 - step * 5;
      for (let n = 0; n < 8; n++) {
        const p = randomInDisk({ x: center.x, y, z: center.z }, 9);
        particle(dimension, "minecraft:basic_flame_particle", p);
      }
      if (step % 8 === 0) sound(dimension, "random.explode", { x: center.x, y, z: center.z }, { pitch: 0.6 });
    });
  }

  knockOutward(dimension, center, 24, 2.0);
  shake(dimension, center, { radius: 40, intensity: 0.7, seconds: 3 });
  radiationZone(dimension, center, { radius: 10, duration: 400, amplifier: 0, lingerTicks: 200 });
}

/* ------------------------------------------------------------------ */
/*  崩落TNT                                                            */
/*                                                                     */
/*  爆発では壊さない。足元をくり抜いたうえで周りの地形を砂に変え、       */
/*  支えを失った大地がそのまま崩れ落ちるのを見せる。                    */
/* ------------------------------------------------------------------ */
export function collapseEffect(dimension, center) {
  announce("§6§l▼ 崩落TNT: 足場が消えた ▼§r");
  sound(dimension, "random.explode", center, { pitch: 0.45 });
  if (mayBreakBlocks()) {
    crumbleTerrain(dimension, center, { radius: scaledRadius(18), depth: 6, height: 14, priority: 8 });
  }
  shake(dimension, center, { radius: 45, intensity: 0.8, seconds: 4 });
  knockOutward(dimension, center, 18, 0.6, { lift: -0.1 });
  repeat(10, 8, () => scatter(dimension, "minecraft:basic_smoke_particle", center, {
    count: 12, radius: 18, height: 3,
  }));
}

/* ------------------------------------------------------------------ */
/*  増殖TNT                                                            */
/*                                                                     */
/*  連鎖着火で爆発し、また増える。放っておくと際限がないので、          */
/*  1回の連鎖で増やせる総数に上限を設けてある。                        */
/*  コピーは「置くだけ」で、着火は既存の連鎖爆発の仕組みに任せている。   */
/* ------------------------------------------------------------------ */
export const REPLICATION_LIMIT = 40;
export const REPLICATION_COOLDOWN = 300;

let budget = REPLICATION_LIMIT;
let refillPending = false;

/** 増殖の残り (テスト用) */
export function replicationBudget() {
  return budget;
}

export function resetReplication() {
  budget = REPLICATION_LIMIT;
  refillPending = false;
}

export function replicatorEffect(dimension, center) {
  if (budget <= 0) {
    announce("§a§l✦ 増殖TNT: これ以上は増えない ✦§r");
    return;
  }
  if (budget === REPLICATION_LIMIT) announce("§a§l✦ 増殖TNT: 増え始めた ✦§r");

  const children = Math.min(3, budget);
  budget -= children;

  // しばらく何も起きなければ、また増やせるようにする
  if (!refillPending) {
    refillPending = true;
    later(REPLICATION_COOLDOWN, () => {
      budget = REPLICATION_LIMIT;
      refillPending = false;
    });
  }

  const base = blockPos(center);
  let placed = 0;
  for (let i = 0; i < 8 && placed < children; i++) {
    const angle = (Math.PI * 2 * i) / 8 + Math.random() * 0.4;
    const loc = {
      x: base.x + Math.round(Math.cos(angle) * 3),
      y: base.y,
      z: base.z + Math.round(Math.sin(angle) * 3),
    };
    const block = blockAt(dimension, loc);
    if (!block || block.typeId !== "minecraft:air") continue;
    // 置くだけでよい。すぐ後の連鎖判定がこれを拾って着火する
    if (trySetBlock(dimension, loc, ["manytnt:replicator_tnt"])) placed++;
  }
  // 産み落とせなかったぶんは返す
  budget += children - placed;

  scatter(dimension, "minecraft:villager_happy", center, { count: 12, radius: 3, height: 2 });
  sound(dimension, "random.pop", center);
}
