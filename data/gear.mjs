/**
 * TNT以外の追加物。投げる爆弾・道具・仕掛けブロック。
 *
 * TNTは「置いて火を点ける」ものなので、置く余裕が無い場面では使えない。
 * ここにあるのはその隙間を埋めるもので、投げる・遠くから起爆する・
 * 導火線を引く、といった別の遊び方を足している。
 *
 * data/tnt/*.mjs と同じく、ここに1件足せば
 * アイテム定義・レシピ・言語ファイル・テクスチャまで生成される。
 */

/**
 * 投げる爆弾。
 *   id      識別子 (manytnt:<id>)。投擲物は manytnt:<id>_projectile になる
 *   power   投げる強さ。大きいほど遠くまで飛ぶ
 *   gravity 落ち方。小さいほどまっすぐ飛ぶ
 *   effect  当たったときに呼ぶ効果の名前 (BP/scripts/gear/throwables.js)
 */
export const THROWABLES = [
  {
    id: "grenade",
    name: { ja: "手榴弾", en: "Grenade" },
    desc: { ja: "投げて当たった場所で爆発する。距離を取って使える。", en: "Explodes where it lands. Lets you keep your distance." },
    visual: { color: "#4c5a3c", emblem: "grenade" },
    power: 1.6, gravity: 0.06,
    effect: "grenadeHit",
    recipe: { ingredients: ["minecraft:gunpowder", "minecraft:iron_ingot", "minecraft:flint"], count: 4 },
  },
  {
    id: "incendiary",
    name: { ja: "焼夷手榴弾", en: "Incendiary Grenade" },
    desc: { ja: "当たった場所を火の海に変える。木造には使わないこと。", en: "Turns the impact into a sea of fire. Not for wooden builds." },
    visual: { color: "#c85a20", emblem: "napalm" },
    power: 1.6, gravity: 0.06,
    effect: "incendiaryHit",
    recipe: { ingredients: ["manytnt:grenade", "minecraft:blaze_powder", "minecraft:coal"], count: 2 },
  },
  {
    id: "flashbang",
    name: { ja: "閃光弾", en: "Flashbang" },
    desc: { ja: "何も壊さない。目と足を一時的に潰すだけ。", en: "Breaks nothing. Just takes away sight and footing for a while." },
    visual: { color: "#e8e0b0", band: "#c8c090", emblem: "flash" },
    power: 1.7, gravity: 0.05,
    effect: "flashbangHit",
    recipe: { ingredients: ["manytnt:grenade", "minecraft:glowstone_dust", "minecraft:glowstone_dust"], count: 2 },
  },
  {
    id: "smoke_bomb",
    name: { ja: "煙玉", en: "Smoke Bomb" },
    desc: { ja: "濃い煙が居座る。逃げるときに足元へ投げる。", en: "Thick smoke that lingers. Throw it at your feet and run." },
    visual: { color: "#6c6c74", emblem: "smoke" },
    power: 1.5, gravity: 0.07,
    effect: "smokeBombHit",
    recipe: { ingredients: ["manytnt:grenade", "minecraft:coal", "minecraft:paper"], count: 3 },
  },
  {
    id: "sticky_bomb",
    name: { ja: "粘着爆弾", en: "Sticky Bomb" },
    desc: { ja: "当たった場所に貼り付き、3秒後に大きく爆発する。", en: "Sticks where it lands and blows up big three seconds later." },
    visual: { color: "#9cc83c", emblem: "sticky" },
    power: 1.4, gravity: 0.08,
    effect: "stickyBombHit",
    recipe: { ingredients: ["manytnt:grenade", "minecraft:slime_ball", "minecraft:slime_ball"], count: 2 },
  },
];

/**
 * 手に持って使う道具。
 *   handler  使ったときに呼ぶ処理の名前 (BP/scripts/gear/tools.js)
 */
