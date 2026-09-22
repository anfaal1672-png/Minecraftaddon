import { world } from "@minecraft/server";
import { getSettings } from "./settings.js";
import { attempt } from "../util/log.js";

/* ------------------------------------------------------------------ */
/*  多言語メッセージ。文字列は texts/*.lang に置き、ここでは翻訳キーを   */
/*  RawMessage に組み立てるだけ。各プレイヤーの言語設定で表示される。   */
/* ------------------------------------------------------------------ */
const NS = "manytnt";

/** manytnt.msg.<key> の翻訳。args は文字列か RawMessage */
export function msg(key, ...args) {
  return tr(`${NS}.msg.${key}`, ...args);
}

export function tr(translate, ...args) {
  if (args.length === 0) return { translate };
  if (args.every((a) => typeof a === "string" || typeof a === "number")) {
    return { translate, with: args.map(String) };
  }
  return {
    translate,
    with: { rawtext: args.map((a) => (typeof a === "object" ? a : { text: String(a) })) },
  };
}

export function tntName(typeId) {
  return { translate: `tile.${typeId}.name` };
}

export function tntDesc(typeId) {
  return { translate: `${NS}.desc.${typeId.replace(`${NS}:`, "")}` };
}

export function categoryName(cat) {
  return { translate: `${NS}.cat.${cat}` };
}

export function ingredientName(itemId) {
  if (itemId.startsWith(`${NS}:`)) return tntName(itemId);
  return { translate: `${NS}.ing.${itemId.replace("minecraft:", "")}` };
}

export function join(parts, sep = "") {
  const rawtext = [];
  parts.forEach((p, i) => {
    if (i > 0 && sep) rawtext.push({ text: sep });
    rawtext.push(typeof p === "object" ? p : { text: String(p) });
  });
  return { rawtext };
}

/** チャット演出 (設定でOFFにできる) */
export function announce(message) {
  if (!getSettings().chat) return;
  attempt("announce", () => world.sendMessage(message));
}

/** 設定に関係なく必ず送るシステムメッセージ */
export function tell(target, message) {
  attempt("tell", () => (target ?? world).sendMessage(message));
}

export function actionBar(player, message) {
  attempt("actionBar", () => player.onScreenDisplay.setActionBar(message));
}

/** ネームタグ用 (RawMessage が使えないので設定の言語で文字列にする) */
export function plainName(def) {
  return getSettings().nameTagLang === "en" ? def.name.en : def.name.ja;
}
