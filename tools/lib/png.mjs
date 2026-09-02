/**
 * 依存なしの最小 PNG エンコーダ (8bit RGBA 固定)。
 * テクスチャ生成のためだけに使うので、必要な機能しか実装していない。
 */
import zlib from "node:zlib";

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** 幅 w・高さ h・RGBA の Uint8Array を PNG のバイト列にする */
export function encodePng(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;  // ビット深度
  ihdr[9] = 6;  // カラータイプ: RGBA
  ihdr[10] = 0; // 圧縮方式
  ihdr[11] = 0; // フィルタ方式
  ihdr[12] = 0; // インタレース

  // 各行の先頭にフィルタ種別 0 を付ける
  const stride = 1 + w * 4;
  const raw = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    raw[y * stride] = 0;
    for (let i = 0; i < w * 4; i++) raw[y * stride + 1 + i] = rgba[y * w * 4 + i];
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/**
 * PNG のデコード。バニラのテクスチャを読むためだけのものなので、
 * 8bit RGBA・インタレース無しにだけ対応する (実際それしか来ない)。
 */
export function decodePng(buf) {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (sig.some((b, i) => buf[i] !== b)) throw new Error("PNG ではない");

  let i = 8;
  let width = 0;
  let height = 0;
  let depth = 0;
  let colorType = 0;
  const idat = [];
  while (i < buf.length) {
    const len = buf.readUInt32BE(i);
    const type = buf.toString("ascii", i + 4, i + 8);
    const data = buf.subarray(i + 8, i + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      depth = data[8];
      colorType = data[9];
      if (data[12] !== 0) throw new Error("インタレースされた PNG には対応していない");
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
    i += 12 + len;
  }
  if (depth !== 8 || colorType !== 6) {
    throw new Error(`8bit RGBA の PNG だけに対応 (depth=${depth}, colorType=${colorType})`);
  }

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = 4;
  const stride = width * bpp;
  const out = Buffer.alloc(height * stride);
  let p = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[p++];
    const line = raw.subarray(p, p + stride);
    p += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= bpp ? prev[x - bpp] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const est = a + b - c;
        const da = Math.abs(est - a);
        const db = Math.abs(est - b);
        const dc = Math.abs(est - c);
        v += da <= db && da <= dc ? a : db <= dc ? b : c;
      } else if (filter !== 0) {
        throw new Error(`未知の PNG フィルタ: ${filter}`);
      }
      cur[x] = v & 0xff;
    }
  }
  return { width, height, data: out };
}

/** デコードした PNG を "#rrggbb" の二次元配列にする (透明は null) */
export function toHexGrid({ width, height, data }) {
  const grid = [];
  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      row.push(data[i + 3] < 128
        ? null
        : "#" + [data[i], data[i + 1], data[i + 2]].map((v) => v.toString(16).padStart(2, "0")).join(""));
    }
    grid.push(row);
  }
  return grid;
}

/** 描画用のキャンバス。put(x, y, "#rrggbb") で1ピクセル置く */
export function canvas(size = 16) {
  const data = new Uint8Array(size * size * 4);
  const put = (x, y, hex) => {
    if (x < 0 || y < 0 || x >= size || y >= size || !hex) return;
    const i = (y * size + x) * 4;
    data[i] = parseInt(hex.slice(1, 3), 16);
    data[i + 1] = parseInt(hex.slice(3, 5), 16);
    data[i + 2] = parseInt(hex.slice(5, 7), 16);
    data[i + 3] = hex.length > 7 ? parseInt(hex.slice(7, 9), 16) : 255;
  };
  return { size, data, put, toPng: () => encodePng(size, size, data) };
}

/* ------------------------------------------------------------------ */
/*  色のユーティリティ                                                  */
/* ------------------------------------------------------------------ */
const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
const parse = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (rgb) => "#" + rgb.map((v) => clamp(v).toString(16).padStart(2, "0")).join("");

/** amount < 0 で暗く、> 0 で明るく (-1 〜 1) */
export function shade(hex, amount) {
  const rgb = parse(hex);
  return toHex(amount >= 0
    ? rgb.map((v) => v + (255 - v) * amount)
    : rgb.map((v) => v * (1 + amount)));
}

/** 2色を t の比率で混ぜる */
export function mix(a, b, t) {
  const [ra, ga, ba] = parse(a);
  const [rb, gb, bb] = parse(b);
  return toHex([ra + (rb - ra) * t, ga + (gb - ga) * t, ba + (bb - ba) * t]);
}

/**
 * 座標から決まる 0〜1 の擬似乱数。
 * バニラのTNTのように面へ細かい斑点を散らすのに使う。
 * 毎回同じ模様になるので、生成し直しても差分が出ない。
 */
export function noise(x, y, seed = 0) {
  let h = (x * 374761393 + y * 668265263 + seed * 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/** 明るい色かどうか (帯の上に置く文字色を決めるのに使う) */
export function isLight(hex) {
  const [r, g, b] = parse(hex);
  return (r * 299 + g * 587 + b * 114) / 1000 > 140;
}
