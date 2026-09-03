/**
 * 連鎖爆発。爆発に巻き込まれた近くのTNTに火を点ける。
 *
 * 探し方は dimension.getBlocks に任せている。半径4なら729マスあるが、
 * 「この種類のブロックだけ探して」と1回頼めば済むので、
 * 自前で729回 getBlock を呼ぶより桁違いに軽い。
 * 古い端末でこれが使えない場合に備えて、素朴な走査も残してある。
 */
import { BlockVolume, system } from "@minecraft/server";
import { attempt } from "./log.js";
import { ignite, reserve, release } from "./ignition.js";
import { isTnt, TNT_TYPE_IDS } from "./registry.js";
import { get } from "./settings.js";

/** 巻き込む範囲 (ブロック) */
export const CHAIN_RADIUS = 4;

/**
 * 連鎖の安全上限。
 * TNTを何百個も敷き詰めて一気に連鎖させると端末ごと落ちる恐れがあるので、
 * 「直近2秒間に連鎖で着火した数」に上限を設け、超過分は無視する。
 * プレイヤーが自分の手で着火するぶんには制限しない。
 */
export const CHAIN_CAP = 120;

/** 上限を数え直す間隔 (tick) */
const CAP_WINDOW = 40;

let recentIgnitions = 0;

export function registerChainCapReset() {
  attempt("chain:capReset", () =>
    system.runInterval(() => {
      recentIgnitions = 0;
    }, CAP_WINDOW)
  );
}

/** いま何発ぶん連鎖したか (テストと診断用) */
export function chainCount() {
  return recentIgnitions;
}

export function resetChainCount() {
  recentIgnitions = 0;
}

/** 近くのTNTの座標を集める */
function findNearbyTnt(dimension, center) {
  const R = CHAIN_RADIUS;
  const found = attempt("chain:getBlocks", () => {
    const volume = new BlockVolume(
      { x: center.x - R, y: center.y - R, z: center.z - R },
      { x: center.x + R, y: center.y + R, z: center.z + R }
    );
    const list = dimension.getBlocks(volume, { includeTypes: TNT_TYPE_IDS }, true);
    const out = [];
    for (const loc of list.getBlockLocationIterator()) out.push({ x: loc.x, y: loc.y, z: loc.z });
    return out;
  }, null);
  if (found) return found;

  // getBlocks が使えない端末向けの代替
  const out = [];
  for (let dx = -R; dx <= R; dx++) {
    for (let dy = -R; dy <= R; dy++) {
      for (let dz = -R; dz <= R; dz++) {
        const loc = { x: center.x + dx, y: center.y + dy, z: center.z + dz };
        const block = attempt("chain:getBlock", () => dimension.getBlock(loc), null);
        if (block && isTnt(block.typeId)) out.push(loc);
      }
    }
  }
  return out;
}

/**
 * 爆心地の周りのTNTを巻き込む。
 * 着火は少し遅らせるが、予約はいま取る。そうしないと待ち時間の間に
 * 別の爆発が同じTNTをもう一度予定してしまい、二重に爆発する。
 */
export function chainReaction(dimension, center) {
  if (!get("chain")) return 0;

  const R2 = CHAIN_RADIUS * CHAIN_RADIUS;
  let lit = 0;

  for (const loc of findNearbyTnt(dimension, center)) {
    const dx = loc.x - center.x, dy = loc.y - center.y, dz = loc.z - center.z;
    if (dx === 0 && dy === 0 && dz === 0) continue;
    if (dx * dx + dy * dy + dz * dz > R2) continue;

    if (recentIgnitions >= CHAIN_CAP) break;

    const key = reserve(dimension, loc);
    if (!key) continue;

    const block = attempt("chain:type", () => dimension.getBlock(loc), null);
    const typeId = block?.typeId;
    if (!typeId || !isTnt(typeId)) {
      release(key);
      continue;
    }

    recentIgnitions++;
    lit++;
    const delay = 2 + Math.floor(Math.random() * 10);
    attempt("chain:schedule", () =>
      system.runTimeout(() => ignite(dimension, loc, typeId, { chained: true, key }), delay)
    );
  }
  return lit;
}
