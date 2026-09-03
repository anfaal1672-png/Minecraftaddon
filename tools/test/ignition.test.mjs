/** 着火と連鎖爆発 */
import { expect, suite, test } from "./harness.mjs";
import { world } from "./mock/server.mjs";
import {
  burnFuse, detonate, freshWorld, placeTnt, primedEntities, primedType,
  solidGround, system, tickBlock, tickBlockIgnite,
} from "./setup.mjs";
import { CHAIN_CAP, chainCount } from "../../BP/scripts/core/chain.js";
import { ignite, isReserved } from "../../BP/scripts/core/ignition.js";
import { get, set } from "../../BP/scripts/core/settings.js";

suite("着火", () => {
  test("隣に火があると着火する", () => {
    const dim = freshWorld();
    placeTnt(dim, { x: 0, y: 64, z: 0 }, "mini_tnt");
    tickBlockIgnite(dim, { x: 0, y: 64, z: 0 });

    expect.equal(primedEntities(dim).length, 1, "起爆中のTNTが1個生まれるはず");
    expect.equal(dim.getBlock({ x: 0, y: 64, z: 0 }).typeId, "minecraft:air", "ブロックは消費されるはず");
  });

  test("レッドストーンで通電すると着火する", () => {
    const dim = freshWorld();
    const loc = { x: 0, y: 64, z: 0 };
    placeTnt(dim, loc, "mega_tnt");
    dim._redstone.set("0,64,0", 15);
    tickBlock(dim, loc);
    expect.equal(primedEntities(dim).length, 1);
  });

  test("火打石で着火する", () => {
    const dim = freshWorld();
    const loc = { x: 0, y: 64, z: 0 };
    placeTnt(dim, loc, "mega_tnt");
    const player = dim.spawnEntity("minecraft:player", { x: 0, y: 64, z: 1 });
    player.components = { "minecraft:equippable": { getEquipmentSlot: () => ({ hasItem: () => true, typeId: "minecraft:flint_and_steel", damageDurability() {} }) } };

    world.afterEvents.playerInteractWithBlock.emit({
      player,
      block: dim.getBlock(loc),
      itemStack: { typeId: "minecraft:flint_and_steel" },
    });
    expect.equal(primedEntities(dim).length, 1);
  });

  test("火打石以外では着火しない", () => {
    const dim = freshWorld();
    const loc = { x: 0, y: 64, z: 0 };
    placeTnt(dim, loc, "mega_tnt");
    const player = dim.spawnEntity("minecraft:player", { x: 0, y: 64, z: 1 });
    world.afterEvents.playerInteractWithBlock.emit({
      player,
      block: dim.getBlock(loc),
      itemStack: { typeId: "minecraft:diamond_pickaxe" },
    });
    expect.equal(primedEntities(dim).length, 0);
  });

  test("燃えている矢で着火する", () => {
    const dim = freshWorld();
    const loc = { x: 0, y: 64, z: 0 };
    placeTnt(dim, loc, "mega_tnt");
    const arrow = dim.spawnEntity("minecraft:arrow", { x: 0, y: 65, z: 0 });
    arrow.components = { "minecraft:onfire": {} };
    world.afterEvents.projectileHitBlock.emit({
      dimension: dim,
      projectile: arrow,
      getBlockHit: () => ({ block: dim.getBlock(loc) }),
    });
    expect.equal(primedEntities(dim).length, 1);
  });

  test("遠隔起爆装置で着火する", () => {
    const dim = freshWorld();
    const loc = { x: 0, y: 64, z: 5 };
    placeTnt(dim, loc, "mega_tnt");
    const player = dim.spawnEntity("minecraft:player", { x: 0, y: 64, z: 0 });
    player.getBlockFromViewDirection = () => ({ block: dim.getBlock(loc) });
    player.onScreenDisplay = { setActionBar() {} };

    world.afterEvents.itemUse.emit({ source: player, itemStack: { typeId: "manytnt:detonator" } });
    expect.equal(primedEntities(dim).length, 1);
  });

  test("そこにTNTが無ければ着火しない", () => {
    const dim = freshWorld();
    // ブロックを置かずに着火を頼む
    expect.equal(ignite(dim, { x: 0, y: 64, z: 0 }, "manytnt:mega_tnt"), false);
    expect.equal(primedEntities(dim).length, 0);
    expect.equal(isReserved(dim, { x: 0, y: 64, z: 0 }), false, "予約は必ず返すこと");
  });

  test("種類ごとに導火線の長さが切り替わる", () => {
    const dim = freshWorld();
    placeTnt(dim, { x: 0, y: 64, z: 0 }, "mini_tnt");     // 50 tick
    placeTnt(dim, { x: 8, y: 64, z: 0 }, "antimatter_tnt"); // 160 tick
    tickBlockIgnite(dim, { x: 0, y: 64, z: 0 });
    tickBlockIgnite(dim, { x: 8, y: 64, z: 0 });

    const events = primedEntities(dim).map((e) => e.events).flat();
    expect.includes(events, "manytnt:fuse_50");
    expect.includes(events, "manytnt:fuse_160");
  });

  test("ロケットTNTは上へ打ち上がる", () => {
    const dim = freshWorld();
    placeTnt(dim, { x: 0, y: 64, z: 0 }, "rocket_tnt");
    tickBlockIgnite(dim, { x: 0, y: 64, z: 0 });
    const [tnt] = primedEntities(dim);
    expect.atLeast(tnt.impulses[0].y, 1, "上向きの初速が入るはず");
  });
});

