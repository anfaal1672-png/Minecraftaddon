/**
 * 手に持って使う道具。
 *
 * 使ったときの処理はすべてここに集めて、world.afterEvents.itemUse の
 * 購読も1本にまとめてある。道具を増やすときは data/gear.mjs に1件足して、
 * ここに同じ名前の関数を書けばよい。
 */
import { world } from "@minecraft/server";
import { attempt } from "../core/log.js";
import { actionBar, tell } from "../core/chat.js";
import { chainRadiusIgnite } from "../core/chain.js";
import { ignite, isReserved } from "../core/ignition.js";
import { openMainMenu } from "../core/menu.js";
import { isTnt, NS, tntConfig } from "../core/registry.js";
import { TOOLS } from "../data/gear-table.js";
import { SURVEY_ORES } from "../effects/utility.js";
import { blockAt } from "../lib/blocks.js";
import { later, sound } from "../lib/fx.js";

/** 視線の先のブロック。届かなければ null */
function lookingAt(player, maxDistance = 64) {
  return attempt("tools:ray", () => player.getBlockFromViewDirection({ maxDistance })?.block, null) ?? null;
}

/* ------------------------------------------------------------------ */

/** リモート起爆装置: 視線の先のTNT1個を着火する */
export function useDetonator(player) {
  const block = lookingAt(player);
  if (!block || !isTnt(block.typeId)) {
    actionBar(player, "§7起爆できるTNTが見つかりません (64ブロック以内)§r");
    return;
  }
  if (isReserved(player.dimension, block.location)) return;
  sound(player.dimension, "random.click", player.location);
  ignite(player.dimension, block.location, block.typeId);
}

/** 一斉起爆ロッド: 視線の先を中心に、半径10のTNTを全部着火する */
export const BLAST_ROD_RADIUS = 10;

export function useBlastRod(player) {
  const block = lookingAt(player);
  if (!block) {
    actionBar(player, "§7狙う場所が遠すぎます§r");
    return;
  }
  const lit = chainRadiusIgnite(player.dimension, block.location, BLAST_ROD_RADIUS);
  sound(player.dimension, "random.click", player.location, { pitch: 0.7 });
  actionBar(player, lit > 0 ? `§c${lit} 個のTNTに点火§r` : "§7半径10にTNTがありません§r");
}

/* ------------------------------------------------------------------ */

/** 時限装置で仕掛けた予約 */
const timers = new Map();

/** 時限装置の秒数。使うたびに次の段へ回る */
export const TIMER_STEPS = [5, 10, 30];

const timerKey = (dimension, loc) => `${dimension.id}:${loc.x},${loc.y},${loc.z}`;

/**
 * 時限装置: TNTに使うと、指定した秒数後に着火する予約を仕掛ける。
 * 仕掛けてあるTNTにもう一度使うと解除できる。
 */
export function useTimer(player) {
  const block = lookingAt(player, 8);
  if (!block || !isTnt(block.typeId)) {
    actionBar(player, "§7TNTを見ながら使ってください (8ブロック以内)§r");
    return;
  }
  const dimension = player.dimension;
  const key = timerKey(dimension, block.location);

  if (timers.has(key)) {
    timers.delete(key);
    actionBar(player, "§7時限装置を解除しました§r");
    sound(dimension, "random.click", player.location, { pitch: 0.5 });
    return;
  }

  const seconds = TIMER_STEPS[timers.size % TIMER_STEPS.length];
  const loc = { ...block.location };
  const typeId = block.typeId;
  timers.set(key, seconds);

  const name = tntConfig(typeId)?.name.ja ?? typeId;
  actionBar(player, `§e${name} を ${seconds} 秒後に起爆します§r`);
  sound(dimension, "random.click", player.location, { pitch: 1.4 });

  // 1秒ごとに音で残りを知らせてから着火する
  for (let remaining = seconds; remaining > 0; remaining--) {
    later((seconds - remaining) * 20, () => {
      if (!timers.has(key)) return;
      sound(dimension, "note.pling", loc, { pitch: remaining <= 3 ? 1.8 : 1.0 });
    });
  }
  later(seconds * 20, () => {
    if (!timers.delete(key)) return; // 解除済み
    const still = blockAt(dimension, loc);
    if (!still || still.typeId !== typeId) return; // 掘られた・既に爆発した
    ignite(dimension, loc, typeId);
  });
}

/** 仕掛けてある時限装置の数 (テストと診断用) */
export function pendingTimers() {
  return timers.size;
}

export function clearTimers() {
  timers.clear();
}

/* ------------------------------------------------------------------ */

/** 探知機が調べる範囲 */
export const SCANNER_RADIUS = 12;

/**
 * 爆発物探知機: 周囲に埋まっているTNTと地雷、それに鉱石を教える。
 * 地雷を踏む前に気づくための道具でもある。
 */
export function useScanner(player) {
  const dimension = player.dimension;
  const origin = attempt("tools:scanOrigin", () => ({
    x: Math.floor(player.location.x),
    y: Math.floor(player.location.y),
    z: Math.floor(player.location.z),
  }), null);
  if (!origin) return;

  const tnt = new Map();
  const ores = new Map();
  let mines = 0;

  const R = SCANNER_RADIUS;
  for (let dx = -R; dx <= R; dx++) {
    for (let dy = -R; dy <= R; dy++) {
      for (let dz = -R; dz <= R; dz++) {
        if (dx * dx + dy * dy + dz * dz > R * R) continue;
        const block = blockAt(dimension, { x: origin.x + dx, y: origin.y + dy, z: origin.z + dz });
        if (!block) continue;
        const cfg = tntConfig(block.typeId);
        if (cfg) {
          tnt.set(cfg.name.ja, (tnt.get(cfg.name.ja) ?? 0) + 1);
          if (cfg.proximity) mines++;
          continue;
        }
        const ore = SURVEY_ORES[block.typeId];
        if (ore) ores.set(ore, (ores.get(ore) ?? 0) + 1);
      }
    }
  }

  const summarize = (map) => [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([label, count]) => `${label}×${count}`)
    .join("、");

  tell(player, `§b🔍 半径${R}の探知結果§r`);
  tell(player, tnt.size ? `  §cTNT:§r ${summarize(tnt)}` : "  §7TNT: 見つからず§r");
  if (mines > 0) tell(player, `  §4⚠ うち ${mines} 個は地雷です。近づくと起爆します§r`);
  tell(player, ores.size ? `  §e鉱石:§r ${summarize(ores)}` : "  §7鉱石: 見つからず§r");
  sound(dimension, "random.orb", player.location, { pitch: 1.4 });
}

/** TNT図鑑: 画面を開く */
export function useCatalog(player) {
  openMainMenu(player);
}

/* ------------------------------------------------------------------ */

const HANDLERS = { useDetonator, useBlastRod, useTimer, useScanner, useCatalog };

const byItem = new Map(
  TOOLS.map((tool) => [`${NS}:${tool.id}`, { ...tool, run: HANDLERS[tool.handler] ?? null }])
);

/** 道具の一覧 (図鑑用) */
export function toolList() {
  return [...byItem.values()];
}

export function registerTools() {
  attempt("tools:itemUse", () =>
    world.afterEvents.itemUse.subscribe((event) => {
      const tool = byItem.get(event.itemStack?.typeId);
      if (!tool?.run || !event.source) return;
      attempt(`tool:${tool.id}`, () => tool.run(event.source));
    })
  );
}
