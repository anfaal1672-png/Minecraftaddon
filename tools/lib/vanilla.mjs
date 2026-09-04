/**
 * バニラのTNTのテクスチャを読み込み、色の役割を割り出す。
 *
 * テクスチャは Mojang が公開しているBedrock向けリソースパックのもの:
 *   https://github.com/Mojang/bedrock-samples
 *   resource_pack/textures/blocks/tnt_{side,top,bottom}.png
 *
 * これらは "(c) Mojang AB. All rights reserved." で Minecraft EULA の対象なので、
 * このリポジトリには含めていない。生成時に手元の clone から読み込み、
 * 色を差し替えたものだけを RP/textures/blocks/ に書き出す。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { decodePng, toHexGrid } from "./png.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * 探しに行く場所。VANILLA_RP が指定されていればそこだけを見る
 * (指定したのに別の場所が使われると混乱するため)。
 */
const SEARCH_PATHS = process.env.VANILLA_RP
  ? [process.env.VANILLA_RP]
  : [
      path.join(root, "../mojang/bedrock-samples/resource_pack/textures/blocks"),
      path.join(root, "../bedrock-samples/resource_pack/textures/blocks"),
      path.join(root, "vendor/bedrock-samples/resource_pack/textures/blocks"),
    ];

export const NOT_FOUND_MESSAGE = `バニラのTNTのテクスチャが見つからなかった。

テクスチャは Mojang の配布物で、ライセンス上このリポジトリには置けないため、
生成し直すときは手元に clone しておく必要がある:

  git clone --depth 1 https://github.com/Mojang/bedrock-samples ../bedrock-samples

別の場所に置いてある場合は環境変数で指定する:

  VANILLA_RP=/path/to/resource_pack/textures/blocks node tools/generate-textures.mjs

探した場所:
${SEARCH_PATHS.map((p) => "  " + p).join("\n")}

なお既に生成済みのテクスチャは RP/textures/blocks/ にあるので、
色や紋章を変えないのであれば生成し直す必要はない。`;

function findDir() {
  for (const dir of SEARCH_PATHS) {
    if (fs.existsSync(path.join(dir, "tnt_side.png"))) return dir;
  }
  return null;
}

/**
 * バニラのTNTで使われている色と、その役割の対応。
 * 3面すべてを合わせて13色しか使われていない。
 */
export const ROLE_OF_COLOR = {
  // 本体 (4段階の赤)
  "#ea4318": "bright",
  "#db2f1a": "body",
  "#b11527": "crimson",
  "#912d11": "dark",
  // 上面・底面の金具
  "#8e8e8e": "metal",
  "#565656": "metalDark",
  // 上面中央の導火線の差し込み口
  "#11111e": "burst",
  // 側面の帯
  "#ffffff": "bandHigh",
  "#ddd9d9": "band",
  "#cecece": "bandMid",
  "#beb2b3": "bandLow",
  // 帯に書かれた TNT の文字 (濃紺の2段階)
  "#373656": "ink",
  "#1b1a3c": "inkDark",
};

/** 文字として扱う役割。側面ではここを消して紋章に差し替える */
export const GLYPH_ROLES = new Set(["ink", "inkDark"]);

/**
 * 3面を読み込んで、役割名の二次元配列にして返す。
 * 見つからなければ null。
 */
export function loadVanillaTnt() {
  const dir = findDir();
  if (!dir) return null;

  const faces = {};
  const unknown = new Set();
  for (const face of ["side", "top", "bottom"]) {
    const grid = toHexGrid(decodePng(fs.readFileSync(path.join(dir, `tnt_${face}.png`))));
    faces[face] = grid.map((row) =>
      row.map((hex) => {
        if (!hex) return null;
        const role = ROLE_OF_COLOR[hex];
        if (!role) unknown.add(hex);
        return role ?? null;
      })
    );
  }
  return { dir, faces, unknown: [...unknown] };
}
