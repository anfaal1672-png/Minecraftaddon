/**
 * /scriptevent で使えるコマンド。
 */
import { world, system } from "@minecraft/server";
import { muted } from "./announce.js";
import { TNT_COUNT, TNT_TYPE_IDS, shortName } from "./registry.js";
import { flushStats, loadStats, stats } from "./stats.js";

export function registerBasicCommands() {
  /* ------------------------------------------------------------------ */
  /*  チャットコマンド:                                                   */
  /*   /scriptevent manytnt:mute ... 爆発時のチャット演出をON/OFF          */
  /*   /scriptevent manytnt:help ... TNT一覧を表示                        */
  /* ------------------------------------------------------------------ */
  try {
    system.afterEvents.scriptEventReceive.subscribe((e) => {
      try {
        if (e.id === "manytnt:mute") {
          muted = !muted;
          try {
            world.setDynamicProperty("manytnt:muted", muted);
          } catch (err) {}
          world.sendMessage(muted ? "§7[manytnt] チャット演出をOFFにしました§r" : "§a[manytnt] チャット演出をONにしました§r");
        } else if (e.id === "manytnt:help") {
          const names = TNT_TYPE_IDS.map(shortName);
          world.sendMessage(`§e[manytnt] 全${names.length}種類のTNT:§r ${names.join(", ")}`);
          world.sendMessage("§7着火: 火打石 / 炎・溶岩 / レッドストーン / 他の爆発。§r");
          world.sendMessage("§7チャット演出のON/OFF: /scriptevent manytnt:mute§r");
          world.sendMessage("§7実績・統計を見る: /scriptevent manytnt:stats§r");
        }
      } catch (err) {}
    });
  } catch (err) {}
}

export function registerStatsCommand() {
  try {
    system.afterEvents.scriptEventReceive.subscribe((e) => {
      try {
        if (e.id === "manytnt:stats") {
          loadStats();
          flushStats();
          const distinctUsed = Object.keys(stats.counts).length;
          const totalTypes = TNT_COUNT;
          world.sendMessage(`§e[manytnt] 累計爆発数: §f${stats.total}§e回§r`);
          world.sendMessage(`§e[manytnt] 使用した種類: §f${distinctUsed} / ${totalTypes}§r`);
          const top = Object.entries(stats.counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([k, v]) => `${k}×${v}`)
            .join(", ");
          if (top) world.sendMessage(`§e[manytnt] よく使う上位5種: §f${top}§r`);
        }
      } catch (err) {}
    });
  } catch (err) {}
}
