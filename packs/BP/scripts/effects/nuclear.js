import { system } from "@minecraft/server";
import { queueExplosion, runBlockJob } from "../core/scheduler.js";
import { clearSphere, terrainAllowed } from "../core/safety.js";
import { nearbyEntities, knockbackFrom, addEffect } from "../core/entities.js";
import { announce, msg, tntName } from "../systems/i18n.js";
import { attempt } from "../util/log.js";
import { rand, shuffle } from "../util/math.js";
import { particle, spellColor } from "./common.js";
import { fireEffect } from "./elemental.js";
import { ARMAGEDDON_POOL, EFFECTS, effectOwner } from "./index.js";

/* ==================================================================== */
/*  核系TNT (核・超核・水素爆弾・ツァーリボンバ・反物質・終焉)            */
/*                                                                      */
/*  爆発の負荷について: 爆発はすべてスケジューラー経由で「1tickに1発」。  */
/*  クレーターの地形破壊は fillBlocks を行単位で呼ぶ方式にして高速化し、  */
/*  未ロードのチャンクには触らない (B18)。                                */
/* ==================================================================== */

/**
 * リアル志向のきのこ雲。実際の核爆発の段階を順番に再現する:
 *  1) 閃光 2) 火球の上昇 3) 幹(スモーク柱) 4) 傘 5) ベースサージ 6) 火の粉
 * パーティクルはすべて時間分散で発生させるので負荷の山はできない。
 */
export function mushroomCloud(dimension, center, opts = {}) {
  const stemHeight = opts.stemHeight ?? 12;
  const capRadius = opts.capRadius ?? 10;
  const duration = opts.duration ?? 60;
  const lingerTicks = opts.lingerTicks ?? 140; // 完成後もこの時間だけ雲を維持する
  const densityMult = opts.densityMult ?? 1;
  const stemRadius = Math.max(1.5, capRadius * 0.18);
  const P = (id, loc) => particle(dimension, id, loc);

  // 1) 閃光
  for (let n = 0; n < 16; n++) {
    system.runTimeout(() => {
      P("minecraft:huge_explosion_emitter", { x: center.x + rand(-3, 3), y: center.y + rand(0, 4), z: center.z + rand(-3, 3) });
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
        P("minecraft:basic_flame_particle", { x: center.x + Math.cos(a) * rr, y: y + rand(-1, 1), z: center.z + Math.sin(a) * rr });
      }
      P("minecraft:huge_explosion_emitter", { x: center.x + rand(-1, 1), y, z: center.z + rand(-1, 1) });
    }, t);
  }

  // 3) 幹のスモーク柱 (形成後も lingerTicks の間、薄くなりつつ供給し続ける)
  const stemTotal = duration + lingerTicks;
  for (let t = 0; t <= stemTotal; t += 2) {
    const fadeOut = t > duration ? Math.max(0.15, 1 - (t - duration) / lingerTicks) : 1;
    const count = Math.max(1, Math.round(7 * fadeOut * densityMult));
    system.runTimeout(() => {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const rr = stemRadius * Math.sqrt(Math.random());
        P("minecraft:campfire_smoke_particle", {
          x: center.x + Math.cos(a) * rr,
          y: center.y + Math.random() * stemHeight * 0.9,
          z: center.z + Math.sin(a) * rr,
        });
      }
    }, t);
  }

  // 4) 傘: 頂上でドーム状に外へ巻き広がる
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
        P("minecraft:campfire_smoke_particle", {
          x: center.x + Math.cos(a) * (r + jitter),
          y: center.y + stemHeight + Math.max(0, (1 - prog) * capRadius * 0.25) + rand(0, 1.5),
          z: center.z + Math.sin(a) * (r + jitter),
        });
        if (p % 2 === 0) {
          P("minecraft:basic_flame_particle", {
            x: center.x + Math.cos(a) * r * 0.85,
            y: center.y + stemHeight - 1 + rand(-0.5, 0.5),
            z: center.z + Math.sin(a) * r * 0.85,
          });
        }
      }
    }, t);
  }

  // 4.5) 傘の維持フェーズ
  const capLingerSteps = Math.max(4, Math.floor(lingerTicks / 8));
  for (let s = 0; s <= capLingerSteps; s++) {
    const fadeOut = Math.max(0.2, 1 - s / capLingerSteps);
    system.runTimeout(() => {
      const pts = Math.max(6, Math.floor(capRadius * 1.4 * fadeOut * densityMult));
      for (let p = 0; p < pts; p++) {
        const a = Math.random() * Math.PI * 2;
        const r = capRadius * (0.3 + 0.7 * Math.sqrt(Math.random()));
        P("minecraft:campfire_smoke_particle", { x: center.x + Math.cos(a) * r, y: center.y + stemHeight + rand(-0.5, 2), z: center.z + Math.sin(a) * r });
      }
    }, duration + s * 8);
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
        P("minecraft:basic_smoke_particle", { x: center.x + Math.cos(a) * r, y: center.y + 0.5 + Math.random(), z: center.z + Math.sin(a) * r });
      }
    }, Math.floor(prog * duration * 0.4));
  }

  // 6) 火の粉
  for (let n = 0; n < Math.floor((duration + lingerTicks) / 2); n++) {
    system.runTimeout(() => {
      for (let i = 0; i < Math.max(1, Math.round(densityMult)); i++) {
        P("minecraft:crit_particle", {
          x: center.x + rand(-capRadius, capRadius),
          y: center.y + rand(1, stemHeight),
          z: center.z + rand(-capRadius, capRadius),
        });
      }
    }, n * 2);
  }
}

