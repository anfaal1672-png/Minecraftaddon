import { system, world, EquipmentSlot, GameMode } from "@minecraft/server";
import { isTnt } from "../core/registry.js";
import { igniteBlock } from "../core/ignition.js";
import { getBlock } from "../core/safety.js";
import { onMineStepOn, rememberMine, forgetMine } from "./traps.js";
import { attempt, warn } from "../util/log.js";

/* ------------------------------------------------------------------ */
/*  着火条件は通常のTNTと同じ:                                          */
/*   1) 火打石で右クリック                                             */
/*   2) 隣接ブロックが炎・溶岩                                         */
/*   3) レッドストーン信号                                             */
/*   4) 燃えている矢が当たる                                           */
/*   5) 近くの爆発に巻き込まれる (core/explosion.js)                    */
/*  + リモート起爆装置 (systems/detonator.js)                           */
/* ------------------------------------------------------------------ */
const FIRE_NEIGHBORS = new Set(["minecraft:fire", "minecraft:soul_fire", "minecraft:lava", "minecraft:flowing_lava"]);
const OFFSETS = [
  [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
];

function hasFireOrLavaNeighbor(dimension, loc) {
  for (const [x, y, z] of OFFSETS) {
    const b = getBlock(dimension, { x: loc.x + x, y: loc.y + y, z: loc.z + z });
    if (b && FIRE_NEIGHBORS.has(b.typeId)) return true;
  }
  return false;
}

function isRedstonePowered(block) {
  const power = attempt("redstonePower", () => block.getRedstonePower());
  return typeof power === "number" && power > 0;
}

function playSound(dimension, id, loc) {
  attempt("sound", () => dimension.playSound(id, loc));
}

export function registerTriggers() {
  system.beforeEvents.startup.subscribe((init) => {
    // 火打石での着火は playerInteractWithBlock 側で検知する。
    // ここに onPlayerInteract を登録するとブロックが「操作を持つブロック」扱いになり、
    // しゃがまないと上に物を置けなくなるため。
    init.blockComponentRegistry.registerCustomComponent("manytnt:ignite", {
      onTick(e) {
        const { block, dimension } = e;
        if (hasFireOrLavaNeighbor(dimension, block.location) || isRedstonePowered(block)) {
          igniteBlock(dimension, block.location);
        }
      },
      // レッドストーン信号はイベントで即座に受け取る (onTick は保険)
      onRedstoneUpdate(e) {
        if (e.powerLevel > 0) igniteBlock(e.dimension, e.block.location);
      },
      // 設置音・破壊音 (機種によって blocks.json の sound が効かないことがあるため)。
      // 2.x では破壊時のフックは onPlayerBreak (旧 onPlayerDestroy は呼ばれない。B29)
      onPlace(e) {
        playSound(e.dimension, "dig.grass", e.block.location);
      },
      onPlayerBreak(e) {
        playSound(e.dimension, "dig.grass", e.block.location);
        forgetMine(e.dimension.id, e.block.location);
      },
    });
    init.blockComponentRegistry.registerCustomComponent("manytnt:landmine", {
      onStepOn(e) {
        onMineStepOn(e);
      },
    });
  });

  // 火打石
  world.afterEvents.playerInteractWithBlock.subscribe((e) => {
    try {
      const { player, block } = e;
      if (!player || !block || !isTnt(block.typeId) || e.isFirstEvent === false) return;
      const itemId = (e.beforeItemStack ?? e.itemStack)?.typeId;
      if (itemId !== "minecraft:flint_and_steel") return;
      if (igniteBlock(player.dimension, block.location, { source: player })) damageFlint(player);
    } catch (err) {
      warn("flint", err);
    }
  });

  // 燃えている矢
  world.afterEvents.projectileHitBlock.subscribe((e) => {
    try {
      const burning = attempt("onfire", () => e.projectile?.getComponent("minecraft:onfire") !== undefined);
      if (!burning) return;
      const block = e.getBlockHit()?.block;
      if (!block || !isTnt(block.typeId)) return;
      const shooter = attempt("shooter", () => e.source);
      igniteBlock(e.dimension, block.location, { source: shooter?.typeId === "minecraft:player" ? shooter : undefined });
    } catch (err) {
      warn("arrow", err);
    }
  });

  // 地雷の持ち主を覚える
  world.afterEvents.playerPlaceBlock.subscribe((e) => {
    try {
      if (e.block.typeId === "manytnt:landmine_tnt") rememberMine(e.dimension.id, e.block.location, e.player.id);
    } catch (err) {
      warn("placeMine", err);
    }
  });
}

/**
 * 火打石の耐久値を1減らす (B30: 以前は ContainerSlot に存在しない
 * damageDurability を呼んでいて、耐久値が減っていなかった)。クリエイティブでは減らさない。
 */
function damageFlint(player) {
  attempt("flintDurability", () => {
    if (player.getGameMode() === GameMode.Creative) return;
    const slot = player.getComponent("minecraft:equippable")?.getEquipmentSlot(EquipmentSlot.Mainhand);
    const item = slot?.getItem();
    if (!item || item.typeId !== "minecraft:flint_and_steel") return;
    const durability = item.getComponent("minecraft:durability");
    if (!durability) return;
    if (durability.damage + 1 >= durability.maxDurability) {
      slot.setItem(undefined);
      player.playSound("random.break");
    } else {
      durability.damage += 1;
      slot.setItem(item);
    }
  });
}
