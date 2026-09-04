/**
 * 拡張で足した仕組みの確認。
 *   ・地雷 (近づくまで爆発しない)
 *   ・弧を描いて飛ぶ着火
 *   ・建築系の地形生成
 */
import { expect, suite, test } from "./harness.mjs";
import { freshWorld, placeTnt, primedEntities, system, tickBlock } from "./setup.mjs";
import { clearMines, PROXIMITY_RANGE } from "../../BP/scripts/core/ignition.js";
import {
  buildBridges, buildShelter, buildWall, carveBox, carveTunnels,
  fillBasin, flattenArea, raiseScaffold, spiralStairs,
} from "../../BP/scripts/lib/terrain.js";
import { CATEGORIES, configsInCategory, tntConfig } from "../../BP/scripts/core/registry.js";

suite("地雷", () => {
  test("誰も近づかなければ爆発しない", () => {
    const dim = freshWorld();
    clearMines();
    const loc = { x: 0, y: 64, z: 0 };
    placeTnt(dim, loc, "mine_tnt");
    // 設置直後は必ず見送る (置いた本人が踏むのを避けるため)
    for (let i = 0; i < 10; i++) {
      tickBlock(dim, loc);
      system.advance(10);
    }
    expect.equal(primedEntities(dim).length, 0, "誰もいないのに爆発した");
    expect.equal(dim.getBlock(loc).typeId, "manytnt:mine_tnt");
  });

  test("近づくと爆発する", () => {
    const dim = freshWorld();
    clearMines();
    const loc = { x: 0, y: 64, z: 0 };
    placeTnt(dim, loc, "mine_tnt");

    tickBlock(dim, loc);        // 1回目は待機に入るだけ
    system.advance(60);         // 起動するまで待つ
    dim.spawnEntity("minecraft:player", { x: 0.5, y: 64.5, z: 1 });
    tickBlock(dim, loc);
    expect.equal(primedEntities(dim).length, 1, "近づいても爆発しない");
  });

  test("アイテムでは反応しない", () => {
    const dim = freshWorld();
    clearMines();
    const loc = { x: 0, y: 64, z: 0 };
    placeTnt(dim, loc, "mine_tnt");
    tickBlock(dim, loc);
    system.advance(60);
    dim.spawnEntity("minecraft:item", { x: 0.5, y: 64.5, z: 1 });
    tickBlock(dim, loc);
    expect.equal(primedEntities(dim).length, 0, "落ちているアイテムで反応した");
  });

  test("反応する距離が離れすぎていない", () => {
    expect.between(PROXIMITY_RANGE, 1.5, 4);
  });
});

suite("飛ぶTNT", () => {
  test("弧を描くTNTは横向きの初速も持つ", () => {
    const dim = freshWorld();
    placeTnt(dim, { x: 0, y: 64, z: 0 }, "missile_tnt");
    dim._setBlock(1, 64, 0, "minecraft:fire");
    tickBlock(dim, { x: 0, y: 64, z: 0 });
    const [tnt] = primedEntities(dim);
    const impulse = tnt.impulses[0];
    expect.atLeast(impulse.y, 1, "上向きの初速が足りない");
    expect.atLeast(Math.abs(impulse.x) + Math.abs(impulse.z), 0.5, "横向きの初速が無い");
  });

  test("真上に上がるTNTは横へ流れない", () => {
    const dim = freshWorld();
    placeTnt(dim, { x: 0, y: 64, z: 0 }, "rocket_tnt");
    dim._setBlock(1, 64, 0, "minecraft:fire");
    tickBlock(dim, { x: 0, y: 64, z: 0 });
    const [tnt] = primedEntities(dim);
    expect.atMost(Math.abs(tnt.impulses[0].x) + Math.abs(tnt.impulses[0].z), 0.3);
  });
});

