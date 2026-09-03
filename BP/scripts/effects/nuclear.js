/**
 * 核・超核・水素爆弾・ツァーリボンバ・反物質・終焉。
 */
import { system } from "@minecraft/server";
import { announce } from "../core/announce.js";
import { animalEffect, beeEffect, feastEffect, invisibilityEffect, snowgolemEffect, summonEffect, webEffect } from "./creatures.js";
import { darknessEffect, fireEffect, glowEffect, iceEffect, iceageEffect, lavaEffect, obsidianEffect, poisonEffect, scorchedEffect, thunderEffect, tsunamiEffect, vacuumEffect, waterEffect } from "./elemental.js";
import { antiGravityEffect, beamEffect, bouncyEffect, chorusEffect, confusionEffect, endermanEffect, slimeEffect, speedEffect, swapEffect, teleportEffect } from "./motion.js";
import { arrowEffect, fortuneEffect, musicEffect, treasureEffect, xpEffect } from "./spectacle.js";
import { cactusEffect, desertEffect, earthquakeEffect, grassEffect, harvestEffect, honeyEffect } from "./terrain.js";
import { carveCrater } from "../util/blocks.js";
import { rand } from "../util/common.js";
import { irradiateEntities, shockwaveKnockback } from "../util/entities.js";
import { mushroomCloud, nukeImpact, radiationZone } from "../util/spectacle.js";

