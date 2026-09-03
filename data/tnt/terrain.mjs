/**
 * 地形カテゴリのTNT。
 *
 * 地形を作り替えるTNT。壊すより整えるものが多い。
 *
 * 書式は data/schema.mjs を参照。カテゴリはこのファイルに入っていること自体で決まる。
 */
export default [
  {
    id: "earthquake_tnt",
    name: { ja: "地震TNT", en: "Earthquake TNT" },
    desc: { ja: "地面を波打たせ、地割れを走らせる。", en: "Makes the ground ripple and tear open." },
    blast: { power: 6, breaks: true, fire: false },
    visual: { color: "#8c6c3c", emblem: "crack" },
    effect: "earthquakeEffect",
    recipe: {
      ingredients: [
        "minecraft:tnt",
        "minecraft:cobblestone",
        "minecraft:cobblestone",
        "minecraft:cobblestone",
        "minecraft:cobblestone",
      ],
    },
  },
  {
    id: "grass_tnt",
    name: { ja: "草原TNT", en: "Grass TNT" },
    desc: { ja: "荒れ地を草原と花畑に変える。", en: "Turns wasteland into grass and flowers." },
    blast: { power: 0, breaks: false, fire: false },
    visual: { color: "#4ca232", emblem: "grass", trail: "minecraft:totem_particle" },
    effect: "grassEffect",
    recipe: { ingredients: ["minecraft:tnt", "minecraft:wheat_seeds", "minecraft:bone_meal"] },
  },
  {
    id: "desert_tnt",
    name: { ja: "砂漠TNT", en: "Desert TNT" },
    desc: { ja: "一帯を砂漠に変える。", en: "Turns the area into desert." },
    blast: { power: 2, breaks: true, fire: false },
    visual: { color: "#dcca8a", emblem: "dune", trail: "minecraft:basic_smoke_particle" },
    effect: "desertEffect",
    recipe: { ingredients: ["minecraft:tnt", "minecraft:sand", "minecraft:sand"] },
  },
  {
    id: "smelter_tnt",
    name: { ja: "製錬TNT", en: "Smelter TNT" },
    desc: { ja: "周囲のブロックを精錬済みの姿に変える。", en: "Smelts the surrounding blocks where they stand." },
    blast: { power: 0, breaks: false, fire: false },
    visual: { color: "#5c5c5c", emblem: "furnace", trail: "minecraft:basic_flame_particle" },
    effect: "smelterEffect",
    recipe: { ingredients: ["minecraft:tnt", "minecraft:furnace"] },
  },
  {
    id: "harvest_tnt",
    name: { ja: "豊作TNT", en: "Harvest TNT" },
    desc: { ja: "範囲内の作物を一瞬で育て切る。", en: "Instantly brings every crop in range to full growth." },
    blast: { power: 0, breaks: false, fire: false },
    visual: { color: "#dab24a", emblem: "wheat", trail: "minecraft:totem_particle" },
    effect: "harvestEffect",
    recipe: { ingredients: ["minecraft:tnt", "minecraft:bone_meal", "minecraft:bone_meal"] },
  },
  {
    id: "builder_tnt",
    name: { ja: "建材TNT", en: "Builder TNT" },
    desc: { ja: "爆発の代わりに建物の土台を組み上げる。", en: "Instead of blowing up, it builds a structure." },
    blast: { power: 0, breaks: false, fire: false },
    visual: { color: "#9c9c9c", emblem: "brick", trail: "minecraft:basic_crit_particle" },
    effect: "builderEffect",
    recipe: { ingredients: ["minecraft:tnt", "minecraft:brick_block", "minecraft:brick_block"] },
  },
  {
    id: "shaft_tnt",
    name: { ja: "縦穴TNT", en: "Shaft TNT" },
    desc: { ja: "岩盤まで一直線に縦穴を掘る。", en: "Bores a shaft straight down toward bedrock." },
    blast: { power: 0, breaks: false, fire: false },
    visual: { color: "#6c6c74", emblem: "hole", trail: "minecraft:basic_smoke_particle" },
    effect: "shaftEffect",
    recipe: { ingredients: ["minecraft:tnt", "minecraft:iron_pickaxe"] },
  },
  {
    id: "honey_tnt",
    name: { ja: "ハチミツTNT", en: "Honey TNT" },
    desc: { ja: "一帯をハチミツで固め、動きを封じる。", en: "Coats the area in honey and pins everything down." },
    blast: { power: 0, breaks: false, fire: false },
    visual: { color: "#eaa42a", emblem: "drip", trail: "minecraft:villager_happy" },
    effect: "honeyEffect",
    recipe: { ingredients: ["minecraft:tnt", "minecraft:honey_bottle", "minecraft:honey_bottle"] },
  },
  {
    id: "cactus_tnt",
    name: { ja: "サボテンTNT", en: "Cactus TNT" },
    desc: { ja: "サボテンの林を生やす。", en: "Grows a thicket of cactus." },
    blast: { power: 1, breaks: false, fire: false },
    visual: { color: "#3c8c4a", emblem: "cactus", trail: "minecraft:basic_crit_particle" },
    effect: "cactusEffect",
    recipe: { ingredients: ["minecraft:tnt", "minecraft:cactus", "minecraft:cactus"] },
  },
  {
    id: "obsidian_tnt",
    name: { ja: "黒曜石TNT", en: "Obsidian TNT" },
    desc: { ja: "爆発の代わりに黒曜石の殻を築く。", en: "Builds an obsidian shell instead of exploding." },
    blast: { power: 0, breaks: false, fire: false },
    visual: { color: "#261c3a", band: "#1a1228", emblem: "crystal", trail: "minecraft:endrod" },
    effect: "obsidianEffect",
    recipe: { ingredients: ["minecraft:tnt", "minecraft:lava_bucket", "minecraft:water_bucket"] },
  },
];
