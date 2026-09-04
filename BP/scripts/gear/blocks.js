/**
 * 仕掛けブロック。
 *
 *   起爆装置    レッドストーン信号で、半径12のTNTを一斉に着火する
 *   導火線      火を点けると隣の導火線へ燃え広がり、行き着いた先のTNTを着火する
 *   耐爆ブロック 何をしても壊れない (lib/blocks.js の PROTECTED_BLOCKS に入っている)
 */
import { system } from "@minecraft/server";
import { attempt } from "../core/log.js";
import { chainRadiusIgnite } from "../core/chain.js";
import { ignite, isReserved } from "../core/ignition.js";
import { isTnt, NS } from "../core/registry.js";
import { blockAt, setBlock } from "../lib/blocks.js";
import { later, particle, sound } from "../lib/fx.js";

/** 起爆装置ブロックが届く範囲 */
export const DETONATOR_BLOCK_RADIUS = 12;

/** 導火線が1マス燃え進むのにかかる時間 (tick) */
export const FUSE_STEP_TICKS = 4;

/** 導火線が伝わる向き。斜めには伝わらない */
const FUSE_NEIGHBORS = [
  { x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 },
  { x: 0, y: 1, z: 0 }, { x: 0, y: -1, z: 0 },
  { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: -1 },
];

const FUSE_BLOCK = `${NS}:fuse_block`;
const DETONATOR_BLOCK = `${NS}:detonator_block`;

/** 火の付いた導火線。同じ場所を二度燃やさないための覚え書き */
const burning = new Set();
const keyOf = (dimension, loc) => `${dimension.id}:${loc.x},${loc.y},${loc.z}`;

/** 燃えている導火線の数 (テストと診断用) */
export function burningFuses() {
  return burning.size;
}

export function clearFuses() {
  burning.clear();
}

/**
 * 導火線に火を点ける。
 *
 * 燃えたマスは消え、そこから隣の導火線へ順に燃え移る。
 * 途中でTNTに行き当たったら、それを着火して止まる。
 */
export function lightFuse(dimension, loc) {
  const key = keyOf(dimension, loc);
  if (burning.has(key)) return false;

  const block = blockAt(dimension, loc);
  if (!block || block.typeId !== FUSE_BLOCK) return false;

  burning.add(key);
  sound(dimension, "random.fuse", loc, { volume: 0.6 });

  later(FUSE_STEP_TICKS, () => {
    burning.delete(key);
    // 燃え尽きたぶんは消える
    const still = blockAt(dimension, loc);
    if (!still || still.typeId !== FUSE_BLOCK) return;
    setBlock(dimension, loc, "minecraft:air");
    particle(dimension, "minecraft:basic_flame_particle", {
      x: loc.x + 0.5, y: loc.y + 0.5, z: loc.z + 0.5,
    });

    // 隣へ燃え移る。TNTがあればそれを着火して終わり
    for (const offset of FUSE_NEIGHBORS) {
      const next = { x: loc.x + offset.x, y: loc.y + offset.y, z: loc.z + offset.z };
      const neighbor = blockAt(dimension, next);
      if (!neighbor) continue;
      if (neighbor.typeId === FUSE_BLOCK) {
        lightFuse(dimension, next);
      } else if (isTnt(neighbor.typeId) && !isReserved(dimension, next)) {
        ignite(dimension, next, neighbor.typeId);
      }
    }
  });
  return true;
}

/** そのブロックが通電しているか */
function isPowered(block) {
  return attempt("gearBlock:redstone", () => {
    const power = block.getRedstonePower();
    return typeof power === "number" && power > 0;
  }, false);
}

/** 隣に火か溶岩があるか */
function hasFireNeighbor(dimension, loc) {
  for (const offset of FUSE_NEIGHBORS) {
    const block = blockAt(dimension, { x: loc.x + offset.x, y: loc.y + offset.y, z: loc.z + offset.z });
    if (!block) continue;
    if (["minecraft:fire", "minecraft:soul_fire", "minecraft:lava", "minecraft:flowing_lava"].includes(block.typeId)) {
      return true;
    }
  }
  return false;
}

/** 一度動いた起爆装置が、通電しっぱなしで連射しないようにする */
const firedDetonators = new Set();

export function registerGearBlocks() {
  attempt("gearBlock:startup", () =>
    system.beforeEvents.startup.subscribe((init) => {
      const registry = init.blockComponentRegistry;

      registry.registerCustomComponent(DETONATOR_BLOCK, {
        onTick(event) {
          const { block, dimension } = event;
          const key = keyOf(dimension, block.location);
          if (!isPowered(block)) {
            firedDetonators.delete(key); // 信号が切れたらまた撃てる
            return;
          }
          if (firedDetonators.has(key)) return;
          firedDetonators.add(key);

          const lit = chainRadiusIgnite(dimension, block.location, DETONATOR_BLOCK_RADIUS);
          if (lit > 0) sound(dimension, "random.click", block.location, { pitch: 0.7 });
        },
        onPlace(event) {
          sound(event.dimension, "dig.copper", event.block.location);
        },
      });

      registry.registerCustomComponent(FUSE_BLOCK, {
        onTick(event) {
          const { block, dimension } = event;
          if (hasFireNeighbor(dimension, block.location) || isPowered(block)) {
            lightFuse(dimension, block.location);
          }
        },
        onPlace(event) {
          sound(event.dimension, "dig.grass", event.block.location);
        },
      });
    })
  );
}
