// 効果・安全処理まわりのバグ修正とバランスの確認
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { world, tick, spawnPlayer } from "@minecraft/server";

const { knockbackVector, knockbackFrom } = await import("../packs/BP/scripts/core/entities.js");
const { findSafeLanding, breakBlock, clearSphere } = await import("../packs/BP/scripts/core/safety.js");
const { updateSettings } = await import("../packs/BP/scripts/systems/settings.js");
const { gachaCandidates } = await import("../packs/BP/scripts/core/registry.js");
const W = await import("../packs/BP/scripts/effects/world.js");
const E = await import("../packs/BP/scripts/effects/elemental.js");
const F = await import("../packs/BP/scripts/effects/fun.js");
const P = await import("../packs/BP/scripts/effects/physics.js");
const { RAINBOW_POOL } = await import("../packs/BP/scripts/effects/index.js");

let n = 0;
let dim;
beforeEach(() => {
  dim = world.getDimension(`fx:${n++}`);
  updateSettings({ terrain: true, powerScale: 1, allowNuclear: true, gachaTable: "normal" });
});
const floor = (R = 10, y = -1, type = "minecraft:stone") => {
  for (let x = -R; x <= R; x++) for (let z = -R; z <= R; z++) dim.setBlock({ x, y, z }, type);
};

test("B03: ノックバックは水平と垂直を別々に指定する (2.x の引数)", () => {
  const v = knockbackVector({ x: 3, y: 0, z: 4 }, { x: 0, y: 0, z: 0 }, 2);
  assert.ok(Math.abs(v.x - 1.2) < 1e-9 && Math.abs(v.z - 1.6) < 1e-9);
  const zombie = dim.spawnEntity("minecraft:zombie", { x: 3, y: 0, z: 4 });
  knockbackFrom(zombie, { x: 0, y: 0, z: 0 }, 2, 0.4);
  assert.deepEqual(zombie.knockbacks[0].v, 0.4, "垂直方向は指定した値");
  assert.ok(Math.abs(Math.hypot(zombie.knockbacks[0].h.x, zombie.knockbacks[0].h.z) - 2) < 1e-9, "水平方向の強さ");
});

test("B04: 嵐TNTは Dimension.setWeather で雷雨にする", () => {
  E.stormEffect(dim, { x: 0, y: 0, z: 0 });
  assert.deepEqual(dim.weather, { type: "Thunder", duration: 6000 });
});

test("B08: 豊作TNTはネザーウォート (age) とビートルートも最大まで育てる", () => {
  floor(8, -1, "minecraft:farmland");
  dim.setBlock({ x: 1, y: 0, z: 0 }, "minecraft:nether_wart", { states: { age: 0 } });
  dim.setBlock({ x: 2, y: 0, z: 0 }, "minecraft:beetroot", { states: { growth: 0 } });
  dim.setBlock({ x: 3, y: 0, z: 0 }, "minecraft:wheat", { states: { growth: 2 } });
  W.harvestEffect(dim, { x: 0.5, y: 0, z: 0.5 });
  tick(5);
  assert.equal(dim.getBlock({ x: 1, y: 0, z: 0 }).permutation.getState("age"), 3);
  assert.equal(dim.getBlock({ x: 2, y: 0, z: 0 }).permutation.getState("growth"), 7);
  assert.equal(dim.getBlock({ x: 3, y: 0, z: 0 }).permutation.getState("growth"), 7);
});

test("収穫祭TNT: 実った作物だけ収穫して植え直す", () => {
  dim.setBlock({ x: 1, y: 0, z: 0 }, "minecraft:wheat", { states: { growth: 7 } });
  dim.setBlock({ x: 2, y: 0, z: 0 }, "minecraft:wheat", { states: { growth: 3 } });
  W.reaperEffect(dim, { x: 0.5, y: 0, z: 0.5 });
  tick(5);
  assert.equal(dim.getBlock({ x: 1, y: 0, z: 0 }).permutation.getState("growth"), 0);
  assert.equal(dim.getBlock({ x: 2, y: 0, z: 0 }).permutation.getState("growth"), 3);
  assert.ok(dim._entities.some((e) => e.item?.typeId === "minecraft:wheat"));
});

test("B09: ディスコTNTは床をブロック状態ごと元に戻し、チェストには触らない", () => {
  floor(6, -1, "minecraft:stone");
  dim.setBlock({ x: 1, y: -1, z: 0 }, "minecraft:oak_stairs", { states: { weirdo_direction: 2 } });
  dim.setBlock({ x: 2, y: -1, z: 0 }, "minecraft:chest", { items: [{ typeId: "minecraft:diamond" }] });
  F.discoEffect(dim, { x: 0.5, y: 0, z: 0.5 });
  tick(10);
  assert.notEqual(dim.typeAt({ x: 0, y: -1, z: 0 }), "minecraft:stone", "踊っている最中");
  assert.equal(dim.typeAt({ x: 2, y: -1, z: 0 }), "minecraft:chest");
  assert.ok(world.getDynamicProperty("manytnt:disco_restore"), "復元データを先に保存");
  tick(80);
  assert.equal(dim.typeAt({ x: 0, y: -1, z: 0 }), "minecraft:stone");
  assert.equal(dim.getBlock({ x: 1, y: -1, z: 0 }).permutation.getState("weirdo_direction"), 2);
  assert.equal(world.getDynamicProperty("manytnt:disco_restore"), undefined);
});