/* ==================================================================== */
/*  核系TNTの段階表                                                      */
/*                                                                      */
/*  以前は核・超核・水素爆弾・ツァーリボンバ・反物質の5つに、ほぼ同じ手順が */
/*  それぞれ個別に書かれていた。数値だけが違うのに手順が5箇所に散っていて、 */
/*  片方だけ直して他が置き去りになりやすかったため、手順は nuclearBlast に */
/*  1本化し、段階ごとの違いはこの表だけにまとめた。                        */
/*                                                                      */
/*  crater … 掘るクレーターの半径と深さ。実際の破壊はここが受け持つ。     */
/*            createExplosion は地面の耐爆性で威力を使い切ってしまい、    */
/*            威力をいくら上げても横方向にはあまり広がらない (Minecraft   */
/*            自体の仕様で、設定では解除できない)。そのため範囲の拡大は   */
/*            爆発ではなくクレーターの掘削で表現している。                */
/* ==================================================================== */
export const NUKE_TIERS = {
  nuke: {
    messages: ["§c☢ 核TNTが爆発した！§r"],
    cloud: { stemHeight: 14, capRadius: 10, duration: 60, lingerTicks: 140, densityMult: 1.0 },
    fireRadius: 6,
    radiation: { radius: 8, duration: 600, amplifier: 0, lingerTicks: 300 },
    knockRadius: 18, knockStrength: 1.5,
    damageRadius: 20, maxDamage: 35,
    crater: { radius: 16, depth: 6 },
    secondaryBlasts: 3, secondaryPower: 8,
    shakeRadius: 50, shakeIntensity: 0.6, shakeSeconds: 1.8,
  },
  ultraNuke: {
    messages: ["§4§l☢☢☢ 超核TNTが爆発した...世界が震える ☢☢☢§r"],
    cloud: { stemHeight: 22, capRadius: 17, duration: 90, lingerTicks: 180, densityMult: 1.3 },
    fireRadius: 10,
    radiation: { radius: 13, duration: 1000, amplifier: 1, lingerTicks: 500 },
    knockRadius: 30, knockStrength: 2.0,
    damageRadius: 30, maxDamage: 50,
    crater: { radius: 26, depth: 10 },
    secondaryBlasts: 4, secondaryPower: 10,
    shakeRadius: 75, shakeIntensity: 0.8, shakeSeconds: 2.6,
  },
  hydrogenBomb: {
    messages: ["§5§l☢☢☢☢☢ 水素爆弾が炸裂した...大地が消し飛ぶ ☢☢☢☢☢§r"],
    cloud: { stemHeight: 34, capRadius: 27, duration: 130, lingerTicks: 220, densityMult: 1.6 },
    fireRadius: 14,
    radiation: { radius: 20, duration: 1800, amplifier: 2, lingerTicks: 1200 },
    knockRadius: 46, knockStrength: 2.6,
    damageRadius: 42, maxDamage: 70,
    crater: { radius: 38, depth: 14 },
    secondaryBlasts: 5, secondaryPower: 12,
    shakeRadius: 110, shakeIntensity: 0.95, shakeSeconds: 3.5,
  },
  /*
   * ツァーリボンバ(弱体化前の100メガトン版)。
   *
   * 実際の記録:
   * ・実験で使われた50メガトン版でも、火球半径 約4.6km、全壊半径 約35km
   * ・弱体化前の100メガトン設計は、その約1.26倍(降伏出力の立方根比)相当と
   *   推定されており、全壊半径は概算で40〜45km、火球は直径10kmに達したとされる
   * ・きのこ雲は実測で高度60〜64km(50メガトン版)
   *
   * これを1ブロック=1mでそのまま再現しようとすると、半径44kmは一辺88,000
   * ブロック超・面積にして約77億ブロックとなり、どんな端末でも即クラッシュする。
   * そのため実寸ではなく「このアドオンの中で最大級の規模」として表現している。
   */
  tsarBomba: {
    messages: [
      "§d§l☢☢☢☢☢☢☢ ツァーリボンバ(100メガトン)が炸裂した ☢☢☢☢☢☢☢§r",
      "§7実際の規模なら全壊半径は約44km、火球は直径10km超え§r",
    ],
    cloud: { stemHeight: 48, capRadius: 38, duration: 170, lingerTicks: 260, densityMult: 2.0 },
    fireRadius: 18,
    radiation: { radius: 28, duration: 2400, amplifier: 3, lingerTicks: 2400 },
    knockRadius: 70, knockStrength: 3.4,
    damageRadius: 60, maxDamage: 95,
    crater: { radius: 52, depth: 19 },
    secondaryBlasts: 6, secondaryPower: 14,
    shakeRadius: 160, shakeIntensity: 1.0, shakeSeconds: 5.0,
  },
  /*
   * 反物質爆弾。核分裂・核融合の先、物質と反物質の対消滅を再現した、
   * このアドオンの頂点に立つ一撃。クレーターは直径136ブロックに達する。
   */
  antimatter: {
    messages: ["§f§l⚛⚛⚛ 反物質爆弾が対消滅を起こした...この世の終わりだ ⚛⚛⚛§r"],
    cloud: { stemHeight: 64, capRadius: 50, duration: 200, lingerTicks: 300, densityMult: 2.5 },
    fireRadius: 22,
    radiation: { radius: 36, duration: 6000, amplifier: 4, lingerTicks: 3600 },
    knockRadius: 90, knockStrength: 3.8,
    damageRadius: 80, maxDamage: 110,
    crater: { radius: 68, depth: 25 },
    secondaryBlasts: 8, secondaryPower: 16,
    shakeRadius: 220, shakeIntensity: 1.0, shakeSeconds: 6.0,
  },
};

