/**
 * 各TNTの見た目の設定。
 *   crate  … 木箱(本体)の色。これを基準に影・ハイライト・帯の色を自動で作る
 *   emblem … 帯に描く紋章 (tools/lib/emblems.mjs)
 *   band   … 帯の色 (省略時は crate をほんのり混ぜたクリーム色)
 *   ink    … 紋章の色 (省略時は帯の明るさに応じて自動で決める)
 *   style  … "rainbow" にすると木箱を虹色の横縞にする
 */
export const PALETTES = {
  // ── 基本 ──
  mega_tnt:          { crate: "#b8322a", emblem: "tnt" },
  mini_tnt:          { crate: "#e0786a", emblem: "dynamite" },

  // ── 核・破滅系 ──
  nuke_tnt:          { crate: "#d4af1c", emblem: "radiation" },
  ultra_nuke_tnt:    { crate: "#e07a14", emblem: "mushroom" },
  hydrogen_bomb_tnt: { crate: "#7c3fb4", emblem: "mushroom_ring" },
  tsar_bomba_tnt:    { crate: "#c01a5c", emblem: "bomb" },
  antimatter_tnt:    { crate: "#2c2450", band: "#1b1730", emblem: "atom" },
  armageddon_tnt:    { crate: "#2c0c0c", band: "#1c0a0a", emblem: "bigskull" },

  // ── 温度・天候 ──
  ice_tnt:           { crate: "#56b4e2", emblem: "snowflake" },
  iceage_tnt:        { crate: "#a8dcea", emblem: "glacier" },
  fire_tnt:          { crate: "#e0521a", emblem: "flame" },
  lava_tnt:          { crate: "#c24a0a", emblem: "lava" },
  scorched_tnt:      { crate: "#3c322a", band: "#2a221c", emblem: "flame" },
  thunder_tnt:       { crate: "#d8cc22", emblem: "bolt" },
  storm_tnt:         { crate: "#4c5668", emblem: "cloud" },
  water_tnt:         { crate: "#2a7aca", emblem: "droplet" },
  tsunami_tnt:       { crate: "#1a5aa2", emblem: "wave" },
  daynight_tnt:      { crate: "#4c5c8c", emblem: "daynight" },
  darkness_tnt:      { crate: "#262030", band: "#1a1622", emblem: "moon" },
  glow_tnt:          { crate: "#f2e272", emblem: "sun" },

  // ── 力・移動 ──
  gravity_tnt:       { crate: "#3c4c72", emblem: "arrow_down" },
  antigravity_tnt:   { crate: "#8c7ce2", emblem: "arrow_up" },
  rocket_tnt:        { crate: "#d22a2a", emblem: "rocket" },
  speed_tnt:         { crate: "#4ab2ea", emblem: "speed" },
  bouncy_tnt:        { crate: "#8cd22a", emblem: "bounce" },
  slime_tnt:         { crate: "#7aca4a", emblem: "slime_face" },
  magnet_tnt:        { crate: "#b02222", emblem: "magnet" },
  teleport_tnt:      { crate: "#5c3c8c", emblem: "portal" },
  chorus_tnt:        { crate: "#8c5aaa", emblem: "island" },
  swap_tnt:          { crate: "#2ab2b2", emblem: "swap" },
  beam_tnt:          { crate: "#4ae2e2", emblem: "beam" },
  confusion_tnt:     { crate: "#9c4aba", emblem: "question" },
  blackhole_tnt:     { crate: "#1a1a22", band: "#101016", ink: "#a898d8", emblem: "void" },
  vacuum_tnt:        { crate: "#1c4c4c", emblem: "suction" },

  // ── 生き物 ──
  heal_tnt:          { crate: "#e85a7a", emblem: "heart" },
  animal_tnt:        { crate: "#b28a5a", emblem: "paw" },
  summon_tnt:        { crate: "#3c6c3c", emblem: "creeper" },
  bee_tnt:           { crate: "#e2b21a", emblem: "bee" },
  honey_tnt:         { crate: "#eaa42a", emblem: "drip" },
  snowgolem_tnt:     { crate: "#e4eef4", band: "#4a6a84", ink: "#f6fcff", emblem: "snowman" },
  enderman_tnt:      { crate: "#24223c", band: "#1a1830", emblem: "eye" },
  invisibility_tnt:  { crate: "#c6d0da", emblem: "ghost" },
  ufo_tnt:           { crate: "#7c9c8c", emblem: "ufo" },
  web_tnt:           { crate: "#b4b4c0", emblem: "web" },
  poison_tnt:        { crate: "#5c9c2a", emblem: "flask" },
  curse_tnt:         { crate: "#4c2252", band: "#2c1a32", emblem: "skull" },

  // ── 自然・地形 ──
  grass_tnt:         { crate: "#4ca232", emblem: "grass" },
  cactus_tnt:        { crate: "#3c8c4a", emblem: "cactus" },
  desert_tnt:        { crate: "#dcca8a", emblem: "dune" },
  earthquake_tnt:    { crate: "#8c6c3c", emblem: "crack" },
  meteor_tnt:        { crate: "#6c5c4c", emblem: "meteor" },
  shaft_tnt:         { crate: "#6c6c74", emblem: "hole" },
  obsidian_tnt:      { crate: "#261c3a", band: "#1a1228", emblem: "crystal" },

  // ── 道具・その他 ──
  treasure_tnt:      { crate: "#e0b22a", emblem: "gem" },
  fortune_tnt:       { crate: "#2ab25a", emblem: "clover" },
  gacha_tnt:         { crate: "#f24aa2", emblem: "star" },
  fireworks_tnt:     { crate: "#2a42a2", emblem: "firework" },
  confetti_tnt:      { crate: "#e85ab2", emblem: "confetti" },
  rainbow_tnt:       { crate: "#d03030", emblem: "star", style: "rainbow" },
  disco_tnt:         { crate: "#e232a2", emblem: "disco" },
  music_tnt:         { crate: "#5a52c2", emblem: "note" },
  arrow_tnt:         { crate: "#8c7c5c", emblem: "arrows" },
  builder_tnt:       { crate: "#9c9c9c", emblem: "brick" },
  smelter_tnt:       { crate: "#5c5c5c", emblem: "furnace" },
  harvest_tnt:       { crate: "#dab24a", emblem: "wheat" },
  feast_tnt:         { crate: "#d29a4a", emblem: "cutlery" },
  xp_tnt:            { crate: "#6cd22a", emblem: "orb" },
};

/** 虹TNTの木箱に使う横縞の色 */
export const RAINBOW_ROWS = ["#e03a3a", "#e8892a", "#e8d02a", "#3ab84a", "#2a7ad8", "#8a4ad8"];

/** 全TNT共通の底面テクスチャの色 */
export const BOTTOM = { crate: "#7a2018" };
