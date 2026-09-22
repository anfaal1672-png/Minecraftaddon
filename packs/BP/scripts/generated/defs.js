// このファイルは tools/generate.mjs が生成します。直接編集しないでください。
export const TNT_DEFS = [
  {
    "id": "manytnt:mega_tnt",
    "category": "blast",
    "color": "#780a0a",
    "recipe": [
      "minecraft:tnt",
      "minecraft:tnt",
      "minecraft:tnt",
      "minecraft:tnt"
    ],
    "power": 14,
    "breaks": true,
    "fire": false,
    "name": {
      "ja": "メガTNT",
      "en": "Mega TNT"
    }
  },
  {
    "id": "manytnt:mini_tnt",
    "category": "blast",
    "color": "#ff8caa",
    "recipe": [
      "minecraft:tnt",
      "minecraft:string"
    ],
    "power": 2,
    "breaks": true,
    "fire": false,
    "name": {
      "ja": "ミニTNT",
      "en": "Mini TNT"
    }
  },
  {
    "id": "manytnt:nuke_tnt",
    "category": "nuclear",
    "color": "#ebc814",
    "recipe": [
      "manytnt:mega_tnt",
      "minecraft:glowstone"
    ],
    "power": 20,
    "breaks": true,
    "fire": true,
    "underwater": true,
    "effect": "nuke",
    "trail": "minecraft:basic_flame_particle",
    "nuclear": true,
    "gachaWeight": 3,
    "name": {
      "ja": "核TNT",
      "en": "Nuke TNT"
    }
  },
  {
    "id": "manytnt:ultra_nuke_tnt",
    "category": "nuclear",
    "color": "#1a0000",
    "recipe": [
      "manytnt:nuke_tnt",
      "minecraft:blaze_powder",
      "minecraft:blaze_powder"
    ],
    "power": 35,
    "breaks": true,
    "fire": true,
    "underwater": true,
    "effect": "ultraNuke",
    "trail": "minecraft:basic_flame_particle",
    "nuclear": true,
    "gachaWeight": 2,
    "name": {
      "ja": "超核TNT",
      "en": "Ultra Nuke TNT"
    }
  },
  {
    "id": "manytnt:hydrogen_bomb_tnt",
    "category": "nuclear",
    "color": "#0a0014",
    "recipe": [
      "manytnt:ultra_nuke_tnt",
      "minecraft:diamond",
      "minecraft:diamond"
    ],
    "power": 50,
    "breaks": true,
    "fire": true,
    "underwater": true,
    "effect": "hydrogenBomb",
    "trail": "minecraft:basic_flame_particle",
    "nuclear": true,
    "gachaWeight": 1,
    "name": {
      "ja": "水素爆弾",
      "en": "Hydrogen Bomb"
    }
  },
  {
    "id": "manytnt:tsar_bomba_tnt",
    "category": "nuclear",
    "color": "#3d0a1e",
    "recipe": [
      "manytnt:hydrogen_bomb_tnt",
      "minecraft:netherite_ingot"
    ],
    "power": 65,
    "breaks": true,
    "fire": true,
    "underwater": true,
    "effect": "tsarBomba",
    "trail": "minecraft:basic_flame_particle",
    "nuclear": true,
    "gachaWeight": 0.5,
    "name": {
      "ja": "ツァーリボンバ",
      "en": "Tsar Bomba"
    }
  },
  {
    "id": "manytnt:antimatter_tnt",
    "category": "nuclear",
    "color": "#ffffff",
    "recipe": [
      "manytnt:tsar_bomba_tnt",
      "minecraft:netherite_ingot",
      "minecraft:nether_star",
      "minecraft:amethyst_shard"
    ],
    "power": 80,
    "breaks": true,
    "fire": true,
    "underwater": true,
    "effect": "antimatter",
    "trail": "minecraft:endrod",
    "nuclear": true,
    "gachaWeight": 0.25,
    "name": {
      "ja": "反物質爆弾",
      "en": "Antimatter Bomb"
    }
  },
  {
    "id": "manytnt:ice_tnt",
    "category": "elemental",
    "color": "#96e1ff",
    "recipe": [
      "minecraft:tnt",
      "minecraft:snowball",
      "minecraft:snowball"
    ],
    "power": 0,
    "breaks": false,
    "fire": false,
    "effect": "ice",
    "trail": "minecraft:snowflake_particle",
    "name": {
      "ja": "氷結TNT",
      "en": "Ice TNT"
    }
  },
  {
    "id": "manytnt:poison_tnt",
    "category": "elemental",
    "color": "#5aaa28",
    "recipe": [
      "minecraft:tnt",
      "minecraft:spider_eye"
    ],
    "power": 3,
    "breaks": true,
    "fire": false,
    "effect": "poison",
    "trail": "minecraft:mob_spell_particle",
    "name": {
      "ja": "毒TNT",
      "en": "Poison TNT"
    }
  },
  {
    "id": "manytnt:fire_tnt",
    "category": "elemental",
    "color": "#ff6e14",
    "recipe": [
      "minecraft:tnt",
      "minecraft:blaze_powder"
    ],
    "power": 6,
    "breaks": true,
    "fire": true,
    "effect": "fire",
    "trail": "minecraft:basic_flame_particle",
    "name": {
      "ja": "火炎TNT",
      "en": "Fire TNT"
    }
  },
  {
    "id": "manytnt:thunder_tnt",
    "category": "elemental",
    "color": "#5a32aa",
    "recipe": [
      "minecraft:tnt",
      "minecraft:lightning_rod"
    ],
    "power": 4,
    "breaks": true,
    "fire": false,
    "effect": "thunder",
    "trail": "minecraft:totem_particle",
    "name": {
      "ja": "雷TNT",
      "en": "Thunder TNT"
    }
  },
  {
    "id": "manytnt:gravity_tnt",
    "category": "physics",
    "color": "#1e0a2d",
    "recipe": [
      "minecraft:tnt",
      "minecraft:obsidian",
      "minecraft:obsidian"
    ],
    "power": 3,
    "breaks": false,
    "fire": false,
    "effect": "gravity",
    "trail": "minecraft:endrod",
    "gravityPull": true,
    "name": {
      "ja": "重力TNT",
      "en": "Gravity TNT"
    }
  },
  {
    "id": "manytnt:teleport_tnt",
    "category": "physics",
    "color": "#14bebe",
    "recipe": [
      "minecraft:tnt",
      "minecraft:ender_pearl"
    ],
    "power": 4,
    "breaks": true,
    "fire": false,
    "effect": "teleport",
    "trail": "minecraft:endrod",
    "name": {
      "ja": "テレポートTNT",
      "en": "Teleport TNT"
    }
  },
  {
    "id": "manytnt:heal_tnt",
    "category": "fun",
    "color": "#ffd2e6",
    "recipe": [
      "minecraft:tnt",
      "minecraft:glistering_melon_slice"
    ],
    "power": 0,
    "breaks": false,
    "fire": false,
    "effect": "heal",
    "trail": "minecraft:heart_particle",
    "name": {
      "ja": "回復TNT",
      "en": "Heal TNT"
    }
  },
  {
    "id": "manytnt:confetti_tnt",
    "category": "fun",
    "color": "#faf5eb",
    "recipe": [
      "minecraft:tnt",
      "minecraft:paper",
      "minecraft:paper",
      "minecraft:paper"
    ],
    "power": 0,
    "breaks": false,
    "fire": false,
    "effect": "confetti",
    "trail": "minecraft:totem_particle",
    "name": {
      "ja": "紙吹雪TNT",
      "en": "Confetti TNT"
    }
  },
  {
    "id": "manytnt:rainbow_tnt",
    "category": "fun",
    "color": "#f0f0f0",
    "recipe": [
      "minecraft:tnt",
      "minecraft:amethyst_shard"
    ],
    "power": 6,
    "breaks": true,
    "fire": false,
    "effect": "rainbow",
    "trail": "minecraft:totem_particle",
    "name": {
      "ja": "虹TNT",
      "en": "Rainbow TNT"
    }
  },
  {
    "id": "manytnt:magnet_tnt",
    "category": "physics",
    "color": "#8c3c14",
    "recipe": [
      "minecraft:tnt",
      "minecraft:iron_ingot",
      "minecraft:iron_ingot"
    ],
    "power": 2,
    "breaks": true,
    "fire": false,
    "effect": "magnetBurst",
    "trail": "minecraft:villager_happy",
    "magnetPull": true,
    "name": {
      "ja": "磁力TNT",
      "en": "Magnet TNT"
    }
  },
  {
    "id": "manytnt:antigravity_tnt",
    "category": "physics",
    "color": "#c8e6ff",
    "recipe": [
      "minecraft:tnt",
      "minecraft:phantom_membrane"
    ],
    "power": 3,
    "breaks": false,
    "fire": false,
    "effect": "antiGravity",
    "trail": "minecraft:endrod",
    "name": {
      "ja": "反重力TNT",
      "en": "Anti-Gravity TNT"
    }
  },
  {
    "id": "manytnt:lava_tnt",
    "category": "elemental",
    "color": "#e0560a",
    "recipe": [
      "minecraft:tnt",
      "minecraft:magma"
    ],
    "power": 8,
    "breaks": true,
    "fire": true,
    "effect": "lava",
    "trail": "minecraft:basic_flame_particle",
    "name": {
      "ja": "溶岩TNT",
      "en": "Lava TNT"
    }
  },
  {
    "id": "manytnt:water_tnt",
    "category": "elemental",
    "color": "#1e78c8",
    "recipe": [
      "minecraft:tnt",
      "minecraft:prismarine_shard"
    ],
    "power": 0,
    "breaks": false,
    "fire": false,
    "effect": "water",
    "trail": "minecraft:bubble_particle",
    "name": {
      "ja": "水TNT",
      "en": "Water TNT"
    }
  },
  {
    "id": "manytnt:darkness_tnt",
    "category": "elemental",
    "color": "#141018",
    "recipe": [
      "minecraft:tnt",
      "minecraft:ink_sac"
    ],
    "power": 2,
    "breaks": false,
    "fire": false,
    "effect": "darkness",
    "trail": "minecraft:basic_smoke_particle",
    "name": {
      "ja": "暗闇TNT",
      "en": "Darkness TNT"
    }
  },
  {
    "id": "manytnt:summon_tnt",
    "category": "mobs",
    "color": "#3c1e46",
    "recipe": [
      "minecraft:tnt",
      "minecraft:rotten_flesh",
      "minecraft:bone"
    ],
    "power": 3,
    "breaks": true,
    "fire": false,
    "effect": "summon",
    "trail": "minecraft:mob_spell_particle",
    "name": {
      "ja": "召喚TNT",
      "en": "Summon TNT"
    }
  },
  {
    "id": "manytnt:earthquake_tnt",
    "category": "physics",
    "color": "#6e5636",
    "recipe": [
      "minecraft:tnt",
      "minecraft:cobblestone",
      "minecraft:cobblestone",
      "minecraft:cobblestone",
      "minecraft:cobblestone"
    ],
    "power": 6,
    "breaks": true,
    "fire": false,
    "effect": "earthquake",
    "name": {
      "ja": "地震TNT",
      "en": "Earthquake TNT"
    }
  },
  {
    "id": "manytnt:bouncy_tnt",
    "category": "physics",
    "color": "#3cc85a",
    "recipe": [
      "minecraft:tnt",
      "minecraft:slime_ball"
    ],
    "power": 0,
    "breaks": false,
    "fire": false,
    "effect": "bouncy",
    "name": {
      "ja": "バウンドTNT",
      "en": "Bouncy TNT"
    }
  },
  {
    "id": "manytnt:web_tnt",
    "category": "world",
    "color": "#e6e6e6",
    "recipe": [
      "minecraft:tnt",
      "minecraft:string",
      "minecraft:string",
      "minecraft:string"
    ],
    "power": 2,
    "breaks": false,
    "fire": false,
    "effect": "web",
    "name": {
      "ja": "蜘蛛の巣TNT",
      "en": "Web TNT"
    }
  },
  {
    "id": "manytnt:treasure_tnt",
    "category": "world",
    "color": "#e6c832",
    "recipe": [
      "minecraft:tnt",
      "minecraft:gold_ingot"
    ],
    "power": 3,
    "breaks": true,
    "fire": false,
    "effect": "treasure",
    "trail": "minecraft:villager_happy",
    "name": {
      "ja": "お宝TNT",
      "en": "Treasure TNT"
    }
  },
  {
    "id": "manytnt:swap_tnt",
    "category": "physics",
    "color": "#b432c8",
    "recipe": [
      "minecraft:tnt",
      "minecraft:ender_eye"
    ],
    "power": 3,
    "breaks": true,
    "fire": false,
    "effect": "swap",
    "trail": "minecraft:endrod",
    "name": {
      "ja": "入れ替えTNT",
      "en": "Swap TNT"
    }
  },
  {
    "id": "manytnt:confusion_tnt",
    "category": "elemental",
    "color": "#786496",
    "recipe": [
      "minecraft:tnt",
      "minecraft:fermented_spider_eye"
    ],
    "power": 2,
    "breaks": false,
    "fire": false,
    "effect": "confusion",
    "trail": "minecraft:mob_spell_particle",
    "name": {
      "ja": "混乱TNT",
      "en": "Confusion TNT"
    }
  },
  {
    "id": "manytnt:blackhole_tnt",
    "category": "physics",
    "color": "#0a0018",
    "recipe": [
      "minecraft:tnt",
      "minecraft:crying_obsidian",
      "minecraft:crying_obsidian"
    ],
    "power": 0,
    "breaks": true,
    "fire": false,
    "effect": "blackhole",
    "trail": "minecraft:basic_smoke_particle",
    "name": {
      "ja": "ブラックホールTNT",
      "en": "Black Hole TNT"
    }
  },
  {
    "id": "manytnt:disco_tnt",
    "category": "fun",
    "color": "#ff1493",
    "recipe": [
      "minecraft:tnt",
      "minecraft:redstone_lamp"
    ],
    "power": 0,
    "breaks": false,
    "fire": false,
    "effect": "disco",
    "trail": "minecraft:totem_particle",
    "name": {
      "ja": "ディスコTNT",
      "en": "Disco TNT"
    }
  },
  {
    "id": "manytnt:ufo_tnt",
    "category": "mobs",
    "color": "#32ff64",
    "recipe": [
      "minecraft:tnt",
      "minecraft:emerald"
    ],
    "power": 2,
    "breaks": false,
    "fire": false,
    "effect": "ufo",
    "trail": "minecraft:mob_spell_particle",
    "name": {
      "ja": "UFO襲来TNT",
      "en": "UFO TNT"
    }
  },
  {
    "id": "manytnt:fireworks_tnt",
    "category": "fun",
    "color": "#ffd700",
    "recipe": [
      "minecraft:tnt",
      "minecraft:firework_rocket"
    ],
    "power": 0,
    "breaks": false,
    "fire": false,
    "effect": "fireworks",
    "trail": "minecraft:totem_particle",
    "name": {
      "ja": "花火大乱舞TNT",
      "en": "Fireworks TNT"
    }
  },
  {
    "id": "manytnt:meteor_tnt",
    "category": "elemental",
    "color": "#8b4513",
    "recipe": [
      "minecraft:tnt",
      "minecraft:fire_charge"
    ],
    "power": 4,
    "breaks": true,
    "fire": true,
    "effect": "meteor",
    "trail": "minecraft:basic_flame_particle",
    "name": {
      "ja": "隕石雨TNT",
      "en": "Meteor TNT"
    }
  },
  {
    "id": "manytnt:curse_tnt",
    "category": "elemental",
    "color": "#1c1c1c",
    "recipe": [
      "minecraft:tnt",
      "minecraft:soul_sand",
      "minecraft:soul_sand"
    ],
    "power": 2,
    "breaks": false,
    "fire": false,
    "effect": "curse",
    "trail": "minecraft:mob_spell_particle",
    "name": {
      "ja": "呪いTNT",
      "en": "Curse TNT"
    }
  },
  {
    "id": "manytnt:grass_tnt",
    "category": "world",
    "color": "#4caf50",
    "recipe": [
      "minecraft:tnt",
      "minecraft:wheat_seeds",
      "minecraft:bone_meal"
    ],
    "power": 0,
    "breaks": false,
    "fire": false,
    "effect": "grass",
    "trail": "minecraft:totem_particle",
    "name": {
      "ja": "草原TNT",
      "en": "Grass TNT"
    }
  },
  {
    "id": "manytnt:desert_tnt",
    "category": "world",
    "color": "#e0c068",
    "recipe": [
      "minecraft:tnt",
      "minecraft:sand",
      "minecraft:sand"
    ],
    "power": 2,
    "breaks": true,
    "fire": false,
    "effect": "desert",
    "trail": "minecraft:basic_smoke_particle",
    "name": {
      "ja": "砂漠TNT",
      "en": "Desert TNT"
    }
  },
  {
    "id": "manytnt:snowgolem_tnt",
    "category": "mobs",
    "color": "#e8f4ff",
    "recipe": [
      "minecraft:tnt",
      "minecraft:carved_pumpkin",
      "minecraft:snowball"
    ],
    "power": 0,
    "breaks": false,
    "fire": false,
    "effect": "snowgolem",
    "trail": "minecraft:snowflake_particle",
    "name": {
      "ja": "雪だるまTNT",
      "en": "Snow Golem TNT"
    }
  },
  {
    "id": "manytnt:bee_tnt",
    "category": "mobs",
    "color": "#ffc107",
    "recipe": [
      "minecraft:tnt",
      "minecraft:honeycomb",
      "minecraft:poppy"
    ],
    "power": 2,
    "breaks": false,
    "fire": false,
    "effect": "bee",
    "trail": "minecraft:villager_happy",
    "name": {
      "ja": "ハチTNT",
      "en": "Bee TNT"
    }
  },
  {
    "id": "manytnt:arrow_tnt",
    "category": "physics",
    "color": "#8d6e63",
    "recipe": [
      "minecraft:tnt",
      "minecraft:arrow",
      "minecraft:arrow"
    ],
    "power": 3,
    "breaks": true,
    "fire": false,
    "effect": "arrow",
    "trail": "minecraft:crit_particle",
    "name": {
      "ja": "アロー乱射TNT",
      "en": "Arrow Barrage TNT"
    }
  },
  {
    "id": "manytnt:rocket_tnt",
    "category": "physics",
    "color": "#d32f2f",
    "recipe": [
      "minecraft:tnt",
      "minecraft:firework_rocket",
      "minecraft:feather"
    ],
    "power": 6,
    "breaks": true,
    "fire": false,
    "trail": "minecraft:basic_flame_particle",
    "launchUp": true,
    "name": {
      "ja": "ロケットTNT",
      "en": "Rocket TNT"
    }
  },
  {
    "id": "manytnt:music_tnt",
    "category": "fun",
    "color": "#ba68c8",
    "recipe": [
      "minecraft:tnt",
      "minecraft:noteblock"
    ],
    "power": 0,
    "breaks": false,
    "fire": false,
    "effect": "music",
    "trail": "minecraft:totem_particle",
    "name": {
      "ja": "音楽TNT",
      "en": "Music TNT"
    }
  },
  {
    "id": "manytnt:tsunami_tnt",
    "category": "elemental",
    "color": "#0288d1",
    "recipe": [
      "minecraft:tnt",
      "minecraft:heart_of_the_sea"
    ],
    "power": 2,
    "breaks": false,
    "fire": false,
    "effect": "tsunami",
    "trail": "minecraft:bubble_particle",
    "name": {
      "ja": "津波TNT",
      "en": "Tsunami TNT"
    }
  },
  {
    "id": "manytnt:smelter_tnt",
    "category": "world",
    "color": "#ff7043",
    "recipe": [
      "minecraft:tnt",
      "minecraft:furnace"
    ],
    "power": 0,
    "breaks": false,
    "fire": false,
    "effect": "smelter",
    "trail": "minecraft:basic_flame_particle",
    "name": {
      "ja": "製錬TNT",
      "en": "Smelter TNT"
    }
  },
  {
    "id": "manytnt:harvest_tnt",
    "category": "world",
    "color": "#8bc34a",
    "recipe": [
      "minecraft:tnt",
      "minecraft:bone_meal",
      "minecraft:bone_meal"
    ],
    "power": 0,
    "breaks": false,
    "fire": false,
    "effect": "harvest",
    "trail": "minecraft:totem_particle",
    "name": {
      "ja": "豊作TNT",
      "en": "Harvest TNT"
    }
  },
  {
    "id": "manytnt:daynight_tnt",
    "category": "fun",
    "color": "#3949ab",
    "recipe": [
      "minecraft:tnt",
      "minecraft:clock"
    ],
    "power": 2,
    "breaks": false,
    "fire": false,
    "effect": "daynight",
    "trail": "minecraft:endrod",
    "name": {
      "ja": "時間TNT",
      "en": "Day-Night TNT"
    }
  },
  {
    "id": "manytnt:storm_tnt",
    "category": "elemental",
    "color": "#546e7a",
    "recipe": [
      "minecraft:tnt",
      "minecraft:trident"
    ],
    "power": 3,
    "breaks": true,
    "fire": false,
    "effect": "storm",
    "trail": "minecraft:totem_particle",
    "name": {
      "ja": "嵐TNT",
      "en": "Storm TNT"
    }
  },
  {
    "id": "manytnt:xp_tnt",
    "category": "world",
    "color": "#7cb342",
    "recipe": [
      "minecraft:tnt",
      "minecraft:experience_bottle",
      "minecraft:experience_bottle"
    ],
    "power": 0,
    "breaks": false,
    "fire": false,
    "effect": "xp",
    "trail": "minecraft:villager_happy",
    "name": {
      "ja": "経験値TNT",
      "en": "XP TNT"
    }
  },
  {
    "id": "manytnt:enderman_tnt",
    "category": "physics",
    "color": "#4a148c",
    "recipe": [
      "minecraft:tnt",
      "minecraft:ender_pearl",
      "minecraft:ender_pearl"
    ],
    "power": 2,
    "breaks": false,
    "fire": false,
    "effect": "enderman",
    "trail": "minecraft:endrod",
    "name": {
      "ja": "エンダーマンTNT",
      "en": "Enderman TNT"
    }
  },
  {
    "id": "manytnt:slime_tnt",
    "category": "mobs",
    "color": "#66bb6a",
    "recipe": [
      "minecraft:tnt",
      "minecraft:slime_ball",
      "minecraft:slime_ball"
    ],
    "power": 0,
    "breaks": false,
    "fire": false,
    "effect": "slime",
    "trail": "minecraft:villager_happy",
    "name": {
      "ja": "スライムTNT",
      "en": "Slime TNT"
    }
  },
  {
    "id": "manytnt:animal_tnt",
    "category": "mobs",
    "color": "#ffab91",
    "recipe": [
      "minecraft:tnt",
      "minecraft:wheat",
      "minecraft:apple"
    ],
    "power": 0,
    "breaks": false,
    "fire": false,
    "effect": "animal",
    "trail": "minecraft:heart_particle",
    "name": {
      "ja": "動物TNT",
      "en": "Animal TNT"
    }
  },
  {
    "id": "manytnt:iceage_tnt",
    "category": "elemental",
    "color": "#81d4fa",
    "recipe": [
      "minecraft:tnt",
      "minecraft:blue_ice",
      "minecraft:blue_ice"
    ],
    "power": 0,
    "breaks": false,
    "fire": false,
    "effect": "iceage",
    "trail": "minecraft:snowflake_particle",
    "name": {
      "ja": "氷河期TNT",
      "en": "Ice Age TNT"
    }
  },
  {
    "id": "manytnt:fortune_tnt",
    "category": "world",
    "color": "#ffd700",
    "recipe": [
      "minecraft:tnt",
      "minecraft:rabbit_foot"
    ],
    "power": 2,
    "breaks": true,
    "fire": false,
    "effect": "fortune",
    "trail": "minecraft:totem_particle",
    "name": {
      "ja": "運試しTNT",
      "en": "Fortune TNT"
    }
  },
  {
    "id": "manytnt:builder_tnt",
    "category": "world",
    "color": "#9e9e9e",
    "recipe": [
      "minecraft:tnt",
      "minecraft:brick_block",
      "minecraft:brick_block"
    ],
    "power": 0,
    "breaks": false,
    "fire": false,
    "effect": "builder",
    "trail": "minecraft:crit_particle",
    "name": {
      "ja": "建材TNT",
      "en": "Builder TNT"
    }
  },
  {
    "id": "manytnt:shaft_tnt",
    "category": "physics",
    "color": "#5d4037",
    "recipe": [
      "minecraft:tnt",
      "minecraft:iron_pickaxe"
    ],
    "power": 0,
    "breaks": false,
    "fire": false,
    "effect": "shaft",
    "trail": "minecraft:basic_smoke_particle",
    "name": {
      "ja": "縦穴TNT",
      "en": "Shaft TNT"
    }
  },
  {
    "id": "manytnt:beam_tnt",
    "category": "physics",
    "color": "#00e5ff",
    "recipe": [
      "minecraft:tnt",
      "minecraft:nether_star"
    ],
    "power": 3,
    "breaks": true,
    "fire": false,
    "effect": "beam",
    "trail": "minecraft:endrod",
    "name": {
      "ja": "ビームTNT",
      "en": "Beam TNT"
    }
  },
  {
    "id": "manytnt:invisibility_tnt",
    "category": "fun",
    "color": "#cfd8dc",
    "recipe": [
      "minecraft:tnt",
      "minecraft:glass",
      "minecraft:fermented_spider_eye"
    ],
    "power": 0,
    "breaks": false,
    "fire": false,
    "effect": "invisibility",
    "trail": "minecraft:basic_smoke_particle",
    "name": {
      "ja": "透明TNT",
      "en": "Invisibility TNT"
    }
  },
  {
    "id": "manytnt:speed_tnt",
    "category": "fun",
    "color": "#29b6f6",
    "recipe": [
      "minecraft:tnt",
      "minecraft:sugar",
      "minecraft:sugar"
    ],
    "power": 0,
    "breaks": false,
    "fire": false,
    "effect": "speed",
    "trail": "minecraft:crit_particle",
    "name": {
      "ja": "スピードTNT",
      "en": "Speed TNT"
    }
  },
  {
    "id": "manytnt:honey_tnt",
    "category": "world",
    "color": "#ffa000",
    "recipe": [
      "minecraft:tnt",
      "minecraft:honey_bottle",
      "minecraft:honey_bottle"
    ],
    "power": 0,
    "breaks": false,
    "fire": false,
    "effect": "honey",
    "trail": "minecraft:villager_happy",
    "name": {
      "ja": "ハチミツTNT",
      "en": "Honey TNT"
    }
  },
  {
    "id": "manytnt:scorched_tnt",
    "category": "elemental",
    "color": "#3e2723",
    "recipe": [
      "minecraft:tnt",
      "minecraft:netherrack",
      "minecraft:blaze_powder"
    ],
    "power": 4,
    "breaks": true,
    "fire": true,
    "effect": "scorched",
    "trail": "minecraft:basic_flame_particle",
    "name": {
      "ja": "焦土TNT",
      "en": "Scorched TNT"
    }
  },
  {
    "id": "manytnt:feast_tnt",
    "category": "world",
    "color": "#ff8a65",
    "recipe": [
      "minecraft:tnt",
      "minecraft:bread",
      "minecraft:cooked_beef"
    ],
    "power": 0,
    "breaks": false,
    "fire": false,
    "effect": "feast",
    "trail": "minecraft:heart_particle",
    "name": {
      "ja": "満腹TNT",
      "en": "Feast TNT"
    }
  },
  {
    "id": "manytnt:cactus_tnt",
    "category": "world",
    "color": "#2e7d32",
    "recipe": [
      "minecraft:tnt",
      "minecraft:cactus",
      "minecraft:cactus"
    ],
    "power": 1,
    "breaks": false,
    "fire": false,
    "effect": "cactus",
    "trail": "minecraft:crit_particle",
    "name": {
      "ja": "サボテンTNT",
      "en": "Cactus TNT"
    }
  },
  {
    "id": "manytnt:obsidian_tnt",
    "category": "world",
    "color": "#311b92",
    "recipe": [
      "minecraft:tnt",
      "minecraft:lava_bucket",
      "minecraft:water_bucket"
    ],
    "power": 0,
    "breaks": false,
    "fire": false,
    "effect": "obsidian",
    "trail": "minecraft:endrod",
    "name": {
      "ja": "黒曜石TNT",
      "en": "Obsidian TNT"
    }
  },
  {
    "id": "manytnt:glow_tnt",
    "category": "world",
    "color": "#fff59d",
    "recipe": [
      "minecraft:tnt",
      "minecraft:glowstone",
      "minecraft:glow_ink_sac"
    ],
    "power": 0,
    "breaks": false,
    "fire": false,
    "effect": "glow",
    "trail": "minecraft:villager_happy",
    "name": {
      "ja": "発光TNT",
      "en": "Glow TNT"
    }
  },
  {
    "id": "manytnt:vacuum_tnt",
    "category": "physics",
    "color": "#263238",
    "recipe": [
      "minecraft:tnt",
      "minecraft:sponge",
      "minecraft:sponge"
    ],
    "power": 0,
    "breaks": false,
    "fire": false,
    "effect": "vacuum",
    "trail": "minecraft:bubble_particle",
    "name": {
      "ja": "真空TNT",
      "en": "Vacuum TNT"
    }
  },
  {
    "id": "manytnt:chorus_tnt",
    "category": "physics",
    "color": "#ab47bc",
    "recipe": [
      "minecraft:tnt",
      "minecraft:chorus_fruit",
      "minecraft:popped_chorus_fruit"
    ],
    "power": 2,
    "breaks": false,
    "fire": false,
    "effect": "chorus",
    "trail": "minecraft:endrod",
    "name": {
      "ja": "エンドTNT",
      "en": "Chorus TNT"
    }
  },
  {
    "id": "manytnt:armageddon_tnt",
    "category": "nuclear",
    "color": "#000000",
    "recipe": [
      "manytnt:tsar_bomba_tnt",
      "manytnt:hydrogen_bomb_tnt",
      "manytnt:ultra_nuke_tnt",
      "manytnt:nuke_tnt",
      "minecraft:nether_star"
    ],
    "power": 40,
    "breaks": true,
    "fire": true,
    "underwater": true,
    "effect": "armageddon",
    "trail": "minecraft:huge_explosion_emitter",
    "nuclear": true,
    "gachaWeight": 0.25,
    "name": {
      "ja": "終焉TNT",
      "en": "Armageddon TNT"
    }
  },
  {
    "id": "manytnt:gacha_tnt",
    "category": "fun",
    "color": "#ff69b4",
    "recipe": [
      "minecraft:tnt",
      "minecraft:emerald",
      "minecraft:rabbit_foot"
    ],
    "power": 2,
    "breaks": true,
    "fire": false,
    "trail": "minecraft:totem_particle",
    "isGacha": true,
    "name": {
      "ja": "ガチャTNT",
      "en": "Gacha TNT"
    }
  },
  {
    "id": "manytnt:cluster_tnt",
    "category": "blast",
    "color": "#e65100",
    "recipe": [
      "manytnt:mini_tnt",
      "manytnt:mini_tnt",
      "manytnt:mini_tnt",
      "minecraft:gunpowder"
    ],
    "power": 3,
    "breaks": true,
    "fire": false,
    "effect": "cluster",
    "trail": "minecraft:crit_particle",
    "name": {
      "ja": "分裂TNT",
      "en": "Cluster TNT"
    }
  },
  {
    "id": "manytnt:landmine_tnt",
    "category": "blast",
    "color": "#4e5b31",
    "recipe": [
      "minecraft:tnt",
      "minecraft:stone_pressure_plate"
    ],
    "power": 4,
    "breaks": true,
    "fire": false,
    "landmine": true,
    "trail": "minecraft:basic_smoke_particle",
    "name": {
      "ja": "地雷TNT",
      "en": "Landmine TNT"
    }
  },
  {
    "id": "manytnt:timer_tnt",
    "category": "blast",
    "color": "#b71c1c",
    "recipe": [
      "minecraft:tnt",
      "minecraft:clock",
      "minecraft:redstone"
    ],
    "power": 8,
    "breaks": true,
    "fire": false,
    "timer": 30,
    "trail": "minecraft:basic_flame_particle",
    "name": {
      "ja": "時限TNT",
      "en": "Time Bomb TNT"
    }
  },
  {
    "id": "manytnt:homing_tnt",
    "category": "blast",
    "color": "#ff5722",
    "recipe": [
      "minecraft:tnt",
      "minecraft:compass"
    ],
    "power": 4,
    "breaks": true,
    "fire": false,
    "homing": true,
    "trail": "minecraft:basic_flame_particle",
    "name": {
      "ja": "誘導TNT",
      "en": "Homing TNT"
    }
  },
  {
    "id": "manytnt:mining_tnt",
    "category": "world",
    "color": "#607d8b",
    "recipe": [
      "minecraft:tnt",
      "minecraft:golden_pickaxe"
    ],
    "power": 0,
    "breaks": false,
    "fire": false,
    "effect": "mining",
    "trail": "minecraft:crit_particle",
    "name": {
      "ja": "採掘TNT",
      "en": "Mining TNT"
    }
  },
  {
    "id": "manytnt:wall_tnt",
    "category": "world",
    "color": "#8d8d8d",
    "recipe": [
      "minecraft:tnt",
      "minecraft:stone_bricks",
      "minecraft:stone_bricks"
    ],
    "power": 0,
    "breaks": false,
    "fire": false,
    "effect": "wall",
    "trail": "minecraft:crit_particle",
    "name": {
      "ja": "防壁TNT",
      "en": "Wall TNT"
    }
  },
  {
    "id": "manytnt:timestop_tnt",
    "category": "physics",
    "color": "#7e57c2",
    "recipe": [
      "minecraft:tnt",
      "minecraft:clock",
      "minecraft:packed_ice"
    ],
    "power": 0,
    "breaks": false,
    "fire": false,
    "effect": "timestop",
    "trail": "minecraft:endrod",
    "name": {
      "ja": "時間停止TNT",
      "en": "Time Stop TNT"
    }
  },
  {
    "id": "manytnt:forest_tnt",
    "category": "world",
    "color": "#33691e",
    "recipe": [
      "minecraft:tnt",
      "minecraft:oak_sapling",
      "minecraft:oak_sapling"
    ],
    "power": 0,
    "breaks": false,
    "fire": false,
    "effect": "forest",
    "trail": "minecraft:villager_happy",
    "name": {
      "ja": "植林TNT",
      "en": "Forest TNT"
    }
  },
  {
    "id": "manytnt:bridge_tnt",
    "category": "world",
    "color": "#a1887f",
    "recipe": [
      "minecraft:tnt",
      "minecraft:oak_planks",
      "minecraft:oak_planks",
      "minecraft:oak_planks"
    ],
    "power": 0,
    "breaks": false,
    "fire": false,
    "effect": "bridge",
    "trail": "minecraft:crit_particle",
    "name": {
      "ja": "橋TNT",
      "en": "Bridge TNT"
    }
  },
  {
    "id": "manytnt:reaper_tnt",
    "category": "world",
    "color": "#ffb300",
    "recipe": [
      "minecraft:tnt",
      "minecraft:iron_hoe"
    ],
    "power": 0,
    "breaks": false,
    "fire": false,
    "effect": "reaper",
    "trail": "minecraft:villager_happy",
    "name": {
      "ja": "収穫祭TNT",
      "en": "Reaper TNT"
    }
  }
];

