/**
 * いろんなTNT追加アドオン — 入口。
 *
 * ここは登録するだけ。中身はそれぞれのモジュールにある。
 *
 *   core/registry.js    TNTの一覧と設定 (data/tnt-table.js から作られる)
 *   core/settings.js    ワールドごとの設定とゲームルールの尊重
 *   core/jobs.js        重い処理を捌く共有のジョブ置き場
 *   core/ignition.js    着火。火打石・炎・レッドストーン・矢・遠隔起爆の入口
 *   core/fuse.js        導火線が燃えている間の追跡と演出
 *   core/detonation.js  爆発の横取りと、威力・効果の適用
 *   core/chain.js       連鎖爆発
 *   core/stats.js       爆発の記録と実績
 *   core/menu.js        図鑑と設定の画面
 *   core/commands.js    /scriptevent
 *   effects/            種類ごとの特殊効果
 *   gear/               TNT以外の追加物 (投げる爆弾・道具・仕掛けブロック)
 *   lib/                座標・ブロック・エンティティ・演出の道具
 */
import { world } from "@minecraft/server";
import { attempt } from "./core/log.js";
import { registerChainCapReset } from "./core/chain.js";
import { registerCommands } from "./core/commands.js";
import { registerExplosionHook } from "./core/detonation.js";
import { registerFuseLoop } from "./core/fuse.js";
import { registerIgnitionSources } from "./core/ignition.js";
import { load as loadSettings } from "./core/settings.js";
import { loadStats } from "./core/stats.js";
import { registerGearBlocks } from "./gear/blocks.js";
import { registerThrowables } from "./gear/throwables.js";
import { registerTools } from "./gear/tools.js";

// ワールドが読み込まれる前に dynamic property は読めないので、
// 保存してあるものはすべてここで読み直す。
attempt("main:worldLoad", () =>
  world.afterEvents.worldLoad.subscribe(() => {
    loadSettings();
    loadStats();
  })
);

registerIgnitionSources();
registerFuseLoop();
registerExplosionHook();
registerChainCapReset();
registerCommands();

// TNT以外の追加物 (投げる爆弾・道具・仕掛けブロック)
registerThrowables();
registerTools();
registerGearBlocks();
