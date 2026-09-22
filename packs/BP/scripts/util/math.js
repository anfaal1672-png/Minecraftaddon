/* ------------------------------------------------------------------ */
/*  ベクトル計算・乱数などの小さなヘルパー                              */
/* ------------------------------------------------------------------ */
export function rand(a, b) {
  return a + Math.random() * (b - a);
}

export function randInt(a, b) {
  return a + Math.floor(Math.random() * (b - a + 1));
}

export function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

/** [{ value, weight }] から重み付きで1つ選ぶ。重みの合計が0なら undefined */
export function weightedPick(entries, random = Math.random) {
  let total = 0;
  for (const e of entries) total += Math.max(0, e.weight);
  if (total <= 0) return undefined;
  let r = random() * total;
  for (const e of entries) {
    r -= Math.max(0, e.weight);
    if (r < 0) return e.value;
  }
  return entries[entries.length - 1].value;
}

export function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function distSq(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

export function floorLoc(loc) {
  return { x: Math.floor(loc.x), y: Math.floor(loc.y), z: Math.floor(loc.z) };
}

export function centerOf(blockLoc) {
  return { x: blockLoc.x + 0.5, y: blockLoc.y, z: blockLoc.z + 0.5 };
}

export function offset(loc, dx, dy, dz) {
  return { x: loc.x + dx, y: loc.y + dy, z: loc.z + dz };
}

export function locKey(dimensionId, loc) {
  return `${dimensionId}:${Math.floor(loc.x)},${Math.floor(loc.y)},${Math.floor(loc.z)}`;
}

/** 視線ベクトルを東西南北の単位ベクトルに丸める */
export function cardinal(dir) {
  if (!dir) return { x: 1, z: 0 };
  if (Math.abs(dir.x) >= Math.abs(dir.z)) return { x: Math.sign(dir.x) || 1, z: 0 };
  return { x: 0, z: Math.sign(dir.z) || 1 };
}

export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
