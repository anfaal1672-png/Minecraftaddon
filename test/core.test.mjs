// 着火・爆発・スケジューラーまわりのバグ修正の確認
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { world, system, tick, spawnPlayer } from "@minecraft/server";

const { igniteBlock, scheduleChainIgnition, spawnLitTnt, TAG_TYPE, TAG_ORIGIN } = await import("../packs/BP/scripts/core/ignition.js");
const { chainReactionCheck, finishExplosion, registerExplosionHook, detonateTntEntity } = await import("../packs/BP/scripts/core/explosion.js");
const { runBlockJob, queueExplosion, BLOCK_BUDGET } = await import("../packs/BP/scripts/core/scheduler.js");
const { getDef } = await import("../packs/BP/scripts/core/registry.js");
const { updateSettings } = await import("../packs/BP/scripts/systems/settings.js");
const { getWorldStats, usedTypes } = await import("../packs/BP/scripts/systems/stats.js");
registerExplosionHook();

let n = 0;
let dim;
beforeEach(() => {
  tick(1200); // 前のテストの予約 (爆発・連鎖) を流しきる
  dim = world.getDimension(`test:${n++}`);
  updateSettings({ terrain: true, powerScale: 1, allowNuclear: true, chainPerSecond: 60, gachaTable: "normal" });
});
const tnts = () => dim._entities.filter((e) => e.typeId === "minecraft:tnt");
const spawnedTnt = () => dim.spawned["minecraft:tnt"] ?? 0;

test("B02: 同じTNTに3回連鎖着火しても、エンティティは1体だけ", () => {
  dim.setBlock({ x: 0, y: 0, z: 0 }, "manytnt:nuke_tnt");
  assert.equal(igniteBlock(dim, { x: 0, y: 0, z: 0 }, { chained: true }), true);
  assert.equal(igniteBlock(dim, { x: 0, y: 0, z: 0 }, { chained: true }), false);
  assert.equal(igniteBlock(dim, { x: 0, y: 0, z: 0 }), false);
  assert.equal(tnts().length, 1);
  assert.equal(dim.typeAt({ x: 0, y: 0, z: 0 }), "minecraft:air");
});

test("B02: 近くで何度爆発しても、1ブロックは1回しか予約されない", () => {
  dim.setBlock({ x: 2, y: 0, z: 0 }, "manytnt:mega_tnt");
  for (let i = 0; i < 5; i++) chainReactionCheck(dim, { x: 0, y: 0, z: 0 }, 4);
  tick(60);
  assert.equal(spawnedTnt(), 1);
  assert.equal(dim.explosions.length, 1);
});

test("B02: 自前の爆発で起きる beforeEvents.explosion では連鎖スキャンを二重に走らせない", () => {
  dim.setBlock({ x: 3, y: 0, z: 0 }, "manytnt:mini_tnt");
  finishExplosion(dim, { x: 0.5, y: 0, z: 0.5 }, getDef("manytnt:mega_tnt"));
  // スケジューラーが爆発を実行 → ゲームなら beforeEvents が発火する
  tick(1);
  const ex = dim.explosions.at(-1);
  assert.ok(ex, "爆発が実行された");
  const ev = world.beforeEvents.explosion.fire({
    dimension: dim,
    source: undefined,
    cancel: false,
    getImpactedBlocks: () => [{ location: { x: 1, y: 0, z: 0 } }, { location: { x: -1, y: 0, z: 0 } }],
  });
  assert.equal(ev.cancel, false);
  tick(60);
  assert.equal(spawnedTnt(), 1, "連鎖は1回だけ");
});

test("B06: 連鎖着火したガチャTNTは、当たった種類で爆発する", () => {
  dim.setBlock({ x: 0, y: 0, z: 0 }, "manytnt:gacha_tnt");
  const orig = Math.random;
  Math.random = () => 0.001; // 先頭 (mega_tnt) が当たる
  try {
    igniteBlock(dim, { x: 0, y: 0, z: 0 }, { chained: true });
  } finally {
    Math.random = orig;
  }
  const t = tnts()[0];
  assert.ok(t.getTags().includes(TAG_TYPE + "manytnt:mega_tnt"));
  assert.ok(t.getTags().includes(TAG_ORIGIN + "manytnt:gacha_tnt"));
  tick(40); // 短い導火線で爆発
  const ex = dim.explosions.at(-1);
  assert.equal(ex.power, 14, "メガTNTの威力");
  // B07: 元のガチャTNTも「使用済み」になる
  assert.ok(usedTypes(getWorldStats()).has("gacha_tnt"));
});

