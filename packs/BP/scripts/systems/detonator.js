import { system, world } from "@minecraft/server";
import { isTnt } from "../core/registry.js";
import { igniteBlock } from "../core/ignition.js";
import { getBlock } from "../core/safety.js";
import { actionBar, msg } from "./i18n.js";
import { openLinkMenu } from "../ui/menus.js";
import { attempt, warn } from "../util/log.js";

/* ------------------------------------------------------------------ */
/*  リモート起爆装置 v2                                                 */
/*   ・しゃがみながらTNTを右クリック … 登録 / 解除 (最大16個)             */
/*   ・右クリック (空中)            … 登録したTNTを一斉起爆              */
/*                                   登録がなければ視線の先(64マス)を起爆 */
/*   ・しゃがみながら右クリック (空中) … 登録の一覧・全解除メニュー        */
/* ------------------------------------------------------------------ */
export const DETONATOR_ID = "manytnt:detonator";
const LINKS_KEY = "manytnt:links";
export const MAX_LINKS = 16;
const RANGE = 64;
const COOLDOWN_TICKS = 5;
const lastUse = new Map();

export function loadLinks(player) {
  return (
    attempt("links.load", () => {
      const raw = player.getDynamicProperty(LINKS_KEY);
      const list = typeof raw === "string" ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    }) ?? []
  );
}

export function saveLinks(player, links) {
  attempt("links.save", () => player.setDynamicProperty(LINKS_KEY, links.length ? JSON.stringify(links) : undefined));
}

const sameLink = (l, dimId, loc) => l[0] === dimId && l[1] === loc.x && l[2] === loc.y && l[3] === loc.z;

/** 登録を切り替える。戻り値: "added" | "removed" | "full" */
export function toggleLink(links, dimId, loc) {
  const i = links.findIndex((l) => sameLink(l, dimId, loc));
  if (i >= 0) {
    links.splice(i, 1);
    return "removed";
  }
  if (links.length >= MAX_LINKS) return "full";
  links.push([dimId, loc.x, loc.y, loc.z]);
  return "added";
}

function onCooldown(player) {
  const now = system.currentTick;
  const last = lastUse.get(player.id) ?? -100;
  if (now - last < COOLDOWN_TICKS) return true;
  lastUse.set(player.id, now);
  return false;
}

function click(player) {
  attempt("click", () => player.dimension.playSound("random.click", player.location));
}

/** 登録したTNTを一斉起爆。登録がなければ視線の先を起爆 */
export function detonate(player) {
  const links = loadLinks(player);
  if (links.length > 0) {
    const dim = player.dimension;
    const p = player.location;
    let fired = 0;
    let outOfRange = 0;
    const keep = [];
    for (const l of links) {
      const [dimId, x, y, z] = l;
      if (dimId !== dim.id) {
        keep.push(l);
        outOfRange++;
        continue;
      }
      const dx = x - p.x;
      const dy = y - p.y;
      const dz = z - p.z;
      if (dx * dx + dy * dy + dz * dz > RANGE * RANGE) {
        keep.push(l);
        outOfRange++;
        continue;
      }
      const block = getBlock(dim, { x, y, z });
      if (!block) {
        keep.push(l); // 未ロード
        outOfRange++;
        continue;
      }
      if (!isTnt(block.typeId)) continue; // もう無い: 登録から外す
      if (igniteBlock(dim, { x, y, z }, { source: player })) fired++;
      else keep.push(l);
    }
    saveLinks(player, keep);
    click(player);
    actionBar(player, msg("detonator_fired", String(fired), String(outOfRange)));
    return;
  }

  const hit = attempt("raycast", () => player.getBlockFromViewDirection({ maxDistance: RANGE }));
  if (!hit?.block || !isTnt(hit.block.typeId)) {
    actionBar(player, msg("detonator_no_target"));
    return;
  }
  click(player);
  igniteBlock(player.dimension, hit.block.location, { source: player });
}

export function registerDetonator() {
  world.afterEvents.itemUse.subscribe((e) => {
    try {
      const player = e.source;
      if (e.itemStack?.typeId !== DETONATOR_ID || !player) return;
      if (onCooldown(player)) return;
      if (player.isSneaking) openLinkMenu(player);
      else detonate(player);
    } catch (err) {
      warn("detonator.use", err);
    }
  });

  world.afterEvents.playerInteractWithBlock.subscribe((e) => {
    try {
      const { player, block } = e;
      if ((e.beforeItemStack ?? e.itemStack)?.typeId !== DETONATOR_ID || !player || !block) return;
      if (e.isFirstEvent === false || onCooldown(player)) return;
      if (player.isSneaking && isTnt(block.typeId)) {
        const links = loadLinks(player);
        const result = toggleLink(links, player.dimension.id, block.location);
        saveLinks(player, links);
        click(player);
        actionBar(player, msg(`detonator_${result}`, String(links.length), String(MAX_LINKS)));
        return;
      }
      if (!player.isSneaking) detonate(player);
    } catch (err) {
      warn("detonator.interact", err);
    }
  });
}
