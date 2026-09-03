/**
 * きのこ雲・放射能ゾーン・画面揺れといった、核系の演出。
 */
import { system } from "@minecraft/server";
import { rand, spawnParticleSafe } from "./common.js";
import { nearbyEntities } from "./entities.js";

/**
 * リアル志向のきのこ雲。実際の核爆発の段階を順番に再現する:
 *  1) 閃光         … 爆発直後、中心が真っ白に光る
 *  2) 火球の上昇   … 燃える球が膨らみながら立ち上る
 *  3) 幹(スモーク柱)… 根本から太い煙が終始立ち上り続ける
 *  4) 傘           … 頂上でドーム状に外へ巻き広がる。下面は火に照らされる
 *  5) ベースサージ … 地表を這って外側へ広がる土煙のリング
 *  6) 火の粉       … 全体に舞う燃えかす
 * パーティクルはすべて時間分散で発生させるので負荷の山はできない。
 */
export function mushroomCloud(dimension, center, opts = {}) {
  const stemHeight = opts.stemHeight ?? 12;
  const capRadius = opts.capRadius ?? 10;
  const duration = opts.duration ?? 60;
  const lingerTicks = opts.lingerTicks ?? 140; // 完成後もこの時間だけ雲を維持する
  const densityMult = opts.densityMult ?? 1; // 段階が上がるほど大きくして密度を上げる
  const stemRadius = Math.max(1.5, capRadius * 0.18);

  // 1) 閃光
  for (let n = 0; n < 16; n++) {
    system.runTimeout(() => {
      spawnParticleSafe(dimension, "minecraft:huge_explosion_emitter", {
        x: center.x + rand(-3, 3),
        y: center.y + rand(0, 4),
        z: center.z + rand(-3, 3),
      });
    }, Math.floor(n / 5));
  }

  // 2) 火球の上昇
  const riseT = Math.max(10, Math.floor(duration * 0.35));
  for (let t = 0; t <= riseT; t += 2) {
    const prog = t / riseT;
    const y = center.y + stemHeight * prog;
    const r = 1.5 + (stemRadius + 1.5) * prog;
    system.runTimeout(() => {
      for (let i = 0; i < Math.round(10 * densityMult); i++) {
        const a = Math.random() * Math.PI * 2;
        const rr = r * Math.sqrt(Math.random());
        spawnParticleSafe(dimension, "minecraft:basic_flame_particle", {
          x: center.x + Math.cos(a) * rr,
          y: y + rand(-1, 1),
          z: center.z + Math.sin(a) * rr,
        });
      }
      spawnParticleSafe(dimension, "minecraft:huge_explosion_emitter", {
        x: center.x + rand(-1, 1),
        y,
        z: center.z + rand(-1, 1),
      });
    }, t);
  }

  // 3) 幹のスモーク柱 (campfire smoke は自力で上昇するので柱がよく伸びる)。
  //    形成期間(duration)が終わった後も lingerTicks の間、薄くなりつつ供給し続ける。
  const stemTotal = duration + lingerTicks;
  for (let t = 0; t <= stemTotal; t += 2) {
    const fadeOut = t > duration ? Math.max(0.15, 1 - (t - duration) / lingerTicks) : 1;
    const count = Math.max(1, Math.round(7 * fadeOut * densityMult));
    system.runTimeout(() => {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const rr = stemRadius * Math.sqrt(Math.random());
        const h = Math.random() * stemHeight * 0.9;
        spawnParticleSafe(dimension, "minecraft:campfire_smoke_particle", {
          x: center.x + Math.cos(a) * rr,
          y: center.y + h,
          z: center.z + Math.sin(a) * rr,
        });
      }
    }, t);
  }

  // 4) 傘: 頂上でドーム状に外へ巻き広がる (密度アップ)
  const capSteps = 16;
  for (let s = 0; s <= capSteps; s++) {
    const prog = s / capSteps;
    const r = capRadius * (0.25 + 0.75 * prog);
    const t = riseT + Math.floor((duration - riseT) * prog * 0.8);
    system.runTimeout(() => {
      const pts = Math.round((14 + r * 1.8) * densityMult);
      for (let p = 0; p < pts; p++) {
        const a = (Math.PI * 2 * p) / pts + Math.random() * 0.3;
        const jitter = rand(-0.8, 0.8);
        // 傘の上面 (外側ほど低く、中心ほど盛り上がるドーム形状)
        spawnParticleSafe(dimension, "minecraft:campfire_smoke_particle", {
          x: center.x + Math.cos(a) * (r + jitter),
          y: center.y + stemHeight + Math.max(0, (1 - prog) * capRadius * 0.25) + rand(0, 1.5),
          z: center.z + Math.sin(a) * (r + jitter),
        });
        // 傘の下面が火球に照らされている表現
        if (p % 2 === 0) {
          spawnParticleSafe(dimension, "minecraft:basic_flame_particle", {
            x: center.x + Math.cos(a) * r * 0.85,
            y: center.y + stemHeight - 1 + rand(-0.5, 0.5),
            z: center.z + Math.sin(a) * r * 0.85,
          });
        }
      }
    }, t);
  }

  // 4.5) 傘の維持フェーズ: 形成が終わった後も lingerTicks の間、
  //      傘の輪郭に沿ってパーティクルを供給し続け、雲が留まって見えるようにする。
  const capLingerSteps = Math.max(4, Math.floor(lingerTicks / 8));
  for (let s = 0; s <= capLingerSteps; s++) {
    const t = duration + s * 8;
    const fadeOut = Math.max(0.2, 1 - s / capLingerSteps);
    system.runTimeout(() => {
      const pts = Math.max(6, Math.floor(capRadius * 1.4 * fadeOut * densityMult));
      for (let p = 0; p < pts; p++) {
        const a = Math.random() * Math.PI * 2;
        const r = capRadius * (0.3 + 0.7 * Math.sqrt(Math.random()));
        spawnParticleSafe(dimension, "minecraft:campfire_smoke_particle", {
          x: center.x + Math.cos(a) * r,
          y: center.y + stemHeight + rand(-0.5, 2),
          z: center.z + Math.sin(a) * r,
        });
      }
    }, t);
  }

  // 5) ベースサージ (地表を這う土煙の輪)
  const surgeSteps = 14;
  const surgeR = capRadius * 1.6;
  for (let s = 0; s <= surgeSteps; s++) {
    const prog = s / surgeSteps;
    const r = surgeR * prog + 2;
    system.runTimeout(() => {
      const pts = Math.round((16 + r * 1.5) * densityMult);
      for (let p = 0; p < pts; p++) {
        const a = (Math.PI * 2 * p) / pts + Math.random() * 0.4;
        spawnParticleSafe(dimension, "minecraft:basic_smoke_particle", {
          x: center.x + Math.cos(a) * r,
          y: center.y + 0.5 + Math.random(),
          z: center.z + Math.sin(a) * r,
        });
      }
    }, Math.floor(prog * duration * 0.4));
  }

  // 6) 火の粉 (形成中〜維持フェーズを通して降らせ続ける)
  for (let n = 0; n < Math.floor((duration + lingerTicks) / 2); n++) {
    system.runTimeout(() => {
      for (let i = 0; i < Math.max(1, Math.round(densityMult)); i++) {
        spawnParticleSafe(dimension, "minecraft:crit_particle", {
          x: center.x + rand(-capRadius, capRadius),
          y: center.y + rand(1, stemHeight),
          z: center.z + rand(-capRadius, capRadius),
        });
      }
    }, n * 2);
  }
}