suite("連鎖爆発", () => {
  test("1個のTNTから2発の爆発が起きない", () => {
    // 以前は着火の予約を取っていなかったため、複数の爆発が同じTNTを
    // 同時に狙うとTNTが増殖して爆発の数が合わなくなっていた。
    const dim = freshWorld();
    solidGround(dim);
    for (const x of [0, 3, 6]) placeTnt(dim, { x, y: 64, z: 0 }, "mini_tnt");

    // 真ん中を着火 → 連鎖で両側も着火する
    tickBlockIgnite(dim, { x: 3, y: 64, z: 0 });
    let exploded = 0;
    for (let n = 0; n < 40; n++) {
      for (const entity of primedEntities(dim)) {
        burnFuse(dim, entity);
        exploded++;
      }
      system.advance(1);
    }
    expect.equal(exploded, 3, "置いた数と爆発の数は一致するはず");
  });

  test("連鎖の上限を超えない", () => {
    const dim = freshWorld();
    // 半径4に収まる範囲へ大量に敷き詰める
    for (let x = -4; x <= 4; x++) {
      for (let y = 62; y <= 66; y++) {
        for (let z = -4; z <= 4; z++) placeTnt(dim, { x, y, z }, "mini_tnt");
      }
    }
    const center = { x: 0, y: 64, z: 0 };
    tickBlockIgnite(dim, center);
    for (const entity of primedEntities(dim)) burnFuse(dim, entity);
    system.advance(2);
    expect.atMost(chainCount(), CHAIN_CAP, "上限を超えて連鎖しないこと");
  });

  test("設定で連鎖を切れる", () => {
    const dim = freshWorld();
    set("chain", false);
    expect.equal(get("chain"), false);
    placeTnt(dim, { x: 0, y: 64, z: 0 }, "mini_tnt");
    placeTnt(dim, { x: 2, y: 64, z: 0 }, "mini_tnt");
    detonate(dim, { x: 0, y: 64, z: 0 });
    expect.equal(dim.getBlock({ x: 2, y: 64, z: 0 }).typeId, "manytnt:mini_tnt", "隣は残るはず");
  });

  test("バニラの爆発でも連鎖する", () => {
    const dim = freshWorld();
    placeTnt(dim, { x: 2, y: 64, z: 0 }, "mini_tnt");
    // クリーパーなど、うちのTNT以外の爆発
    world.beforeEvents.explosion.emit({
      dimension: dim,
      source: { typeId: "minecraft:creeper", location: { x: 0, y: 64, z: 0 } },
      cancel: false,
      getImpactedBlocks: () => [],
    });
    system.advance(20);
    expect.equal(primedEntities(dim).length + dim.explosions.length, 1, "隣のTNTが着火するはず");
  });

  test("うちのTNT以外の爆発は取り消さない", () => {
    const dim = freshWorld();
    const event = {
      dimension: dim,
      source: { typeId: "minecraft:creeper", location: { x: 0, y: 64, z: 0 } },
      cancel: false,
      getImpactedBlocks: () => [],
    };
    world.beforeEvents.explosion.emit(event);
    expect.equal(event.cancel, false);
  });
});

suite("ガチャTNT", () => {
  test("着火した時点で引いた種類として飛ぶ", () => {
    const dim = freshWorld();
    placeTnt(dim, { x: 0, y: 64, z: 0 }, "gacha_tnt");
    tickBlockIgnite(dim, { x: 0, y: 64, z: 0 });
    const [tnt] = primedEntities(dim);
    const drawn = primedType(tnt);
    expect.ok(drawn, "種類のタグが付いているはず");
    expect.ok(drawn !== "manytnt:gacha_tnt", "ガチャ自身は引かないこと");
  });

  test("連鎖で着火してもガチャは引かれる", () => {
    // 以前は連鎖の経路だけ元の種類のまま爆発していた
    const dim = freshWorld();
    placeTnt(dim, { x: 0, y: 64, z: 0 }, "mini_tnt");
    placeTnt(dim, { x: 2, y: 64, z: 0 }, "gacha_tnt");
    tickBlockIgnite(dim, { x: 0, y: 64, z: 0 });
    for (const entity of primedEntities(dim)) burnFuse(dim, entity);
    system.advance(20);

    const drawn = primedEntities(dim).map(primedType);
    expect.equal(drawn.length, 1, "ガチャが1個着火するはず");
    expect.ok(drawn[0] !== "manytnt:gacha_tnt", "連鎖でも別の種類を引くこと");
  });
});
