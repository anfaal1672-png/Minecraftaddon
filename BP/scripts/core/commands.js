/**
 * ゲーム内から使えるコマンドと、図鑑を開くアイテム。
 *
 * どれも /scriptevent で呼ぶ。統合版のアドオンはカスタムコマンドを
 * 追加できないため、この形が一番手軽に使える。
 *
 *   /scriptevent manytnt:menu    図鑑と設定の画面を開く
 *   /scriptevent manytnt:list    一覧をチャットに出す
 *   /scriptevent manytnt:stats   記録をチャットに出す
 *   /scriptevent manytnt:mute    チャット演出をON/OFF
 *   /scriptevent manytnt:set <項目> <値>  設定を変える
 *   /scriptevent manytnt:debug   握り潰した例外とジョブの状態を出す
 */
import { system, world } from "@minecraft/server";
import { attempt, failureReport } from "./log.js";
import { announce, tell } from "./chat.js";
import { jobStats } from "./jobs.js";
import { openMainMenu } from "./menu.js";
import { activeCount } from "./fuse.js";
import { CATALOG_ITEM, CATEGORIES, TNT_COUNT, configsInCategory } from "./registry.js";
import { SETTINGS, get, reset, set, toggle } from "./settings.js";
import { distinctUsed, flushStats, getStats, topUsed } from "./stats.js";

const HANDLERS = {
  "manytnt:menu": (event) => {
    const player = event.sourceEntity;
    if (!player || player.typeId !== "minecraft:player") {
      announce("§7[manytnt] この操作はプレイヤーから実行してください§r", { force: true });
      return;
    }
    openMainMenu(player);
  },

  "manytnt:list": (event) => {
    const say = (line) => (event.sourceEntity ? tell(event.sourceEntity, line) : announce(line, { force: true }));
    say(`§e[manytnt] 全 ${TNT_COUNT} 種類§r`);
    for (const category of CATEGORIES) {
      const names = configsInCategory(category.id).map((c) => c.name.ja).join("、");
      say(`${category.icon} §l${category.name.ja}§r: §7${names}§r`);
    }
    say("§7着火: 火打石 / 炎・溶岩 / レッドストーン / 燃えている矢 / 他の爆発§r");
    say("§7画面で見る: /scriptevent manytnt:menu§r");
  },

  "manytnt:stats": (event) => {
    const say = (line) => (event.sourceEntity ? tell(event.sourceEntity, line) : announce(line, { force: true }));
    flushStats();
    const stats = getStats();
    say(`§e[manytnt] 累計爆発数: §f${stats.total}§e 回§r`);
    say(`§e[manytnt] 使った種類: §f${distinctUsed()} / ${TNT_COUNT}§r`);
    const top = topUsed(5).map(([name, count]) => `${name}×${count}`).join(", ");
    if (top) say(`§e[manytnt] よく使う上位5種: §f${top}§r`);
  },

  "manytnt:mute": () => {
    const on = toggle("announce");
    announce(on ? "§a[manytnt] チャット演出をONにしました§r" : "§7[manytnt] チャット演出をOFFにしました§r", {
      force: true,
    });
  },

  "manytnt:set": (event) => {
    const [name, raw] = String(event.message ?? "").trim().split(/\s+/);
    const spec = SETTINGS[name];
    if (!spec) {
      announce(`§c[manytnt] 設定名が違います。使えるのは: ${Object.keys(SETTINGS).join(", ")}§r`, { force: true });
      return;
    }
    const value = spec.type === "boolean" ? raw !== "false" && raw !== "0" : Number(raw);
    if (spec.type === "number" && !Number.isFinite(value)) {
      announce(`§c[manytnt] ${name} には ${spec.min}〜${spec.max} の数値を指定してください§r`, { force: true });
      return;
    }
    announce(`§a[manytnt] ${spec.name.ja} を ${set(name, value)} にしました§r`, { force: true });
  },

  "manytnt:reset": () => {
    reset();
    announce("§a[manytnt] 設定を初期値に戻しました§r", { force: true });
  },

  "manytnt:debug": (event) => {
    const say = (line) => (event.sourceEntity ? tell(event.sourceEntity, line) : announce(line, { force: true }));
    const jobs = jobStats();
    say(`§e[manytnt] 起爆中: §f${activeCount()}§e / 実行中のジョブ: §f${jobs.running}§e / 待ち: §f${jobs.queued}§r`);
    say(`§e[manytnt] 完了したジョブ: §f${jobs.completed}§e / 捨てたジョブ: §f${jobs.dropped}§r`);
    say(`§e[manytnt] 設定: §f${Object.keys(SETTINGS).map((n) => `${n}=${get(n)}`).join(" ")}§r`);
    const failures = failureReport().slice(0, 8);
    if (failures.length === 0) {
      say("§a[manytnt] 握り潰した例外はありません§r");
      return;
    }
    say("§c[manytnt] 握り潰した例外 (多い順):§r");
    for (const [label, count] of failures) say(`  §7${label}§r ×${count}`);
  },
};

export function registerCommands() {
  attempt("commands:subscribe", () =>
    system.afterEvents.scriptEventReceive.subscribe((event) => {
      const handler = HANDLERS[event.id];
      if (!handler) return;
      attempt(`command:${event.id}`, () => handler(event));
    })
  );
}

/** 図鑑アイテムを持って使うと画面が開く */
export function registerCatalogItem() {
  attempt("commands:catalogItem", () =>
    world.afterEvents.itemUse.subscribe((event) => {
      if (event.itemStack?.typeId !== CATALOG_ITEM) return;
      const player = event.source;
      if (!player) return;
      attempt("command:catalog", () => openMainMenu(player));
    })
  );
}
