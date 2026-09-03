/**
 * 地形を作り替える処理。
 *
 * どれも core/jobs.js にジョブとして積むだけで、その場では何もしない。
 * 実際の書き込みはエンジンの空き時間に少しずつ進むので、
 * 半径80の球を消しても1tickぶんの負荷は一定に保たれる。
 */
import { submit } from "../core/jobs.js";
import { mayBreakBlocks } from "../core/settings.js";
import { blockAt, carveColumn, fillColumn, PROTECTED_SET, setBlock, trySetBlock } from "./blocks.js";
import { diskCells, shellOffsets, sphereColumns } from "./shapes.js";
import { blockPos } from "./math.js";

/** 焼け焦げた地面に使うブロック */
const SCORCH_BLOCKS = ["minecraft:blackstone", "minecraft:magma_block"];

/**
 * 爆心地を中心に、球状にブロックを消す。
 *
 * すり鉢状ではなく球にしてあるのは、爆心地より上が残ると
 * 山の中や建物の中で使ったときに上半分が無傷で立ってしまうため。
 * 本物の爆発と同じく、上にも下にも同じだけ広がる。
 *
 * @param scorch 底に焼け焦げた地面を残すか
 * @param priority 大きいほど先に処理される
 */
export function carveSphere(dimension, center, { radius, scorch = false, priority = 0, onDone } = {}) {
  // 地形を壊してよいかの判断はここに集約する。呼ぶ側で書き忘れても
  // 「設定を切ったのに核だけ地形を消した」ということが起きないようにするため。
  if (!mayBreakBlocks()) {
    if (onDone) onDone();
    return;
  }
  const base = blockPos(center);
  submit(
    `carveSphere r=${Math.round(radius)}`,
    function* () {
      const columns = sphereColumns(radius);
      for (const col of columns) {
        const x = base.x + col.dx;
        const z = base.z + col.dz;
        carveColumn(dimension, x, z, base.y - col.h, base.y + col.h);
        if (scorch && Math.random() < 0.3) {
          const floor = blockAt(dimension, { x, y: base.y - col.h - 1, z });
          if (floor && floor.typeId !== "minecraft:air" && !PROTECTED_SET.has(floor.typeId)) {
            setBlock(dimension, { x, y: base.y - col.h - 1, z }, Math.random() < 0.22 ? SCORCH_BLOCKS[1] : SCORCH_BLOCKS[0]);
          }
        }
        yield;
      }
    },
    { priority, onDone }
  );
}

/**
 * 太い縦穴を、上から下まで一気に貫く。
 * top / bottom は爆心地からの相対の高さ。
 */
export function carveShaft(dimension, center, { radius, top, bottom, priority = 0, onDone } = {}) {
  if (!mayBreakBlocks()) {
    if (onDone) onDone();
    return;
  }
  const base = blockPos(center);
  submit(
    `carveShaft r=${Math.round(radius)}`,
    function* () {
      for (const cell of diskCells(radius, { ragged: 0.88 })) {
        carveColumn(dimension, base.x + cell.dx, base.z + cell.dz, base.y + bottom, base.y + top);
        yield;
      }
    },
    { priority, onDone }
  );
}

/**
 * 地形を砂と砂利に変えて、支えを失わせる。
 * 先に足元をくり抜いてから上を砂に変えるので、そのまま崩れ落ちる。
 */
export function crumbleTerrain(dimension, center, { radius, depth = 6, height = 14, priority = 0 } = {}) {
  if (!mayBreakBlocks()) return;
  const base = blockPos(center);

  // 1) 崩れ落ちる先を作る
  carveSphere(dimension, { x: base.x, y: base.y - depth, z: base.z }, {
    radius: Math.round(radius * 0.7),
    priority: priority + 1,
  });

  // 2) 上に残った地形を、下から順に砂へ変えていく。
  //    下から変えることで、変えたそばから崩れ始める。
  submit(
    `crumble r=${Math.round(radius)}`,
    function* () {
      const cells = diskCells(radius);
      for (let dy = 0; dy <= height; dy++) {
        for (const cell of cells) {
          const loc = { x: base.x + cell.dx, y: base.y + dy, z: base.z + cell.dz };
          const block = blockAt(dimension, loc);
          if (!block || block.typeId === "minecraft:air" || PROTECTED_SET.has(block.typeId)) continue;
          setBlock(dimension, loc, Math.random() < 0.72 ? "minecraft:sand" : "minecraft:gravel");
        }
        yield;
      }
    },
    { priority }
  );
}

/**
 * 球の殻を張る。空いている場所だけを埋めるので、既存の建築は壊さない。
 * @param candidates 置くブロックの候補 (先頭から順に試す)
 */
export function buildShell(dimension, center, { radius, thickness = 1, candidates, priority = 0 } = {}) {
  if (!mayBreakBlocks()) return;
  const base = blockPos(center);
  submit(
    `buildShell r=${Math.round(radius)}`,
    function* () {
      const offsets = shellOffsets(radius, thickness);
      let n = 0;
      for (const off of offsets) {
        const loc = { x: base.x + off.dx, y: base.y + off.dy, z: base.z + off.dz };
        const block = blockAt(dimension, loc);
        if (block && (block.isAir || block.typeId === "minecraft:air" ||
                      block.typeId === "minecraft:water" || block.typeId === "minecraft:flowing_water")) {
          trySetBlock(dimension, loc, candidates);
        }
        if (++n % 64 === 0) yield;
      }
    },
    { priority }
  );
}

/**
 * 円盤の範囲を1マスずつ見て回る。
 * 「地表を書き換える」系のTNTはどれもこの形をしているので、
 * 判定と書き換えの中身だけを visit に渡してもらう。
 *
 * @param visit (dimension, loc, cell) => void
 * @param layers 中心の高さから上下いくつまで見るか [下, 上]
 */
export function scanDisk(dimension, center, { radius, layers = [0, 0], priority = 0, name = "scanDisk" }, visit) {
  const base = blockPos(center);
  submit(
    name,
    function* () {
      const cells = diskCells(radius);
      let n = 0;
      for (const cell of cells) {
        for (let dy = layers[0]; dy <= layers[1]; dy++) {
          const loc = { x: base.x + cell.dx, y: base.y + dy, z: base.z + cell.dz };
          try {
            visit(dimension, loc, cell);
          } catch (err) {
            /* 1マスの失敗で走査全体を止めない */
          }
        }
        if (++n % 48 === 0) yield;
      }
    },
    { priority }
  );
}

/**
 * 球の範囲を1マスずつ見て回る。scanDisk の立体版。
 */
export function scanSphere(dimension, center, { radius, priority = 0, name = "scanSphere" }, visit) {
  const base = blockPos(center);
  submit(
    name,
    function* () {
      const R = Math.max(1, Math.round(radius));
      for (let dy = -R; dy <= R; dy++) {
        const slice = Math.sqrt(Math.max(0, R * R - dy * dy));
        for (const cell of diskCells(slice)) {
          const loc = { x: base.x + cell.dx, y: base.y + dy, z: base.z + cell.dz };
          try {
            visit(dimension, loc, cell);
          } catch (err) {
            /* 同上 */
          }
        }
        yield;
      }
    },
    { priority }
  );
}

/** 柱を1本立てる (煙突・目印など) */
export function raisePillar(dimension, loc, height, blockId) {
  const base = blockPos(loc);
  fillColumn(dimension, base.x, base.z, base.y, base.y + height, blockId);
}
