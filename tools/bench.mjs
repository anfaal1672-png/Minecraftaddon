/**
 * 核系の掘削がどれくらいの規模になるかを測る。
 *   実行: node --import ./tools/test/mock/loader.mjs tools/bench.mjs
 *
 * 実機の速度そのものは測れないが、代役の世界でも
 *   ・段階ごとに何ブロック消えるのか
 *   ・そのために API を何回叩くのか
 * は確かめられる。実機での重さはだいたい呼び出し回数に比例するので、
 * ここの数字が跳ね上がったら調整が要る合図になる。
 */
import { freshWorld, system } from "./test/setup.mjs";
import { carveSphere } from "../BP/scripts/lib/terrain.js";
import { NUKE_TIERS } from "../BP/scripts/effects/nuclear.js";

const TIERS = [
  ["核TNT", NUKE_TIERS.nuke.blastRadius],
  ["超核TNT", NUKE_TIERS.ultraNuke.blastRadius],
  ["水素爆弾", NUKE_TIERS.hydrogenBomb.blastRadius],
  ["ツァーリボンバ", NUKE_TIERS.tsarBomba.blastRadius],
  ["反物質爆弾", NUKE_TIERS.antimatter.blastRadius],
];

/** 全角を2文字ぶんとして数えて幅を揃える */
const width = (text) => [...text].reduce((n, ch) => n + (ch.charCodeAt(0) > 0x2000 ? 2 : 1), 0);
const padRight = (text, w) => text + " ".repeat(Math.max(0, w - width(text)));
const padLeft = (text, w) => " ".repeat(Math.max(0, w - width(String(text)))) + text;
const num = (value) => value.toLocaleString("en-US");

const rows = [];
for (const [name, radius] of TIERS) {
  const dim = freshWorld();
  const span = radius + 4;
  // 半径ぶんの立方体をすべて石で埋める (いちばん重い場合)
  dim.fill({ x: -span, y: 64 - span, z: -span }, { x: span, y: 64 + span, z: span }, "minecraft:stone");
  const before = dim._blocks.size;
  dim.calls.fillBlocks = 0;

  carveSphere(dim, { x: 0, y: 64, z: 0 }, { radius, scorch: true });
  const ticks = system.drain(20000);

  rows.push({
    name,
    radius,
    destroyed: before - dim._blocks.size,
    calls: dim.calls.fillBlocks,
    ticks,
  });
}

console.log(
  padRight("種類", 16) + padLeft("半径", 6) + padLeft("直径", 6) +
  padLeft("破壊ブロック", 16) + padLeft("API呼び出し", 14) + padLeft("1回あたり", 12)
);
for (const row of rows) {
  console.log(
    padRight(row.name, 16) + padLeft(row.radius, 6) + padLeft(row.radius * 2, 6) +
    padLeft(num(row.destroyed), 16) + padLeft(num(row.calls), 14) +
    padLeft(Math.round(row.destroyed / row.calls), 12)
  );
}

console.log("\n1回の fillBlocks で縦1列をまとめて消しているので、");
console.log("ブロックを1マスずつ書き換える場合に比べて呼び出し回数がおよそ");
const ratio = rows.map((r) => r.destroyed / r.calls);
console.log(`${Math.round(Math.min(...ratio))}〜${Math.round(Math.max(...ratio))} 分の1で済んでいる。`);
