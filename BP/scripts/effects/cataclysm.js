/**
 * 常軌を逸したTNT。
 *
 * 威力の数字を上げただけのものは既に核系にあるので、ここに置くのは
 * 「仕組みそのものがおかしい」TNT だけにしてある。
 * どれも1tickあたりの処理量に上限を設けてあり、規模が大きくても
 * 端末が固まらないようにしている。
 */
import { system } from "@minecraft/server";
import { announce } from "../core/announce.js";
import { playSoundSafe, rand, spawnParticleSafe } from "../util/common.js";
import {
  irradiateEntities,
  nearbyEntities,
  pushEntity,
  shockwaveKnockback,
} from "../util/entities.js";
import { carveShaft, carveSphere, crumbleTerrain, trySetBlock } from "../util/blocks.js";
import { mushroomCloud, nukeImpact, radiationZone } from "../util/spectacle.js";

/* ------------------------------------------------------------------ */
/*  特異点TNT                                                          */
/*                                                                     */
/*  6秒かけて周囲を吸い込みながら、球状に空間そのものを消していく。      */
/*  吸い込みが終わると、溜め込んだものを一気に吐き出して弾ける。         */
/*  ブラックホールTNTが「引き寄せて中心を少し抉る」のに対し、           */
/*  こちらは半径26ブロックの球がまるごと消える。                        */
/* ------------------------------------------------------------------ */
const SINGULARITY_RADIUS = 26;
const SINGULARITY_DURATION = 120;

export function singularityEffect(dimension, center) {
  announce("§0§l⬤ 特異点TNT: 空間が閉じていく ⬤§r");
  playSoundSafe(dimension, "portal.portal", center);

  let elapsed = 0;
  const pullId = system.runInterval(() => {
    elapsed += 2;
    // 近いものほど強く引く。逃げ切るには走り出しが要る
    for (const ent of nearbyEntities(dimension, center, 44)) {
      try {
        const loc = ent.location;
        const dx = center.x - loc.x;
        const dy = center.y - loc.y;
        const dz = center.z - loc.z;
        const dist = Math.max(1.5, Math.sqrt(dx * dx + dy * dy + dz * dz));
        const strength = Math.min(1.4, 14 / (dist * dist));
        pushEntity(ent, {
          x: (dx / dist) * strength,
          y: (dy / dist) * strength * 0.7,
          z: (dz / dist) * strength,
        });
      } catch (err) {}
    }
    // 渦を巻く事象の地平面
    const spin = elapsed * 0.35;
    for (let n = 0; n < 14; n++) {
      const angle = spin + (Math.PI * 2 * n) / 14;
      const ring = 3 + (n % 5) * 2.5;
      spawnParticleSafe(dimension, "minecraft:basic_smoke_particle", {
        x: center.x + Math.cos(angle) * ring,
        y: center.y + rand(-3, 3),
        z: center.z + Math.sin(angle) * ring,
      });
      spawnParticleSafe(dimension, "minecraft:endrod", {
        x: center.x + Math.cos(-angle) * (ring * 0.6),
        y: center.y + rand(-2, 2),
        z: center.z + Math.sin(-angle) * (ring * 0.6),
      });
    }
    if (elapsed >= SINGULARITY_DURATION) system.clearRun(pullId);
  }, 2);

  // 吸い込みと並行して、内側から順に空間が消えていく
  carveSphere(dimension, center, SINGULARITY_RADIUS);

  system.runTimeout(() => {
    announce("§5§l⬤ ...そして弾けた ⬤§r");
    nukeImpact(dimension, center, 120, 1.0, 3.0);
    shockwaveKnockback(dimension, center, 56, 5.0);
    irradiateEntities(dimension, center, 44, 120);
    mushroomCloud(dimension, center, {
      stemHeight: 40, capRadius: 34, duration: 140, lingerTicks: 200, densityMult: 1.8,
    });
    try {
      dimension.createExplosion(center, 60, {
        breaksBlocks: true, causesFire: false, allowUnderwater: true,
      });
    } catch (err) {}
  }, SINGULARITY_DURATION);
}

