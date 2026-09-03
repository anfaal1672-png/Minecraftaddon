/**
 * 災厄カテゴリのTNT。
 *
 * 常軌を逸したTNT。使う場所をよく選ぶこと。
 *
 * 書式は data/schema.mjs を参照。カテゴリはこのファイルに入っていること自体で決まる。
 */
export default [
  {
    id: "singularity_tnt",
    name: { ja: "特異点TNT", en: "Singularity TNT" },
    desc: { ja: "特異点が生まれ、球ごと世界を飲み込む。", en: "A singularity forms and swallows the world whole." },
    fuse: 120,
    blast: { power: 0, breaks: false, fire: false, underwater: true },
    visual: {
      color: "#0e0e18", band: "#131320", emblem: "singularity", trail: "minecraft:basic_smoke_particle",
    },
    effect: "singularityEffect",
    recipe: { ingredients: ["manytnt:antimatter_tnt", "manytnt:blackhole_tnt", "minecraft:nether_star"] },
  },
  {
    id: "timestop_tnt",
    name: { ja: "時間停止TNT", en: "Time Stop TNT" },
    desc: { ja: "時を止め、解除と同時にすべてを吹き飛ばす。", en: "Freezes time, then blows everything away when it resumes." },
    fuse: 100,
    blast: { power: 0, breaks: false, fire: false },
    visual: { color: "#3fb2c6", emblem: "hourglass", trail: "minecraft:endrod" },
    effect: "timestopEffect",
    recipe: { ingredients: ["manytnt:armageddon_tnt", "minecraft:clock", "minecraft:ender_eye"] },
  },
  {
    id: "drill_tnt",
    name: { ja: "地殻貫通TNT", en: "Earthborer TNT" },
    desc: { ja: "空から岩盤まで、世界を垂直に貫く。", en: "Punches a vertical hole from the sky to bedrock." },
    fuse: 100,
    blast: { power: 6, breaks: true, fire: false, underwater: true },
    visual: { color: "#6b7079", emblem: "drill", trail: "minecraft:basic_crit_particle" },
    effect: "drillEffect",
    recipe: { ingredients: ["manytnt:ultra_nuke_tnt", "manytnt:shaft_tnt", "minecraft:netherite_ingot"] },
  },
  {
    id: "collapse_tnt",
    name: { ja: "崩落TNT", en: "Collapse TNT" },
    desc: { ja: "足元を抜き、地形をまるごと崩落させる。", en: "Pulls out the ground so the terrain caves in." },
    fuse: 90,
    blast: { power: 0, breaks: false, fire: false },
    visual: { color: "#c8a75e", emblem: "collapse", trail: "minecraft:basic_smoke_particle" },
    effect: "collapseEffect",
    recipe: {
      ingredients: [
        "manytnt:earthquake_tnt",
        "manytnt:tsar_bomba_tnt",
        "minecraft:sand",
        "minecraft:gravel",
      ],
    },
  },
  {
    id: "replicator_tnt",
    name: { ja: "増殖TNT", en: "Replicator TNT" },
    desc: { ja: "爆発するたびに自分自身を増やしていく。", en: "Every blast plants more copies of itself." },
    blast: { power: 6, breaks: true, fire: false },
    visual: { color: "#5fc95f", emblem: "replicate", trail: "minecraft:villager_happy" },
    effect: "replicatorEffect",
    recipe: { ingredients: ["manytnt:mega_tnt", "manytnt:gacha_tnt", "minecraft:nether_star"] },
  },
];
