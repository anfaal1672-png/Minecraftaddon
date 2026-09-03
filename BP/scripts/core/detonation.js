/**
 * 爆発の横取りと、そこから先の組み立て。
 *
 * 起爆中のTNTが爆発すると world.beforeEvents.explosion が呼ばれる。
 * それがこのアドオンのTNTだったときだけ本来の爆発を取り消して、
 * 威力・特殊効果・連鎖をこちらの手順で組み立て直す。
 * バニラのTNTやクリーパーの爆発には一切干渉しない。
 */
import { system, world } from "@minecraft/server";
import { attempt, note } from "./log.js";
import { chainReaction } from "./chain.js";
import { PRIMED_TNT, TAG_PREFIX, tntConfig } from "./registry.js";
import { mayBreakBlocks, maySetFire } from "./settings.js";
import { recordExplosion } from "./stats.js";
import { burst, sound } from "../lib/fx.js";
import { blockPos } from "../lib/math.js";

/**
 * createExplosion に渡してよい威力の上限。
 *
 * 威力950で17秒のハング (ウォッチドッグによる強制終了) を実際に確認している。
 * 設定ミスや今後の調整で極端な値になっても致命的なフリーズが起きないよう、
 * ここで必ず上限を掛けておく。
 */
export const MAX_EXPLOSION_POWER = 100;

/**
 * 1発ぶんの爆発を組み立てる。
 * 着火から先の流れはすべてここに集約してあるので、
 * 「爆発したときに何が起きるか」を追うときはこの関数だけ読めばよい。
 */
export function detonate(dimension, center, cfg) {
  recordExplosion(cfg.typeId);

  const breaks = cfg.breaks && mayBreakBlocks();
  const fire = cfg.fire && maySetFire();

  if (cfg.power > 0) {
    attempt("detonate:explosion", () =>
      dimension.createExplosion(center, Math.min(cfg.power, MAX_EXPLOSION_POWER), {
        breaksBlocks: breaks,
        causesFire: fire,
        allowUnderwater: !!cfg.underwater,
      })
    );
  } else {
    // 威力0のTNTも「爆発した」ことは分かるようにする
    sound(dimension, "random.explode", center);
    burst(dimension, "minecraft:huge_explosion_emitter", center, { count: 1, radius: 0.1 });
  }

  if (cfg.run) {
    try {
      cfg.run(dimension, center, cfg);
    } catch (err) {
      note(`effect:${cfg.effect}`, err);
    }
  }

  chainReaction(dimension, blockPos(center));
}

/** 起爆中エンティティに付いているタグから、種類を割り出す */
function configFromSource(source) {
  if (!source || source.typeId !== PRIMED_TNT) return null;
  const tag = attempt("detonate:tags", () => source.getTags().find((t) => t.startsWith(TAG_PREFIX)), undefined);
  if (!tag) return null;
  return tntConfig(tag.slice(TAG_PREFIX.length)) ?? null;
}

/** 爆発が起きた場所を、なるべく確かに割り出す */
function epicenterOf(event) {
  const fromSource = attempt("detonate:sourceLoc", () => (event.source ? { ...event.source.location } : null), null);
  if (fromSource) return fromSource;
  return attempt("detonate:impacted", () => {
    const blocks = event.getImpactedBlocks?.() ?? [];
    if (blocks.length === 0) return null;
    return { x: blocks[0].x, y: blocks[0].y, z: blocks[0].z };
  }, null);
}

export function registerExplosionHook() {
  attempt("detonate:subscribe", () =>
    world.beforeEvents.explosion.subscribe((event) => {
      const dimension = event.dimension;
      const cfg = configFromSource(event.source);

      if (cfg) {
        // このアドオンのTNT。本来の爆発を取り消して、独自の手順に差し替える
        event.cancel = true;
        const center = attempt("detonate:center", () => ({ ...event.source.location }), null);
        if (!center) return;
        attempt("detonate:schedule", () => system.run(() => detonate(dimension, center, cfg)));
        return;
      }

      // ここに来るのはバニラのTNT・クリーパー・ベッド・他アドオンの爆発。
      // 取り消しはせずそのまま爆発させるが、巻き込まれた場所の近くに
      // このアドオンのTNTがあれば、通常のTNTと同じく連鎖着火させる。
      const epicenter = epicenterOf(event);
      if (!epicenter) return;
      attempt("detonate:chain", () =>
        system.run(() => chainReaction(dimension, blockPos(epicenter)))
      );
    })
  );
}