/* ------------------------------------------------------------------ */
/*  時間停止TNT                                                        */
/*                                                                     */
/*  周囲のすべてを8秒間その場に縫い止める。止まっている間は何も起きず、  */
/*  時が動き出した瞬間に、溜め込んだ分の衝撃がまとめて襲いかかる。       */
/*  位置を毎tick元に戻すことで「止まっている」を作っている。             */
/* ------------------------------------------------------------------ */
const TIMESTOP_RADIUS = 26;
const TIMESTOP_TICKS = 160;

export function timestopEffect(dimension, center) {
  announce("§b§l⏳ 時間停止TNT: 世界が止まった ⏳§r");
  playSoundSafe(dimension, "beacon.deactivate", center);

  const frozen = [];
  for (const ent of nearbyEntities(dimension, center, TIMESTOP_RADIUS)) {
    try {
      frozen.push({ ent, loc: { ...ent.location } });
      // 止まっている感を出すのと、位置を戻される違和感を減らすため
      ent.addEffect("minecraft:slowness", TIMESTOP_TICKS + 20, { amplifier: 6, showParticles: false });
    } catch (err) {}
  }

  let elapsed = 0;
  const holdId = system.runInterval(() => {
    elapsed++;
    for (const f of frozen) {
      // 向きは戻さない。周りを見回すことはできる
      try {
        f.ent.teleport(f.loc);
      } catch (err) {}
    }
    if (elapsed % 4 === 0) {
      for (let n = 0; n < 6; n++) {
        spawnParticleSafe(dimension, "minecraft:endrod", {
          x: center.x + rand(-TIMESTOP_RADIUS, TIMESTOP_RADIUS) * 0.5,
          y: center.y + rand(0, 6),
          z: center.z + rand(-TIMESTOP_RADIUS, TIMESTOP_RADIUS) * 0.5,
        });
      }
    }
    if (elapsed < TIMESTOP_TICKS) return;

    system.clearRun(holdId);
    announce("§b§l⏳ ...時は動き出す ⏳§r");
    playSoundSafe(dimension, "random.explode", center);
    // 止めていた8秒分が一度に来る
    for (const f of frozen) {
      try {
        f.ent.applyDamage(28, { cause: "entityExplosion" });
      } catch (err) {}
      try {
        const loc = f.ent.location;
        const dx = loc.x - center.x;
        const dz = loc.z - center.z;
        const dist = Math.max(0.5, Math.sqrt(dx * dx + dz * dz));
        pushEntity(f.ent, { x: (dx / dist) * 2.2, y: 1.4, z: (dz / dist) * 2.2 });
      } catch (err) {}
    }
    nukeImpact(dimension, center, 60, 0.9, 2.0);
    try {
      dimension.createExplosion(center, 24, { breaksBlocks: true, causesFire: false });
    } catch (err) {}
  }, 1);
}

/* ------------------------------------------------------------------ */
/*  地殻貫通TNT                                                        */
/*                                                                     */
/*  空から岩盤まで、直径19ブロックの穴を一直線に開ける。                */
/*  縦穴TNTが1マス幅で40ブロック掘るのに対し、こちらは世界を貫通する。   */
/* ------------------------------------------------------------------ */
export function drillEffect(dimension, center) {
  announce("§7§l⛏ 地殻貫通TNT: 岩盤まで貫く ⛏§r");
  playSoundSafe(dimension, "random.explode", center);

  // 下は岩盤付近まで。掘る量が青天井にならないよう深さに上限を設ける
  const down = -Math.min(170, Math.round(center.y) + 68);
  carveShaft(dimension, center, { radius: 9, top: 34, bottom: down });

  // 掘り進んでいく様子を見せる光の柱
  for (let step = 0; step < 40; step++) {
    system.runTimeout(() => {
      const y = center.y + 30 - step * 5;
      for (let n = 0; n < 8; n++) {
        const angle = Math.random() * Math.PI * 2;
        spawnParticleSafe(dimension, "minecraft:basic_flame_particle", {
          x: center.x + Math.cos(angle) * rand(0, 9),
          y,
          z: center.z + Math.sin(angle) * rand(0, 9),
        });
      }
      if (step % 8 === 0) playSoundSafe(dimension, "random.explode", { x: center.x, y, z: center.z });
    }, step * 2);
  }

  shockwaveKnockback(dimension, center, 24, 2.0);
  radiationZone(dimension, center, { radius: 10, duration: 400, amplifier: 0, lingerTicks: 200 });
}

