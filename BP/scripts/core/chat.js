/**
 * チャットへの案内文。
 *
 * 出す・出さないは設定 (settings.announce) 1か所で決まる。
 * 連鎖爆発で同じ文が何十行も流れないよう、直前と同じ文はまとめる。
 */
import { system, world } from "@minecraft/server";
import { attempt } from "./log.js";
import { get } from "./settings.js";

let lastMessage = "";
let lastTick = -1000;
let repeated = 0;

/** 同じ文をまとめる時間 (tick) */
const DEDUPE_TICKS = 20;

/**
 * 全員に案内文を出す。
 * @param force 設定でOFFにしていても必ず出す (コマンドの応答など)
 */
export function announce(message, { force = false } = {}) {
  if (!force && !get("announce")) return false;

  const tick = attempt("chat:tick", () => system.currentTick, 0) ?? 0;
  if (message === lastMessage && tick - lastTick < DEDUPE_TICKS) {
    repeated++;
    return false;
  }
  const suffix = repeated > 0 ? ` §7(×${repeated + 1})§r` : "";
  repeated = 0;
  lastMessage = message;
  lastTick = tick;

  return attempt("chat:send", () => {
    world.sendMessage(message + suffix);
    return true;
  }, false);
}

/** その人にだけ伝える */
export function tell(player, message) {
  return attempt("chat:tell", () => {
    player.sendMessage(message);
    return true;
  }, false);
}

/** 画面下部に短く出す。チャットを流さずに知らせたいとき */
export function actionBar(player, message) {
  return attempt("chat:actionBar", () => {
    player.onScreenDisplay.setActionBar(message);
    return true;
  }, false);
}

/** まとめ表示のための内部状態を初期化する (テスト用) */
export function resetDedupe() {
  lastMessage = "";
  lastTick = -1000;
  repeated = 0;
}
