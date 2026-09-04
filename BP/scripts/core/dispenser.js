/**
 * ディスペンサーからのTNT射出。
 *
 * 本家のディスペンサーは、TNTを入れて動かすと「アイテムを吐き出す」のではなく
 * 「導火線に火を点けた状態で正面に撃ち出す」。この振る舞いはエンジンに
 * 焼き込まれていて、アドオンのブロックを仲間に入れる方法は用意されていない
 * (ブロックにもアイテムにも、それらしいコンポーネントが存在しない)。
 *
 * そこで結果の側から合わせる。ディスペンサーは知らないアイテムを
 * ただのアイテムとして吐き出すので、
 *   1) アイテムが湧いた瞬間を捉える
 *   2) それがこのアドオンのTNTで、
 *   3) 隣のディスペンサーがちょうどこちらを向いているなら
 * そのアイテムを消して、代わりに起爆中のTNTを撃ち出す。
 *
 * ドロッパーは本家でもTNTをそのまま落とすだけなので、こちらも何もしない。
 */
import { world } from "@minecraft/server";
import { attempt } from "./log.js";
import { spawnPrimed } from "./fuse.js";
import { tntConfig } from "./registry.js";
import { blockAt } from "../lib/blocks.js";
import { blockPos } from "../lib/math.js";

const DISPENSER = "minecraft:dispenser";

/** facing_direction の値と、その向き */
const FACING = {
  0: { x: 0, y: -1, z: 0 },
  1: { x: 0, y: 1, z: 0 },
  2: { x: 0, y: 0, z: -1 },
  3: { x: 0, y: 0, z: 1 },
  4: { x: -1, y: 0, z: 0 },
  5: { x: 1, y: 0, z: 0 },
};

/** アイテムの中身。読めなければ null */
function stackOf(entity) {
  return attempt("dispenser:stack", () =>
    entity.getComponent("minecraft:item")?.itemStack ?? null, null);
}

/**
 * そのアイテムを吐き出したディスペンサーを探す。
 *
 * @returns 撃ち出す位置。ディスペンサーが見つからなければ null
 */
export function findDispenserMuzzle(dimension, itemLoc) {
  const at = blockPos(itemLoc);

  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dz = -1; dz <= 1; dz++) {
        if (dx === 0 && dy === 0 && dz === 0) continue;
        const here = { x: at.x + dx, y: at.y + dy, z: at.z + dz };
        const block = blockAt(dimension, here);
        if (!block || block.typeId !== DISPENSER) continue;

        const facing = attempt("dispenser:facing", () =>
          block.permutation.getState("facing_direction"), undefined);
        const direction = FACING[facing];
        if (!direction) continue;

        // ディスペンサーの正面が、アイテムの湧いた場所と一致するか
        const muzzle = { x: here.x + direction.x, y: here.y + direction.y, z: here.z + direction.z };
        if (muzzle.x === at.x && muzzle.y === at.y && muzzle.z === at.z) return muzzle;
      }
    }
  }
  return null;
}

export function registerDispenser() {
  attempt("dispenser:subscribe", () =>
    world.afterEvents.entitySpawn.subscribe((event) => {
      const entity = event.entity;
      if (!entity || entity.typeId !== "minecraft:item") return;

      const stack = stackOf(entity);
      const cfg = tntConfig(stack?.typeId);
      if (!cfg) return;

      const location = attempt("dispenser:loc", () => ({ ...entity.location }), null);
      if (!location) return;

      const dimension = entity.dimension;
      const muzzle = findDispenserMuzzle(dimension, location);
      if (!muzzle) return; // 手で落としただけ

      // 吐き出されたアイテムを取り消して、本家と同じく火の点いたTNTにする
      attempt("dispenser:remove", () => entity.remove());
      spawnPrimed(dimension, { x: muzzle.x + 0.5, y: muzzle.y + 0.5, z: muzzle.z + 0.5 }, cfg);
    })
  );
}
