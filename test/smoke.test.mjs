// 全モジュールが読み込めて、イベント登録まで例外なく終わること。
import { test } from "node:test";
import assert from "node:assert/strict";
import { system, world } from "@minecraft/server";

test("main.js を読み込み、起動イベントでカスタムコンポーネントが登録される", async () => {
  await import("../packs/BP/scripts/main.js");
  const registered = [];
  system.beforeEvents.startup.fire({
    blockComponentRegistry: { registerCustomComponent: (name, comp) => registered.push([name, Object.keys(comp)]) },
  });
  const names = registered.map(([n]) => n);
  assert.deepEqual(names.sort(), ["manytnt:ignite", "manytnt:landmine"]);
  const ignite = registered.find(([n]) => n === "manytnt:ignite")[1];
  assert.ok(ignite.includes("onRedstoneUpdate"), "レッドストーンのイベントを受け取る");
  assert.ok(ignite.includes("onPlayerBreak"), "2.x の破壊フック名 (B29)");
  assert.ok(!ignite.includes("onPlayerDestroy"));
  assert.equal(world.beforeEvents.explosion.handlers.length, 1);
  world.afterEvents.worldLoad.fire({});
});

test("全ての効果関数が例外なく実行できる", async () => {
  const { EFFECTS } = await import("../packs/BP/scripts/effects/index.js");
  const { tick } = await import("@minecraft/server");
  const dim = world.getDimension("minecraft:overworld");
  for (let x = -20; x <= 20; x++) for (let z = -20; z <= 20; z++) dim.setBlock({ x, y: -1, z }, "minecraft:grass_block");
  dim.spawnEntity("minecraft:zombie", { x: 2, y: 0, z: 2 });
  const errors = [];
  const orig = console.warn;
  console.warn = (m) => errors.push(m);
  try {
    for (const [name, fn] of Object.entries(EFFECTS)) {
      fn(dim, { x: 0.5, y: 0, z: 0.5 }, { scale: 0.25, def: { id: "manytnt:test" } });
      tick(5);
    }
    tick(800);
  } finally {
    console.warn = orig;
  }
  assert.deepEqual(errors, []);
});
