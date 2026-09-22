// 設定・統計・起爆装置・地雷・多言語の確認
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, tick, spawnPlayer } from "@minecraft/server";

const S = await import("../packs/BP/scripts/systems/settings.js");
const I = await import("../packs/BP/scripts/systems/i18n.js");
const D = await import("../packs/BP/scripts/systems/detonator.js");
const T = await import("../packs/BP/scripts/systems/traps.js");
const ST = await import("../packs/BP/scripts/systems/stats.js");
const { TNT_DEFS } = await import("../packs/BP/scripts/generated/defs.js");

test("設定: 範囲外の値は丸められ、旧バージョンのミュート設定を引き継ぐ", () => {
  world.setDynamicProperty("manytnt:muted", true);
  S.resetSettingsCache();
  assert.equal(S.getSettings().chat, false);
  const s = S.updateSettings({ powerScale: 99, chainPerSecond: 0, gachaTable: "???", chat: true });
  assert.equal(s.powerScale, 2);
  assert.equal(s.chainPerSecond, 10);
  assert.equal(s.gachaTable, "normal");
  S.resetSettingsCache();
  assert.equal(S.getSettings().chat, true, "保存した値が優先");
});

test("多言語: 翻訳キーと差し込み値の RawMessage", () => {
  assert.deepEqual(I.msg("stats_total", 5), { translate: "manytnt.msg.stats_total", with: ["5"] });
  assert.deepEqual(I.msg("gacha_result", I.tntName("manytnt:nuke_tnt")), {
    translate: "manytnt.msg.gacha_result",
    with: { rawtext: [{ translate: "tile.manytnt:nuke_tnt.name" }] },
  });
});

test("起爆装置: 登録は最大16個、同じ場所は解除", () => {
  const links = [];
  for (let i = 0; i < D.MAX_LINKS; i++) assert.equal(D.toggleLink(links, "d", { x: i, y: 0, z: 0 }), "added");
  assert.equal(D.toggleLink(links, "d", { x: 99, y: 0, z: 0 }), "full");
  assert.equal(D.toggleLink(links, "d", { x: 3, y: 0, z: 0 }), "removed");
  assert.equal(links.length, D.MAX_LINKS - 1);
});

test("起爆装置: 登録したTNTを一斉起爆し、無くなったものは登録から外す", () => {
  const dim = world.getDimension("det");
  const p = spawnPlayer(dim, { x: 0, y: 0, z: 0 });
  dim.setBlock({ x: 5, y: 0, z: 0 }, "manytnt:mini_tnt");
  dim.setBlock({ x: 6, y: 0, z: 0 }, "manytnt:mini_tnt");
  D.saveLinks(p, [["det", 5, 0, 0], ["det", 6, 0, 0], ["det", 7, 0, 0], ["other", 1, 1, 1]]);
  D.detonate(p);
  assert.equal(dim._entities.filter((e) => e.typeId === "minecraft:tnt").length, 2);
  assert.deepEqual(D.loadLinks(p), [["other", 1, 1, 1]], "別ディメンションの登録は残す");
  tick(100);
});

test("地雷: 本人・しゃがみ中・アイテムでは起爆しない", () => {
  const dim = world.getDimension("mine");
  const owner = spawnPlayer(dim, { x: 0, y: 1, z: 0 });
  const other = spawnPlayer(dim, { x: 0, y: 1, z: 0 }, "Alex");
  const zombie = dim.spawnEntity("minecraft:zombie", { x: 0, y: 1, z: 0 });
  const item = dim.spawnEntity("minecraft:item", { x: 0, y: 1, z: 0 });
  assert.equal(T.shouldTrigger(owner, owner.id), false);
  assert.equal(T.shouldTrigger(item, owner.id), false);
  assert.equal(T.shouldTrigger(zombie, owner.id), true);
  assert.equal(T.shouldTrigger(other, owner.id), true);
  other.isSneaking = true;
  assert.equal(T.shouldTrigger(other, owner.id), false);
});

test("地雷: 踏まれると短い導火線で起爆する", () => {
  S.updateSettings({ powerScale: 1 });
  const dim = world.getDimension("mine2");
  dim.setBlock({ x: 0, y: 0, z: 0 }, "manytnt:landmine_tnt");
  const owner = spawnPlayer(dim, { x: 0, y: 1, z: 0 });
  T.rememberMine(dim.id, { x: 0, y: 0, z: 0 }, owner.id);
  const block = dim.getBlock({ x: 0, y: 0, z: 0 });
  T.onMineStepOn({ block, dimension: dim, entity: owner });
  assert.equal(dim.typeAt({ x: 0, y: 0, z: 0 }), "manytnt:landmine_tnt");
  T.onMineStepOn({ block, dimension: dim, entity: dim.spawnEntity("minecraft:zombie", { x: 0, y: 1, z: 0 }) });
  assert.equal(dim.typeAt({ x: 0, y: 0, z: 0 }), "minecraft:air");
  tick(15);
  assert.equal(dim.explosions.at(-1)?.power, 4);
});

test("B07: 全種類制覇は到達できる (ガチャは着火しただけでも使用済み)", () => {
  for (const d of TNT_DEFS) {
    if (d.isGacha) ST.recordExplosion("manytnt:mega_tnt", d.id);
    else ST.recordExplosion(d.id, d.id);
  }
  assert.ok(ST.getWorldStats().milestones.includes("all_types"));
});

test("B21: 統計の保存はまとめて行う", () => {
  const writes = [];
  const orig = world.setDynamicProperty.bind(world);
  world.setDynamicProperty = (k, v) => {
    if (k === "manytnt:stats") writes.push(k);
    orig(k, v);
  };
  try {
    for (let i = 0; i < 20; i++) ST.recordExplosion("manytnt:mini_tnt");
    assert.equal(writes.length, 0);
    tick(110);
    assert.equal(writes.length, 1);
  } finally {
    world.setDynamicProperty = orig;
  }
});