/** 広範囲の爆風の余波で生き物を吹き飛ばす (B03: 水平と垂直を分けて指定) */
export function shockwaveKnockback(dimension, center, radius, maxStrength) {
  for (const ent of nearbyEntities(dimension, center, radius, "all")) {
    attempt("shockwave", () => {
      const dx = ent.location.x - center.x;
      const dz = ent.location.z - center.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const falloff = Math.max(0.15, 1 - dist / radius);
      knockbackFrom(ent, center, maxStrength * falloff, 0.25 + 0.1 * maxStrength * falloff);
    });
  }
}

/**
 * 爆心地に残留する放射能。ゾーン内にいる間はウィザー効果を塗り直し、
 * 一瞬でも通過すれば lingerTicks 分は被曝が続く。追加の爆発は起こさない。
 */
export function radiationZone(dimension, center, opts) {
  const radius = opts.radius ?? 6;
  const duration = opts.duration ?? 600;
  const amplifier = opts.amplifier ?? 0;
  const lingerTicks = opts.lingerTicks ?? 300;
  const tickInterval = 20;
  const green = spellColor(0.4, 0.9, 0.2);
  let elapsed = 0;
  const id = system.runInterval(() => {
    elapsed += tickInterval;
    for (const ent of nearbyEntities(dimension, center, radius, "living")) {
      addEffect(ent, "minecraft:wither", lingerTicks, amplifier, true);
    }
    particle(
      dimension,
      "minecraft:mob_spell_particle",
      { x: center.x + (Math.random() - 0.5) * radius * 1.6, y: center.y + 0.3, z: center.z + (Math.random() - 0.5) * radius * 1.6 },
      green
    );
    if (elapsed >= duration) system.clearRun(id);
  }, tickInterval);
}

/**
 * 壁を無視して届く直接ダメージ。熱線 (即時) と爆風の到達 (少し遅れて半分 + 打ち上げ)。
 * 体力のある生き物だけが対象 (B20)。
 */
export function irradiateEntities(dimension, center, radius, maxDamage) {
  const pulse = (damageScale, launch) => {
    for (const ent of nearbyEntities(dimension, center, radius, "living")) {
      attempt("irradiate", () => {
        const loc = ent.location;
        const dx = loc.x - center.x;
        const dy = loc.y - center.y;
        const dz = loc.z - center.z;
        const falloff = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy + dz * dz) / radius);
        ent.applyDamage(Math.max(2, maxDamage * damageScale * falloff), { cause: "entityExplosion" });
        if (launch && falloff > 0.15) ent.applyImpulse({ x: 0, y: 0.6 * falloff, z: 0 });
      });
    }
  };
  pulse(1.0, false);
  system.runTimeout(() => pulse(0.5, true), 8);
}

/**
 * すり鉢状のクレーター。
 * 中心から外側へ何重ものリング状に破壊点を並べ、角度と半径にジッターを入れて
 * 「隙間なく埋まっているが、完全な円ではない」形にする。
 * 各点では clearSphere で耐爆性を無視して確実に削り、同じ場所に控えめな
 * 本物の爆発も重ねて、焦げ跡や音など本物らしい質感を足す。
 */