/**
 * 爆心地に残留する放射能ダメージ。
 * ゾーン内にいる間は一定間隔でウィザー効果を「塗り直す」だけでなく、
 * 塗り直すたびに lingerTicks 分の残り時間を与えるので、
 * ゾーンを一瞬でも通過すればその後ゾーンの外に出ても
 * 最低 lingerTicks 分は被曝ダメージが継続する(=放射能に汚染された扱い)。
 * 追加の爆発は一切起こさないので、何回重ねても処理は軽いまま。
 */
export function radiationZone(dimension, center, opts) {
  const radius = opts.radius ?? 6;
  const duration = opts.duration ?? 600; // ゾーン自体が持続する時間 (tick)
  const amplifier = opts.amplifier ?? 0;
  const lingerTicks = opts.lingerTicks ?? 300; // ゾーンを出た後も保証される被曝時間 (tick)
  const tickInterval = 20;
  let elapsed = 0;
  const id = system.runInterval(() => {
    elapsed += tickInterval;
    for (const ent of nearbyEntities(dimension, center, radius)) {
      try {
        ent.addEffect("minecraft:wither", lingerTicks, { amplifier, showParticles: true });
      } catch (err) {}
    }
    try {
      dimension.spawnParticle("minecraft:mob_spell_particle", {
        x: center.x + (Math.random() - 0.5) * radius * 1.6,
        y: center.y + 0.3,
        z: center.z + (Math.random() - 0.5) * radius * 1.6,
      });
    } catch (err) {}
    if (elapsed >= duration) system.clearRun(id);
  }, tickInterval);
}

/**
 * 核系爆発の「体感」を作る: 周囲プレイヤーの画面を揺らし、
 * 通常の爆発音に低いピッチの爆発音を重ねて重低音のドォンを演出する。
 */
export function nukeImpact(dimension, center, radius, intensity, seconds) {
  try {
    const x = Math.floor(center.x);
    const y = Math.floor(center.y);
    const z = Math.floor(center.z);
    dimension.runCommand(
      `camerashake add @a[x=${x},y=${y},z=${z},r=${radius}] ${intensity} ${seconds} positional`
    );
  } catch (err) {}
  try {
    dimension.playSound("random.explode", center, { volume: 6, pitch: 0.55 });
  } catch (err) {}
  system.runTimeout(() => {
    try {
      dimension.playSound("random.explode", center, { volume: 5, pitch: 0.4 });
    } catch (err) {}
  }, 4);
}
