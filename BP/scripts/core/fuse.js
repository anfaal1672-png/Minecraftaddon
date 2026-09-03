/**
 * 導火線が燃えている間の面倒を見る。
 *
 * 起爆中のTNTは manytnt:primed_tnt という専用のエンティティとして飛ぶ。
 * バニラの minecraft:tnt を使うと見た目が普通のTNTになってしまうので、
 * 種類ごとのテクスチャを持てる自前のエンティティにしてある。
 *
 * 追跡は「1個につき1本のタイマー」ではなく、全体で1本の巡回にまとめてある。
 * TNTを200個まとめて連鎖させると前者ではタイマーが200本になるが、
 * この形なら何個並べても巡回は1本のままで済む。
 */
import { system } from "@minecraft/server";
import { attempt, note } from "./log.js";
import { KIND_PROPERTY, NS, PRIMED_TNT, TAG_PREFIX } from "./registry.js";
import { get } from "./settings.js";
import { particle, shake, sound } from "../lib/fx.js";
import { pullInward, pullItems } from "../lib/entities.js";
import { rand } from "../lib/math.js";

/** 巡回の間隔 (tick)。短くすると軌跡が濃くなるが負荷も上がる */
const PATROL_INTERVAL = 2;

/** 保険。この時間を超えたものは追跡から外す (導火線より必ず長くする) */
const MAX_TRACK_TICKS = 400;

/** 連鎖着火のときの導火線 (tick)。バニラと同じく 0.5〜2秒 */
export const SHORT_FUSE_EVENT = `${NS}:short_fuse`;

/** 追跡中の起爆中TNT */
const active = [];

/**
 * 起爆中のTNTを1個生み出す。
 *
 * @param cfg 種類の設定 (registry のもの)
 * @param chained 他の爆発に巻き込まれた着火か
 * @returns 生まれたエンティティ。失敗したら null
 */
export function spawnPrimed(dimension, center, cfg, { chained = false } = {}) {
  const entity = attempt("fuse:spawn", () => dimension.spawnEntity(PRIMED_TNT, center), null);
  if (!entity) return null;

  attempt("fuse:tag", () => entity.addTag(TAG_PREFIX + cfg.typeId));
  attempt("fuse:kind", () => entity.setProperty(KIND_PROPERTY, cfg.index));

  // 導火線の長さは種類ごとに違う。エンティティ側に用意してある
  // component_group を呼び分けることで切り替える。
  const fuseEvent = chained ? SHORT_FUSE_EVENT : `${NS}:fuse_${cfg.fuse}`;
  attempt("fuse:event", () => entity.triggerEvent(fuseEvent));

  if (cfg.launchUp) {
    attempt("fuse:launch", () => entity.applyImpulse({ x: rand(-0.08, 0.08), y: 1.8, z: rand(-0.08, 0.08) }));
  }

  sound(dimension, "random.fuse", center);
  track(dimension, entity, cfg, chained ? 40 : cfg.fuse);
  return entity;
}

/** 巡回の対象に加える */
function track(dimension, entity, cfg, fuseTicks) {
  active.push({
    dimension,
    entity,
    cfg,
    elapsed: 0,
    fuseTicks: Math.min(MAX_TRACK_TICKS, fuseTicks),
    warned: false,
  });
}

/**
 * 全体で1本だけ回る巡回。
 * 軌跡・吸い寄せ・警報をここでまとめて処理する。
 */
export function registerFuseLoop() {
  attempt("fuse:loop", () =>
    system.runInterval(() => {
      for (let i = active.length - 1; i >= 0; i--) {
        const item = active[i];
        item.elapsed += PATROL_INTERVAL;

        let loc;
        try {
          loc = item.entity.location;
        } catch (err) {
          active.splice(i, 1); // 既に爆発した、または消えた
          continue;
        }
        if (item.elapsed > item.fuseTicks + 40) {
          active.splice(i, 1);
          continue;
        }

        try {
          patrol(item, loc);
        } catch (err) {
          note("fuse:patrol", err);
          active.splice(i, 1);
        }
      }
    }, PATROL_INTERVAL)
  );
}

function patrol(item, loc) {
  const { dimension, cfg } = item;

  // 飛んでいる間、種類ごとの色のパーティクルを引く
  particle(dimension, cfg.trail ?? "minecraft:basic_crit_particle", {
    x: loc.x + rand(-0.3, 0.3),
    y: loc.y + 0.6,
    z: loc.z + rand(-0.3, 0.3),
  });

  if (cfg.gravityPull) pullInward(dimension, loc, 8, 0.9, { vertical: 0.5, cap: 0.35 });
  if (cfg.magnetPull) pullItems(dimension, loc, 10);

  // 大型TNTは、燃えている間ずっと警報が鳴る。
  // 逃げる時間を与えるためと、置いた本人にも緊張感を出すため。
  if (!cfg.warns || !get("warning")) return;

  const remain = item.fuseTicks - item.elapsed;
  if (remain <= 0) return;
  const urgency = 1 - remain / item.fuseTicks;

  // 残りが減るほど間隔が詰まり、音が高くなる
  const beatEvery = remain > item.fuseTicks * 0.5 ? 8 : remain > item.fuseTicks * 0.25 ? 4 : 2;
  if (item.elapsed % beatEvery === 0) {
    sound(dimension, "note.pling", loc, { volume: 1.2, pitch: 0.8 + urgency * 1.2 });
  }
  if (!item.warned && remain <= 20) {
    item.warned = true;
    shake(dimension, loc, { radius: 24, intensity: 0.25, seconds: 1 });
  }
}

/** いま追跡している数 (テストと診断用) */
export function activeCount() {
  return active.length;
}

/** 追跡をすべて捨てる (テスト用) */
export function clearActive() {
  active.length = 0;
}
