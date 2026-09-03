/**
 * 起爆中のTNT (manytnt:primed_tnt) 一式を生成する。
 *
 *   BP/entities/primed_tnt.json                  挙動 (導火線の長さ・重力・爆発)
 *   RP/entity/primed_tnt.entity.json             見た目の割り当て
 *   RP/render_controllers/primed_tnt.*.json      種類ごとのテクスチャの選び方
 *   RP/models/entity/primed_tnt.geo.json         立方体1個ぶんのモデル
 *
 * バニラの minecraft:tnt をそのまま使うと見た目がエンジン側で固定され、
 * どの種類を着火しても普通のTNTが飛んでしまう。そのため同じ構成の
 * エンティティを自前で持ち、種類の番号 (manytnt:kind) でテクスチャを選ぶ。
 */
import { fuseLengths, NAMESPACE, TNT_IDS } from "../../data/index.mjs";
import { writeJson } from "../lib/io.mjs";

const NS = NAMESPACE;
const ENTITY_FORMAT = "1.21.90";

/** 導火線の長さ (tick) を、エンティティが扱う秒に直す */
const toSeconds = (ticks) => Math.round((ticks / 20) * 100) / 100;

export function behaviorEntity() {
  const explode = (fuseLength, causesFire = false) => ({
    "minecraft:explode": {
      causes_fire: causesFire,
      fuse_lit: true,
      // 実際の威力・破壊はスクリプト側で組み立て直すので、
      // ここは「爆発イベントを起こすための最小の値」でよい
      power: 4,
      fuse_length: fuseLength,
    },
  });

  const groups = {
    // 他の爆発に巻き込まれたときの導火線。バニラと同じく 0.5〜2秒
    [`${NS}:short_fuse`]: explode({ range_min: 0.5, range_max: 2.0 }),
  };
  const events = {
    [`${NS}:short_fuse`]: { add: { component_groups: [`${NS}:short_fuse`] } },
  };
  for (const ticks of fuseLengths()) {
    const name = `${NS}:fuse_${ticks}`;
    groups[name] = explode(toSeconds(ticks));
    events[name] = { add: { component_groups: [name] } };
  }

  return {
    format_version: ENTITY_FORMAT,
    "minecraft:entity": {
      description: {
        identifier: `${NS}:primed_tnt`,
        is_experimental: false,
        is_summonable: true,
        is_spawnable: false,
        spawn_category: "misc",
        properties: {
          // 見た目を選ぶ番号。data/ の並び順そのもの
          [`${NS}:kind`]: {
            type: "int",
            range: [0, Math.max(127, TNT_IDS.length)],
            default: 0,
            client_sync: true,
          },
        },
      },
      components: {
        "minecraft:collision_box": { height: 0.98, width: 0.98 },
        "minecraft:conditional_bandwidth_optimization": {
          default_values: {
            max_dropped_ticks: 5,
            max_optimized_distance: 80.0,
            use_motion_prediction_hints: true,
          },
        },
        // 既定の導火線はバニラと同じ4秒。種類ごとの長さは
        // 着火時に component_group を足して差し替える
        ...explode(4),
        "minecraft:physics": {},
        "minecraft:pushable": { is_pushable: false, is_pushable_by_piston: true },
        "minecraft:type_family": { family: ["tnt", "inanimate"] },
      },
      component_groups: groups,
      events,
    },
  };
}

export function clientEntity() {
  return {
    format_version: "1.10.0",
    "minecraft:client_entity": {
      description: {
        identifier: `${NS}:primed_tnt`,
        materials: { default: "entity_alphatest" },
        textures: Object.fromEntries(TNT_IDS.map((id) => [id, `textures/entity/tnt/${id}`])),
        geometry: { default: `geometry.${NS}_primed_tnt` },
        render_controllers: [`controller.render.${NS}_primed_tnt`],
      },
    },
  };
}

export function renderController() {
  return {
    format_version: "1.10.0",
    render_controllers: {
      [`controller.render.${NS}_primed_tnt`]: {
        arrays: { textures: { "array.skins": TNT_IDS.map((id) => `Texture.${id}`) } },
        geometry: "Geometry.default",
        materials: [{ "*": "Material.default" }],
        textures: [`array.skins[query.property('${NS}:kind')]`],
        // バニラのTNTと同じく、導火線が燃えている間は白く明滅させる
        overlay_color: {
          r: 1.0,
          g: 1.0,
          b: 1.0,
          a: "math.mod(math.floor(query.life_time * 10.0), 2.0) * 0.55",
        },
      },
    },
  };
}

/**
 * 立方体1個ぶんのモデル。
 *
 * 面ごとの UV は、テクスチャ生成側が 64×32 に並べる位置と対になっている。
 *     (0,0)   (16,0)  (32,0)  (48,0)
 *       .      上面    底面      .
 *     (0,16)  (16,16) (32,16) (48,16)
 *      西面    北面    東面    南面
 */
export function geometry() {
  return {
    format_version: "1.12.0",
    "minecraft:geometry": [
      {
        description: {
          identifier: `geometry.${NS}_primed_tnt`,
          texture_width: 64,
          texture_height: 32,
          visible_bounds_width: 2,
          visible_bounds_height: 2,
          visible_bounds_offset: [0, 0.5, 0],
        },
        bones: [
          {
            name: "body",
            pivot: [0, 0, 0],
            cubes: [
              {
                origin: [-8, 0, -8],
                size: [16, 16, 16],
                uv: {
                  north: { uv: [16, 16], uv_size: [16, 16] },
                  east: { uv: [32, 16], uv_size: [16, 16] },
                  south: { uv: [48, 16], uv_size: [16, 16] },
                  west: { uv: [0, 16], uv_size: [16, 16] },
                  up: { uv: [16, 0], uv_size: [16, 16] },
                  down: { uv: [32, 0], uv_size: [16, 16] },
                },
              },
            ],
          },
        ],
      },
    ],
  };
}

export function generateEntity() {
  writeJson("BP/entities/primed_tnt.json", behaviorEntity());
  writeJson("RP/entity/primed_tnt.entity.json", clientEntity());
  writeJson("RP/render_controllers/primed_tnt.render_controllers.json", renderController());
  writeJson("RP/models/entity/primed_tnt.geo.json", geometry());
}