test("B09: ディスコの途中でワールドを閉じても、次回ロード時に元に戻る", () => {
  floor(6, -1, "minecraft:stone");
  F.discoEffect(dim, { x: 0.5, y: 0, z: 0.5 });
  tick(10); // 途中
  dim.setBlock({ x: 0, y: -1, z: 0 }, "minecraft:red_concrete");
  F.restorePendingDisco();
  assert.equal(dim.typeAt({ x: 0, y: -1, z: 0 }), "minecraft:stone");
  tick(80);
});

test("B10: 津波TNTは元からあった水を消さない", () => {
  dim.setBlock({ x: 1, y: 0, z: 1 }, "minecraft:water");
  E.tsunamiEffect(dim, { x: 0.5, y: 0, z: 0.5 });
  tick(120);
  assert.equal(dim.typeAt({ x: 1, y: 0, z: 1 }), "minecraft:water");
  const leftovers = [...dim._cells.values()].filter((c) => c.perm.type.id === "minecraft:water").length;
  assert.equal(leftovers, 1, "置いた水は片付けた");
});

test("B11: 地形を壊す効果でも保護ブロックは壊さず、チェストの中身は落とす", () => {
  dim.setBlock({ x: 0, y: 0, z: 0 }, "minecraft:end_portal_frame");
  dim.setBlock({ x: 1, y: 0, z: 0 }, "minecraft:chest", { items: [{ typeId: "minecraft:diamond" }, undefined] });
  assert.equal(breakBlock(dim, dim.getBlock({ x: 0, y: 0, z: 0 })), false);
  assert.equal(breakBlock(dim, dim.getBlock({ x: 1, y: 0, z: 0 })), true);
  assert.equal(dim.typeAt({ x: 0, y: 0, z: 0 }), "minecraft:end_portal_frame");
  assert.ok(dim._entities.some((e) => e.item?.typeId === "minecraft:diamond"));
});

test("B11: 縦穴TNTは保護ブロックで止まる", () => {
  for (let y = -1; y >= -10; y--) dim.setBlock({ x: 0, y, z: 0 }, "minecraft:stone");
  dim.setBlock({ x: 0, y: -5, z: 0 }, "minecraft:bedrock");
  P.shaftEffect(dim, { x: 0.5, y: 0, z: 0.5 });
  tick(5);
  assert.equal(dim.typeAt({ x: 0, y: -4, z: 0 }), "minecraft:air");
  assert.equal(dim.typeAt({ x: 0, y: -5, z: 0 }), "minecraft:bedrock");
  assert.equal(dim.typeAt({ x: 0, y: -6, z: 0 }), "minecraft:stone");
});

test("安全モードではブロックを壊さない", () => {
  updateSettings({ terrain: false });
  dim.setBlock({ x: 0, y: 0, z: 0 }, "minecraft:stone");
  assert.equal(breakBlock(dim, dim.getBlock({ x: 0, y: 0, z: 0 })), false);
});

test("B12: 安全な着地点は壁の中・溶岩・奈落を返さない", () => {
  // 壁の中
  for (let y = -5; y <= 5; y++) dim.setBlock({ x: 10, y, z: 10 }, "minecraft:stone");
  assert.equal(findSafeLanding(dim, 10.5, 10.5, 0, 3), undefined);
  // 溶岩の上
  dim.setBlock({ x: 20, y: -1, z: 20 }, "minecraft:lava");
  assert.equal(findSafeLanding(dim, 20.5, 20.5, 0, 3), undefined);
  // 奈落 (何もない)
  assert.equal(findSafeLanding(dim, 30.5, 30.5, 0, 3), undefined);
  // 普通の地面
  dim.setBlock({ x: 40, y: -1, z: 40 }, "minecraft:grass_block");
  assert.deepEqual(findSafeLanding(dim, 40.5, 40.5, 2, 3), { x: 40.5, y: 0, z: 40.5 });
});

