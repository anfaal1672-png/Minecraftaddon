/**
 * 効果音とパーティクルの名前が実在するか調べる。
 *
 * 名前を1文字間違えても Minecraft は黙って何も鳴らさない・何も出さない。
 * バニラのリソースパック (bedrock-samples) に定義の一覧があるので、
 * それと突き合わせて事前に見つける。一覧が無ければこの検査は飛ばす。
 *
 * 見た目を動かす Molang の query も同じで、綴りを間違えても
 * 静かに 0 が返るだけなので、こちらも実在するか調べる。
 */
import fs from "node:fs";
import path from "node:path";
import { at, readText } from "./lib/io.mjs";

const SEARCH_PATHS = [
  process.env.VANILLA_RESOURCE_PACK,
  at("../mojang/bedrock-samples/resource_pack"),
  at("../bedrock-samples/resource_pack"),
  at("vendor/bedrock-samples/resource_pack"),
].filter(Boolean);

/**
 * コメント入りの JSON を読む。
 * バニラのパーティクル定義には // のコメントが入っていることがある。
 */
export function parseLooseJson(text) {
  let out = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      out += ch;
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }
    if (ch === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i++;
      out += "\n";
      continue;
    }
    if (ch === "/" && text[i + 1] === "*") {
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i++;
      i++;
      continue;
    }
    out += ch;
  }
  // 末尾のカンマも許す
  return JSON.parse(out.replace(/,(\s*[}\]])/g, "$1"));
}

function findResourcePack() {
  for (const dir of SEARCH_PATHS) {
    if (fs.existsSync(path.join(dir, "sounds/sound_definitions.json"))) return dir;
  }
  return null;
}

function loadSoundNames(dir) {
  const json = parseLooseJson(fs.readFileSync(path.join(dir, "sounds/sound_definitions.json"), "utf8"));
  return new Set(Object.keys(json.sound_definitions ?? json));
}

function loadParticleNames(dir) {
  const particleDir = path.join(dir, "particles");
  const names = new Set();
  for (const file of fs.readdirSync(particleDir)) {
    if (!file.endsWith(".json")) continue;
    try {
      const json = parseLooseJson(fs.readFileSync(path.join(particleDir, file), "utf8"));
      const id = json.particle_effect?.description?.identifier;
      if (id) names.add(id);
    } catch (err) {
      /* 読めない定義は数えない */
    }
  }
  return names;
}

function scriptFiles(rel = "BP/scripts") {
  const out = [];
  for (const name of fs.readdirSync(at(rel))) {
    const child = `${rel}/${name}`;
    if (fs.statSync(at(child)).isDirectory()) out.push(...scriptFiles(child));
    else if (name.endsWith(".js")) out.push(child);
  }
  return out.sort();
}

export function checkAssetNames() {
  const dir = findResourcePack();
  if (!dir) {
    return {
      skipped: true,
      reason:
        "バニラのリソースパックが見つからないので、音とパーティクルの検査は飛ばした。\n" +
        "  git clone --depth 1 https://github.com/Mojang/bedrock-samples ../bedrock-samples",
      problems: [],
    };
  }

  const sounds = loadSoundNames(dir);
  const particles = loadParticleNames(dir);
  const problems = [];

  for (const file of scriptFiles()) {
    const text = readText(file);

    // sound(dimension, "...") と playSound("...")
    for (const m of text.matchAll(/(?:\bsound\(\s*[A-Za-z_.]+\s*,|\.playSound\()\s*"([^"]+)"/g)) {
      if (!sounds.has(m[1])) problems.push(`${file}: 効果音 "${m[1]}" は存在しない`);
    }

    // minecraft:xxx_particle / _emitter のような、パーティクルらしい名前
    for (const m of text.matchAll(/"(minecraft:[a-z0-9_]+)"/g)) {
      const id = m[1];
      if (!/(particle|emitter|endrod)$/.test(id)) continue;
      if (!particles.has(id)) problems.push(`${file}: パーティクル "${id}" は存在しない`);
    }
  }

  problems.push(...checkMolangQueries());

  return { skipped: false, dir, sounds: sounds.size, particles: particles.size, problems: [...new Set(problems)] };
}

/** Molang の query の一覧を探す */
const MOLANG_PATHS = [
  process.env.VANILLA_MOLANG,
  at("../mojang/bedrock-samples/metadata/molang_modules/mojang-molang-queries.json"),
  at("../bedrock-samples/metadata/molang_modules/mojang-molang-queries.json"),
  at("vendor/bedrock-samples/metadata/molang_modules/mojang-molang-queries.json"),
].filter(Boolean);

/**
 * リソースパックの JSON で使っている query.xxx が実在するか調べる。
 * 綴りを間違えると常に 0 が返り、明滅も向きも静かに死ぬ。
 */
export function checkMolangQueries() {
  const file = MOLANG_PATHS.find((p) => fs.existsSync(p));
  if (!file) return [];

  const known = new Set();
  const collect = (node) => {
    if (Array.isArray(node)) return node.forEach(collect);
    if (!node || typeof node !== "object") return;
    if (typeof node.name === "string" && node.name.startsWith("query.")) known.add(node.name);
    Object.values(node).forEach(collect);
  };
  collect(JSON.parse(fs.readFileSync(file, "utf8")));
  if (known.size === 0) return [];

  const problems = [];
  for (const rel of [
    "RP/entity/primed_tnt.entity.json",
    "RP/render_controllers/primed_tnt.render_controllers.json",
  ]) {
    const text = readText(rel);
    for (const m of text.matchAll(/query\.[a-z_]+/g)) {
      if (!known.has(m[0])) problems.push(`${rel}: ${m[0]} という query は無い`);
    }
  }
  return [...new Set(problems)];
}