export function craterBurst(dimension, center, opts, scale = 1) {
  // 威力倍率を上げても、処理が際限なく増えないよう上限を掛ける
  const radius = Math.min(200, Math.max(4, Math.round(opts.radius * scale)));
  const count = Math.min(800, Math.max(8, Math.round(opts.count * scale * scale)));
  const { basePower, coreCount = 3, dome = 3, pointRadius = 3 } = opts;
  const corePower = (opts.corePower || basePower + 6) * scale;
  const terrain = terrainAllowed();
  const explosionOpts = { breaksBlocks: terrain, causesFire: terrain, allowUnderwater: true };

  // フェーズ1: 爆心地への集中爆発
  for (let i = 0; i < coreCount; i++) {
    const ox = i === 0 ? 0 : rand(-2, 2);
    const oz = i === 0 ? 0 : rand(-2, 2);
    queueExplosion(dimension, { x: center.x + ox, y: center.y - dome * 0.5 + rand(-0.5, 1), z: center.z + oz }, corePower, explosionOpts);
  }

  // フェーズ2: リング状に密集配置した破壊点
  const ringCount = Math.max(3, Math.round(Math.sqrt(count)));
  const points = [];
  for (let ring = 1; ring <= ringCount; ring++) {
    const ringFrac = ring / ringCount;
    const ringR = radius * ringFrac;
    const ptsInRing = Math.max(4, Math.round((count * (2 * ring - 1)) / (ringCount * ringCount)));
    for (let p = 0; p < ptsInRing; p++) {
      const angle = (2 * Math.PI * p) / ptsInRing + rand(-0.4, 0.4);
      const rJitter = ringR + rand(-radius * 0.08, radius * 0.08);
      if (ringFrac > 0.8 && Math.random() < (ringFrac - 0.8) * 3.5) continue; // 外周を間引く
      points.push({ ox: Math.cos(angle) * rJitter, oz: Math.sin(angle) * rJitter, r: ringR });
    }
  }
  points.sort((a, b) => a.r - b.r); // 内側から外側へ

  runBlockJob("crater", function* () {
    for (const pt of points) {
      const domeY = -dome * (1 - Math.pow(pt.r / radius, 1.3)) + rand(-0.8, 0.8);
      const loc = { x: center.x + pt.ox, y: center.y + domeY, z: center.z + pt.oz };
      yield* clearSphere(dimension, loc, pointRadius);
      queueExplosion(dimension, loc, Math.max(4, pointRadius * 1.5), explosionOpts);
    }
  });
}

/** 画面の揺れと重低音 */
export function nukeImpact(dimension, center, radius, intensity, seconds) {
  attempt("camerashake", () => {
    const x = Math.floor(center.x);
    const y = Math.floor(center.y);
    const z = Math.floor(center.z);
    dimension.runCommand(`camerashake add @a[x=${x},y=${y},z=${z},r=${radius}] ${intensity} ${seconds} positional`);
  });
  attempt("boom", () => dimension.playSound("random.explode", center, { volume: 6, pitch: 0.55 }));
  system.runTimeout(() => attempt("boom2", () => dimension.playSound("random.explode", center, { volume: 5, pitch: 0.4 })), 4);
}

/** 核系の閃光: 近くのプレイヤーの画面を一瞬白くする */
export function flash(dimension, center, radius) {
  attempt("flash", () => {
    const x = Math.floor(center.x);
    const y = Math.floor(center.y);
    const z = Math.floor(center.z);
    dimension.runCommand(`camera @a[x=${x},y=${y},z=${z},r=${radius}] fade time 0.1 0.4 1.2 color 255 255 255`);
  });
}

function nuclearBlast(dimension, center, ctx, p) {
  const scale = ctx?.scale ?? 1;
  flash(dimension, center, p.impactRadius);
  mushroomCloud(dimension, center, p.cloud);
  fireEffect(dimension, center, { radius: p.fireRadius });
  radiationZone(dimension, center, p.radiation);
  shockwaveKnockback(dimension, center, p.shock[0] * scale, p.shock[1]);
  irradiateEntities(dimension, center, p.irradiate[0] * scale, p.irradiate[1]);
  craterBurst(dimension, center, p.crater, scale);
  nukeImpact(dimension, center, p.impactRadius, p.shake[0], p.shake[1]);
}

export function nukeEffect(dimension, center, ctx) {
  announce(msg("nuke_blast"));
  nuclearBlast(dimension, center, ctx, {
    cloud: { stemHeight: 14, capRadius: 10, duration: 60, lingerTicks: 140, densityMult: 1.0 },
    fireRadius: 6,
    radiation: { radius: 8, duration: 600, amplifier: 0, lingerTicks: 300 },
    shock: [18, 1.5],
    irradiate: [20, 35],
    crater: { radius: 18, count: 20, basePower: 12, coreCount: 4, corePower: 18, dome: 3, pointRadius: 3 },
    impactRadius: 50,
    shake: [0.6, 1.8],
  });
}

