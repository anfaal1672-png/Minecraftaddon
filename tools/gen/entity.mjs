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
import { THROWABLES } from "../../data/gear.mjs";
import { writeJson } from "../lib/io.mjs";

const NS = NAMESPACE;

/**
 * バニラの minecraft:tnt と同じ書式で書く。
 * bedrock-samples の behavior_pack/entities/tnt.json を土台にしてあり、
 * 足しているのは「種類ごとの見た目」と「種類ごとの導火線」だけ。
 */
const ENTITY_FORMAT = "1.21.90";

/** 連鎖着火のときに使うイベント。名前もバニラに合わせてある */
export const CHAIN_FUSE_EVENT = "from_explosion";

/** 導火線の長さ (tick) を、エンティティが扱う秒に直す */
const toSeconds = (ticks) => Math.round((ticks / 20) * 100) / 100;

export function behaviorEntity() {
  const explode = (fuseLength) => ({
    "minecraft:explode": {
      causes_fire: false,
      fuse_lit: true,
      // 実際の威力・破壊はスクリプト側で組み立て直すので、
      // ここはバニラと同じ 4 のままでよい (爆発イベントを起こすためだけ)
      power: 4,
      fuse_length: fuseLength,
    },
  });

  // バニラと同じ「他の爆発に巻き込まれたときの短い導火線」
  const groups = {
    [CHAIN_FUSE_EVENT]: explode({ range_max: 2.0, range_min: 0.5 }),
  };
  const events = {
    [CHAIN_FUSE_EVENT]: { add: { component_groups: [CHAIN_FUSE_EVENT] } },
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
        // ここから下はバニラの tnt.json と同じ内容・同じ並び
        "minecraft:collision_box": { height: 0.98, width: 0.98 },
        "minecraft:conditional_bandwidth_optimization": {
          default_values: {
            max_dropped_ticks: 5,
            max_optimized_distance: 80.0,
            use_motion_prediction_hints: true,
          },
        },
        ...explode(4),
        "minecraft:physics": {},
        "minecraft:pushable": { is_pushable: false, is_pushable_by_piston: true },
        "minecraft:type_family": { family: ["tnt", "inanimate"] },

        // バニラに無いのはここだけ。
        // 本家の起爆中TNTは体力を持たないので殴っても矢が当たっても死なないが、
        // アドオンのエンティティは何かの拍子にダメージを受けて
        // 「爆発せずに消える」ことがある。それを確実に防ぐために付けてある。
        "minecraft:damage_sensor": {
          triggers: [{ cause: "all", deals_damage: "no" }],
        },
      },
      component_groups: groups,
      events,
    },
  };
}

/**
 * 導火線が燃えている間の白い明滅。
 *
 * この式は Mojang 自身が書いたものをそのまま使っている
 * (bedrock-samples の resource_pack/entity/sulfur_cube.entity.json)。
 * 本家のTNTの点滅は 5tick ごとに切り替わり、経過時間ではなく
 * 「導火線の残り時間 (query.fuse_time)」で駆動している。
 * 自前で近い式を書くと点滅の速さも位相も本家とずれる。
 */
export const FLASH_SCRIPT = [
  "variable.is_primed = query.fuse_time >= 0;",
  "variable.is_flashing = variable.is_primed && math.mod(math.floor(query.fuse_time / 5), 2) == 0;",
];

export function clientEntity() {
  return {
    format_version: "1.10.0",
    "minecraft:client_entity": {
      description: {
        identifier: `${NS}:primed_tnt`,
        materials: { default: "entity_alphatest" },
        textures: Object.fromEntries(TNT_IDS.map((id) => [id, `textures/entity/tnt/${id}`])),
        geometry: { default: `geometry.${NS}_primed_tnt` },
        scripts: { pre_animation: FLASH_SCRIPT },
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
        // 明滅のさせ方も Mojang のものをそのまま使う。
        // 光っていない間を "this" にしておくのが大事で、0 を書き込むと
        // 本来エンジンが入れている値まで潰してしまう。
        overlay_color: {
          r: "variable.is_flashing ? 1.0 : this",
          g: "variable.is_flashing ? 1.0 : this",
          b: "variable.is_flashing ? 1.0 : this",
          a: "variable.is_flashing ? 0.5 : this",
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

/**
 * 投げた爆弾が飛んでいる間のエンティティ。
 *
 * バニラの snowball と同じ作りで、当たったら消えるだけ。
 * 何が起きるかはスクリプト側が projectileHit を受け取って組み立てる。
 */
export function throwableEntity(bomb) {
  return {
    format_version: ENTITY_FORMAT,
    "minecraft:entity": {
      description: {
        identifier: `${NS}:${bomb.id}_projectile`,
        is_experimental: false,
        is_summonable: true,
        is_spawnable: false,
        spawn_category: "misc",
      },
      components: {
        "minecraft:collision_box": { height: 0.25, width: 0.25 },
        "minecraft:conditional_bandwidth_optimization": {
          default_values: {
            max_dropped_ticks: 7,
            max_optimized_distance: 100.0,
            use_motion_prediction_hints: true,
          },
        },
        "minecraft:physics": {},
        "minecraft:projectile": {
          anchor: 1,
          angle_offset: 0.0,
          offset: [0, -0.1, 0],
          gravity: bomb.gravity,
          power: bomb.power,
          on_hit: {
            // 見た目の跳ね返りだけ本家に合わせ、中身はスクリプトで作る
            particle_on_hit: {
              num_particles: 6,
              on_other_hit: true,
              on_entity_hit: true,
              particle_type: "explode",
            },
            remove_on_hit: {},
          },
        },
        "minecraft:pushable": { is_pushable: true, is_pushable_by_piston: true },
      },
    },
  };
}

/**
 * 投擲物の見た目。バニラの snowball と同じく、
 * アイテムの絵をそのまま板として飛ばす (専用のモデルが要らない)。
 */
export function throwableClientEntity(bomb) {
  return {
    format_version: "1.10.0",
    "minecraft:client_entity": {
      description: {
        identifier: `${NS}:${bomb.id}_projectile`,
        materials: { default: "snowball" },
        textures: { default: `textures/items/${bomb.id}` },
        geometry: { default: "geometry.item_sprite" },
        render_controllers: ["controller.render.item_sprite"],
        animations: { flying: "animation.actor.billboard" },
        scripts: { animate: ["flying"] },
      },
    },
  };
}

export function generateEntity() {
  writeJson("BP/entities/primed_tnt.json", behaviorEntity());
  writeJson("RP/entity/primed_tnt.entity.json", clientEntity());
  writeJson("RP/render_controllers/primed_tnt.render_controllers.json", renderController());
  writeJson("RP/models/entity/primed_tnt.geo.json", geometry());

  for (const bomb of THROWABLES) {
    writeJson(`BP/entities/${bomb.id}_projectile.json`, throwableEntity(bomb));
    writeJson(`RP/entity/${bomb.id}_projectile.entity.json`, throwableClientEntity(bomb));
  }
}
