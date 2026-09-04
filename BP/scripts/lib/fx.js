/**
 * 見せ場を作るための道具。パーティクル・音・画面揺れ。
 *
 * 効果の中身 (何を壊すか、誰を傷つけるか) とは切り離してある。
 * どのTNTも「効果」と「演出」を別々に組み立てられるようにするため。
 */
import { system } from "@minecraft/server";
import { rand, randomInDisk, randomInSphere } from "./math.js";
import { ringPoints } from "./shapes.js";

/** パーティクル1つ。存在しないIDや読み込み外の座標でも落ちない */
export function particle(dimension, id, loc) {
  try {
    dimension.spawnParticle(id, loc);
    return true;
  } catch (err) {
    return false;
  }
}

/** 効果音。同上 */
export function sound(dimension, id, loc, options = undefined) {
  try {
    dimension.playSound(id, loc, options);
    return true;
  } catch (err) {
    return false;
  }
}

/** 球状にばらまくパーティクル */
export function burst(dimension, id, center, { count = 10, radius = 3 } = {}) {
  for (let i = 0; i < count; i++) particle(dimension, id, randomInSphere(center, radius));
}

/** 地面に沿って円盤状にばらまくパーティクル */
export function scatter(dimension, id, center, { count = 10, radius = 3, height = 2 } = {}) {
  for (let i = 0; i < count; i++) particle(dimension, id, randomInDisk(center, radius, height));
}

/** 水平の輪 */
export function ring(dimension, id, center, radius, { count = 16, y = 0, spin = 0, jitter = 0.2 } = {}) {
  for (const p of ringPoints(center, radius, count, { y, spin, jitter })) particle(dimension, id, p);
}

/** 上へ伸びる光の柱。step tick ごとに1段ずつ伸びる */
export function pillar(dimension, id, center, { height = 20, step = 2, spread = 0.8, perStep = 1 } = {}) {
  for (let h = 0; h < height; h++) {
    later(step * h, () => {
      for (let i = 0; i < perStep; i++) {
        particle(dimension, id, {
          x: center.x + rand(-spread, spread),
          y: center.y + h,
          z: center.z + rand(-spread, spread),
        });
      }
    });
  }
}

/** 外へ広がっていく衝撃波の輪 */
export function shockRing(dimension, id, center, { radius = 12, steps = 12, y = 0.5, every = 2 } = {}) {
  for (let s = 1; s <= steps; s++) {
    const r = (radius * s) / steps;
    later(s * every, () => ring(dimension, id, center, r, { count: Math.max(8, Math.round(r * 2)), y }));
  }
}

/**
 * 周囲のプレイヤーの画面を揺らす。
 * 半径の指定にコマンドを使うのは、スクリプトAPIに同等のものが無いため。
 */