export function ultraNukeEffect(dimension, center, ctx) {
  announce(msg("ultra_nuke_blast"));
  nuclearBlast(dimension, center, ctx, {
    cloud: { stemHeight: 22, capRadius: 17, duration: 90, lingerTicks: 180, densityMult: 1.3 },
    fireRadius: 10,
    radiation: { radius: 13, duration: 1000, amplifier: 1, lingerTicks: 500 },
    shock: [30, 2.0],
    irradiate: [30, 50],
    crater: { radius: 40, count: 50, basePower: 15, coreCount: 5, corePower: 23, dome: 4, pointRadius: 4 },
    impactRadius: 75,
    shake: [0.8, 2.6],
  });
}

export function hydrogenBombEffect(dimension, center, ctx) {
  announce(msg("hydrogen_blast"));
  nuclearBlast(dimension, center, ctx, {
    cloud: { stemHeight: 34, capRadius: 27, duration: 130, lingerTicks: 220, densityMult: 1.6 },
    fireRadius: 14,
    radiation: { radius: 20, duration: 1800, amplifier: 2, lingerTicks: 1200 },
    shock: [46, 2.6],
    irradiate: [42, 70],
    crater: { radius: 72, count: 128, basePower: 19, coreCount: 6, corePower: 29, dome: 5, pointRadius: 5 },
    impactRadius: 110,
    shake: [0.95, 3.5],
  });
}

/**
 * ツァーリボンバ(弱体化前の100メガトン版)。
 * 実際の規模 (全壊半径 約44km) を1ブロック=1mで再現するのは不可能なので、
 * このアドオンの中で最大級の演出にしてスケール感を表現している。
 */
export function tsarBombaEffect(dimension, center, ctx) {
  announce(msg("tsar_blast"));
  announce(msg("tsar_fact"));
  nuclearBlast(dimension, center, ctx, {
    cloud: { stemHeight: 48, capRadius: 38, duration: 170, lingerTicks: 260, densityMult: 2.0 },
    fireRadius: 18,
    radiation: { radius: 28, duration: 2400, amplifier: 3, lingerTicks: 2400 },
    shock: [70, 3.4],
    irradiate: [60, 95],
    crater: { radius: 115, count: 270, basePower: 24, coreCount: 7, corePower: 36, dome: 6, pointRadius: 6 },
    impactRadius: 160,
    shake: [1.0, 5.0],
  });
}

/** 反物質爆弾。対消滅を再現した、このアドオン最大の一撃 */
export function antimatterEffect(dimension, center, ctx) {
  announce(msg("antimatter_blast"));
  nuclearBlast(dimension, center, ctx, {
    cloud: { stemHeight: 64, capRadius: 50, duration: 200, lingerTicks: 300, densityMult: 2.5 },
    fireRadius: 22,
    radiation: { radius: 36, duration: 6000, amplifier: 4, lingerTicks: 3600 },
    shock: [90, 3.8],
    irradiate: [80, 110],
    crater: { radius: 175, count: 524, basePower: 30, coreCount: 9, corePower: 44, dome: 8, pointRadius: 7 },
    impactRadius: 220,
    shake: [1.0, 6.0],
  });
}

/**
 * 終焉TNT: 核級の爆発に加え、ランダムな効果を4〜5個時間差で連続発動する。
 * 発動した効果は「どのTNTの効果か」を名前で表示する (B13)。
 */
export function armageddonEffect(dimension, center, ctx) {
  announce(msg("armageddon_blast"));
  nuclearBlast(dimension, center, ctx, {
    cloud: { stemHeight: 30, capRadius: 26, duration: 120, lingerTicks: 140, densityMult: 1 },
    fireRadius: 12,
    radiation: { radius: 18, duration: 600, amplifier: 2, lingerTicks: 300 },
    shock: [40, 2.6],
    irradiate: [34, 65],
    crater: { radius: 60, count: 60, basePower: 18, coreCount: 6, corePower: 20, dome: 5, pointRadius: 4 },
    impactRadius: 100,
    shake: [0.95, 3.2],
  });
  const picks = shuffle(ARMAGEDDON_POOL).slice(0, 4 + Math.floor(Math.random() * 2));
  picks.forEach((name, i) => {
    system.runTimeout(() => {
      const owner = effectOwner(name);
      if (owner) announce(msg("armageddon_step", String(i + 1), tntName(owner.id)));
      attempt(`armageddon ${name}`, () => EFFECTS[name](dimension, center, ctx));
    }, 30 + i * 25);
  });
}
