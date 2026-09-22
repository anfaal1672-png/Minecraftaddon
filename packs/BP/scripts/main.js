/* ------------------------------------------------------------------ */
/*  いろんなTNT追加アドオン v31 — エントリーポイント                     */
/*                                                                    */
/*  ここではイベントの登録だけを行う。処理の本体は各モジュールにある:     */
/*    core/     着火・爆発・スケジューラー・安全処理                     */
/*    effects/  各TNTの特殊効果                                         */
/*    systems/  設定・統計・多言語・コマンド・起爆装置・地雷             */
/*    ui/       TNT図鑑・設定メニュー                                   */
/*    generated/ tools/generate.mjs が作るTNT定義 (直接編集しない)       */
/* ------------------------------------------------------------------ */
import { world } from "@minecraft/server";
import { registerExplosionHook } from "./core/explosion.js";
import { registerTriggers } from "./systems/triggers.js";
import { registerDetonator } from "./systems/detonator.js";
import { registerCommands } from "./systems/commands.js";
import { getSettings } from "./systems/settings.js";
import { restorePendingDisco } from "./effects/fun.js";
import { guard } from "./util/log.js";

guard("register.explosion", registerExplosionHook);
guard("register.triggers", registerTriggers);
guard("register.detonator", registerDetonator);
guard("register.commands", registerCommands);

world.afterEvents.worldLoad.subscribe(() => {
  guard("load.settings", getSettings);
  guard("load.disco", restorePendingDisco);
});
