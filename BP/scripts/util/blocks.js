/**
 * ブロックを置き換える処理と、クレーターの掘削。
 */
import { system } from "@minecraft/server";
import { rand } from "./common.js";

/**
 * クレーターの掘削で「壊さない」ブロック。
 * 岩盤やコマンドブロックのような壊されては困るものと、
 * 消すと不自然になる水・溶岩を除いてある。
 */
export const INDESTRUCTIBLE_BLOCKS = new Set([
  "minecraft:bedrock",
  "minecraft:barrier",
  "minecraft:end_portal_frame",
  "minecraft:end_portal",
  "minecraft:end_gateway",
  "minecraft:command_block",
  "minecraft:repeating_command_block",
  "minecraft:chain_command_block",
  "minecraft:structure_block",
  "minecraft:jigsaw",
  "minecraft:water",
  "minecraft:flowing_water",
  "minecraft:lava",
  "minecraft:flowing_lava",
]);

/** 指定した候補の中から、実際にセットできたブロックIDを返す */
export function trySetBlock(dimension, loc, candidates) {
  for (const id of candidates) {
    try {
      const b = dimension.getBlock(loc);
      if (!b) return false;
      b.setType(id);
      return true;
    } catch (err) {
      /* 次の候補を試す */
    }
  }
  return false;
}

/** 縦穴掘りや砂化など、単純な置き換えの 1tick あたりの上限 */
const BLOCK_BUDGET_PER_TICK = 2200;

/**
 * 掘削の 1tick あたりの上限。
 *
 * 「触ったマスの数」と「実際に置き換えたブロックの数」を別々に数える。
 * 空中は getBlock だけで済んで安いのに対し、setType は高くつくため、
 * 空が多い上半分は速く進み、地面の中では負荷が一定に保たれる。
 * どちらも規模に応じて少しだけ緩めるが、上限は必ず掛かる。
 */
function blastBudget(radius) {
  return {
    writes: Math.max(2200, Math.min(4000, Math.round(radius * 60))),
    cells: Math.max(8000, Math.min(22000, Math.round(radius * 240))),
  };
}

/**
 * 爆心地を中心に、球状にブロックを消す。
 *
 * 以前はすり鉢状に掘っていたが、それだと爆心地より上がほとんど残ってしまい、
 * 山の中や建物の中で使っても上半分が無傷で立っていた。
 * 本物の爆発と同じく上下どちらにも均等に広がる球にしてある。
 *
 * 柱 (x,z) ごとに「上下どこまで消すか」を先に決めるので、半径が大きくても
 * 覚えておくデータは水平の面積ぶんで済み、同じブロックを二度触ることもない。
 *
 * @param scorch 底に焼け焦げた地面を残すか
 * @param onDone すべて消し終わったときに呼ばれる
 */
export function carveBlastSphere(dimension, center, { radius, scorch = false, onDone } = {}) {
  const R = Math.max(1, Math.round(radius));
  const cx = Math.round(center.x);
  const cy = Math.round(center.y);
  const cz = Math.round(center.z);

  const columns = [];
  for (let dx = -R; dx <= R; dx++) {
    for (let dz = -R; dz <= R; dz++) {
      const flat2 = dx * dx + dz * dz;
      const h2 = R * R - flat2;
      if (h2 < 0) continue;
      const frac = Math.sqrt(flat2) / R;
      // 外周は確率的に間引いて、輪郭が完全な球にならないようにする
      if (frac > 0.86 && Math.random() < (frac - 0.86) / 0.14) continue;
      const h = Math.round(Math.sqrt(h2) + rand(-1.2, 1.2));
      if (h < 0) continue;
      columns.push({ dx, dz, h, frac });
    }
  }
  if (columns.length === 0) {
    if (onDone) onDone();
    return;
  }
  columns.sort((a, b) => a.frac - b.frac); // 中心から外へ広がっていくように見せる

  const limit = blastBudget(R);
  let i = 0;
  const runId = system.runInterval(() => {
    let writes = limit.writes;
    let cells = limit.cells;
    while (i < columns.length && writes > 0 && cells > 0) {
      const col = columns[i++];
      const x = cx + col.dx;
      const z = cz + col.dz;
      for (let dy = col.h; dy >= -col.h; dy--) {
        cells--;
        try {
          const b = dimension.getBlock({ x, y: cy + dy, z });
          if (!b || b.typeId === "minecraft:air" || INDESTRUCTIBLE_BLOCKS.has(b.typeId)) continue;
          b.setType("minecraft:air");
          writes--;
        } catch (err) {}
      }
      // 球の底を焼け焦げた地面にする
      if (scorch && Math.random() < 0.3) {
        try {
          const floor = dimension.getBlock({ x, y: cy - col.h - 1, z });
          if (floor && floor.typeId !== "minecraft:air" && !INDESTRUCTIBLE_BLOCKS.has(floor.typeId)) {
            floor.setType(Math.random() < 0.22 ? "minecraft:magma_block" : "minecraft:blackstone");
          }
        } catch (err) {}
      }
    }
    if (i >= columns.length) {
      system.clearRun(runId);
      if (onDone) {
        try {
          onDone();
        } catch (err) {}
      }
    }
  }, 1);
}

