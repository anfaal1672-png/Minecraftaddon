import { system, world } from "@minecraft/server";
import { TNT_DEFS } from "../generated/defs.js";
import { getSettings, updateSettings } from "./settings.js";
import { statsMessages, flushStats } from "./stats.js";
import { msg, tell, tntName } from "./i18n.js";
import { openGuide, openSettings } from "../ui/menus.js";
import { warn } from "../util/log.js";

/* ------------------------------------------------------------------ */
/*  コマンド (/scriptevent) と TNT図鑑アイテム                          */
/*   /scriptevent manytnt:help     … TNT一覧と使い方                   */
/*   /scriptevent manytnt:mute     … チャット演出のON/OFF               */
/*   /scriptevent manytnt:stats    … 統計・実績                        */
/*   /scriptevent manytnt:settings … 設定メニュー (オペレーター)        */
/*   /scriptevent manytnt:guide    … TNT図鑑を開く                     */
/* ------------------------------------------------------------------ */
export const GUIDE_ID = "manytnt:tnt_guide";

function asPlayer(entity) {
  return entity?.typeId === "minecraft:player" ? entity : undefined;
}

export function registerCommands() {
  system.afterEvents.scriptEventReceive.subscribe((e) => {
    try {
      const player = asPlayer(e.sourceEntity);
      switch (e.id) {
        case "manytnt:mute": {
          const s = updateSettings({ chat: !getSettings().chat });
          tell(undefined, msg(s.chat ? "chat_on" : "chat_off"));
          break;
        }
        case "manytnt:help": {
          const rawtext = [msg("help_list", String(TNT_DEFS.length)), { text: " " }];
          TNT_DEFS.forEach((d, i) => {
            if (i > 0) rawtext.push({ text: ", " });
            rawtext.push(tntName(d.id));
          });
          tell(player, { rawtext });
          for (const key of ["help_ignite", "help_detonator", "help_guide", "help_commands"]) tell(player, msg(key));
          break;
        }
        case "manytnt:stats":
          flushStats();
          for (const line of statsMessages(player)) tell(player, line);
          break;
        case "manytnt:settings":
          if (player) openSettings(player);
          break;
        case "manytnt:guide":
          if (player) openGuide(player);
          break;
        default:
          break;
      }
    } catch (err) {
      warn("scriptevent", err);
    }
  });

  world.afterEvents.itemUse.subscribe((e) => {
    try {
      if (e.itemStack?.typeId === GUIDE_ID && e.source) openGuide(e.source);
    } catch (err) {
      warn("guide.use", err);
    }
  });
}
