/**
 * 建築カテゴリのTNT。
 *
 * 壊すのではなく、掘る・均す・建てるためのTNT。
 * 拠点づくりや整地の手間を一気に片付けるためにある。
 *
 * 書式は data/schema.mjs を参照。カテゴリはこのファイルに入っていること自体で決まる。
 */
export default [
  {
    id: "tunnel_tnt",
    name: { ja: "トンネルTNT", en: "Tunnel TNT" },
    desc: { ja: "四方へ 3×3 のトンネルを 28 ブロック掘り抜く。", en: "Bores 3x3 tunnels 28 blocks in all four directions." },
    blast: { power: 0, breaks: false, fire: false },
    visual: { color: "#7a7f88", emblem: "tunnel", trail: "minecraft:basic_smoke_particle" },
    effect: "tunnelEffect",
    recipe: { ingredients: ["minecraft:tnt", "minecraft:iron_pickaxe", "minecraft:rail"] },
  },
  {
    id: "flatten_tnt",
    name: { ja: "整地TNT", en: "Flatten TNT" },
    desc: { ja: "半径12を爆心地の高さで平らにする。窪みは土で埋める。", en: "Levels radius 12 to the blast height, filling dips with dirt." },
    blast: { power: 0, breaks: false, fire: false },
    visual: { color: "#a89878", emblem: "level", trail: "minecraft:basic_smoke_particle" },
    effect: "flattenEffect",
    recipe: { ingredients: ["minecraft:tnt", "minecraft:iron_shovel", "minecraft:iron_shovel"] },
  },
  {
    id: "wall_tnt",
    name: { ja: "防壁TNT", en: "Rampart TNT" },
    desc: { ja: "周囲に高さ6の石壁を立てて、拠点を丸ごと囲う。", en: "Raises a six-block stone rampart around the whole area." },
    blast: { power: 0, breaks: false, fire: false },
    visual: { color: "#8c8c94", emblem: "rampart" },
    effect: "wallEffect",
    recipe: { ingredients: ["minecraft:tnt", "minecraft:stone_bricks", "minecraft:stone_bricks", "minecraft:shield"] },
  },
  {
    id: "tower_tnt",
    name: { ja: "塔TNT", en: "Tower TNT" },
    desc: { ja: "螺旋階段つきの塔が一瞬で建ち上がる。", en: "A spiral-stair tower shoots up in an instant." },
    blast: { power: 0, breaks: false, fire: false },
    visual: { color: "#9c9488", emblem: "tower" },
    effect: "towerEffect",
    recipe: { ingredients: ["minecraft:tnt", "minecraft:stone_bricks", "minecraft:ladder", "minecraft:torch"] },
  },
  {
    id: "bridge_tnt",
    name: { ja: "架橋TNT", en: "Bridge TNT" },
    desc: { ja: "四方へ橋を架ける。谷でも海でもそのまま渡れる。", en: "Throws bridges out four ways, over any gorge or sea." },
    blast: { power: 0, breaks: false, fire: false },
    visual: { color: "#a8845c", emblem: "bridge" },
    effect: "bridgeEffect",
    recipe: { ingredients: ["minecraft:tnt", "minecraft:oak_planks", "minecraft:oak_planks", "minecraft:scaffolding"] },
  },
  {
    id: "shelter_tnt",
    name: { ja: "避難所TNT", en: "Shelter TNT" },
    desc: { ja: "扉と明かりの付いた小屋がその場に建つ。夜をしのげる。", en: "Drops a lit hut with a doorway. Enough to survive the night." },
    blast: { power: 0, breaks: false, fire: false },
    visual: { color: "#8a6c4a", emblem: "hut" },
    effect: "shelterEffect",
    recipe: { ingredients: ["minecraft:tnt", "minecraft:oak_planks", "minecraft:glowstone", "minecraft:bed"] },
  },
  {
    id: "quarry_tnt",
    name: { ja: "採掘場TNT", en: "Quarry TNT" },
    desc: { ja: "角のそろった直方体を掘り抜く。整った作業場ができる。", en: "Cuts a clean rectangular pit — an instant work site." },
    blast: { power: 0, breaks: false, fire: false },
    visual: { color: "#6c6c6c", emblem: "quarry", trail: "minecraft:basic_smoke_particle" },
    effect: "quarryEffect",
    recipe: { ingredients: ["manytnt:shaft_tnt", "minecraft:diamond_pickaxe", "minecraft:chest"] },
  },
  {
    id: "stairway_tnt",
    name: { ja: "階段TNT", en: "Stairway TNT" },
    desc: { ja: "地下深くへ降りる螺旋階段を掘る。落ちずに降りられる。", en: "Carves a spiral stair down into the deep — no falling required." },
    blast: { power: 0, breaks: false, fire: false },
    visual: { color: "#7c7468", emblem: "stairs", trail: "minecraft:basic_smoke_particle" },
    effect: "stairwayEffect",
    recipe: { ingredients: ["manytnt:shaft_tnt", "minecraft:stone_stairs", "minecraft:torch"] },
  },
  {
    id: "pave_tnt",
    name: { ja: "舗装TNT", en: "Paving TNT" },
    desc: { ja: "地表を石畳の道に変え、明かりまで並べる。", en: "Turns the ground into a lit cobbled road." },
    blast: { power: 0, breaks: false, fire: false },
    visual: { color: "#b4b0a8", emblem: "road" },
    effect: "paveEffect",
    recipe: { ingredients: ["minecraft:tnt", "minecraft:stone_bricks", "minecraft:torch", "minecraft:torch"] },
  },
  {
    id: "scaffold_tnt",
    name: { ja: "足場TNT", en: "Scaffold TNT" },
    desc: { ja: "上へ伸びる足場が立ち上がる。空中の建築に。", en: "A climbable scaffold shoots skyward. For building up high." },
    blast: { power: 0, breaks: false, fire: false },
    visual: { color: "#c8b47c", emblem: "scaffold" },
    effect: "scaffoldEffect",
    recipe: { ingredients: ["minecraft:tnt", "minecraft:scaffolding", "minecraft:scaffolding"] },
  },
];
