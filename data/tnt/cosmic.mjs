/**
 * 宇宙カテゴリのTNT。
 *
 * 天体規模の現象を、遊べる大きさに落とし込んだもの。
 * 核系が「人が作った最大」なら、こちらは「宇宙が起こす最大」。
 *
 * 書式は data/schema.mjs を参照。カテゴリはこのファイルに入っていること自体で決まる。
 */
export default [
  {
    id: "supernova_tnt",
    name: { ja: "超新星TNT", en: "Supernova TNT" },
    desc: { ja: "閃光が走り、外殻を吹き飛ばしてから中心が崩れ落ちる。", en: "A flash, an ejected shell, then the core collapses inward." },
    fuse: 140,
    blast: { power: 45, breaks: true, fire: true, underwater: true },
    visual: { color: "#f0e4a8", band: "#e8d878", emblem: "supernova", trail: "minecraft:basic_flame_particle" },
    effect: "supernovaEffect",
    recipe: { ingredients: ["manytnt:hydrogen_bomb_tnt", "minecraft:glowstone", "minecraft:nether_star"] },
  },
  {
    id: "neutron_tnt",
    name: { ja: "中性子星TNT", en: "Neutron Star TNT" },
    desc: { ja: "半径は狭い。ただしその内側は跡形もなく潰れる。", en: "A small radius — but nothing inside it survives at all." },
    fuse: 120,
    blast: { power: 30, breaks: true, fire: false, underwater: true },
    visual: { color: "#c8d8e8", band: "#8c9ca8", emblem: "neutron", trail: "minecraft:endrod" },
    effect: "neutronEffect",
    recipe: { ingredients: ["manytnt:singularity_tnt", "minecraft:iron_block", "minecraft:iron_block"] },
  },
  {
    id: "wormhole_tnt",
    name: { ja: "ワームホールTNT", en: "Wormhole TNT" },
    desc: { ja: "遠く離れた場所へ穴が繋がり、巻き込まれたものが送られる。", en: "Opens a hole to somewhere far away and posts everything through." },
    fuse: 100,
    blast: { power: 0, breaks: false, fire: false, underwater: true },
    visual: { color: "#4c2a6c", band: "#2c1a44", emblem: "wormhole", trail: "minecraft:endrod" },
    effect: "wormholeEffect",
    recipe: { ingredients: ["manytnt:teleport_tnt", "manytnt:blackhole_tnt", "minecraft:ender_eye"] },
  },
  {
    id: "galaxy_tnt",
    name: { ja: "銀河TNT", en: "Galaxy TNT" },
    desc: { ja: "渦を巻きながら腕を広げ、その形のまま地面に痕を残す。", en: "Spiral arms sweep outward and leave their shape burned into the ground." },
    fuse: 120,
    blast: { power: 8, breaks: true, fire: false },
    visual: { color: "#3c3c7c", band: "#282858", emblem: "galaxy", trail: "minecraft:endrod" },
    effect: "galaxyEffect",
    recipe: { ingredients: ["manytnt:rainbow_tnt", "manytnt:beam_tnt", "minecraft:nether_star"] },
  },
  {
    id: "comet_tnt",
    name: { ja: "彗星TNT", en: "Comet TNT" },
    desc: { ja: "長い尾を引いて空を渡り、氷と岩を撒き散らして落ちる。", en: "Crosses the sky trailing ice and rock before it comes down." },
    fuse: 100,
    blast: { power: 10, breaks: true, fire: true },
    visual: { color: "#9ce0ea", emblem: "comet", trail: "minecraft:snowflake_particle" },
    effect: "cometEffect",
    traits: { launchArc: true },
    recipe: { ingredients: ["manytnt:meteor_tnt", "minecraft:blue_ice", "minecraft:packed_ice"] },
  },
  {
    id: "solarflare_tnt",
    name: { ja: "太陽フレアTNT", en: "Solar Flare TNT" },
    desc: { ja: "地表を焼き払い、日中に変えて生き物を炙る。", en: "Scorches the surface, forces daylight and cooks what stands in it." },
    fuse: 100,
    blast: { power: 14, breaks: true, fire: true },
    visual: { color: "#f09018", emblem: "solarflare", trail: "minecraft:basic_flame_particle" },
    effect: "solarflareEffect",
    recipe: { ingredients: ["manytnt:scorched_tnt", "manytnt:glow_tnt", "minecraft:blaze_rod"] },
  },
  {
    id: "nebula_tnt",
    name: { ja: "星雲TNT", en: "Nebula TNT" },
    desc: { ja: "色とりどりの雲が空に広がる。害は無いが、しばらく消えない。", en: "A many-coloured cloud spreads through the sky. Harmless, and slow to fade." },
    fuse: 100,
    blast: { power: 0, breaks: false, fire: false },
    visual: { color: "#8c4ab4", style: "rainbow", emblem: "nebula", trail: "minecraft:totem_particle" },
    effect: "nebulaEffect",
    recipe: { ingredients: ["manytnt:confetti_tnt", "manytnt:chorus_tnt", "minecraft:amethyst_shard"] },
  },
  {
    id: "bigbang_tnt",
    name: { ja: "ビッグバンTNT", en: "Big Bang TNT" },
    desc: { ja: "すべてを消し飛ばし、そこに新しい地形を作り直す。", en: "Erases everything, then builds a brand new landscape in its place." },
    fuse: 160,
    blast: { power: 60, breaks: true, fire: true, underwater: true },
    visual: { color: "#f4f4f4", band: "#d8d0c8", ink: "#241c38", emblem: "bigbang", trail: "minecraft:huge_explosion_emitter" },
    effect: "bigbangEffect",
    recipe: {
      ingredients: [
        "manytnt:supernova_tnt",
        "manytnt:antimatter_tnt",
        "manytnt:singularity_tnt",
        "minecraft:nether_star",
        "minecraft:dragon_egg",
      ],
    },
  },
];
