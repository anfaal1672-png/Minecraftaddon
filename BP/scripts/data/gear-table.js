/**
 * このファイルは自動生成される (tools/build.mjs)。直接編集しないこと。
 *
 * 元になっているもの: data/gear.mjs
 */

/** 投げる爆弾。当たると effect が呼ばれる */
export const THROWABLES = [
  {"id":"grenade","name":{"ja":"手榴弾","en":"Grenade"},"desc":{"ja":"投げて当たった場所で爆発する。距離を取って使える。","en":"Explodes where it lands. Lets you keep your distance."},"effect":"grenadeHit"},
  {"id":"incendiary","name":{"ja":"焼夷手榴弾","en":"Incendiary Grenade"},"desc":{"ja":"当たった場所を火の海に変える。木造には使わないこと。","en":"Turns the impact into a sea of fire. Not for wooden builds."},"effect":"incendiaryHit"},
  {"id":"flashbang","name":{"ja":"閃光弾","en":"Flashbang"},"desc":{"ja":"何も壊さない。目と足を一時的に潰すだけ。","en":"Breaks nothing. Just takes away sight and footing for a while."},"effect":"flashbangHit"},
  {"id":"smoke_bomb","name":{"ja":"煙玉","en":"Smoke Bomb"},"desc":{"ja":"濃い煙が居座る。逃げるときに足元へ投げる。","en":"Thick smoke that lingers. Throw it at your feet and run."},"effect":"smokeBombHit"},
  {"id":"sticky_bomb","name":{"ja":"粘着爆弾","en":"Sticky Bomb"},"desc":{"ja":"当たった場所に貼り付き、3秒後に大きく爆発する。","en":"Sticks where it lands and blows up big three seconds later."},"effect":"stickyBombHit"},
];

/** 手に持って使う道具 */
export const TOOLS = [
  {"id":"detonator","name":{"ja":"リモート起爆装置","en":"Remote Detonator"},"desc":{"ja":"視線の先のTNT1個を、離れた場所から着火する。","en":"Lights the single TNT you are looking at, from a distance."},"handler":"useDetonator"},
  {"id":"blast_rod","name":{"ja":"一斉起爆ロッド","en":"Blast Rod"},"desc":{"ja":"視線の先を中心に、半径10のTNTを全部まとめて着火する。","en":"Lights every TNT within ten blocks of where you are looking."},"handler":"useBlastRod"},
  {"id":"timer_tool","name":{"ja":"時限装置","en":"Timer"},"desc":{"ja":"TNTに使うと、指定した秒数後に着火する予約を仕掛ける。","en":"Sets a TNT to light itself after a countdown."},"handler":"useTimer"},
  {"id":"scanner","name":{"ja":"爆発物探知機","en":"Blast Scanner"},"desc":{"ja":"周囲に埋まっているTNTと地雷、それに鉱石を教えてくれる。","en":"Reports the TNT, landmines and ore hidden around you."},"handler":"useScanner"},
  {"id":"catalog","name":{"ja":"TNT図鑑","en":"TNT Catalog"},"desc":{"ja":"全種類の威力・効果・レシピを調べられる。設定もここから。","en":"Look up every kind: power, effect, recipe. Settings live here too."},"handler":"useCatalog"},
];

/** 仕掛けブロック */
export const GEAR_BLOCKS = [
  {"id":"detonator_block","name":{"ja":"起爆装置","en":"Detonator Block"},"desc":{"ja":"レッドストーン信号を受けると、半径12のTNTを一斉に着火する。","en":"On a redstone signal, lights every TNT within twelve blocks."},"component":"manytnt:detonator_block"},
  {"id":"fuse_block","name":{"ja":"導火線","en":"Fuse"},"desc":{"ja":"火を点けると隣の導火線へ燃え広がり、行き着いた先のTNTを着火する。","en":"Lit fuse burns along to the next one and sets off the TNT at the end."},"component":"manytnt:fuse_block"},
  {"id":"blast_proof_block","name":{"ja":"耐爆ブロック","en":"Blast-Proof Block"},"desc":{"ja":"このアドオンのどのTNTでも壊れない。実験場の壁に。","en":"No TNT in this addon can break it. Wall off your test range."},"component":null},
];