test("B05: ガチャTNTの着火で例外が出ない (center の参照順)", () => {
  const warns = [];
  const orig = console.warn;
  console.warn = (m) => warns.push(m);
  try {
    spawnLitTnt(dim, { x: 0.5, y: 0, z: 0.5 }, getDef("manytnt:gacha_tnt"));
  } finally {
    console.warn = orig;
  }
  assert.deepEqual(warns, []);
});

test("タグ付きTNTの爆発はキャンセルして、こちらの威力で爆発させる", () => {
  const t = spawnLitTnt(dim, { x: 0.5, y: 0, z: 0.5 }, getDef("manytnt:mini_tnt"));
  const ev = world.beforeEvents.explosion.fire({ dimension: dim, source: t, cancel: false, getImpactedBlocks: () => [] });
  assert.equal(ev.cancel, true);
  tick(2);
  assert.equal(dim.explosions.at(-1).power, 2);
});

test("B17: 連鎖の上限を超えた着火は捨てずに順番待ちになる", () => {
  updateSettings({ chainPerSecond: 20 }); // 1tick に1個
  for (let i = 0; i < 30; i++) {
    dim.setBlock({ x: i * 2, y: 0, z: 100 }, "manytnt:mini_tnt");
    scheduleChainIgnition(dim, { x: i * 2, y: 0, z: 100 }, 0);
  }
  tick(5);
  const early = spawnedTnt();
  assert.ok(early <= 6, `レート制限されている (${early})`);
  tick(40);
  assert.equal(spawnedTnt(), 30, "最終的に全部着火する");
});

test("核系の着火が禁止されていると着火しない", () => {
  updateSettings({ allowNuclear: false });
  dim.setBlock({ x: 0, y: 0, z: 0 }, "manytnt:nuke_tnt");
  const p = spawnPlayer(dim, { x: 3, y: 0, z: 0 });
  assert.equal(igniteBlock(dim, { x: 0, y: 0, z: 0 }, { source: p }), false);
  assert.equal(dim.typeAt({ x: 0, y: 0, z: 0 }), "manytnt:nuke_tnt");
});

test("安全モードでは爆発が地形を壊さない", () => {
  updateSettings({ terrain: false });
  finishExplosion(dim, { x: 0.5, y: 0, z: 0.5 }, getDef("manytnt:mega_tnt"));
  tick(1);
  assert.equal(dim.explosions.at(-1).options.breaksBlocks, false);
});

test("威力倍率が効き、上限 100 を超えない", () => {
  updateSettings({ powerScale: 2 });
  finishExplosion(dim, { x: 0.5, y: 0, z: 0.5 }, getDef("manytnt:antimatter_tnt"));
  tick(1);
  assert.equal(dim.explosions.at(-1).power, 100);
});

test("スケジューラー: 1tick のブロック処理は予算内、爆発は1tickに1発", () => {
  const perTick = [];
  let ops = 0;
  runBlockJob("test", function* () {
    for (let i = 0; i < 20000; i++) {
      ops++;
      yield 1;
    }
  });
  for (let i = 0; i < 5; i++) queueExplosion(dim, { x: 0, y: 0, z: 0 }, 4);
  for (let t = 0; t < 10; t++) {
    const before = ops;
    const exBefore = dim.explosions.length;
    tick(1);
    perTick.push([ops - before, dim.explosions.length - exBefore]);
  }
  for (const [o, e] of perTick) {
    assert.ok(o <= BLOCK_BUDGET, `ops ${o}`);
    assert.ok(e <= 1, `explosions ${e}`);
  }
});

test("時限TNT: 着火してもすぐには爆発せず、壊すと解除できる", () => {
  dim.setBlock({ x: 0, y: 0, z: 0 }, "manytnt:timer_tnt");
  assert.equal(igniteBlock(dim, { x: 0, y: 0, z: 0 }), true);
  tick(100);
  assert.equal(tnts().length, 0);
  assert.equal(dim.typeAt({ x: 0, y: 0, z: 0 }), "manytnt:timer_tnt");
  dim.setBlock({ x: 0, y: 0, z: 0 }, "minecraft:air"); // 解除
  tick(700);
  assert.equal(tnts().length, 0);
});

test("時限TNT: 30秒後に爆発する", () => {
  dim.setBlock({ x: 0, y: 0, z: 0 }, "manytnt:timer_tnt");
  igniteBlock(dim, { x: 0, y: 0, z: 0 });
  tick(30 * 20 + 25);
  assert.equal(dim.explosions.at(-1)?.power, 8);
});

test("短い導火線のTNTは detonateTntEntity で1回だけ爆発する", () => {
  const t = spawnLitTnt(dim, { x: 0.5, y: 0, z: 0.5 }, getDef("manytnt:mini_tnt"));
  detonateTntEntity(t);
  detonateTntEntity(t);
  tick(3);
  assert.equal(dim.explosions.length, 1);
});
