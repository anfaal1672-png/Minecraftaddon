/** 定義と、そこから作られる表が食い違っていないか */
import { expect, suite, test } from "./harness.mjs";
import { TNT_DEFS, checkDefs, fuseLengths } from "../../data/index.mjs";
import { CATEGORIES } from "../../data/categories.mjs";
import { ALL_CONFIGS, TNT_COUNT, TNT_TYPE_IDS, tntConfig, shortName } from "../../BP/scripts/core/registry.js";
import { EFFECTS } from "../../BP/scripts/effects/index.js";
import { readJson } from "../lib/io.mjs";

suite("定義と表", () => {
  test("data/ の定義に問題が無い", () => {
    expect.deepEqual(checkDefs(), []);
  });

  test("スクリプトの表と定義の数・並びが一致する", () => {
    expect.equal(TNT_COUNT, TNT_DEFS.length);
    expect.deepEqual(TNT_TYPE_IDS.map(shortName), TNT_DEFS.map((d) => d.id));
  });

  test("効果の名前がすべて実体につながっている", () => {
    const missing = ALL_CONFIGS.filter((c) => c.effect && !c.run).map((c) => c.id);
    expect.deepEqual(missing, []);
  });

  test("使われていない効果が残っていない", () => {
    const used = new Set(ALL_CONFIGS.map((c) => c.effect).filter(Boolean));
    const unused = Object.keys(EFFECTS).filter((name) => !used.has(name));
    expect.deepEqual(unused, []);
  });

  test("起爆中エンティティの見た目の並びが表と一致する", () => {
    const rc = readJson("RP/render_controllers/primed_tnt.render_controllers.json");
    const skins = rc.render_controllers["controller.render.manytnt_primed_tnt"].arrays.textures["array.skins"];
    expect.deepEqual(skins, TNT_DEFS.map((d) => `Texture.${d.id}`));
  });

  test("導火線の長さが全てエンティティ側に用意されている", () => {
    const entity = readJson("BP/entities/primed_tnt.json")["minecraft:entity"];
    for (const ticks of fuseLengths()) {
      expect.ok(entity.component_groups[`manytnt:fuse_${ticks}`], `fuse_${ticks} が無い`);
      expect.ok(entity.events[`manytnt:fuse_${ticks}`], `fuse_${ticks} のイベントが無い`);
    }
    // 連鎖用の短い導火線。名前もバニラの minecraft:tnt と同じにしてある
    expect.ok(entity.component_groups.from_explosion, "連鎖用の短い導火線が無い");
    expect.ok(entity.events.from_explosion, "連鎖用のイベントが無い");
  });

  test("カテゴリに漏れが無い", () => {
    const known = new Set(CATEGORIES.map((c) => c.id));
    const strays = TNT_DEFS.filter((d) => !known.has(d.category)).map((d) => d.id);
    expect.deepEqual(strays, []);
    for (const category of CATEGORIES) {
      expect.atLeast(TNT_DEFS.filter((d) => d.category === category.id).length, 1, `${category.id} が空`);
    }
  });

  test("ブロック定義・レシピ・ドロップ表が全種類ぶんある", () => {
    for (const def of TNT_DEFS) {
      const block = readJson(`BP/blocks/${def.id}.json`)["minecraft:block"];
      expect.equal(block.description.identifier, `manytnt:${def.id}`);
      expect.equal(block.description.menu_category.group, `manytnt:${def.category}_group`);
      const recipe = readJson(`BP/recipes/${def.id}.json`)["minecraft:recipe_shapeless"];
      expect.equal(recipe.result.item, `manytnt:${def.id}`);
      expect.equal(recipe.ingredients.length, def.recipe.ingredients.length);
      const loot = readJson(`BP/loot_tables/blocks/${def.id}.json`);
      expect.equal(loot.pools[0].entries[0].name, `manytnt:${def.id}`);
    }
  });

  test("テクスチャが全種類ぶん登録されている", () => {
    const terrain = readJson("RP/textures/terrain_texture.json").texture_data;
    for (const def of TNT_DEFS) {
      expect.ok(terrain[`manytnt:${def.id}_side`], `${def.id} の側面が未登録`);
      expect.ok(terrain[`manytnt:${def.id}_top`], `${def.id} の上面が未登録`);
    }
  });

  test("素材に使う自作TNTが必ず先に作れる", () => {
    // 材料に別の自作TNTを使う場合、そちらのレシピも必ず存在すること
    const ids = new Set(TNT_DEFS.map((d) => d.id));
    for (const def of TNT_DEFS) {
      for (const item of def.recipe.ingredients) {
        if (!item.startsWith("manytnt:")) continue;
        expect.ok(ids.has(item.slice(8)), `${def.id} の材料 ${item} が存在しない`);
      }
    }
  });

  test("設定を引く関数が正しい種類を返す", () => {
    const nuke = tntConfig("manytnt:nuke_tnt");
    expect.equal(nuke.name.ja, "核TNT");
    expect.equal(nuke.cat, "nuclear");
    expect.ok(nuke.warns, "核系は導火線の警報が鳴るはず");
    expect.equal(tntConfig("minecraft:tnt"), undefined);
  });
});
