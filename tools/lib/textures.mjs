// 既存TNTテクスチャと同じ画風 (縞模様の側面 + "TNT" の帯 + 3x3 マスの上面) を
// 基本色から機械的に描き起こす。
const LABEL_BG = [0xeb, 0xe4, 0xd6];
const INK = [0x19, 0x19, 0x19];
// 既存テクスチャの "TNT" ロゴをそのまま写したもの (1 = 文字)
const LOGO = [
  "0011101010111000",
  "0001001110010000",
  "0001001010010000",
  "0001001010010000",
];

export function hex(c) {
  const v = c.replace("#", "");
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}
const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
const scale = (c, k) => c.map((v) => clamp(v * k));
const lighten = (c, d) => c.map((v) => clamp(v + d));
const rgba = (c) => [c[0], c[1], c[2], 255];

export function tntSide({ base, band = "#141414" }) {
  const b = hex(base);
  const light = lighten(b, 40);
  const dark = scale(b, 0.64);
  const edge = scale(b, 0.9);
  const bandC = hex(band);
  const rows = [];
  for (let y = 0; y < 16; y++) {
    const row = [];
    for (let x = 0; x < 16; x++) {
      let c;
      if (y === 0 || y === 15) c = edge;
      else if (y === 5 || y === 10) c = bandC;
      else if (y >= 6 && y <= 9) c = LOGO[y - 6][x] === "1" ? INK : LABEL_BG;
      else if (x === 15) c = b;
      else c = [b, light, b, dark][x % 4];
      row.push(rgba(c));
    }
    rows.push(row);
  }
  return rows;
}

export function tntTop({ base, fuse = "#141414" }) {
  const b = hex(base);
  const light = lighten(b, 40);
  const dark = scale(b, 0.64);
  const edge = scale(b, 0.77);
  const f = hex(fuse);
  const fuseHi = lighten(f, 60);
  const rows = [];
  for (let y = 0; y < 16; y++) {
    const row = [];
    for (let x = 0; x < 16; x++) {
      const gx = x % 5;
      const gy = y % 5;
      let c = edge;
      if (x !== 15 && y !== 15 && gx !== 0 && gy !== 0) {
        const inner = gx >= 2 && gx <= 3 && gy >= 2 && gy <= 3;
        const center = x >= 6 && x <= 9 && y >= 6 && y <= 9;
        if (!inner) c = dark;
        else if (center) c = gx === 2 && gy === 2 ? fuseHi : f;
        else c = gx === 2 && gy === 2 ? light : b;
      }
      row.push(rgba(c));
    }
    rows.push(row);
  }
  return rows;
}

/** TNT図鑑アイテムのアイコン (赤い表紙の本) */
export function guideIcon() {
  const T = [0, 0, 0, 0];
  const cover = [0xb7, 0x1c, 0x1c, 255];
  const coverDark = [0x7f, 0x10, 0x10, 255];
  const page = [0xf2, 0xea, 0xd8, 255];
  const ink = [0x19, 0x19, 0x19, 255];
  const band = [0xeb, 0xe4, 0xd6, 255];
  const rows = [];
  for (let y = 0; y < 16; y++) {
    const row = [];
    for (let x = 0; x < 16; x++) {
      let c = T;
      if (y >= 1 && y <= 14 && x >= 2 && x <= 13) {
        if (x === 2 || y === 14) c = coverDark;
        else if (x === 13) c = page;
        else c = cover;
        // 表紙の "TNT" ラベル
        if (y >= 5 && y <= 9 && x >= 4 && x <= 11) {
          c = band;
          const lx = x - 4;
          const ly = y - 6;
          const glyph = ["TTT", ".T.", ".T."];
          const letters = [0, 4]; // T と T (中央は N の代わりに縦棒)
          if (ly >= 0 && ly <= 2) {
            for (const off of letters) {
              const gx = lx - off;
              if (gx >= 0 && gx <= 2 && glyph[ly][gx] === "T") c = ink;
            }
            if (lx === 3 && ly >= 0) c = ink;
          }
        }
      }
      row.push(c);
    }
    rows.push(row);
  }
  return rows;
}