test("B18: clearSphere は未ロードのチャンクに触らず、保護ブロックとTNTを残す", () => {
  for (let x = -3; x <= 3; x++) for (let y = -3; y <= 3; y++) for (let z = -3; z <= 3; z++) dim.setBlock({ x, y, z }, "minecraft:stone");
  dim.setBlock({ x: 0, y: 0, z: 0 }, "minecraft:bedrock");
  dim.setBlock({ x: 1, y: 0, z: 0 }, "manytnt:nuke_tnt");
  dim.unloaded.add("5,5");
  for (const _ of clearSphere(dim, { x: 0, y: 0, z: 0 }, 3));
  for (const _ of clearSphere(dim, { x: 85, y: 0, z: 85 }, 3));
  assert.equal(dim.typeAt({ x: 0, y: 0, z: 0 }), "minecraft:bedrock");
  assert.equal(dim.typeAt({ x: 1, y: 0, z: 0 }), "manytnt:nuke_tnt");
  assert.equal(dim.typeAt({ x: 0, y: 1, z: 0 }), "minecraft:air");
});

test("B31: 建材TNTは土を grass_path に変える", () => {
  floor(6, -1, "minecraft:dirt");
  W.builderEffect(dim, { x: 0.5, y: 0, z: 0.5 });
  tick(3);
  assert.equal(dim.typeAt({ x: 0, y: -1, z: 0 }), "minecraft:grass_path");
});

test("採掘TNT: 鉱石だけを掘り、跡を元の岩で埋める", () => {
  dim.setBlock({ x: 2, y: 0, z: 0 }, "minecraft:diamond_ore");
  dim.setBlock({ x: 0, y: 2, z: 0 }, "minecraft:deepslate_iron_ore");
  W.miningEffect(dim, { x: 0.5, y: 0, z: 0.5 });
  tick(3);
  assert.equal(dim.typeAt({ x: 2, y: 0, z: 0 }), "minecraft:stone");
  assert.equal(dim.typeAt({ x: 0, y: 2, z: 0 }), "minecraft:deepslate");
  const drops = dim._entities.map((e) => e.item?.typeId).filter(Boolean).sort();
  assert.deepEqual(drops, ["minecraft:diamond", "minecraft:raw_iron"]);
});

test("橋TNT: 着火した人の向きに橋を架ける", () => {
  const p = spawnPlayer(dim, { x: 0, y: 0, z: 0 });
  p.viewDirection = { x: 0, y: 0, z: -1 };
  W.bridgeEffect(dim, { x: 0.5, y: 0, z: 0.5 }, { source: p });
  tick(5);
  assert.equal(dim.typeAt({ x: 0, y: -1, z: -10 }), "minecraft:oak_planks");
  assert.equal(dim.typeAt({ x: 0, y: -1, z: 10 }), "minecraft:air");
});

test("B25: お宝TNTの期待値は材料 (金インゴット + TNT) より低い", () => {
  // 価値の目安 (鉄インゴット = 1)
  const V = {
    "minecraft:iron_nugget": 1 / 9,
    "minecraft:gold_nugget": 1 / 9,
    "minecraft:copper_ingot": 0.3,
    "minecraft:iron_ingot": 1,
    "minecraft:lapis_lazuli": 0.3,
    "minecraft:emerald": 3,
    "minecraft:diamond": 8,
  };
  const total = W.TREASURE_TABLE.reduce((s, e) => s + e.weight, 0);
  const perRoll = W.TREASURE_TABLE.reduce((s, e) => s + (e.weight / total) * V[e.value[0]] * ((e.value[1] + e.value[2]) / 2), 0);
  const expected = perRoll * W.TREASURE_ROLLS;
  assert.ok(expected < 1.5 + 1, `期待値 ${expected.toFixed(2)}`); // 金インゴット(1.5) + TNT(1)
});

test("B26: 運試しTNTのネザライト期待値はごく小さい", () => {
  const total = W.FORTUNE_JACKPOT.reduce((s, e) => s + e.weight, 0);
  const scrap = W.FORTUNE_JACKPOT.find((e) => e.value[0] === "minecraft:netherite_scrap").weight / total;
  assert.ok(W.FORTUNE_WIN_CHANCE * 3 * scrap < 0.06);
});

test("B27: ガチャの核系は合計でも数%、設定で完全に除外できる", () => {
  const c = gachaCandidates({ gachaTable: "normal", allowNuclear: true });
  const total = c.reduce((s, e) => s + e.weight, 0);
  const nuclear = c.filter((e) => e.value.nuclear).reduce((s, e) => s + e.weight, 0);
  assert.ok(nuclear / total < 0.02, `核系 ${((nuclear / total) * 100).toFixed(2)}%`);
  assert.ok(!c.some((e) => e.value.isGacha));
  assert.ok(!gachaCandidates({ gachaTable: "no_nuclear", allowNuclear: true }).some((e) => e.value.nuclear));
  assert.ok(!gachaCandidates({ gachaTable: "normal", allowNuclear: false }).some((e) => e.value.nuclear));
});

test("B28: 虹TNTの抽選に核の効果は入っていない", () => {
  assert.ok(!RAINBOW_POOL.includes("nuke"));
});