export const TOOLS = [
  {
    id: "detonator",
    name: { ja: "リモート起爆装置", en: "Remote Detonator" },
    desc: { ja: "視線の先のTNT1個を、離れた場所から着火する。", en: "Lights the single TNT you are looking at, from a distance." },
    visual: { color: "#b4342a", emblem: "detonator" },
    handler: "useDetonator",
    recipe: { ingredients: ["minecraft:redstone_torch", "minecraft:stick", "minecraft:iron_ingot"] },
  },
  {
    id: "blast_rod",
    name: { ja: "一斉起爆ロッド", en: "Blast Rod" },
    desc: { ja: "視線の先を中心に、半径10のTNTを全部まとめて着火する。", en: "Lights every TNT within ten blocks of where you are looking." },
    visual: { color: "#d4a02a", emblem: "burst" },
    handler: "useBlastRod",
    recipe: { ingredients: ["manytnt:detonator", "minecraft:blaze_rod", "minecraft:gold_ingot"] },
  },
  {
    id: "timer_tool",
    name: { ja: "時限装置", en: "Timer" },
    desc: { ja: "TNTに使うと、指定した秒数後に着火する予約を仕掛ける。", en: "Sets a TNT to light itself after a countdown." },
    visual: { color: "#3c9ca8", emblem: "hourglass" },
    handler: "useTimer",
    recipe: { ingredients: ["minecraft:clock", "minecraft:redstone", "minecraft:iron_ingot"] },
  },
  {
    id: "scanner",
    name: { ja: "爆発物探知機", en: "Blast Scanner" },
    desc: { ja: "周囲に埋まっているTNTと地雷、それに鉱石を教えてくれる。", en: "Reports the TNT, landmines and ore hidden around you." },
    visual: { color: "#5c9cd4", emblem: "survey" },
    handler: "useScanner",
    recipe: { ingredients: ["minecraft:compass", "minecraft:redstone", "minecraft:copper_ingot"] },
  },
  {
    id: "catalog",
    name: { ja: "TNT図鑑", en: "TNT Catalog" },
    desc: { ja: "全種類の威力・効果・レシピを調べられる。設定もここから。", en: "Look up every kind: power, effect, recipe. Settings live here too." },
    visual: { color: "#8c2a1e", emblem: "book" },
    handler: "useCatalog",
    recipe: { ingredients: ["minecraft:book", "minecraft:gunpowder"] },
  },
];

/**
 * 仕掛けブロック。
 *   component  スクリプト側で登録するカスタムコンポーネントの名前
 */
export const GEAR_BLOCKS = [
  {
    id: "detonator_block",
    name: { ja: "起爆装置", en: "Detonator Block" },
    desc: { ja: "レッドストーン信号を受けると、半径12のTNTを一斉に着火する。", en: "On a redstone signal, lights every TNT within twelve blocks." },
    visual: { color: "#a83028", band: "#7c2018", emblem: "detonator" },
    component: "manytnt:detonator_block",
    sound: "metal",
    recipe: { ingredients: ["manytnt:detonator", "minecraft:redstone_block", "minecraft:stone"] },
  },
  {
    id: "fuse_block",
    name: { ja: "導火線", en: "Fuse" },
    desc: { ja: "火を点けると隣の導火線へ燃え広がり、行き着いた先のTNTを着火する。", en: "Lit fuse burns along to the next one and sets off the TNT at the end." },
    visual: { color: "#c8a24a", band: "#8c6c2a", emblem: "fuseline" },
    component: "manytnt:fuse_block",
    sound: "grass",
    recipe: { ingredients: ["minecraft:string", "minecraft:gunpowder", "minecraft:gunpowder"], count: 8 },
  },
  {
    id: "blast_proof_block",
    name: { ja: "耐爆ブロック", en: "Blast-Proof Block" },
    desc: { ja: "このアドオンのどのTNTでも壊れない。実験場の壁に。", en: "No TNT in this addon can break it. Wall off your test range." },
    visual: { color: "#54585c", band: "#3c4044", emblem: "shieldblock" },
    component: null,
    sound: "metal",
    recipe: { ingredients: ["minecraft:obsidian", "minecraft:netherite_scrap", "minecraft:iron_block"], count: 4 },
  },
];

export const GEAR_ITEMS = [...THROWABLES, ...TOOLS];
export const ALL_GEAR = [...THROWABLES, ...TOOLS, ...GEAR_BLOCKS];
