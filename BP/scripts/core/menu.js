/**
 * ゲーム内のUI。TNT図鑑と設定画面。
 *
 * 72種類もあるとチャットに一覧を流しても読めないので、
 * カテゴリ → 一覧 → 詳細 とたどれる図鑑にしてある。
 * 詳細にはレシピも出るので、作り方を調べるのに外部の情報が要らない。
 */
import { system } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { attempt } from "./log.js";
import { actionBar } from "./chat.js";
import { CATEGORIES, ALL_CONFIGS, configsInCategory, TNT_COUNT } from "./registry.js";
import { SETTINGS, get, set } from "./settings.js";
import { distinctUsed, getStats, topUsed } from "./stats.js";

/**
 * 画面を出す。
 *
 * プレイヤーがチャットや別の画面を開いていると "UserBusy" で弾かれるので、
 * 開けるようになるまで少しだけ待ち直す。待ちきれなければ諦める。
 */
async function show(form, player, { retries = 20 } = {}) {
  for (let i = 0; i < retries; i++) {
    let response;
    try {
      response = await form.show(player);
    } catch (err) {
      return null;
    }
    if (!response.canceled) return response;
    if (response.cancelationReason !== "UserBusy") return null;
    // チャット欄などを閉じるのを待つ
    await waitTicks(10);
  }
  actionBar(player, "§7画面を閉じてからもう一度お試しください§r");
  return null;
}

function waitTicks(ticks) {
  // system.waitTicks が無い端末向けに runTimeout でも同じことができるようにしておく
  return attempt("menu:wait", () => system.waitTicks(ticks), null)
    ?? new Promise((resolve) => system.runTimeout(resolve, ticks));
}

/* ------------------------------------------------------------------ */
/*  入口                                                               */
/* ------------------------------------------------------------------ */

export async function openMainMenu(player) {
  const form = new ActionFormData()
    .title("§lいろんなTNT§r")
    .body(`全 §e${TNT_COUNT}§r 種類。カテゴリから選ぶと、威力・効果・レシピが見られます。`)
    .button("§l図鑑§r\n§7種類を調べる", "textures/items/gunpowder")
    .button("§l記録§r\n§7爆発の統計と実績", "textures/items/book_normal")
    .button("§l設定§r\n§7動きを調整する", "textures/items/redstone_dust");

  const response = await show(form, player);
  if (!response) return;
  if (response.selection === 0) return openCatalog(player);
  if (response.selection === 1) return openStats(player);
  if (response.selection === 2) return openSettings(player);
}

/* ------------------------------------------------------------------ */
/*  図鑑                                                               */
/* ------------------------------------------------------------------ */

export async function openCatalog(player) {
  const form = new ActionFormData().title("§lTNT図鑑§r").body("カテゴリを選んでください");
  for (const category of CATEGORIES) {
    const count = configsInCategory(category.id).length;
    form.button(`${category.icon} §l${category.name.ja}§r\n§7${count} 種類`);
  }
  form.button("§7◀ もどる§r");

  const response = await show(form, player);
  if (!response) return;
  if (response.selection >= CATEGORIES.length) return openMainMenu(player);
  return openCategory(player, CATEGORIES[response.selection]);
}

async function openCategory(player, category) {
  const configs = configsInCategory(category.id);
  const form = new ActionFormData()
    .title(`${category.icon} §l${category.name.ja}§r`)
    .body(`${configs.length} 種類`);
  for (const cfg of configs) form.button(`§l${cfg.name.ja}§r\n§7${powerLabel(cfg)}`);
  form.button("§7◀ もどる§r");

  const response = await show(form, player);
  if (!response) return;
  if (response.selection >= configs.length) return openCatalog(player);
  return openDetail(player, configs[response.selection], category);
}

/** 威力を一目で分かる形にする */
export function powerLabel(cfg) {
  if (cfg.power === 0) return "威力なし (効果だけ)";
  const stars = Math.min(5, Math.max(1, Math.ceil(cfg.power / 16)));
  return `威力 ${cfg.power} ${"★".repeat(stars)}${"☆".repeat(5 - stars)}`;
}