export const CATEGORIES = ["blast","nuclear","elemental","physics","mobs","world","fun"];

export const CONTAINER_BLOCKS = [
  "minecraft:acacia_shelf",
  "minecraft:bamboo_shelf",
  "minecraft:barrel",
  "minecraft:birch_shelf",
  "minecraft:black_shulker_box",
  "minecraft:blast_furnace",
  "minecraft:blue_shulker_box",
  "minecraft:brewing_stand",
  "minecraft:brown_shulker_box",
  "minecraft:cherry_shelf",
  "minecraft:chest",
  "minecraft:chiseled_bookshelf",
  "minecraft:copper_chest",
  "minecraft:crafter",
  "minecraft:crimson_shelf",
  "minecraft:cyan_shulker_box",
  "minecraft:dark_oak_shelf",
  "minecraft:decorated_pot",
  "minecraft:dispenser",
  "minecraft:dropper",
  "minecraft:ender_chest",
  "minecraft:exposed_copper_chest",
  "minecraft:furnace",
  "minecraft:gray_shulker_box",
  "minecraft:green_shulker_box",
  "minecraft:hopper",
  "minecraft:jukebox",
  "minecraft:jungle_shelf",
  "minecraft:lectern",
  "minecraft:light_blue_shulker_box",
  "minecraft:light_gray_shulker_box",
  "minecraft:lime_shulker_box",
  "minecraft:lit_blast_furnace",
  "minecraft:lit_furnace",
  "minecraft:lit_smoker",
  "minecraft:magenta_shulker_box",
  "minecraft:mangrove_shelf",
  "minecraft:oak_shelf",
  "minecraft:orange_shulker_box",
  "minecraft:oxidized_copper_chest",
  "minecraft:pale_oak_shelf",
  "minecraft:pink_shulker_box",
  "minecraft:poplar_shelf",
  "minecraft:purple_shulker_box",
  "minecraft:red_shulker_box",
  "minecraft:smoker",
  "minecraft:spruce_shelf",
  "minecraft:trapped_chest",
  "minecraft:undyed_shulker_box",
  "minecraft:warped_shelf",
  "minecraft:waxed_copper_chest",
  "minecraft:waxed_exposed_copper_chest",
  "minecraft:waxed_oxidized_copper_chest",
  "minecraft:waxed_weathered_copper_chest",
  "minecraft:weathered_copper_chest",
  "minecraft:white_shulker_box",
  "minecraft:yellow_shulker_box"
];
