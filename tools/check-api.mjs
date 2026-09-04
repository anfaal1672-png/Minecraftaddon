/**
 * スクリプトが使っている Minecraft の API が、本当に存在するか調べる。
 *
 * 統合版のスクリプトは、存在しないメソッドを呼んでも「その場で例外」に
 * なるだけで、ワールドに入って試すまで気づけない。しかも try で包んで
 * あるぶん、静かに何も起きないという一番たちの悪い壊れ方をする。
 *
 * Mojang が bedrock-samples で API の一覧 (metadata/script_modules) を
 * 公開しているので、それと突き合わせて事前に見つける。
 * 一覧が手元に無いときは、この検査だけ飛ばす。
 */
import fs from "node:fs";
import path from "node:path";
import { at, readJson, readText } from "./lib/io.mjs";

/** 一覧を探しに行く場所 */
const SEARCH_PATHS = [
  process.env.VANILLA_METADATA,
  at("../mojang/bedrock-samples/metadata/script_modules/@minecraft"),
  at("../bedrock-samples/metadata/script_modules/@minecraft"),
  at("vendor/bedrock-samples/metadata/script_modules/@minecraft"),
].filter(Boolean);

/**
 * 受け取り側の変数名から、どのクラスのものと見なすか。
 * 呼び出しの型を本気で追うと大掛かりになるので、
 * このリポジトリで実際に使っている名前だけを対象にする。
 */
const RECEIVER_CLASS = {
  system: "System",
  world: "World",
  dimension: "Dimension",
  dim: "Dimension",
  block: "Block",
  entity: "Entity",
  ent: "Entity",
  player: "Player",
};


function findMetadataDir() {
  for (const dir of SEARCH_PATHS) {
    if (fs.existsSync(dir) && fs.readdirSync(dir).some((f) => f.startsWith("server-bindings_"))) return dir;
  }
  return null;
}

/** マニフェストが要求しているモジュールとその版 */
function declaredModules() {
  const manifest = readJson("BP/manifest.json");
  return Object.fromEntries((manifest.dependencies ?? []).map((d) => [d.module_name, d.version]));
}

function loadModule(dir, moduleName, version) {
  // @minecraft/server 本体は薄い包みで、中身は server-bindings 側にある
  const base = moduleName.replace("@minecraft/", "");
  for (const name of [`${base}-bindings_${version}.json`, `${base}_${version}.json`]) {
    const file = path.join(dir, name);
    if (fs.existsSync(file)) {
      const json = JSON.parse(fs.readFileSync(file, "utf8"));
      if (json.classes) return json;
    }
  }
  return null;
}

/** そのモジュールが export しているものの名前 */
function exportedNames(module) {
  return new Set([
    ...(module.classes ?? []).map((c) => c.name),
    ...(module.interfaces ?? []).map((c) => c.name),
    ...(module.enums ?? []).map((c) => c.name),
    ...(module.objects ?? []).map((c) => c.name),
    ...(module.constants ?? []).map((c) => c.name),
    ...(module.functions ?? []).map((c) => c.name),
    ...(module.errors ?? []).map((c) => c.name),
    ...(module.type_aliases ?? []).map((c) => c.name),
  ]);
}

/**
 * クラスが持っているメンバーの名前。継承元のぶんも含める。
 * (Player は Entity を、ExplosionBeforeEvent は ExplosionAfterEvent を継ぐ)
 */
function memberNames(module, className, seen = new Set()) {
  if (seen.has(className)) return new Set();
  seen.add(className);
  const cls = (module.classes ?? []).find((c) => c.name === className);
  if (!cls) return null;
  const names = new Set([
    ...(cls.functions ?? []).map((f) => f.name),
    ...(cls.properties ?? []).map((p) => p.name),
  ]);
  for (const parent of cls.base_types ?? []) {
    const inherited = memberNames(module, parent.name, seen);
    if (inherited) for (const name of inherited) names.add(name);
  }
  return names;
}

/** BP/scripts 以下のスクリプトを集める */
function scriptFiles(rel = "BP/scripts") {
  const out = [];
  for (const name of fs.readdirSync(at(rel))) {
    const child = `${rel}/${name}`;
    if (fs.statSync(at(child)).isDirectory()) out.push(...scriptFiles(child));
    else if (name.endsWith(".js")) out.push(child);
  }
  return out.sort();
}


/** WorldAfterEvents.playerJoin のような入れ物から、実際のイベントの型を割り出す */
function signalEventClass(module, holderName, propertyName) {
  const holder = (module.classes ?? []).find((c) => c.name === holderName);
  const property = holder?.properties?.find((p) => p.name === propertyName);
  const signal = property?.type?.name;
  if (!signal || !signal.endsWith("Signal")) return null;
  const eventClass = signal.slice(0, -"Signal".length);
  return (module.classes ?? []).some((c) => c.name === eventClass) ? eventClass : null;
}