suite("建築の地形", () => {
  const filled = () => {
    const dim = freshWorld();
    dim.fill({ x: -40, y: 20, z: -40 }, { x: 40, y: 70, z: 40 }, "minecraft:stone");
    return dim;
  };

  test("トンネルが四方に通る", () => {
    const dim = filled();
    carveTunnels(dim, { x: 0, y: 64, z: 0 }, { width: 1, length: 20 });
    system.drain();
    for (const [dx, dz] of [[15, 0], [-15, 0], [0, 15], [0, -15]]) {
      expect.ok(dim.getBlock({ x: dx, y: 64, z: dz }).isAir, `(${dx},${dz}) が掘れていない`);
    }
    // 長さの外は残っている
    expect.ok(!dim.getBlock({ x: 25, y: 64, z: 0 }).isAir, "指定より先まで掘っている");
  });

  test("整地すると上が消えて窪みが埋まる", () => {
    const dim = freshWorld();
    dim.fill({ x: -20, y: 40, z: -20 }, { x: 20, y: 70, z: 20 }, "minecraft:stone");
    // 窪みを作っておく
    dim.fill({ x: 3, y: 55, z: 3 }, { x: 5, y: 70, z: 5 }, "minecraft:air");
    flattenArea(dim, { x: 0, y: 60, z: 0 }, { radius: 10, height: 12, fill: "minecraft:dirt" });
    system.drain();
    expect.ok(dim.getBlock({ x: 0, y: 63, z: 0 }).isAir, "上が削れていない");
    expect.equal(dim.getBlock({ x: 4, y: 59, z: 4 }).typeId, "minecraft:dirt", "窪みが埋まっていない");
  });

  test("壁が立つ", () => {
    const dim = freshWorld();
    buildWall(dim, { x: 0, y: 64, z: 0 }, { radius: 8, height: 5, candidates: ["minecraft:stone_bricks"] });
    system.drain();
    let walls = 0;
    for (const [, value] of dim._blocks) if (value.typeId === "minecraft:stone_bricks") walls++;
    expect.atLeast(walls, 100, "壁が立っていない");
    // 内側は空いたまま
    expect.ok(dim.getBlock({ x: 0, y: 64, z: 0 }).isAir, "内側まで埋めている");
  });

  test("採掘場は角のそろった穴になる", () => {
    const dim = filled();
    carveBox(dim, { x: 0, y: 64, z: 0 }, { radius: 5, top: 0, bottom: -8 });
    system.drain();
    // 角も含めて全部抜けている
    for (const [dx, dz] of [[5, 5], [-5, 5], [5, -5], [-5, -5], [0, 0]]) {
      expect.ok(dim.getBlock({ x: dx, y: 60, z: dz }).isAir, `角 (${dx},${dz}) が残っている`);
    }
    expect.ok(!dim.getBlock({ x: 6, y: 60, z: 0 }).isAir, "指定より外を掘っている");
    expect.ok(!dim.getBlock({ x: 0, y: 55, z: 0 }).isAir, "指定より下を掘っている");
  });

  test("避難所は中が空洞になる", () => {
    const dim = freshWorld();
    buildShelter(dim, { x: 0, y: 64, z: 0 }, { radius: 4, height: 4, candidates: ["minecraft:oak_planks"] });
    system.drain();
    expect.ok(dim.getBlock({ x: 0, y: 66, z: 0 }).isAir, "中が埋まっている");
    expect.equal(dim.getBlock({ x: 4, y: 66, z: 0 }).typeId, "minecraft:oak_planks", "壁が無い");
    expect.equal(dim.getBlock({ x: 0, y: 68, z: 0 }).typeId, "minecraft:oak_planks", "屋根が無い");
  });

  test("湖は水で満たされる", () => {
    const dim = filled();
    fillBasin(dim, { x: 0, y: 64, z: 0 }, { radius: 8, depth: 4 });
    system.drain();
    expect.equal(dim.getBlock({ x: 0, y: 63, z: 0 }).typeId, "minecraft:water", "水が入っていない");
    expect.ok(dim.getBlock({ x: 0, y: 66, z: 0 }).isAir, "水面の上が塞がっている");
  });

  test("橋と足場と階段が形になる", () => {
    const dim = freshWorld();
    buildBridges(dim, { x: 0, y: 64, z: 0 }, { length: 12, width: 1, candidates: ["minecraft:oak_planks"] });
    raiseScaffold(dim, { x: 40, y: 64, z: 0 }, { height: 16, candidates: ["minecraft:oak_planks"] });
    spiralStairs(dim, { x: 80, y: 64, z: 0 }, { radius: 3, height: 12, direction: 1 });
    system.drain();
    expect.equal(dim.getBlock({ x: 10, y: 63, z: 0 }).typeId, "minecraft:oak_planks", "橋の桁が無い");
    expect.equal(dim.getBlock({ x: 40, y: 74, z: 0 }).typeId, "minecraft:oak_planks", "足場が伸びていない");
    let stairs = 0;
    for (const [key, value] of dim._blocks) {
      if (!key.startsWith("7") && !key.startsWith("8")) continue;
      if (value.typeId.includes("stone")) stairs++;
    }
    expect.atLeast(stairs, 20, "階段が組まれていない");
  });
});

suite("拡張後の全体", () => {
  test("120種類ある", () => {
    const total = CATEGORIES.reduce((n, c) => n + configsInCategory(c.id).length, 0);
    expect.equal(total, 120);
  });

  test("新しいカテゴリが空でない", () => {
    for (const id of ["construction", "military", "cosmic"]) {
      expect.atLeast(configsInCategory(id).length, 5, `${id} が少なすぎる`);
    }
  });

  test("地雷は導火線が短い", () => {
    // 踏んでから逃げられてしまっては地雷にならない
    expect.atMost(tntConfig("manytnt:mine_tnt").fuse, 30);
  });

  test("建築系は地形を壊す爆発を持たない", () => {
    for (const cfg of configsInCategory("construction")) {
      expect.equal(cfg.power, 0, `${cfg.id} が爆発してしまう`);
      expect.equal(cfg.breaks, false, `${cfg.id} が地形を壊す設定になっている`);
    }
  });
});