/** 材料を「アイテム名 ×個数」の形にまとめる */
export function recipeLines(cfg) {
  const counted = new Map();
  for (const item of cfg.recipe.items) counted.set(item, (counted.get(item) ?? 0) + 1);
  return [...counted.entries()].map(([item, count]) => {
    const label = itemLabel(item);
    return count > 1 ? `  ・${label} ×${count}` : `  ・${label}`;
  });
}

function itemLabel(itemId) {
  const own = ALL_CONFIGS.find((c) => c.typeId === itemId);
  if (own) return `§e${own.name.ja}§r`;
  return itemId.replace("minecraft:", "");
}

async function openDetail(player, cfg, category) {
  const lines = [
    `§7${cfg.desc.ja}§r`,
    "",
    `§l威力§r  ${powerLabel(cfg)}`,
    `§l地形§r  ${cfg.breaks ? "壊す" : "壊さない"}${cfg.fire ? " / 着火する" : ""}${cfg.underwater ? " / 水中でも爆発" : ""}`,
    `§l導火線§r  ${(cfg.fuse / 20).toFixed(1)} 秒`,
    "",
    "§l作り方§r §7(作業台。並びは自由)§r",
    ...recipeLines(cfg),
    cfg.recipe.count > 1 ? `  → ${cfg.recipe.count} 個できる` : null,
    "",
    `§8${cfg.typeId}§r`,
  ].filter((line) => line !== null);

  // ここで MessageFormData を使わないのは、統合版だとボタンの並びと
  // selection の対応が直感と逆になることがあり、「もどる」を押したのに
  // 閉じてしまう、という分かりにくい壊れ方をするため。
  const form = new ActionFormData()
    .title(`§l${cfg.name.ja}§r`)
    .body(lines.join("\n"))
    .button("§7◀ 一覧へ§r")
    .button("閉じる");

  const response = await show(form, player);
  if (!response) return;
  if (response.selection === 0) return openCategory(player, category);
}

/* ------------------------------------------------------------------ */
/*  記録                                                               */
/* ------------------------------------------------------------------ */

export async function openStats(player) {
  const stats = getStats();
  const top = topUsed(8).map(([name, count], i) => {
    const cfg = ALL_CONFIGS.find((c) => c.id === name);
    return `  ${i + 1}. ${cfg?.name.ja ?? name} §7×${count}§r`;
  });

  const body = [
    `§l累計爆発数§r  §e${stats.total}§r 回`,
    `§l使った種類§r  §e${distinctUsed()}§r / ${TNT_COUNT}`,
    `§l解除した実績§r  §e${stats.milestones.length}§r 個`,
    "",
    top.length ? "§lよく使う種類§r" : "§7まだ何も爆発していません§r",
    ...top,
  ];

  const form = new ActionFormData()
    .title("§l記録§r")
    .body(body.join("\n"))
    .button("§7◀ もどる§r")
    .button("閉じる");

  const response = await show(form, player);
  if (response && response.selection === 0) return openMainMenu(player);
}

/* ------------------------------------------------------------------ */
/*  設定                                                               */
/* ------------------------------------------------------------------ */

/** 設定画面に出す順番 */
const SETTING_ORDER = ["announce", "chain", "terrain", "warning", "scale"];

export async function openSettings(player) {
  const form = new ModalFormData().title("§l設定§r");
  for (const name of SETTING_ORDER) {
    const spec = SETTINGS[name];
    if (spec.type === "boolean") {
      form.toggle(`${spec.name.ja}\n§7${spec.help.ja}§r`, { defaultValue: get(name) });
    } else {
      // スライダーは整数しか扱えないので、百分率で受け取って戻す
      form.slider(`${spec.name.ja} (%)\n§7${spec.help.ja}§r`, spec.min * 100, spec.max * 100, {
        valueStep: 5,
        defaultValue: Math.round(get(name) * 100),
      });
    }
  }
  form.submitButton("保存する");

  const response = await show(form, player);
  if (!response || !response.formValues) return;

  SETTING_ORDER.forEach((name, i) => {
    const spec = SETTINGS[name];
    const value = response.formValues[i];
    set(name, spec.type === "boolean" ? value === true : Number(value) / 100);
  });
  actionBar(player, "§a設定を保存しました§r");
}
