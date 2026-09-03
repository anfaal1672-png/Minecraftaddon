/**
 * いろんなTNT追加アドオン — 入口。
 *
 * ここでは各機能を登録するだけで、中身はそれぞれのモジュールにある。
 *
 *   core/registry.js   TNTの一覧と設定 (data/tnt-table.js から作られる)
 *   core/ignite.js     着火。火打石・炎・レッドストーン・矢・連鎖のすべての入口
 *   core/explode.js    爆発の横取りと、威力・効果の適用
 *   core/stats.js      爆発回数の記録と実績
 *   core/announce.js   チャットへの案内文
 *   core/commands.js   /scriptevent で使えるコマンド
 *   effects/           種類ごとの特殊効果
 *   util/              エンティティ・ブロック・演出の小物
 */
import { registerMuteState } from "./core/announce.js";
import { registerBasicCommands, registerStatsCommand } from "./core/commands.js";
import {
  registerArrowIgnition,
  registerChainCapReset,
  registerDetonator,
  registerFlintIgnition,
  registerIgniteComponent,
} from "./core/ignite.js";
import { registerExplosionHook } from "./core/explode.js";

registerMuteState();
registerBasicCommands();
registerStatsCommand();

registerChainCapReset();
registerIgniteComponent();
registerFlintIgnition();
registerDetonator();
registerArrowIgnition();

registerExplosionHook();
