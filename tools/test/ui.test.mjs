/** 設定・記録・画面 */
import { expect, suite, test } from "./harness.mjs";
import { world } from "./mock/server.mjs";
import { queueResponses, shown } from "./mock/server-ui.mjs";
import { detonate, freshWorld, placeTnt, solidGround } from "./setup.mjs";
import { SETTINGS, get, load, mayBreakBlocks, scaledRadius, set, toggle } from "../../BP/scripts/core/settings.js";
import { distinctUsed, getStats, recordExplosion, topUsed } from "../../BP/scripts/core/stats.js";
import { openCatalog, openMainMenu, openSettings, powerLabel, recipeLines } from "../../BP/scripts/core/menu.js";
import { ALL_CONFIGS, CATEGORIES, TNT_COUNT } from "../../BP/scripts/core/registry.js";
import { announce } from "../../BP/scripts/core/chat.js";

suite("設定", () => {
  test("既定値で始まる", () => {
    freshWorld();
    for (const [name, spec] of Object.entries(SETTINGS)) expect.equal(get(name), spec.default, name);
  });

  test("保存した値が読み直せる", () => {
    freshWorld();
    set("announce", false);
    set("scale", 1.5);
    load();
    expect.equal(get("announce"), false);
    expect.equal(get("scale"), 1.5);
  });

  test("範囲外の値は丸められる", () => {
    freshWorld();
    expect.equal(set("scale", 99), SETTINGS.scale.max);
    expect.equal(set("scale", -5), SETTINGS.scale.min);
  });

  test("知らない設定名は無視される", () => {
    freshWorld();
    expect.equal(set("nope", true), undefined);
    expect.equal(get("nope"), undefined);
  });

  test("倍率が半径に効く", () => {
    freshWorld();
    set("scale", 2);
    expect.equal(scaledRadius(24), 48);
    set("scale", 0.25);
    expect.equal(scaledRadius(24), 6);
  });

  test("ゲームルールを尊重する", () => {
    freshWorld();
    expect.equal(mayBreakBlocks(), true);
    world.gameRules.mobGriefing = false;
    expect.equal(mayBreakBlocks(), false);
    world.gameRules.mobGriefing = true;
  });

  test("チャット演出を切ると流れない", () => {
    freshWorld();
    set("announce", false);
    announce("テスト");
    expect.equal(world._messages.length, 0);
    // 強制指定のものは出る
    announce("強制", { force: true });
    expect.equal(world._messages.length, 1);
  });

  test("同じ案内文が連続しても1行にまとまる", () => {
    freshWorld();
    for (let i = 0; i < 5; i++) announce("同じ文");
    expect.equal(world._messages.length, 1, "5行流れてはいけない");
  });

  test("mute で反転できる", () => {
    freshWorld();
    expect.equal(toggle("announce"), false);
    expect.equal(toggle("announce"), true);
  });
});

suite("記録と実績", () => {
  test("爆発すると数が増える", () => {
    const dim = freshWorld();
    solidGround(dim);
    placeTnt(dim, { x: 0, y: 64, z: 0 }, "mini_tnt");
    detonate(dim, { x: 0, y: 64, z: 0 });
    expect.equal(getStats().total, 1);
    expect.equal(distinctUsed(), 1);
  });

  test("節目で実績が解除される", () => {
    freshWorld();
    for (let i = 0; i < 10; i++) recordExplosion("manytnt:mini_tnt");
    expect.includes(getStats().milestones, "total_10");
    expect.ok(world._messages.some((m) => m.includes("10回")), "お祝いが出ていない");
  });

  test("同じ実績は一度しか出ない", () => {
    freshWorld();
    for (let i = 0; i < 30; i++) recordExplosion("manytnt:nuke_tnt");
    const first = world._messages.filter((m) => m.includes("初めての核実験"));
    expect.equal(first.length, 1);
  });

  test("全種類制覇の実績がある", () => {
    freshWorld();
    for (const cfg of ALL_CONFIGS) recordExplosion(cfg.typeId);
    expect.includes(getStats().milestones, "all_types");
    expect.equal(distinctUsed(), TNT_COUNT);
  });

  test("よく使う順に並ぶ", () => {
    freshWorld();
    for (let i = 0; i < 5; i++) recordExplosion("manytnt:mega_tnt");
    for (let i = 0; i < 2; i++) recordExplosion("manytnt:mini_tnt");
    expect.deepEqual(topUsed(2), [["mega_tnt", 5], ["mini_tnt", 2]]);
  });
});

suite("画面", () => {
  const player = () => {
    const p = { typeId: "minecraft:player", onScreenDisplay: { setActionBar() {} } };
    return p;
  };

  test("入口の画面が組み立てられる", async () => {
    freshWorld();
    queueResponses({ canceled: true, cancelationReason: "UserClosed" });
    await openMainMenu(player());
    expect.equal(shown.length, 1);
    expect.equal(shown[0].buttons.length, 3);
    expect.includes(shown[0].body, String(TNT_COUNT));
  });

  test("図鑑にカテゴリが全部並ぶ", async () => {
    freshWorld();
    queueResponses({ canceled: true, cancelationReason: "UserClosed" });
    await openCatalog(player());
    // カテゴリの数 + 「もどる」
    expect.equal(shown[0].buttons.length, CATEGORIES.length + 1);
  });

  test("カテゴリを選ぶと詳細まで開ける", async () => {
    freshWorld();
    queueResponses(
      { canceled: false, selection: 0 },   // 基本カテゴリ
      { canceled: false, selection: 0 },   // 先頭のTNT
      { canceled: true, cancelationReason: "UserClosed" }
    );
    await openCatalog(player());
    const detail = shown[shown.length - 1];
    expect.equal(detail.kind, "action");
    expect.includes(detail.title, "メガTNT");
    expect.includes(detail.body, "作り方");
  });

  test("設定画面の値を保存できる", async () => {
    freshWorld();
    queueResponses({ canceled: false, formValues: [false, false, true, true, 150] });
    await openSettings(player());
    expect.equal(get("announce"), false);
    expect.equal(get("chain"), false);
    expect.equal(get("terrain"), true);
    expect.equal(get("scale"), 1.5);
  });

  test("画面を開けなくても落ちない", async () => {
    freshWorld();
    // 何も積まないと UserClosed が返る
    await openMainMenu(player());
    expect.ok(true);
  });

  test("威力の表示が破綻しない", () => {
    for (const cfg of ALL_CONFIGS) {
      const label = powerLabel(cfg);
      expect.ok(label.length > 0, `${cfg.id} の威力表示が空`);
      const lines = recipeLines(cfg);
      expect.atLeast(lines.length, 1, `${cfg.id} の材料が空`);
    }
  });
});