/** 核系TNTの共通処理。段階ごとの違いは NUKE_TIERS だけを見ればよい。 */
export function nuclearBlast(dimension, center, tier) {
  for (const line of tier.messages) announce(line);

  mushroomCloud(dimension, center, tier.cloud);
  fireEffect(dimension, center, tier.fireRadius);
  radiationZone(dimension, center, tier.radiation);
  shockwaveKnockback(dimension, center, tier.knockRadius, tier.knockStrength);
  irradiateEntities(dimension, center, tier.damageRadius, tier.maxDamage);
  carveCrater(dimension, center, { ...tier.crater, scorch: true });
  nukeImpact(dimension, center, tier.shakeRadius, tier.shakeIntensity, tier.shakeSeconds);

  // クレーターの中に本物の爆発をいくつか散らす。
  // 地形の破壊そのものは carveCrater が受け持つので、ここは音・炎・
  // 吹き飛びといった「本物の爆発らしさ」を足すための少数だけでいい。
  for (let i = 0; i < tier.secondaryBlasts; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = tier.crater.radius * 0.4 * Math.sqrt(Math.random());
    system.runTimeout(() => {
      try {
        dimension.createExplosion(
          {
            x: center.x + Math.cos(angle) * r,
            y: center.y + rand(-1, 2),
            z: center.z + Math.sin(angle) * r,
          },
          tier.secondaryPower,
          { breaksBlocks: true, causesFire: true, allowUnderwater: true }
        );
      } catch (err) {}
    }, 2 + i * 3);
  }
}

export function nukeEffect(dimension, center) {
  nuclearBlast(dimension, center, NUKE_TIERS.nuke);
}

export function ultraNukeEffect(dimension, center) {
  nuclearBlast(dimension, center, NUKE_TIERS.ultraNuke);
}

export function hydrogenBombEffect(dimension, center) {
  nuclearBlast(dimension, center, NUKE_TIERS.hydrogenBomb);
}

export function tsarBombaEffect(dimension, center) {
  nuclearBlast(dimension, center, NUKE_TIERS.tsarBomba);
}

export function antimatterEffect(dimension, center) {
  nuclearBlast(dimension, center, NUKE_TIERS.antimatter);
}

/**
 * 究極TNT(終焉TNT): このアドオンの集大成。
 * 単体でも強力な爆発(核系と同じ「1tickに1発」方式で安全に処理)に加え、
 * ランダムに選んだ4〜5個の効果を時間差で連続発動させる、まさに何でもありの一撃。
 * どの効果が出るかは毎回変わるので、riddleのように結果を予測できないのが売り。
 */
export function armageddonEffect(dimension, center) {
  try {
    announce("§0§l☠☠☠ 終焉TNTが世界の理を破壊した ☠☠☠§r");
  } catch (err) {}

  mushroomCloud(dimension, center, { stemHeight: 30, capRadius: 26, duration: 120 });
  fireEffect(dimension, center, 12);
  radiationZone(dimension, center, { radius: 18, duration: 600, amplifier: 2 });
  shockwaveKnockback(dimension, center, 40, 2.6);
  irradiateEntities(dimension, center, 34, 65);
  carveCrater(dimension, center, { radius: 44, depth: 16, scorch: true });
  nukeImpact(dimension, center, 100, 0.95, 3.2);

  // ランダムな追加効果を数個、時間差で連続発動する
  const pool = [
    iceEffect, poisonEffect, thunderEffect, teleportEffect, antiGravityEffect,
    lavaEffect, waterEffect, darknessEffect, summonEffect, earthquakeEffect,
    bouncyEffect, webEffect, treasureEffect, swapEffect, confusionEffect,
    grassEffect, desertEffect, snowgolemEffect, beeEffect, arrowEffect,
    musicEffect, tsunamiEffect, harvestEffect, xpEffect, endermanEffect,
    slimeEffect, animalEffect, iceageEffect, fortuneEffect, beamEffect,
    invisibilityEffect, speedEffect, honeyEffect, scorchedEffect, feastEffect,
    cactusEffect, obsidianEffect, glowEffect, vacuumEffect, chorusEffect,
  ];
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const picks = shuffled.slice(0, 4 + Math.floor(Math.random() * 2));
  picks.forEach((fn, i) => {
    system.runTimeout(() => {
      try {
        announce(`§5[終焉] ${i + 1}発目: §d${fn.name}§5 発動！§r`);
      } catch (err) {}
      try {
        fn(dimension, center);
      } catch (err) {}
    }, 30 + i * 25);
  });
}
