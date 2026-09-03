/**
 * 乱数・距離・パーティクル・音といった、どこからでも使う小物。
 */
/** a 以上 b 未満の乱数 */
export function rand(a, b) {
  return a + Math.random() * (b - a);
}

/** 2点間の距離の二乗 (平方根を取らないぶん速い) */
export function distSq(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

/** パーティクル。存在しないIDや読み込み外の座標でも落ちないようにする */
export function spawnParticleSafe(dimension, id, loc) {
  try {
    dimension.spawnParticle(id, loc);
  } catch (err) {}
}

/** 効果音。同上 */
export function playSoundSafe(dimension, soundId, loc) {
  try {
    dimension.playSound(soundId, loc);
  } catch (err) {}
}
