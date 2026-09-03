/**
 * チャットへの案内文と、そのON/OFF。
 */
import { world } from "@minecraft/server";

/* ------------------------------------------------------------------ */
/*  チャット演出のミュート設定 (/scriptevent manytnt:mute で切替)        */
/* ------------------------------------------------------------------ */
export let muted = false;

export function announce(msg) {
  if (muted) return;
  try {
    world.sendMessage(msg);
  } catch (err) {}
}

/** ワールド読み込み時に、保存しておいたON/OFFを復元する */
export function registerMuteState() {
  try {
    world.afterEvents.worldLoad.subscribe(() => {
      try {
        muted = world.getDynamicProperty("manytnt:muted") === true;
      } catch (err) {}
    });
  } catch (err) {}
}