/** subscribe( ... ) の中身をだいたい切り出す。括弧の対応だけを数える */
function subscribeBody(text, startIndex) {
  const open = text.indexOf("(", text.indexOf(".subscribe", startIndex));
  if (open < 0) return "";
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === "(") depth++;
    else if (text[i] === ")") {
      depth--;
      if (depth === 0) return text.slice(open, i);
    }
  }
  return text.slice(open);
}

export function checkApiUsage() {
  const dir = findMetadataDir();
  if (!dir) {
    return {
      skipped: true,
      reason:
        "APIの一覧が見つからないので、この検査は飛ばした。\n" +
        "  git clone --depth 1 https://github.com/Mojang/bedrock-samples ../bedrock-samples\n" +
        "  もしくは VANILLA_METADATA=<...>/metadata/script_modules/@minecraft を指定する",
      problems: [],
    };
  }

  const declared = declaredModules();
  const modules = {};
  const problems = [];

  for (const [name, version] of Object.entries(declared)) {
    const module = loadModule(dir, name, version);
    if (!module) {
      problems.push(`manifest が要求している ${name} ${version} は存在しない版`);
      continue;
    }
    modules[name] = module;
  }
  if (problems.length) return { skipped: false, dir, problems };

  const server = modules["@minecraft/server"];

  for (const file of scriptFiles()) {
    const text = readText(file);

    // 1) import しているものが本当に export されているか
    for (const m of text.matchAll(/import\s*\{([^}]+)\}\s*from\s*"(@minecraft\/[^"]+)"/g)) {
      const module = modules[m[2]];
      if (!module) {
        problems.push(`${file}: ${m[2]} は manifest に書かれていない`);
        continue;
      }
      const names = exportedNames(module);
      for (const raw of m[1].split(",")) {
        const name = raw.trim().split(/\s+as\s+/)[0].trim();
        if (!name) continue;
        if (!names.has(name)) problems.push(`${file}: ${m[2]} に ${name} は無い`);
      }
    }

    // 2) イベントの名前が実在するか (world.afterEvents.xxx など)
    for (const m of text.matchAll(/\b(world|system)\.(beforeEvents|afterEvents)\.([A-Za-z_][A-Za-z0-9_]*)/g)) {
      const owner = m[1] === "world" ? "World" : "System";
      const holder = `${owner}${m[2] === "beforeEvents" ? "BeforeEvents" : "AfterEvents"}`;
      const members = memberNames(server, holder);
      if (members && !members.has(m[3])) problems.push(`${file}: ${holder} に ${m[3]} は無い`);
    }

    // 3) subscribe に渡した引数のメンバーが、そのイベントに実在するか。
    //    ここを間違えると「イベントは来るのに中身が undefined」になり、
    //    静かに何も起きないという一番たちの悪い壊れ方をする。
    for (const m of text.matchAll(
      /\b(world|system)\.(beforeEvents|afterEvents)\.([A-Za-z0-9_]+)\.subscribe\(\s*\(([A-Za-z_][A-Za-z0-9_]*)\)\s*=>/g
    )) {
      const owner = m[1] === "world" ? "World" : "System";
      const holder = `${owner}${m[2] === "beforeEvents" ? "BeforeEvents" : "AfterEvents"}`;
      const eventClass = signalEventClass(server, holder, m[3]);
      if (!eventClass) continue;
      const members = memberNames(server, eventClass);
      if (!members) continue;
      const body = subscribeBody(text, m.index);
      for (const use of body.matchAll(new RegExp(`\\b${m[4]}\\.([A-Za-z_][A-Za-z0-9_]*)`, "g"))) {
        if (!members.has(use[1])) problems.push(`${file}: ${eventClass} に ${use[1]} は無い (${m[4]}.${use[1]})`);
      }
    }

    // 4) よく使う受け取り側のメンバーが実在するか
    for (const [receiver, className] of Object.entries(RECEIVER_CLASS)) {
      const members = memberNames(server, className);
      if (!members) continue;
      const pattern = new RegExp(`\\b${receiver}\\.([A-Za-z_][A-Za-z0-9_]*)`, "g");
      for (const m of text.matchAll(pattern)) {
        const member = m[1];
        // 自前で足したもの (テスト用の入口など) は対象外
        if (member.startsWith("_")) continue;
        if (!members.has(member)) {
          problems.push(`${file}: ${className}.${member} は ${className} に無い (${receiver}.${member})`);
        }
      }
    }
  }

  return { skipped: false, dir, problems: [...new Set(problems)] };
}
