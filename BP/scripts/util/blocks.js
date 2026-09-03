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

/**
 * クレーターを掘るときに 1tick で触るブロック数の上限。
 * 規模がどれだけ大きくなっても1tickあたりの負荷を一定に保つための予算。
 */
export const CRATER_BUDGET_PER_TICK = 2200;

/**
 * 爆心地に、すり鉢状のクレーターを掘る。
 *
 * 以前は半径方向にリング状の爆発点を並べ、点ごとに小さな球を消していた。
 * この方式には2つの問題があった:
 *  ・点の数が半径に関係なく固定だったため、半径を大きくすると外側のリングでは
 *    点の間隔が球の直径より広がってしまい、「点々と穴が空いただけ」の見た目に
 *    なっていた (反物質爆弾では最外周の点は26ブロックも離れていた)
 *  ・点1つにつき1tickずつ進めていたので、反物質爆弾では爆発が26秒も続き、
 *    しかも重なった部分の同じブロックを何度も消し直すので、その間ずっと重かった
 *
 * 今の方式は、クレーターの形を「柱(x,z)ごとに掘る深さ」として先に確定させ、
 * 1tickあたりのブロック操作数に予算を設けて中心から外へ順に掘っていく。
 * 同じブロックには二度触らないので無駄がなく、隙間のない本物のクレーターになる。
 * 掘り終わるまでの時間は規模によらず数秒に収まる。
 */
export function carveCrater(dimension, center, opts) {
  const radius = Math.max(1, Math.round(opts.radius));
  const depth = Math.max(2, Math.round(opts.depth ?? radius * 0.35));
  // 中心付近は地表より上も抉れて、器のような断面になる
  const lip = opts.lip ?? Math.max(1, Math.round(radius * 0.08));
  const scorch = opts.scorch ?? false;
  const cx = Math.round(center.x);
  const cy = Math.round(center.y);
  const cz = Math.round(center.z);

  const columns = [];
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dz = -radius; dz <= radius; dz++) {
      const r2 = dx * dx + dz * dz;
      if (r2 > radius * radius) continue;
      const frac = Math.sqrt(r2) / radius;
      // 外周は確率的に間引いて、輪郭が完全な円にならないようにする
      if (frac > 0.82 && Math.random() < (frac - 0.82) / 0.18) continue;
      // すり鉢状の断面: 中心ほど深く、外へ行くほど浅い
      const d = Math.round(depth * (1 - frac * frac) + rand(-1.2, 1.2));
      if (d < 1) continue;
      columns.push({ dx, dz, d, top: Math.round(lip * (1 - frac) + rand(0, 1)), frac });
    }
  }
  if (columns.length === 0) return;
  columns.sort((a, b) => a.frac - b.frac); // 中心から外へ広がっていくように見せる

  let i = 0;
  const runId = system.runInterval(() => {
    let budget = CRATER_BUDGET_PER_TICK;
    while (i < columns.length && budget > 0) {
      const col = columns[i++];
      const x = cx + col.dx;
      const z = cz + col.dz;
      const bottom = cy - col.d;
      for (let y = cy + col.top; y >= bottom; y--) {
        budget--;
        try {
          const b = dimension.getBlock({ x, y, z });
          if (!b || b.typeId === "minecraft:air" || INDESTRUCTIBLE_BLOCKS.has(b.typeId)) continue;
          b.setType("minecraft:air");
        } catch (err) {}
      }
      // クレーターの底を焼け焦げた地面にする
      if (scorch && Math.random() < 0.35) {
        try {
          const floor = dimension.getBlock({ x, y: bottom - 1, z });
          if (floor && floor.typeId !== "minecraft:air" && !INDESTRUCTIBLE_BLOCKS.has(floor.typeId)) {
            floor.setType(Math.random() < 0.22 ? "minecraft:magma_block" : "minecraft:blackstone");
          }
        } catch (err) {}
      }
    }
    if (i >= columns.length) system.clearRun(runId);
  }, 1);
}
