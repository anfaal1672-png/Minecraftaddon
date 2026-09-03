/**
 * 爆発の横取りと、威力・効果の適用。
 */
import { world, system } from "@minecraft/server";
import { chainReactionCheck } from "./ignite.js";
import { PRIMED_TNT, TAG_PREFIX, tntConfig } from "./registry.js";
import { recordExplosion } from "./stats.js";

export function finishExplosion(dimension, center, typeId, cfg) {
  recordExplosion(typeId);

  if (cfg.power > 0) {
    // 安全上限のクランプ。威力950で17秒のハング→ウォッチドッグ強制終了を
    // 実際に確認したため、設定ミスや今後の調整で誤って極端な値になっても
    // 致命的なフリーズが起きないよう、ここで必ず上限を掛けておく。
    const safePower = Math.min(cfg.power, 100);
    try {
      dimension.createExplosion(center, safePower, {
        breaksBlocks: cfg.breaks,
        causesFire: cfg.fire,
        allowUnderwater: !!cfg.underwater,
      });
    } catch (err) {}
  } else {
    try {
      dimension.playSound("random.explode", center);
      dimension.spawnParticle("minecraft:huge_explosion_emitter", center);
    } catch (err) {}
  }

  if (cfg.run) {
    try {
      cfg.run(dimension, center);
    } catch (err) {
      console.warn(`manytnt effect error: ${err}`);
    }
  }

  chainReactionCheck(dimension, {
    x: Math.floor(center.x),
    y: Math.floor(center.y),
    z: Math.floor(center.z),
  });
}

/** 爆発イベントの横取り */
export function registerExplosionHook() {
  /* ------------------------------------------------------------------ */
  /*  爆発の瞬間を横取りする。                                            */
  /*  起爆中エンティティが爆発すると world.beforeEvents.explosion         */
  /*  が発火するので、それが「うちのタグ付きTNT」だった場合だけ            */
  /*  本来の爆発をキャンセルして、代わりにこちらで威力や特殊効果を適用する。*/
  /*  タグの無い(=本物の)TNTや、クリーパー等の爆発には一切干渉しない。     */
  /* ------------------------------------------------------------------ */
  try {
    world.beforeEvents.explosion.subscribe((event) => {
      try {
        const source = event.source;
        const dimension = event.dimension;

        let tag;
        if (source && source.typeId === PRIMED_TNT) {
          try {
            tag = source.getTags().find((t) => t.startsWith(TAG_PREFIX));
          } catch (err) {}
        }

        if (tag) {
          // うちのタグ付きTNT: 本来の爆発をキャンセルして独自処理に差し替える
          const typeId = tag.slice(TAG_PREFIX.length);
          const cfg = tntConfig(typeId);
          if (!cfg) return;

          event.cancel = true;

          let loc;
          try {
            loc = { ...source.location };
          } catch (err) {
            return;
          }

          system.run(() => finishExplosion(dimension, loc, typeId, cfg));
          return;
        }

        // ここに来るのは「うちのTNTではない爆発」= 本物のバニラTNT・クリーパー・
        // ベッド・他アドオンの爆発など。こちらは何もキャンセルせず通常通り爆発させるが、
        // 巻き込まれた場所の近くにうちのTNTがあれば、通常TNT同様に連鎖着火させる。
        try {
          let epicenter = null;
          if (source) {
            try {
              epicenter = { ...source.location };
            } catch (err) {}
          }
          if (!epicenter) {
            try {
              const blocks = event.getImpactedBlocks ? event.getImpactedBlocks() : [];
              if (blocks && blocks.length > 0) {
                epicenter = { x: blocks[0].x, y: blocks[0].y, z: blocks[0].z };
              }
            } catch (err) {}
          }
          if (epicenter) {
            const loc = {
              x: Math.floor(epicenter.x),
              y: Math.floor(epicenter.y),
              z: Math.floor(epicenter.z),
            };
            system.run(() => chainReactionCheck(dimension, loc));
          }
        } catch (err) {}
      } catch (err) {}
    });
  } catch (err) {
    console.warn(`manytnt: explosion hook registration failed: ${err}`);
  }
}