export function shake(dimension, center, { radius = 40, intensity = 0.6, seconds = 1.5 } = {}) {
  const x = Math.floor(center.x), y = Math.floor(center.y), z = Math.floor(center.z);
  try {
    dimension.runCommand(
      `camerashake add @a[x=${x},y=${y},z=${z},r=${Math.round(radius)}] ${intensity} ${seconds} positional`
    );
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * 重低音の爆発音。通常の爆発音にピッチを下げた音を重ねて、
 * 「遠くまで届く大きさ」を耳で分かるようにする。
 */
export function deepBoom(dimension, center, { volume = 6, pitch = 0.55 } = {}) {
  sound(dimension, "random.explode", center, { volume, pitch });
  later(4, () => sound(dimension, "random.explode", center, { volume: volume - 1, pitch: pitch - 0.15 }));
}

/** delay tick 後に実行する。タイマーが取れなければその場で実行する */
export function later(delay, fn) {
  if (delay <= 0) {
    try {
      fn();
    } catch (err) {}
    return;
  }
  try {
    system.runTimeout(() => {
      try {
        fn();
      } catch (err) {}
    }, delay);
  } catch (err) {
    try {
      fn();
    } catch (err2) {}
  }
}

/**
 * 一定間隔で count 回だけ繰り返す。
 * 回数を決めて呼ぶ形にしておくと、止め忘れて延々回り続けることがない。
 * @param fn (回数, 進み具合 0〜1) => void。false を返すと途中で止まる
 */
export function repeat(count, interval, fn) {
  let i = 0;
  let id;
  const tick = () => {
    i++;
    let keepGoing = true;
    try {
      keepGoing = fn(i, i / count) !== false;
    } catch (err) {
      keepGoing = false;
    }
    if (!keepGoing || i >= count) {
      try {
        system.clearRun(id);
      } catch (err) {}
    }
  };
  try {
    id = system.runInterval(tick, interval);
  } catch (err) {
    for (let n = 0; n < count; n++) tick();
  }
  return () => {
    try {
      system.clearRun(id);
    } catch (err) {}
  };
}

/**
 * きのこ雲。実際の核爆発の段階を順番に再現する。
 *   1) 閃光         爆発直後、中心が真っ白に光る
 *   2) 火球の上昇   燃える球が膨らみながら立ち上る
 *   3) 幹           根本から太い煙が終始立ち上り続ける
 *   4) 傘           頂上でドーム状に外へ巻き広がる。下面は火に照らされる
 *   5) ベースサージ 地表を這って外へ広がる土煙の輪
 *   6) 火の粉       全体に舞う燃えかす
 * パーティクルはすべて時間をずらして出すので、負荷の山はできない。
 */
export function mushroomCloud(dimension, center, opts = {}) {
  const stemHeight = opts.stemHeight ?? 12;
  const capRadius = opts.capRadius ?? 10;
  const duration = opts.duration ?? 60;
  const linger = opts.lingerTicks ?? 140;
  const density = opts.densityMult ?? 1;
  const stemRadius = Math.max(1.5, capRadius * 0.18);

  // 1) 閃光
  for (let n = 0; n < 16; n++) {
    later(Math.floor(n / 5), () =>
      particle(dimension, "minecraft:huge_explosion_emitter", randomInSphere({ ...center, y: center.y + 2 }, 3))
    );
  }

  // 2) 火球の上昇
  const riseT = Math.max(10, Math.floor(duration * 0.35));
  for (let t = 0; t <= riseT; t += 2) {
    const prog = t / riseT;
    const y = center.y + stemHeight * prog;
    const r = 1.5 + (stemRadius + 1.5) * prog;
    later(t, () => {
      const hub = { x: center.x, y, z: center.z };
      for (let i = 0; i < Math.round(10 * density); i++) {
        particle(dimension, "minecraft:basic_flame_particle", randomInDisk(hub, r));
      }
      particle(dimension, "minecraft:huge_explosion_emitter", { x: center.x + rand(-1, 1), y, z: center.z + rand(-1, 1) });
    });
  }

  // 3) 幹。形成が終わった後も薄くなりつつ供給し続ける
  for (let t = 0; t <= duration + linger; t += 2) {
    const fade = t > duration ? Math.max(0.15, 1 - (t - duration) / linger) : 1;
    const count = Math.max(1, Math.round(7 * fade * density));
    later(t, () => {
      for (let i = 0; i < count; i++) {
        const p = randomInDisk(center, stemRadius);
        p.y = center.y + Math.random() * stemHeight * 0.9;
        particle(dimension, "minecraft:campfire_smoke_particle", p);
      }
    });
  }

  // 4) 傘
  const capSteps = 16;
  for (let s = 0; s <= capSteps; s++) {
    const prog = s / capSteps;
    const r = capRadius * (0.25 + 0.75 * prog);
    later(riseT + Math.floor((duration - riseT) * prog * 0.8), () => {
      const pts = Math.round((14 + r * 1.8) * density);
      for (let p = 0; p < pts; p++) {
        const a = (Math.PI * 2 * p) / pts + Math.random() * 0.3;
        const jitter = rand(-0.8, 0.8);
        particle(dimension, "minecraft:campfire_smoke_particle", {
          x: center.x + Math.cos(a) * (r + jitter),
          y: center.y + stemHeight + Math.max(0, (1 - prog) * capRadius * 0.25) + rand(0, 1.5),
          z: center.z + Math.sin(a) * (r + jitter),
        });
        if (p % 2 === 0) {
          particle(dimension, "minecraft:basic_flame_particle", {
            x: center.x + Math.cos(a) * r * 0.85,
            y: center.y + stemHeight - 1 + rand(-0.5, 0.5),
            z: center.z + Math.sin(a) * r * 0.85,
          });
        }
      }
    });
  }

  // 4.5) 傘を維持する。これが無いと数秒で雲が消えてしまう
  const lingerSteps = Math.max(4, Math.floor(linger / 8));
  for (let s = 0; s <= lingerSteps; s++) {
    const fade = Math.max(0.2, 1 - s / lingerSteps);
    later(duration + s * 8, () => {
      const pts = Math.max(6, Math.floor(capRadius * 1.4 * fade * density));
      for (let p = 0; p < pts; p++) {
        const q = randomInDisk({ x: center.x, y: center.y + stemHeight, z: center.z }, capRadius);
        q.y += rand(-0.5, 2);
        particle(dimension, "minecraft:campfire_smoke_particle", q);
      }
    });
  }

  // 5) ベースサージ
  const surgeSteps = 14;
  for (let s = 0; s <= surgeSteps; s++) {
    const prog = s / surgeSteps;
    const r = capRadius * 1.6 * prog + 2;
    later(Math.floor(prog * duration * 0.4), () =>
      ring(dimension, "minecraft:basic_smoke_particle", center, r, {
        count: Math.round((16 + r * 1.5) * density),
        y: 0.5 + Math.random(),
        jitter: 0.4,
      })
    );
  }

  // 6) 火の粉
  for (let n = 0; n < Math.floor((duration + linger) / 2); n++) {
    later(n * 2, () => {
      for (let i = 0; i < Math.max(1, Math.round(density)); i++) {
        particle(dimension, "minecraft:basic_crit_particle", {
          x: center.x + rand(-capRadius, capRadius),
          y: center.y + rand(1, stemHeight),
          z: center.z + rand(-capRadius, capRadius),
        });
      }
    });
  }
}
