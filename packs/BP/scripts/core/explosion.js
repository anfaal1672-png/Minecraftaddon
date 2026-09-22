import { system, world } from "@minecraft/server";
import { getDef, isTnt } from "./registry.js";
import { TAG_TYPE, TAG_ORIGIN, TAG_BY, scheduleChainIgnition } from "./ignition.js";
import { queueExplosion, consumeOwnExplosion, runBlockJob, MAX_POWER } from "./scheduler.js";
import { getBlock } from "./safety.js";
import { EFFECTS } from "../effects/index.js";
import { recordExplosion } from "../systems/stats.js";
import { getSettings } from "../systems/settings.js";
import { attempt, guard, warn } from "../util/log.js";
import { clamp, floorLoc, randInt } from "../util/math.js";

/* ------------------------------------------------------------------ */
/*  爆発の瞬間を横取りする。                                            */
/*  タグ付きの minecraft:tnt が爆発しようとしたら、本来の爆発をキャンセルし、 */
/*  こちらで威力と特殊効果を適用する。タグのない本物のTNTや、             */
/*  クリーパーなどの爆発はそのまま通し、近くのTNTを連鎖着火させるだけ。     */
/* ------------------------------------------------------------------ */
export function registerExplosionHook() {
  world.beforeEvents.explosion.subscribe((event) => {
    try {
      const source = event.source;
      const dimension = event.dimension;
      if (source && source.typeId === "minecraft:tnt") {
        const info = readTags(source);
        if (info) {
          event.cancel = true;
          const loc = { ...source.location };
          system.run(() => finishExplosion(dimension, loc, info.def, info.origin, info.by));
          return;
        }
      }
      // うちのTNT以外の爆発: 巻き込まれた範囲の重心と広がりから連鎖範囲を決める (B16)
      const area = impactArea(event, source);
      if (!area) return;
      // 自分で起こした爆発は finishExplosion が連鎖を処理済み (B02)
      if (consumeOwnExplosion(dimension.id, area.center)) return;
      system.run(() => chainReactionCheck(dimension, floorLoc(area.center), area.radius));
    } catch (err) {
      warn("explosion hook", err);
    }
  });
}

function readTags(entity) {
  let tags;
  try {
    tags = entity.getTags();
  } catch (err) {
    return undefined;
  }
  const typeTag = tags.find((t) => t.startsWith(TAG_TYPE));
  if (!typeTag) return undefined;
  const def = getDef(typeTag.slice(TAG_TYPE.length));
  if (!def) return undefined;
  const originTag = tags.find((t) => t.startsWith(TAG_ORIGIN));
  const byTag = tags.find((t) => t.startsWith(TAG_BY));
  return {
    def,
    origin: originTag ? getDef(originTag.slice(TAG_ORIGIN.length)) : undefined,
    by: byTag ? byTag.slice(TAG_BY.length) : undefined,
  };
}

function impactArea(event, source) {
  let blocks = [];
  try {
    blocks = event.getImpactedBlocks() ?? [];
  } catch (err) {
    blocks = [];
  }
  if (blocks.length > 0) {
    let sx = 0;
    let sy = 0;
    let sz = 0;
    for (const b of blocks) {
      sx += b.location.x;
      sy += b.location.y;
      sz += b.location.z;
    }
    const center = { x: sx / blocks.length, y: sy / blocks.length, z: sz / blocks.length };
    let maxD2 = 0;
    for (const b of blocks) {
      const dx = b.location.x - center.x;
      const dy = b.location.y - center.y;
      const dz = b.location.z - center.z;
      maxD2 = Math.max(maxD2, dx * dx + dy * dy + dz * dz);
    }
    return { center, radius: clamp(Math.ceil(Math.sqrt(maxD2)) + 1, 3, 8) };
  }
  if (source) {
    const loc = attempt("sourceLoc", () => ({ ...source.location }));
    if (loc) return { center: loc, radius: 4 };
  }
  return undefined;
}

/** 短い導火線で先回りして爆発させる (連鎖着火・地雷・時限TNT) */
export function detonateTntEntity(tnt) {
  let loc;
  let dimension;
  try {
    loc = { ...tnt.location };
    dimension = tnt.dimension;
  } catch (err) {
    return; // 既に爆発した
  }
  const info = readTags(tnt);
  attempt("removeTnt", () => tnt.remove());
  if (info) finishExplosion(dimension, loc, info.def, info.origin, info.by);
}

/**
 * 爆発本体。
 * def    … 実際に起きる爆発の種類 (ガチャなら当たった種類)
 * origin … 着火したブロックの種類 (統計用。B07)
 */
export function finishExplosion(dimension, center, def, origin, igniterId) {
  const settings = getSettings();
  guard("stats", () => recordExplosion(def.id, origin?.id, igniterId));

  const scale = settings.powerScale;
  if (def.power > 0) {
    queueExplosion(
      dimension,
      center,
      Math.min(def.power * scale, MAX_POWER),
      {
        breaksBlocks: def.breaks && settings.terrain,
        causesFire: def.fire && settings.terrain,
        allowUnderwater: !!def.underwater,
      },
      { priority: true, own: true }
    );
  } else {
    attempt("fizzle", () => {
      dimension.playSound("random.explode", center);
      dimension.spawnParticle("minecraft:huge_explosion_emitter", center);
    });
  }

  const fn = def.effect ? EFFECTS[def.effect] : undefined;
  if (fn) {
    const source = igniterId ? attempt("igniter", () => world.getEntity(igniterId)) : undefined;
    guard(`effect ${def.effect}`, () => fn(dimension, center, { def, scale, source }));
  }

  chainReactionCheck(dimension, floorLoc(center), clamp(Math.ceil(def.power * scale * 0.5), 4, 10));
}

/** 近くのTNTブロックを探して連鎖着火を予約する (重い走査はスケジューラーで分割) */
export function chainReactionCheck(dimension, center, radius = 4) {
  const R = Math.floor(radius);
  runBlockJob("chain", function* () {
    for (let dx = -R; dx <= R; dx++) {
      for (let dy = -R; dy <= R; dy++) {
        for (let dz = -R; dz <= R; dz++) {
          if (dx === 0 && dy === 0 && dz === 0) continue;
          if (dx * dx + dy * dy + dz * dz > R * R) continue;
          const loc = { x: center.x + dx, y: center.y + dy, z: center.z + dz };
          const block = getBlock(dimension, loc);
          if (block && isTnt(block.typeId)) scheduleChainIgnition(dimension, loc, randInt(2, 11));
        }
        yield 2 * R + 1;
      }
    }
  });
}
