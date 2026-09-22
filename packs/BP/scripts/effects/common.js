import { MolangVariableMap } from "@minecraft/server";
import { runBlockJob } from "../core/scheduler.js";
import { getBlock } from "../core/safety.js";
import { attempt } from "../util/log.js";
import { floorLoc, rand } from "../util/math.js";

/* ------------------------------------------------------------------ */
/*  効果関数の共通ヘルパー                                              */
/* ------------------------------------------------------------------ */

export function particle(dimension, id, loc, molang) {
  attempt("particle", () => dimension.spawnParticle(id, loc, molang));
}

export function sound(dimension, id, loc, opts) {
  attempt("sound", () => dimension.playSound(id, loc, opts));
}

/** center の周りにパーティクルをばら撒く */
export function burst(dimension, id, center, count, spread = 3, height = 2, molang) {
  for (let n = 0; n < count; n++) {
    particle(
      dimension,
      id,
      {
        x: center.x + (Math.random() - 0.5) * spread,
        y: center.y + Math.random() * height,
        z: center.z + (Math.random() - 0.5) * spread,
      },
      molang
    );
  }
}

/**
 * 色付きのポーション風パーティクル (B23)。
 * mob_spell_particle は色の Molang 変数を渡さないと色が付かないため、ここで設定する。
 */
export function spellColor(red, green, blue) {
  return attempt("molang", () => {
    const m = new MolangVariableMap();
    m.setColorRGBA("variable.color", { red, green, blue, alpha: 1 });
    return m;
  });
}

/** 水平の円 (半径 R) × 高さ [dyMin, dyMax] のブロック座標を列挙 */
export function* discLocs(center, R, dyMin = 0, dyMax = 0) {
  const c = floorLoc(center);
  for (let dx = -R; dx <= R; dx++) {
    for (let dz = -R; dz <= R; dz++) {
      if (dx * dx + dz * dz > R * R) continue;
      for (let dy = dyMin; dy <= dyMax; dy++) yield { x: c.x + dx, y: c.y + dy, z: c.z + dz };
    }
  }
}

/** 球 (半径 R) のブロック座標を列挙。dyMin/dyMax で上下を切り詰められる */
export function* sphereLocs(center, R, dyMin = -R, dyMax = R) {
  const c = floorLoc(center);
  for (let dy = Math.max(-R, dyMin); dy <= Math.min(R, dyMax); dy++) {
    for (let dx = -R; dx <= R; dx++) {
      for (let dz = -R; dz <= R; dz++) {
        if (dx * dx + dy * dy + dz * dz > R * R) continue;
        yield { x: c.x + dx, y: c.y + dy, z: c.z + dz };
      }
    }
  }
}

/**
 * 座標の列を、スケジューラーの予算内で少しずつ処理する。
 * fn(block, loc) — ブロックが取れた座標だけ呼ばれる。
 */
export function forEachBlock(label, dimension, locs, fn) {
  runBlockJob(label, function* () {
    let ops = 0;
    for (const loc of locs) {
      const block = getBlock(dimension, loc);
      if (block) attempt(label, () => fn(block, loc));
      if (++ops >= 64) {
        yield ops;
        ops = 0;
      }
    }
    if (ops > 0) yield ops;
  });
}

export function randomAround(center, spread, height = 0) {
  return {
    x: center.x + rand(-spread, spread),
    y: center.y + (height ? Math.random() * height : 0),
    z: center.z + rand(-spread, spread),
  };
}

export function below(loc) {
  return { x: loc.x, y: loc.y - 1, z: loc.z };
}

export function above(loc) {
  return { x: loc.x, y: loc.y + 1, z: loc.z };
}
