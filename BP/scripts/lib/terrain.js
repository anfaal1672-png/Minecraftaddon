/**
 * 地形を作り替える処理。
 *
 * どれも core/jobs.js にジョブとして積むだけで、その場では何もしない。
 * 実際の書き込みはエンジンの空き時間に少しずつ進むので、
 * 半径80の球を消しても1tickぶんの負荷は一定に保たれる。
 */
import { submit } from "../core/jobs.js";
import { mayBreakBlocks } from "../core/settings.js";
import { blockAt, carveColumn, fillColumn, PROTECTED_SET, setBlock, setIfEmpty, trySetBlock } from "./blocks.js";
import { diskCells, shellOffsets, sphereColumns } from "./shapes.js";
import { blockPos } from "./math.js";

/** 埋めるときに「空いている」とみなす液体 */
const WATER_LIKE = new Set(["minecraft:water", "minecraft:flowing_water", "minecraft:lava", "minecraft:flowing_lava"]);

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

/* ==================================================================== */
/*  建築と掘削                                                          */
/*                                                                      */
/*  建築系TNTの土台。どれもジョブとして積むだけなので、規模が大きくても  */
/*  1tickあたりの負荷は掘削と同じ枠に収まる。                            */
/* ==================================================================== */

/** 東西南北の向き */
export const CARDINALS = [
  { dx: 1, dz: 0 }, { dx: -1, dz: 0 }, { dx: 0, dz: 1 }, { dx: 0, dz: -1 },
];

/**
 * 四方へ伸びるトンネルを掘る。
 * @param width  トンネルの幅と高さの半径 (1 なら 3×3)
 * @param length 1方向あたりの長さ
 * @param dirs   掘る向き (省略時は四方)
 */
export function carveTunnels(dimension, center, { width = 1, length = 24, dirs = CARDINALS, priority = 0 } = {}) {
  if (!mayBreakBlocks()) return;
  const base = blockPos(center);
  submit(
    `tunnel ${length}`,
    function* () {
      for (const dir of dirs) {
        for (let step = 1; step <= length; step++) {
          const x = base.x + dir.dx * step;
          const z = base.z + dir.dz * step;
          // 進む向きと直交する方向へ幅をとる
          for (let side = -width; side <= width; side++) {
            const sx = x + (dir.dx === 0 ? side : 0);
            const sz = z + (dir.dz === 0 ? side : 0);
            carveColumn(dimension, sx, sz, base.y, base.y + width * 2);
          }
          yield;
        }
      }
    },
    { priority }
  );
}

/**
 * 範囲を爆心地の高さで平らにする。上は削り、下は埋める。
 * @param fill 埋めるのに使うブロック。省略すると窪みは埋めない
 */
export function flattenArea(dimension, center, { radius, height = 24, fill = null, priority = 0 } = {}) {
  if (!mayBreakBlocks()) return;
  const base = blockPos(center);
  submit(
    `flatten r=${Math.round(radius)}`,
    function* () {
      for (const cell of diskCells(radius)) {
        const x = base.x + cell.dx;
        const z = base.z + cell.dz;
        // 上を削る
        carveColumn(dimension, x, z, base.y, base.y + height);
        // 下を埋める (足元が空いている場合だけ)
        if (fill) {
          for (let dy = -1; dy >= -6; dy--) {
            const block = blockAt(dimension, { x, y: base.y + dy, z });
            if (!block) break;
            if (block.typeId !== "minecraft:air" && !WATER_LIKE.has(block.typeId)) break;
            setBlock(dimension, { x, y: base.y + dy, z }, fill);
          }
        }
        yield;
      }
    },
    { priority }
  );
}

/**
 * 円形の壁を立てる。
 * @param thickness 壁の厚み
 */
export function buildWall(dimension, center, { radius, height = 5, thickness = 1, candidates, priority = 0 } = {}) {
  if (!mayBreakBlocks()) return;
  const base = blockPos(center);
  submit(
    `wall r=${Math.round(radius)}`,
    function* () {
      const inner = Math.max(0, radius - thickness);
      for (const cell of diskCells(radius)) {
        const d = Math.sqrt(cell.d2);
        if (d < inner) continue;
        const x = base.x + cell.dx;
        const z = base.z + cell.dz;
        for (let dy = 0; dy < height; dy++) {
          // 上端を狭間にして、のっぺりした壁にならないようにする
          if (dy === height - 1 && (cell.dx + cell.dz) % 2 !== 0) continue;
          setIfEmpty(dimension, { x, y: base.y + dy, z }, candidates[0]);
        }
        yield;
      }
    },
    { priority }
  );
}

/**
 * 螺旋階段。上へ伸ばすことも、下へ掘ることもできる。
 * @param direction  1 で上へ建てる、-1 で下へ掘る
 * @param candidates 上へ建てるときに使うブロック
 */
export function spiralStairs(dimension, center, {
  radius = 3, height = 24, direction = 1, candidates = ["minecraft:stone_bricks", "minecraft:stonebrick"],
  priority = 0,
} = {}) {
  if (!mayBreakBlocks()) return;
  const base = blockPos(center);
  const stepsPerTurn = Math.max(8, Math.round(radius * 6));
  submit(
    `stairs h=${height}`,
    function* () {
      for (let step = 0; step < height * (stepsPerTurn / 4); step++) {
        const angle = (Math.PI * 2 * step) / stepsPerTurn;
        const y = base.y + direction * Math.floor((step * 4) / stepsPerTurn);
        const x = base.x + Math.round(Math.cos(angle) * radius);
        const z = base.z + Math.round(Math.sin(angle) * radius);
        if (Math.abs(y - base.y) > height) break;

        if (direction > 0) {
          trySetBlock(dimension, { x, y, z }, candidates);
          // 頭がぶつからないように上を空ける
          carveColumn(dimension, x, z, y + 1, y + 3);
        } else {
          // 掘り下げる。踏み面と、その上の通路
          carveColumn(dimension, x, z, y, y + 2);
        }
        if (step % 4 === 0) yield;
      }
    },
    { priority }
  );
}

