/**
 * 形の計算。座標を作るだけで、ブロックにもエンティティにも触らない。
 *
 * 「球状に消す」「円状に置く」といった処理は、形を決める部分と
 * それを世界に書き込む部分が混ざると途端に読めなくなる。
 * 形はここで作り、書き込みは lib/terrain.js が受け持つ。
 */
import { rand } from "./math.js";

/**
 * 球を、縦1列ずつの集まりとして表す。
 *
 * 戻り値の1件は「中心から (dx, dz) ずれた柱を、上下 h ブロックぶん」の意味。
 * 球をマス単位で列挙すると半径80で200万件になるが、柱にまとめれば2万件で済み、
 * さらに1列ぶんは fillBlocks 1回で書き込める。
 *
 * @param radius 半径
 * @param jitter 上下の縁をがたつかせる量。0 でつるつるの球になる
 * @param ragged この割合より外側は、確率的に欠けさせる (輪郭をぼかす)
 * @returns 中心に近い順に並んだ [{ dx, dz, h, frac }]
 */
export function sphereColumns(radius, { jitter = 1.2, ragged = 0.86 } = {}) {
  const R = Math.max(1, Math.round(radius));
  const columns = [];
  for (let dx = -R; dx <= R; dx++) {
    for (let dz = -R; dz <= R; dz++) {
      const flat2 = dx * dx + dz * dz;
      const h2 = R * R - flat2;
      if (h2 < 0) continue;
      const frac = Math.sqrt(flat2) / R;
      if (ragged < 1 && frac > ragged && Math.random() < (frac - ragged) / (1 - ragged)) continue;
      const h = Math.round(Math.sqrt(h2) + (jitter ? rand(-jitter, jitter) : 0));
      if (h < 0) continue;
      columns.push({ dx, dz, h, frac });
    }
  }
  // 中心から外へ広がっていくように見せる
  columns.sort((a, b) => a.frac - b.frac);
  return columns;
}

/**
 * 円盤 (水平の円) のマス。
 * @returns 中心に近い順に並んだ [{ dx, dz, d2, frac }]
 */
export function diskCells(radius, { ragged = 1 } = {}) {
  const R = Math.max(1, Math.round(radius));
  const cells = [];
  for (let dx = -R; dx <= R; dx++) {
    for (let dz = -R; dz <= R; dz++) {
      const d2 = dx * dx + dz * dz;
      if (d2 > R * R) continue;
      const frac = Math.sqrt(d2) / R;
      if (ragged < 1 && frac > ragged && Math.random() < (frac - ragged) / (1 - ragged)) continue;
      cells.push({ dx, dz, d2, frac });
    }
  }
  cells.sort((a, b) => a.d2 - b.d2);
  return cells;
}

/**
 * 球の殻 (中身を抜いた球の表面) のマス。ドームを張るのに使う。
 * @param thickness 殻の厚み (ブロック)
 */
export function shellOffsets(radius, thickness = 1) {
  const R = Math.max(1, Math.round(radius));
  const inner = Math.max(0, R - thickness);
  const out = [];
  for (let dx = -R; dx <= R; dx++) {
    for (let dy = -R; dy <= R; dy++) {
      for (let dz = -R; dz <= R; dz++) {
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > R * R || d2 < inner * inner) continue;
        out.push({ dx, dy, dz });
      }
    }
  }
  return out;
}

/**
 * 水平の円周上に等間隔で並ぶ点。パーティクルの輪に使う。
 * @param spin 回すと渦になる
 */
export function ringPoints(center, radius, count, { y = 0, spin = 0, jitter = 0 } = {}) {
  const points = [];
  for (let i = 0; i < count; i++) {
    const angle = spin + (Math.PI * 2 * i) / count + (jitter ? rand(-jitter, jitter) : 0);
    points.push({
      x: center.x + Math.cos(angle) * radius,
      y: center.y + y,
      z: center.z + Math.sin(angle) * radius,
    });
  }
  return points;
}

/** 上へ伸びる螺旋。ビームや光の柱に使う */
export function helixPoints(center, { radius, height, turns = 3, steps = 24 }) {
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const angle = t * Math.PI * 2 * turns;
    points.push({
      x: center.x + Math.cos(angle) * radius,
      y: center.y + height * t,
      z: center.z + Math.sin(angle) * radius,
    });
  }
  return points;
}
