/**
 * 投げる爆弾。
 *
 * 投げる動きそのものはエンティティ側 (minecraft:projectile) に任せてあり、
 * ここは「当たった場所で何が起きるか」だけを受け持つ。
 * TNTと違って置く余裕が要らないので、追われている最中でも使える。
 */
import { world } from "@minecraft/server";
import { attempt, note } from "../core/log.js";

import { mayBreakBlocks, maySetFire } from "../core/settings.js";
import { THROWABLES } from "../data/gear-table.js";
import { igniteFires } from "../effects/elemental.js";
import { applyEffects, damageArea, knockOutward } from "../lib/entities.js";
import { burst, later, repeat, ring, scatter, sound } from "../lib/fx.js";
import { NS } from "../core/registry.js";

/** 投げ物1発ぶんの爆発。設定を見るのを忘れないよう1か所にまとめる */
function blast(dimension, loc, power, { fire = false } = {}) {
  return attempt("throwable:blast", () =>
    dimension.createExplosion(loc, power, {
      breaksBlocks: mayBreakBlocks(),
      causesFire: fire && maySetFire(),
    }), false);
}

export function grenadeHit(dimension, loc) {
  blast(dimension, loc, 4);
  burst(dimension, "minecraft:basic_flame_particle", loc, { count: 10, radius: 2 });
  sound(dimension, "random.explode", loc);
}

export function incendiaryHit(dimension, loc) {
  blast(dimension, loc, 2, { fire: true });
  igniteFires(dimension, loc, 5, 0.5);
  for (const ent of nearbyLiving(dimension, loc, 5)) {
    attempt("throwable:onFire", () => ent.setOnFire(8, true));
  }
  scatter(dimension, "minecraft:basic_flame_particle", loc, { count: 24, radius: 5, height: 2 });
  sound(dimension, "mob.ghast.fireball", loc);
}

export function flashbangHit(dimension, loc) {
  // 何も壊さない。目と足を一時的に潰すだけ
  applyEffects(dimension, loc, 12, [
    ["minecraft:blindness", 120, 0],
    ["minecraft:nausea", 120, 1],
    ["minecraft:slowness", 80, 2],
  ]);
  burst(dimension, "minecraft:huge_explosion_emitter", loc, { count: 2, radius: 0.5 });
  repeat(4, 2, (i) => ring(dimension, "minecraft:endrod", loc, i * 2, { count: 16 + i * 6, y: 1 }));
  sound(dimension, "random.explode", loc, { volume: 3, pitch: 2.0 });
}

export function smokeBombHit(dimension, loc) {
  sound(dimension, "random.fizz", loc, { volume: 2 });
  repeat(24, 5, () => {
    scatter(dimension, "minecraft:basic_smoke_particle", loc, { count: 20, radius: 7, height: 4 });
    applyEffects(dimension, loc, 7, [["minecraft:blindness", 60, 0]]);
  });
}

export function stickyBombHit(dimension, loc) {
  // 貼り付いてから遅れて爆発する。逃げる時間がある代わりに威力が大きい
  sound(dimension, "mob.slime.big", loc);
  repeat(6, 10, (i) => {
    scatter(dimension, "minecraft:villager_happy", loc, { count: 6, radius: 1.5, height: 1 });
    sound(dimension, "note.pling", loc, { pitch: 0.8 + i * 0.2 });
  });
  later(60, () => {
    blast(dimension, loc, 9);
    knockOutward(dimension, loc, 10, 2.2);
    damageArea(dimension, loc, 8, 24);
    sound(dimension, "random.explode", loc, { volume: 2, pitch: 0.7 });
  });
}

/** 巻き込む相手 (アイテムと起爆中のTNTは外す) */
function nearbyLiving(dimension, loc, radius) {
  return attempt("throwable:nearby", () =>
    dimension.getEntities({ location: loc, maxDistance: radius })
      .filter((ent) => !["minecraft:item", "minecraft:xp_orb", "manytnt:primed_tnt"].includes(ent.typeId)),
    []);
}

const HANDLERS = { grenadeHit, incendiaryHit, flashbangHit, smokeBombHit, stickyBombHit };

/** 投擲物の識別子から、当たったときの処理を引く */
const byProjectile = new Map(
  THROWABLES.map((bomb) => [`${NS}:${bomb.id}_projectile`, { ...bomb, run: HANDLERS[bomb.effect] ?? null }])
);

/** 同じ1発を、ブロックとエンティティの両方で二重に処理しないための覚え書き */
const handled = new Set();

function detonateThrowable(dimension, projectile, loc) {
  const bomb = byProjectile.get(projectile.typeId);
  if (!bomb || !bomb.run) return;

  const id = attempt("throwable:id", () => projectile.id, null);
  if (id) {
    if (handled.has(id)) return;
    handled.add(id);
    later(40, () => handled.delete(id));
  }
  try {
    bomb.run(dimension, loc);
  } catch (err) {
    note(`throwable:${bomb.effect}`, err);
  }
}

export function registerThrowables() {
  attempt("throwable:hitBlock", () =>
    world.afterEvents.projectileHitBlock.subscribe((event) => {
      if (!byProjectile.has(event.projectile?.typeId)) return;
      const loc = attempt("throwable:hitLoc", () => ({ ...event.location }), null);
      if (loc) detonateThrowable(event.dimension, event.projectile, loc);
    })
  );

  attempt("throwable:hitEntity", () =>
    world.afterEvents.projectileHitEntity.subscribe((event) => {
      if (!byProjectile.has(event.projectile?.typeId)) return;
      const loc = attempt("throwable:hitLoc", () => ({ ...event.location }), null);
      if (loc) detonateThrowable(event.dimension, event.projectile, loc);
    })
  );
}

/** 投げ物の名前一覧 (図鑑用) */
export function throwableList() {
  return [...byProjectile.values()];
}

/** 覚え書きを捨てる (テスト用) */
export function clearThrowableMemory() {
  handled.clear();
}