/**
 * 四方へ橋を架ける。足元が空いている場所にだけ桁を置く。
 */
export function buildBridges(dimension, center, { length = 20, width = 1, candidates, priority = 0 } = {}) {
  if (!mayBreakBlocks()) return;
  const base = blockPos(center);
  submit(
    `bridge ${length}`,
    function* () {
      for (const dir of CARDINALS) {
        for (let step = 1; step <= length; step++) {
          const x = base.x + dir.dx * step;
          const z = base.z + dir.dz * step;
          for (let side = -width; side <= width; side++) {
            const sx = x + (dir.dx === 0 ? side : 0);
            const sz = z + (dir.dz === 0 ? side : 0);
            setIfEmpty(dimension, { x: sx, y: base.y - 1, z: sz }, candidates[0]);
            // 通り道を確保する
            carveColumn(dimension, sx, sz, base.y, base.y + 2);
          }
          // 手すり
          if (step % 3 === 0) {
            for (const side of [-width - 1, width + 1]) {
              const sx = x + (dir.dx === 0 ? side : 0);
              const sz = z + (dir.dz === 0 ? side : 0);
              setIfEmpty(dimension, { x: sx, y: base.y - 1, z: sz }, candidates[0]);
              setIfEmpty(dimension, { x: sx, y: base.y, z: sz }, candidates[0]);
            }
          }
          yield;
        }
      }
    },
    { priority }
  );
}

/**
 * きれいな直方体を掘り抜く (採掘場)。
 */
export function carveBox(dimension, center, { radius, top = 0, bottom = -12, priority = 0 } = {}) {
  if (!mayBreakBlocks()) return;
  const base = blockPos(center);
  const r = Math.max(1, Math.round(radius));
  submit(
    `quarry r=${r}`,
    function* () {
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          carveColumn(dimension, base.x + dx, base.z + dz, base.y + bottom, base.y + top);
        }
        yield;
      }
    },
    { priority }
  );
}

/**
 * 中が空洞の建物を作る。壁を張ってから内側をくり抜く。
 */
export function buildShelter(dimension, center, { radius = 4, height = 4, candidates, priority = 0 } = {}) {
  if (!mayBreakBlocks()) return;
  const base = blockPos(center);
  const r = Math.max(2, Math.round(radius));
  submit(
    `shelter r=${r}`,
    function* () {
      // 外殻
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          const onEdge = Math.abs(dx) === r || Math.abs(dz) === r;
          for (let dy = 0; dy <= height; dy++) {
            const isFloor = dy === 0;
            const isRoof = dy === height;
            if (!onEdge && !isFloor && !isRoof) continue;
            setIfEmpty(dimension, { x: base.x + dx, y: base.y + dy, z: base.z + dz }, candidates[0]);
          }
        }
        yield;
      }
      // 内側をくり抜く
      for (let dx = -r + 1; dx <= r - 1; dx++) {
        for (let dz = -r + 1; dz <= r - 1; dz++) {
          carveColumn(dimension, base.x + dx, base.z + dz, base.y + 1, base.y + height - 1);
        }
        yield;
      }
      // 出入り口
      for (let dy = 1; dy <= 2; dy++) {
        setBlock(dimension, { x: base.x, y: base.y + dy, z: base.z - r }, "minecraft:air");
      }
      // 明かり
      setIfEmpty(dimension, { x: base.x, y: base.y + height - 1, z: base.z }, "minecraft:glowstone");
    },
    { priority }
  );
}

/**
 * 窪地を掘って液体で満たす (湖・溶岩溜まり)。
 */
export function fillBasin(dimension, center, { radius, depth = 4, liquid = "minecraft:water", priority = 0 } = {}) {
  if (!mayBreakBlocks()) return;
  const base = blockPos(center);
  submit(
    `basin r=${Math.round(radius)}`,
    function* () {
      for (const cell of diskCells(radius)) {
        const x = base.x + cell.dx;
        const z = base.z + cell.dz;
        // 中心ほど深く、縁は浅い椀の形
        const d = Math.sqrt(cell.d2) / Math.max(1, radius);
        const bowl = Math.max(1, Math.round(depth * (1 - d * d)));
        carveColumn(dimension, x, z, base.y - bowl + 1, base.y + 2);
        for (let dy = 0; dy < bowl; dy++) {
          setBlock(dimension, { x, y: base.y - bowl + 1 + dy, z }, liquid);
        }
        yield;
      }
    },
    { priority }
  );
}

/**
 * 柱を1本立てて、上まで登れるようにする (エレベーター・足場)。
 */
export function raiseScaffold(dimension, center, { height = 24, candidates, priority = 0 } = {}) {
  if (!mayBreakBlocks()) return;
  const base = blockPos(center);
  submit(
    `scaffold h=${height}`,
    function* () {
      for (let dy = 0; dy < height; dy++) {
        const y = base.y + dy;
        setIfEmpty(dimension, { x: base.x, y, z: base.z }, candidates[0]);
        // 登る足がかりを螺旋に付ける
        const angle = (dy % 8) * (Math.PI / 4);
        setIfEmpty(dimension, {
          x: base.x + Math.round(Math.cos(angle)),
          y,
          z: base.z + Math.round(Math.sin(angle)),
        }, candidates[0]);
        if (dy % 4 === 0) yield;
      }
    },
    { priority }
  );
}
