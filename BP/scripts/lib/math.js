/**
 * 乱数・ベクトル・座標まわりの小物。
 *
 * ここにあるものは Minecraft の API を一切呼ばない。
 * そのぶんテストで気軽に呼べるし、読むときも副作用を気にしなくてよい。
 */

/** a 以上 b 未満の実数 */
export function rand(a, b) {
  return a + Math.random() * (b - a);
}

/** a 以上 b 以下の整数 */
export function randInt(a, b) {
  return a + Math.floor(Math.random() * (b - a + 1));
}

/** 配列から1つ選ぶ */
export function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

/** 元の配列を壊さずに並びを混ぜる */
export function shuffled(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** lo 〜 hi に収める */
export function clamp(value, lo, hi) {
  return value < lo ? lo : value > hi ? hi : value;
}

/** 2点間の距離の二乗 (平方根を取らないぶん速い) */
export function distSq(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

export function dist(a, b) {
  return Math.sqrt(distSq(a, b));
}

/** from から to へ向かう長さ1のベクトル。同じ位置なら真上を返す */
export function direction(from, to) {
  const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (len < 1e-6) return { x: 0, y: 1, z: 0 };
  return { x: dx / len, y: dy / len, z: dz / len };
}

/** 水平方向だけの長さ1のベクトル */
export function horizontalDirection(from, to) {
  const dx = to.x - from.x, dz = to.z - from.z;
  const len = Math.sqrt(dx * dx + dz * dz);
  if (len < 1e-6) {
    const a = Math.random() * Math.PI * 2;
    return { x: Math.cos(a), z: Math.sin(a) };
  }
  return { x: dx / len, z: dz / len };
}

export function scale(vec, k) {
  return { x: vec.x * k, y: (vec.y ?? 0) * k, z: vec.z * k };
}

export function add(a, b) {
  return { x: a.x + b.x, y: (a.y ?? 0) + (b.y ?? 0), z: a.z + b.z };
}

/** ブロック座標に丸める */
export function blockPos(loc) {
  return { x: Math.floor(loc.x), y: Math.floor(loc.y), z: Math.floor(loc.z) };
}

/** ブロック座標をそのマスの中心に */
export function blockCenter(loc) {
  return { x: Math.floor(loc.x) + 0.5, y: Math.floor(loc.y), z: Math.floor(loc.z) + 0.5 };
}

/** 中心から半径 r 以内のランダムな位置 (面積で一様) */
export function randomInDisk(center, radius, yJitter = 0) {
  const angle = Math.random() * Math.PI * 2;
  const r = radius * Math.sqrt(Math.random());
  return {
    x: center.x + Math.cos(angle) * r,
    y: center.y + (yJitter ? rand(0, yJitter) : 0),
    z: center.z + Math.sin(angle) * r,
  };
}

/** 中心から半径 r 以内のランダムな位置 (球の体積で一様) */
export function randomInSphere(center, radius) {
  const u = Math.random();
  const r = radius * Math.cbrt(u);
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  return {
    x: center.x + r * Math.sin(phi) * Math.cos(theta),
    y: center.y + r * Math.cos(phi),
    z: center.z + r * Math.sin(phi) * Math.sin(theta),
  };
}

/** 距離に応じて 1 → 0 へ落ちる係数 */
export function falloff(distance, radius) {
  if (radius <= 0) return 0;
  return clamp(1 - distance / radius, 0, 1);
}