/* ------------------------------------------------------------------ */
/*  崩落TNT                                                            */
/*                                                                     */
/*  爆発では壊さない。足元をくり抜いたうえで周りの地形を砂に変え、       */
/*  支えを失った大地がそのまま崩れ落ちるのを見せる。                    */
/* ------------------------------------------------------------------ */
export function collapseEffect(dimension, center) {
  announce("§e§l▼ 崩落TNT: 大地が崩れ落ちる ▼§r");
  playSoundSafe(dimension, "dig.gravel", center);

  crumbleTerrain(dimension, center, { radius: 18, depth: 7, height: 16 });

  // 崩れ始めるまでの間、地響きを演出する
  for (let i = 0; i < 10; i++) {
    system.runTimeout(() => {
      nukeImpact(dimension, center, 40, 0.35, 1.0);
      for (let n = 0; n < 10; n++) {
        spawnParticleSafe(dimension, "minecraft:basic_smoke_particle", {
          x: center.x + rand(-18, 18),
          y: center.y + rand(-2, 2),
          z: center.z + rand(-18, 18),
        });
      }
    }, 20 + i * 12);
  }

  for (const ent of nearbyEntities(dimension, center, 20)) {
    try {
      ent.addEffect("minecraft:slowness", 120, { amplifier: 2, showParticles: false });
    } catch (err) {}
  }
}

/* ------------------------------------------------------------------ */
/*  増殖TNT                                                            */
/*                                                                     */
/*  爆発するたびに、自分のコピーを周りに産み落とす。産まれたコピーは     */
/*  連鎖着火で爆発し、また増える。放っておくと際限がないので、          */
/*  1回の連鎖で増やせる総数に上限を設けてある (上限に達すると止まる)。   */
/*                                                                     */
/*  コピーは「置くだけ」で、着火は既存の連鎖爆発の仕組みに任せている。   */
/* ------------------------------------------------------------------ */
const REPLICATION_LIMIT = 40;
const REPLICATION_COOLDOWN = 300;
let replicationBudget = REPLICATION_LIMIT;
let replicationRefillId = null;

export function replicatorEffect(dimension, center) {
  if (replicationBudget <= 0) {
    announce("§a§l✦ 増殖TNT: これ以上は増えない ✦§r");
    return;
  }
  if (replicationBudget === REPLICATION_LIMIT) {
    announce("§a§l✦ 増殖TNT: 増え始めた ✦§r");
  }

  const children = Math.min(3, replicationBudget);
  replicationBudget -= children;

  // しばらく何も起きなければ、また増やせるようにする
  if (replicationRefillId !== null) system.clearRun(replicationRefillId);
  replicationRefillId = system.runTimeout(() => {
    replicationBudget = REPLICATION_LIMIT;
    replicationRefillId = null;
  }, REPLICATION_COOLDOWN);

  const base = { x: Math.floor(center.x), y: Math.floor(center.y), z: Math.floor(center.z) };
  let placed = 0;
  for (let i = 0; i < 8 && placed < children; i++) {
    const angle = (Math.PI * 2 * i) / 8 + Math.random() * 0.4;
    const loc = {
      x: base.x + Math.round(Math.cos(angle) * 3),
      y: base.y,
      z: base.z + Math.round(Math.sin(angle) * 3),
    };
    try {
      const b = dimension.getBlock(loc);
      if (!b || b.typeId !== "minecraft:air") continue;
      // 置くだけでよい。すぐ後の連鎖判定がこれを拾って着火する
      if (trySetBlock(dimension, loc, ["manytnt:replicator_tnt"])) placed++;
    } catch (err) {}
  }
  // 産み落とせなかったぶんは返す
  replicationBudget += children - placed;

  for (let n = 0; n < 12; n++) {
    spawnParticleSafe(dimension, "minecraft:villager_happy", {
      x: center.x + rand(-3, 3),
      y: center.y + rand(0, 2),
      z: center.z + rand(-3, 3),
    });
  }
}