/** 球状にブロックを消す (carveBlastSphere の別名。焼け焦げは残さない) */
export function carveSphere(dimension, center, radius, { onDone } = {}) {
  carveBlastSphere(dimension, center, { radius, onDone });
}

/**
 * 太い縦穴を、上から下まで一気に貫く。
 * top/bottom は爆心地からの相対の高さ。
 */
export function carveShaft(dimension, center, { radius, top, bottom }) {
  const r = Math.max(1, Math.round(radius));
  const cx = Math.round(center.x);
  const cy = Math.round(center.y);
  const cz = Math.round(center.z);

  const columns = [];
  for (let dx = -r; dx <= r; dx++) {
    for (let dz = -r; dz <= r; dz++) {
      const d2 = dx * dx + dz * dz;
      if (d2 > r * r) continue;
      const frac = Math.sqrt(d2) / r;
      if (frac > 0.88 && Math.random() < (frac - 0.88) / 0.12) continue;
      columns.push({ dx, dz, d2 });
    }
  }
  columns.sort((a, b) => a.d2 - b.d2);

  let i = 0;
  const runId = system.runInterval(() => {
    let budget = BLOCK_BUDGET_PER_TICK;
    while (i < columns.length && budget > 0) {
      const col = columns[i++];
      for (let y = cy + top; y >= cy + bottom && budget > 0; y--) {
        budget--;
        try {
          const b = dimension.getBlock({ x: cx + col.dx, y, z: cz + col.dz });
          if (!b || b.typeId === "minecraft:air" || INDESTRUCTIBLE_BLOCKS.has(b.typeId)) continue;
          b.setType("minecraft:air");
        } catch (err) {}
      }
    }
    if (i >= columns.length) system.clearRun(runId);
  }, 1);
}

/**
 * 地形を砂と砂利に変えて、支えを失わせる。
 * 先に足元をくり抜いてから上を砂に変えるので、そのまま崩れ落ちる。
 */
export function crumbleTerrain(dimension, center, { radius, depth = 6, height = 14 }) {
  const r = Math.max(1, Math.round(radius));
  const cx = Math.round(center.x);
  const cy = Math.round(center.y);
  const cz = Math.round(center.z);

  // 1) 崩れ落ちる先を作る (足元をくり抜く)
  carveSphere(dimension, { x: cx, y: cy - depth, z: cz }, Math.round(r * 0.7));

  // 2) 少し遅れて、上に残った地形を砂に変える
  system.runTimeout(() => {
    const cells = [];
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (dx * dx + dz * dz > r * r) continue;
        for (let dy = 0; dy <= height; dy++) cells.push({ dx, dy, dz });
      }
    }
    // 下から順に砂へ変えると、変えたそばから崩れていく
    cells.sort((a, b) => a.dy - b.dy);

    let i = 0;
    const runId = system.runInterval(() => {
      let budget = BLOCK_BUDGET_PER_TICK;
      while (i < cells.length && budget-- > 0) {
        const c = cells[i++];
        try {
          const b = dimension.getBlock({ x: cx + c.dx, y: cy + c.dy, z: cz + c.dz });
          if (!b || b.typeId === "minecraft:air" || INDESTRUCTIBLE_BLOCKS.has(b.typeId)) continue;
          b.setType(Math.random() < 0.72 ? "minecraft:sand" : "minecraft:gravel");
        } catch (err) {}
      }
      if (i >= cells.length) system.clearRun(runId);
    }, 1);
  }, 20);
}
