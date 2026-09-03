/**
 * 核兵器系のTNT。核・超核・水素爆弾・ツァーリボンバ・反物質・終焉。
 *
 * 段階ごとの違いは NUKE_TIERS の数値だけにしてある。手順は nuclearBlast に
 * 1本化してあるので、演出を直すときも1か所で済む。
 */
import { announce } from "../core/chat.js";
import { mayBreakBlocks, maySetFire, scaledRadius } from "../core/settings.js";
import { carveSphere } from "../lib/terrain.js";
import { deepBoom, later, mushroomCloud, particle, shake } from "../lib/fx.js";
import { entitiesNear, irradiate, knockOutward } from "../lib/entities.js";
import { pick, randomInDisk, shuffled } from "../lib/math.js";
import { EFFECTS } from "./index.js";
import { igniteFires } from "./elemental.js";

/* ==================================================================== */
/*  段階表                                                              */
/*                                                                      */
/*  blastRadius … 消し飛ぶ球の半径。実際の破壊はここが受け持つ。         */
/*      createExplosion は地面の耐爆性で威力を使い切ってしまい、         */
/*      威力をいくら上げても横にはあまり広がらない (Minecraft 自体の     */
/*      仕様で、設定では解除できない)。そのため範囲の拡大は爆発ではなく  */
/*      球状の掘削で表現している。爆心地を中心とした球なので、           */
/*      上にも下にも同じだけ広がる。                                    */
/* ==================================================================== */
export const NUKE_TIERS = {
  nuke: {
    messages: ["§c☢ 核TNTが爆発した！§r"],
    cloud: { stemHeight: 14, capRadius: 10, duration: 60, lingerTicks: 140, densityMult: 1.0 },
    fireRadius: 6,
    radiation: { radius: 8, duration: 600, amplifier: 0, lingerTicks: 300 },
    knockRadius: 18, knockStrength: 1.5,
    damageRadius: 20, maxDamage: 35,
    blastRadius: 24,
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
    blastRadius: 36,
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
    blastRadius: 50,
    secondaryBlasts: 5, secondaryPower: 12,
    shakeRadius: 110, shakeIntensity: 0.95, shakeSeconds: 3.5,
  },
  /*
   * ツァーリボンバ (弱体化前の100メガトン版)。
   *
   * 実際の記録:
   * ・実験で使われた50メガトン版でも、火球半径 約4.6km、全壊半径 約35km
   * ・弱体化前の100メガトン設計はその約1.26倍 (出力の立方根比) 相当と
   *   推定され、全壊半径は概算で40〜45km、火球は直径10kmに達したとされる
   * ・きのこ雲は実測で高度60〜64km (50メガトン版)
   *
   * 1ブロック=1mでそのまま再現すると半径44kmは面積にして約77億ブロックとなり、
   * どんな端末でも即クラッシュする。そのため実寸ではなく
   * 「このアドオンの中で最大級の規模」として表現している。
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
    blastRadius: 66,
    secondaryBlasts: 6, secondaryPower: 14,
    shakeRadius: 160, shakeIntensity: 1.0, shakeSeconds: 5.0,
  },
  /*
   * 反物質爆弾。核分裂・核融合の先、物質と反物質の対消滅。
   * このアドオンの頂点で、消える球は直径160ブロックに達する。
   */
  antimatter: {
    messages: ["§f§l⚛⚛⚛ 反物質爆弾が対消滅を起こした...この世の終わりだ ⚛⚛⚛§r"],
    cloud: { stemHeight: 64, capRadius: 50, duration: 200, lingerTicks: 300, densityMult: 2.5 },
    fireRadius: 22,
    radiation: { radius: 36, duration: 6000, amplifier: 4, lingerTicks: 3600 },
    knockRadius: 90, knockStrength: 3.8,
    damageRadius: 80, maxDamage: 110,
    blastRadius: 80,
    secondaryBlasts: 8, secondaryPower: 16,
    shakeRadius: 220, shakeIntensity: 1.0, shakeSeconds: 6.0,
  },
};

/**
 * 爆心地に残る放射能。
 *
 * ゾーン内にいる間は一定間隔でウィザー効果を塗り直す。塗り直すたびに
 * lingerTicks ぶんの残り時間を与えるので、ゾーンを一瞬でも通れば
 * その後外に出ても最低 lingerTicks は被曝が続く (= 汚染された扱い)。
 * 追加の爆発は起こさないので、何回重ねても処理は軽いまま。
 */
export function radiationZone(dimension, center, opts) {
  const radius = opts.radius ?? 6;
  const duration = opts.duration ?? 600;
  const amplifier = opts.amplifier ?? 0;
  const linger = opts.lingerTicks ?? 300;
  const interval = 20;
  const rounds = Math.max(1, Math.round(duration / interval));

  let elapsed = 0;
  const tick = () => {
    elapsed++;
    for (const ent of entitiesNear(dimension, center, radius, { items: false })) {
      try {
        ent.addEffect("minecraft:wither", linger, { amplifier, showParticles: true });
      } catch (err) {
        /* 効果を受け付けないモブもいる */
      }
    }
    particle(dimension, "minecraft:witchspell_emitter", randomInDisk(center, radius * 0.8, 1));
    if (elapsed < rounds) later(interval, tick);
  };
  tick();
}

