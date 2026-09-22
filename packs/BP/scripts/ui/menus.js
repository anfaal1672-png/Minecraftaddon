import { PlayerPermissionLevel } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { TNT_DEFS, CATEGORIES } from "../generated/defs.js";
import { shortId } from "../core/registry.js";
import { getSettings, updateSettings } from "../systems/settings.js";
import { getPlayerStats, usedTypes } from "../systems/stats.js";
import { loadLinks, saveLinks, MAX_LINKS } from "../systems/detonator.js";
import { msg, tntName, tntDesc, categoryName, ingredientName, tell } from "../systems/i18n.js";
import { warn } from "../util/log.js";

/* ------------------------------------------------------------------ */
/*  画面 (TNT図鑑・設定・起爆装置の登録メニュー)                          */
/* ------------------------------------------------------------------ */
const R = (...parts) => ({ rawtext: parts.map((p) => (typeof p === "string" ? { text: p } : p)) });

export function isOperator(player) {
  try {
    return player.playerPermissionLevel >= PlayerPermissionLevel.Operator;
  } catch (err) {
    return false;
  }
}

function show(form, player, onResponse) {
  form
    .show(player)
    .then((res) => {
      if (!res.canceled) onResponse(res);
    })
    .catch((err) => warn("form", err));
}

/* ---------------- TNT図鑑 ---------------- */
export function openGuide(player) {
  const stats = getPlayerStats(player);
  const used = usedTypes(stats);
  const form = new ActionFormData()
    .title(msg("guide_title"))
    .body(msg("guide_body", String(used.size), String(TNT_DEFS.length), String(stats.total)));
  for (const cat of CATEGORIES) {
    const defs = TNT_DEFS.filter((d) => d.category === cat);
    const seen = defs.filter((d) => used.has(shortId(d.id))).length;
    form.button(R(categoryName(cat), ` §8(${seen}/${defs.length})`));
  }
  const op = isOperator(player);
  if (op) form.button(msg("guide_settings"));
  show(form, player, (res) => {
    if (res.selection < CATEGORIES.length) openCategory(player, CATEGORIES[res.selection]);
    else if (op) openSettings(player);
  });
}

function openCategory(player, cat) {
  const stats = getPlayerStats(player);
  const used = usedTypes(stats);
  const defs = TNT_DEFS.filter((d) => d.category === cat);
  const form = new ActionFormData().title(categoryName(cat));
  for (const d of defs) {
    const known = used.has(shortId(d.id));
    const count = stats.counts[shortId(d.id)] ?? 0;
    form.button(known ? R(tntName(d.id), ` §8×${count}`) : R(tntName(d.id), " §8", msg("guide_unused")));
  }
  form.button(msg("guide_back"));
  show(form, player, (res) => {
    if (res.selection < defs.length) openTnt(player, defs[res.selection], cat);
    else openGuide(player);
  });
}

function openTnt(player, def, cat) {
  const stats = getPlayerStats(player);
  const count = stats.counts[shortId(def.id)] ?? 0;
  const recipe = [];
  def.recipe.forEach((item, i) => {
    if (i > 0) recipe.push({ text: " + " });
    recipe.push(ingredientName(item));
  });
  const flags = [];
  if (def.nuclear) flags.push(msg("guide_flag_nuclear"));
  if (def.power > 0) flags.push(msg("guide_flag_power", String(def.power)));
  if (!def.breaks && def.power > 0) flags.push(msg("guide_flag_nobreak"));
  const body = R(
    tntDesc(def.id),
    "\n\n",
    msg("guide_recipe"),
    " ",
    { rawtext: recipe },
    "\n",
    msg("guide_count", String(count)),
    ...flags.flatMap((f) => ["\n", f])
  );
  const form = new ActionFormData().title(tntName(def.id)).body(body).button(msg("guide_back"));
  show(form, player, () => openCategory(player, cat));
}

/* ---------------- 設定 (オペレーターのみ) ---------------- */
const SCALES = [0.25, 0.5, 0.75, 1, 1.5, 2];

export function openSettings(player) {
  if (!isOperator(player)) {
    tell(player, msg("settings_denied"));
    return;
  }
  const s = getSettings();
  const scaleIndex = SCALES.indexOf(s.powerScale);
  const form = new ModalFormData()
    .title(msg("settings_title"))
    .toggle(msg("settings_terrain"), { defaultValue: s.terrain })
    .dropdown(
      msg("settings_power"),
      SCALES.map((v) => `×${v}`),
      { defaultValueIndex: scaleIndex === -1 ? 3 : scaleIndex }
    )
    .toggle(msg("settings_nuclear"), { defaultValue: s.allowNuclear })
    .slider(msg("settings_chain"), 10, 200, { valueStep: 10, defaultValue: Math.min(200, s.chainPerSecond) })
    .toggle(msg("settings_chat"), { defaultValue: s.chat })
    .dropdown(msg("settings_gacha"), [msg("settings_gacha_normal"), msg("settings_gacha_safe")], {
      defaultValueIndex: s.gachaTable === "no_nuclear" ? 1 : 0,
    })
    .dropdown(msg("settings_nametag"), ["日本語", "English"], { defaultValueIndex: s.nameTagLang === "en" ? 1 : 0 })
    .submitButton(msg("settings_save"));
  show(form, player, (res) => {
    const v = res.formValues ?? [];
    updateSettings({
      terrain: v[0],
      powerScale: SCALES[v[1]] ?? 1,
      allowNuclear: v[2],
      chainPerSecond: v[3],
      chat: v[4],
      gachaTable: v[5] === 1 ? "no_nuclear" : "normal",
      nameTagLang: v[6] === 1 ? "en" : "ja",
    });
    tell(player, msg("settings_saved"));
  });
}

/* ---------------- 起爆装置の登録メニュー ---------------- */
export function openLinkMenu(player) {
  const links = loadLinks(player);
  const lines = links.map(([d, x, y, z]) => `§7${d.replace("minecraft:", "")} §f${x}, ${y}, ${z}`).join("\n");
  const form = new ActionFormData()
    .title(msg("links_title"))
    .body(R(msg("links_body", String(links.length), String(MAX_LINKS)), "\n", lines))
    .button(msg("links_clear"))
    .button(msg("guide_back"));
  show(form, player, (res) => {
    if (res.selection === 0) {
      saveLinks(player, []);
      tell(player, msg("links_cleared"));
    }
  });
}
