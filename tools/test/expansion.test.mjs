/**
 * 拡張で足した仕組みの確認。
 *   ・地雷 (近づくまで爆発しない)
 *   ・弧を描いて飛ぶ着火
 *   ・建築系の地形生成
 */
import { expect, suite, test } from "./harness.mjs";
import {
  burnFuse, freshWorld, placeTnt, primedEntities, solidGround, system, tickBlock, tickBlockIgnite,
} from "./setup.mjs";
import { readJson } from "../lib/io.mjs";
import { world } from "./mock/server.mjs";
import { flashbangHit, throwableList } from "../../BP/scripts/gear/throwables.js";
import { clearTimers, pendingTimers, toolList, useBlastRod, useTimer } from "../../BP/scripts/gear/tools.js";
import { clearFuses, lightFuse } from "../../BP/scripts/gear/blocks.js";
import { THROWABLES, TOOLS } from "../../BP/scripts/data/gear-table.js";
import { applyEffects, damageArea, knockOutward } from "../../BP/scripts/lib/entities.js";
import { clearMines, PROXIMITY_RANGE } from "../../BP/scripts/core/ignition.js";
import {
  buildBridges, buildShelter, buildWall, carveBox, carveSphere, carveTunnels,
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

suite("起爆中TNTの扱い", () => {
  test("バニラの minecraft:tnt と同じ作りになっている", () => {
    // bedrock-samples の behavior_pack/entities/tnt.json と突き合わせた内容
    const entity = readJson("BP/entities/primed_tnt.json")["minecraft:entity"];
    const c = entity.components;
    expect.deepEqual(c["minecraft:collision_box"], { height: 0.98, width: 0.98 });
    expect.deepEqual(c["minecraft:pushable"], { is_pushable: false, is_pushable_by_piston: true });
    expect.deepEqual(c["minecraft:type_family"], { family: ["tnt", "inanimate"] });
    expect.ok(c["minecraft:physics"], "physics が無い");
    expect.equal(c["minecraft:explode"].power, 4);
    expect.equal(c["minecraft:explode"].fuse_length, 4);
    expect.equal(c["minecraft:explode"].fuse_lit, true);
    // 体力を持たせない (持たせると殴られて死ぬ)
    expect.equal(c["minecraft:health"], undefined, "体力を持ってしまっている");
  });

  test("ダメージでは死なない", () => {
    const c = readJson("BP/entities/primed_tnt.json")["minecraft:entity"].components;
    const sensor = c["minecraft:damage_sensor"];
    expect.ok(sensor, "ダメージを無効にする設定が無い");
    expect.equal(sensor.triggers[0].cause, "all");
    expect.equal(sensor.triggers[0].deals_damage, "no");
  });

  test("効果は起爆中のTNTを巻き込まない", () => {
    // 核の熱線が、飛んでいる他のTNTを消してしまわないこと
    const dim = freshWorld();
    const flying = dim.spawnEntity("manytnt:primed_tnt", { x: 2, y: 64, z: 0 });
    const cow = dim.spawnEntity("minecraft:cow", { x: 3, y: 64, z: 0 });
    damageArea(dim, { x: 0, y: 64, z: 0 }, 10, 100);
    expect.equal(flying.damage.length, 0, "起爆中のTNTにダメージが入っている");
    expect.atLeast(cow.damage.length, 1, "本来の対象にダメージが入っていない");
  });

  test("爆風では起爆中のTNTも飛ぶ", () => {
    // 巻き込まないと言っても、押し出しはバニラと同じく効かせる
    const dim = freshWorld();
    const flying = dim.spawnEntity("manytnt:primed_tnt", { x: 3, y: 64, z: 0 });
    knockOutward(dim, { x: 0, y: 64, z: 0 }, 10, 2);
    expect.atLeast(flying.impulses.length + flying.knockbacks.length, 1, "起爆中のTNTが押されていない");
  });

  test("状態異常やテレポートの対象にもならない", () => {
    const dim = freshWorld();
    const flying = dim.spawnEntity("manytnt:primed_tnt", { x: 1, y: 64, z: 0 });
    applyEffects(dim, { x: 0, y: 64, z: 0 }, 10, [["minecraft:slowness", 100, 1]]);
    expect.equal(flying.effects.length, 0, "起爆中のTNTに効果が付いている");
  });

  test("爆発せずに消えたTNTは、代わりに爆発させる", () => {
    // 「着火したのにTNTが消えただけで何も起きない」を防ぐ保険
    const dim = freshWorld();
    solidGround(dim);
    placeTnt(dim, { x: 0, y: 64, z: 0 }, "mega_tnt");
    tickBlockIgnite(dim, { x: 0, y: 64, z: 0 });
    const [tnt] = primedEntities(dim);
    expect.ok(tnt, "起爆中のTNTが生まれていない");

    // 爆発イベントを起こさずに消す (ダメージ死やチャンクの読み込み外れを模す)
    tnt.remove();
    system.advance(200);
    expect.atLeast(dim.explosions.length, 1, "消えたまま何も起きていない");
  });

  test("正常に爆発したTNTを二重に爆発させない", () => {
    const dim = freshWorld();
    solidGround(dim);
    placeTnt(dim, { x: 0, y: 64, z: 0 }, "mega_tnt");
    tickBlockIgnite(dim, { x: 0, y: 64, z: 0 });
    const [tnt] = primedEntities(dim);
    burnFuse(dim, tnt);          // 本来の流れ (爆発 → エンティティ消滅)
    system.advance(200);
    expect.equal(dim.explosions.length, 1, "二重に爆発している");
  });
});

suite("TNT以外の追加物", () => {
  const player = () => ({
    typeId: "minecraft:player",
    location: { x: 0, y: 64, z: 0 },
    onScreenDisplay: { setActionBar() {} },
    sendMessage() {},
  });

  test("投げる爆弾がすべて実体につながっている", () => {
    for (const bomb of throwableList()) {
      expect.ok(bomb.run, `${bomb.id} の当たったときの処理が無い`);
    }
    expect.equal(throwableList().length, THROWABLES.length);
  });

  test("道具がすべて実体につながっている", () => {
    for (const tool of toolList()) {
      expect.ok(tool.run, `${tool.id} の処理が無い`);
    }
    expect.equal(toolList().length, TOOLS.length);
  });

  test("投げた爆弾が当たると爆発する", () => {
    const dim = freshWorld();
    solidGround(dim);
    const projectile = dim.spawnEntity("manytnt:grenade_projectile", { x: 0, y: 66, z: 0 });
    world.afterEvents.projectileHitBlock.emit({
      dimension: dim,
      projectile,
      location: { x: 0, y: 66, z: 0 },
      getBlockHit: () => ({ block: dim.getBlock({ x: 0, y: 65, z: 0 }) }),
    });
    system.advance(5);
    expect.atLeast(dim.explosions.length, 1, "当たっても爆発しない");
  });

  test("同じ1発を二重に処理しない", () => {
    const dim = freshWorld();
    solidGround(dim);
    const projectile = dim.spawnEntity("manytnt:grenade_projectile", { x: 0, y: 66, z: 0 });
    const hit = {
      dimension: dim,
      projectile,
      location: { x: 0, y: 66, z: 0 },
      getBlockHit: () => ({ block: dim.getBlock({ x: 0, y: 65, z: 0 }) }),
    };
    // ブロックとエンティティに同時に当たった場合を模す
    world.afterEvents.projectileHitBlock.emit(hit);
    world.afterEvents.projectileHitEntity.emit(hit);
    system.advance(5);
    expect.equal(dim.explosions.length, 1, "二重に爆発している");
  });

  test("閃光弾は何も壊さない", () => {
    const dim = freshWorld();
    solidGround(dim);
    const before = dim._blocks.size;
    const target = dim.spawnEntity("minecraft:cow", { x: 1, y: 81, z: 0 });
    flashbangHit(dim, { x: 0, y: 81, z: 0 });
    system.advance(20);
    expect.equal(dim._blocks.size, before, "ブロックが減っている");
    expect.equal(dim.explosions.length, 0, "爆発している");
    expect.atLeast(target.effects.length, 1, "効果が付いていない");
  });

  test("一斉起爆ロッドは範囲のTNTを全部着火する", () => {
    const dim = freshWorld();
    solidGround(dim);
    for (const x of [-6, -2, 2, 6]) placeTnt(dim, { x, y: 81, z: 0 }, "mini_tnt");
    placeTnt(dim, { x: 30, y: 81, z: 0 }, "mini_tnt"); // 範囲外

    const p = player();
    p.dimension = dim;
    p.getBlockFromViewDirection = () => ({ block: dim.getBlock({ x: 0, y: 81, z: 0 }) });
    useBlastRod(p);
    system.advance(60);

    expect.equal(primedEntities(dim).length, 4, "範囲内が全部着火していない");
    expect.equal(dim.getBlock({ x: 30, y: 81, z: 0 }).typeId, "manytnt:mini_tnt", "範囲外まで着火している");
  });

  test("時限装置は指定した時間で着火し、解除もできる", () => {
    const dim = freshWorld();
    solidGround(dim);
    clearTimers();
    placeTnt(dim, { x: 0, y: 81, z: 0 }, "mega_tnt");

    const p = player();
    p.dimension = dim;
    p.getBlockFromViewDirection = () => ({ block: dim.getBlock({ x: 0, y: 81, z: 0 }) });

    useTimer(p);
    expect.equal(pendingTimers(), 1, "予約されていない");
    system.advance(60);
    expect.equal(primedEntities(dim).length, 0, "早く着火しすぎている");
    system.advance(60);
    expect.equal(primedEntities(dim).length, 1, "指定した時間で着火していない");

    // もう一度使うと解除できる
    clearTimers();
    placeTnt(dim, { x: 4, y: 81, z: 0 }, "mega_tnt");
    p.getBlockFromViewDirection = () => ({ block: dim.getBlock({ x: 4, y: 81, z: 0 }) });
    useTimer(p);
    useTimer(p);
    expect.equal(pendingTimers(), 0, "解除できていない");
  });

  test("導火線が隣へ燃え広がってTNTを着火する", () => {
    const dim = freshWorld();
    solidGround(dim);
    clearFuses();
    // 導火線を一列に並べ、端にTNTを置く
    for (let x = 0; x < 6; x++) dim._setBlock(x, 81, 0, "manytnt:fuse_block");
    placeTnt(dim, { x: 6, y: 81, z: 0 }, "mini_tnt");

    lightFuse(dim, { x: 0, y: 81, z: 0 });
    system.advance(200);

    for (let x = 0; x < 6; x++) {
      expect.ok(dim.getBlock({ x, y: 81, z: 0 }).isAir, `導火線 ${x} が燃え残っている`);
    }
    expect.equal(primedEntities(dim).length, 1, "端のTNTが着火していない");
  });

  test("耐爆ブロックはどのTNTでも壊れない", () => {
    const dim = freshWorld();
    dim.fill({ x: -20, y: 60, z: -20 }, { x: 20, y: 70, z: 20 }, "minecraft:stone");
    dim._setBlock(5, 64, 0, "manytnt:blast_proof_block");
    carveSphere(dim, { x: 0, y: 64, z: 0 }, { radius: 15 });
    system.drain();
    expect.equal(dim.getBlock({ x: 5, y: 64, z: 0 }).typeId, "manytnt:blast_proof_block", "耐爆ブロックが消えた");
    expect.ok(dim.getBlock({ x: 3, y: 64, z: 0 }).isAir, "周りが掘れていない");
  });
});

suite("ディスペンサー", () => {
  /** ディスペンサーを置いて、その正面にアイテムが湧いた状況を作る */
  function dispenseFrom(dim, dispenserAt, facing, itemId) {
    dim._setBlock(dispenserAt.x, dispenserAt.y, dispenserAt.z, "minecraft:dispenser", { facing_direction: facing });
    const offset = { 0: [0, -1, 0], 1: [0, 1, 0], 2: [0, 0, -1], 3: [0, 0, 1], 4: [-1, 0, 0], 5: [1, 0, 0] }[facing];
    const muzzle = {
      x: dispenserAt.x + offset[0],
      y: dispenserAt.y + offset[1],
      z: dispenserAt.z + offset[2],
    };
    const item = dim.spawnEntity("minecraft:item", { x: muzzle.x + 0.5, y: muzzle.y + 0.5, z: muzzle.z + 0.5 });
    item.components = { "minecraft:item": { itemStack: { typeId: itemId } } };
    world.afterEvents.entitySpawn.emit({ entity: item, cause: "Spawned" });
    return { item, muzzle };
  }

  test("TNTを入れると、火の点いたTNTが撃ち出される", () => {
    const dim = freshWorld();
    const { item } = dispenseFrom(dim, { x: 0, y: 64, z: 0 }, 5, "manytnt:mega_tnt");
    expect.equal(primedEntities(dim).length, 1, "起爆中のTNTが出ていない");
    expect.ok(item.removed, "アイテムが残っている");
  });

  test("向きが合っていなければ何もしない", () => {
    const dim = freshWorld();
    // 東を向いたディスペンサーの、西側にアイテムを湧かせる
    dim._setBlock(0, 64, 0, "minecraft:dispenser", { facing_direction: 5 });
    const item = dim.spawnEntity("minecraft:item", { x: -1.5, y: 64.5, z: 0.5 });
    item.components = { "minecraft:item": { itemStack: { typeId: "manytnt:mega_tnt" } } };
    world.afterEvents.entitySpawn.emit({ entity: item, cause: "Spawned" });
    expect.equal(primedEntities(dim).length, 0, "向いていない方向へ撃ち出している");
    expect.ok(!item.removed, "関係ないアイテムを消している");
  });

  test("手で落としたTNTは撃ち出されない", () => {
    const dim = freshWorld();
    const item = dim.spawnEntity("minecraft:item", { x: 0.5, y: 64.5, z: 0.5 });
    item.components = { "minecraft:item": { itemStack: { typeId: "manytnt:mega_tnt" } } };
    world.afterEvents.entitySpawn.emit({ entity: item, cause: "Spawned" });
    expect.equal(primedEntities(dim).length, 0, "落としただけで爆発している");
    expect.ok(!item.removed, "落としたアイテムが消えた");
  });

  test("TNT以外のアイテムには手を出さない", () => {
    const dim = freshWorld();
    const { item } = dispenseFrom(dim, { x: 0, y: 64, z: 0 }, 5, "minecraft:arrow");
    expect.equal(primedEntities(dim).length, 0);
    expect.ok(!item.removed, "関係ないアイテムを消している");
  });

  test("6方向すべてで撃ち出せる", () => {
    for (const facing of [0, 1, 2, 3, 4, 5]) {
      const dim = freshWorld();
      dispenseFrom(dim, { x: 0, y: 64, z: 0 }, facing, "manytnt:mini_tnt");
      expect.equal(primedEntities(dim).length, 1, `facing_direction ${facing} で撃ち出せない`);
    }
  });
});

suite("見た目をバニラに合わせる", () => {
  test("明滅の式が Mojang のものと一致している", () => {
    // bedrock-samples の resource_pack/entity/sulfur_cube.entity.json にある
    // 本家の実装をそのまま使っている。自前で近い式を書くと速さも位相もずれる。
    const scripts = readJson("RP/entity/primed_tnt.entity.json")["minecraft:client_entity"]
      .description.scripts;
    expect.deepEqual(scripts.pre_animation, [
      "variable.is_primed = query.fuse_time >= 0;",
      "variable.is_flashing = variable.is_primed && math.mod(math.floor(query.fuse_time / 5), 2) == 0;",
    ]);
  });

  test("明滅は経過時間ではなく導火線の残りで動く", () => {
    const text = JSON.stringify(readJson("RP/entity/primed_tnt.entity.json"));
    expect.includes(text, "query.fuse_time");
    expect.ok(!text.includes("query.life_time"), "経過時間で動かしている");
  });

  test("光っていない間は元の色を壊さない", () => {
    const rc = readJson("RP/render_controllers/primed_tnt.render_controllers.json")
      .render_controllers["controller.render.manytnt_primed_tnt"];
    expect.deepEqual(rc.overlay_color, {
      r: "variable.is_flashing ? 1.0 : this",
      g: "variable.is_flashing ? 1.0 : this",
      b: "variable.is_flashing ? 1.0 : this",
      a: "variable.is_flashing ? 0.5 : this",
    });
  });
});