/** 核系の共通処理。段階ごとの違いは NUKE_TIERS だけを見ればよい */
export function nuclearBlast(dimension, center, tier) {
  for (const line of tier.messages) announce(line);

  mushroomCloud(dimension, center, tier.cloud);
  igniteFires(dimension, center, tier.fireRadius);
  radiationZone(dimension, center, tier.radiation);
  knockOutward(dimension, center, tier.knockRadius, tier.knockStrength);
  irradiate(dimension, center, tier.damageRadius, tier.maxDamage);

  const radius = scaledRadius(tier.blastRadius);
  // 掘削は他のどのジョブより優先する。ここが遅れると「爆発したのに
  // 地形が残っている」という一番目立つ形で破綻するため。
  carveSphere(dimension, center, { radius, scorch: true, priority: 10 });

  shake(dimension, center, {
    radius: tier.shakeRadius,
    intensity: tier.shakeIntensity,
    seconds: tier.shakeSeconds,
  });
  deepBoom(dimension, center);

  // クレーターの中に本物の爆発をいくつか散らす。地形の破壊は carveSphere が
  // 受け持つので、ここは音・炎・吹き飛びといった「らしさ」を足すだけでよい。
  for (let i = 0; i < tier.secondaryBlasts; i++) {
    const spot = randomInDisk(center, radius * 0.4);
    later(2 + i * 3, () => {
      try {
        dimension.createExplosion(spot, tier.secondaryPower, {
          breaksBlocks: mayBreakBlocks(),
          causesFire: maySetFire(),
          allowUnderwater: true,
        });
      } catch (err) {
        /* 読み込み外なら諦める */
      }
    });
  }
}

export const nukeEffect = (dimension, center) => nuclearBlast(dimension, center, NUKE_TIERS.nuke);
export const ultraNukeEffect = (dimension, center) => nuclearBlast(dimension, center, NUKE_TIERS.ultraNuke);
export const hydrogenBombEffect = (dimension, center) => nuclearBlast(dimension, center, NUKE_TIERS.hydrogenBomb);
export const tsarBombaEffect = (dimension, center) => nuclearBlast(dimension, center, NUKE_TIERS.tsarBomba);
export const antimatterEffect = (dimension, center) => nuclearBlast(dimension, center, NUKE_TIERS.antimatter);

/**
 * 終焉TNT。このアドオンの集大成。
 *
 * 核級の爆発に加えて、ランダムに選んだ4〜5個の効果を時間差で連続発動させる。
 * 何が出るかは毎回変わるので、結果を予測できないのが売り。
 */
export const ARMAGEDDON_POOL = [
  "iceEffect", "poisonEffect", "thunderEffect", "teleportEffect", "antiGravityEffect",
  "lavaEffect", "waterEffect", "darknessEffect", "summonEffect", "earthquakeEffect",
  "bouncyEffect", "webEffect", "treasureEffect", "swapEffect", "confusionEffect",
  "grassEffect", "desertEffect", "snowgolemEffect", "beeEffect", "arrowEffect",
  "musicEffect", "tsunamiEffect", "harvestEffect", "xpEffect", "endermanEffect",
  "slimeEffect", "animalEffect", "iceageEffect", "fortuneEffect", "beamEffect",
  "invisibilityEffect", "speedEffect", "honeyEffect", "scorchedEffect", "feastEffect",
  "cactusEffect", "obsidianEffect", "glowEffect", "vacuumEffect", "chorusEffect",
];

export function armageddonEffect(dimension, center) {
  announce("§0§l☠☠☠ 終焉TNTが世界の理を破壊した ☠☠☠§r");

  mushroomCloud(dimension, center, { stemHeight: 30, capRadius: 26, duration: 120 });
  igniteFires(dimension, center, 12);
  radiationZone(dimension, center, { radius: 18, duration: 600, amplifier: 2 });
  knockOutward(dimension, center, 40, 2.6);
  irradiate(dimension, center, 34, 65);
  carveSphere(dimension, center, { radius: scaledRadius(56), scorch: true, priority: 10 });
  shake(dimension, center, { radius: 100, intensity: 0.95, seconds: 3.2 });
  deepBoom(dimension, center);

  // 追加効果を時間差で連続発動する。
  // 名前で引くのは、効果どうしを直接 import し合うと参照が絡まるため。
  const picks = shuffled(ARMAGEDDON_POOL).slice(0, 4 + Math.floor(Math.random() * 2));
  picks.forEach((name, i) => {
    later(30 + i * 25, () => {
      const fn = EFFECTS[name];
      if (!fn) return;
      announce(`§5[終焉] ${i + 1}発目: §d${name}§5 発動！§r`);
      fn(dimension, center);
    });
  });
}

/** ランダムに1つ引いて発動する (虹TNTなどで使う共通処理) */
export function rollRandomEffect(dimension, center, pool, label) {
  const name = pick(pool);
  const fn = EFFECTS[name];
  if (!fn) return null;
  if (label) announce(`${label}§e${name}§r`);
  fn(dimension, center);
  return name;
}
