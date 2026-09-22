// @minecraft/server のテスト用モック。
// ゲームの挙動を完全に再現するものではなく、スクリプトのロジック
// (二重着火・予算・安全処理など) を検証するための最小限の世界。

class Signal {
  constructor() {
    this.handlers = [];
  }
  subscribe(fn) {
    this.handlers.push(fn);
    return fn;
  }
  unsubscribe(fn) {
    this.handlers = this.handlers.filter((h) => h !== fn);
  }
  fire(ev) {
    for (const h of this.handlers) h(ev);
    return ev;
  }
}

/* ---------------- system ---------------- */
let nextRunId = 1;
const runs = new Map(); // id -> { fn, due, interval }

export const system = {
  currentTick: 0,
  afterEvents: { scriptEventReceive: new Signal() },
  beforeEvents: { startup: new Signal() },
  run(fn) {
    return this.runTimeout(fn, 0);
  },
  runTimeout(fn, delay = 1) {
    const id = nextRunId++;
    runs.set(id, { fn, due: this.currentTick + Math.max(0, delay), interval: 0 });
    return id;
  },
  runInterval(fn, interval = 1) {
    const id = nextRunId++;
    runs.set(id, { fn, due: this.currentTick + Math.max(1, interval), interval: Math.max(1, interval) });
    return id;
  },
  clearRun(id) {
    runs.delete(id);
  },
  runJob(gen) {
    const id = this.runInterval(() => {
      if (gen.next().done) runs.delete(id);
    }, 1);
    return id;
  },
};

/** テスト用: n tick 進める */
export function tick(n = 1) {
  for (let i = 0; i < n; i++) {
    // system.run (delay 0) は同じ tick のうちに処理
    flushDue();
    system.currentTick++;
    flushDue();
  }
}
function flushDue() {
  let guard = 0;
  let ran = true;
  while (ran && guard++ < 1000) {
    ran = false;
    for (const [id, r] of [...runs]) {
      if (!runs.has(id) || r.due > system.currentTick) continue;
      if (r.interval) r.due = system.currentTick + r.interval;
      else runs.delete(id);
      r.fn();
      ran = true;
      if (r.interval) continue;
    }
    // interval は 1 tick に1回だけ
    if ([...runs.values()].every((r) => r.due > system.currentTick)) break;
  }
}
export function pendingRuns() {
  return runs.size;
}

/* ---------------- enums ---------------- */
export const GameMode = { Adventure: "Adventure", Creative: "Creative", Spectator: "Spectator", Survival: "Survival" };
export const WeatherType = { Clear: "Clear", Rain: "Rain", Thunder: "Thunder" };
export const EquipmentSlot = { Mainhand: "Mainhand", Offhand: "Offhand" };
export const PlayerPermissionLevel = { Visitor: 0, Member: 1, Operator: 2, Custom: 3 };

/* ---------------- 値クラス ---------------- */
export class ItemStack {
  constructor(typeId, amount = 1) {
    this.typeId = typeId;
    this.amount = amount;
  }
  getComponent() {
    return undefined;
  }
}

export class MolangVariableMap {
  constructor() {
    this.vars = {};
  }
  setColorRGBA(name, c) {
    this.vars[name] = c;
  }
  setColorRGB(name, c) {
    this.vars[name] = c;
  }
  setFloat(name, v) {
    this.vars[name] = v;
  }
}

export class BlockVolume {
  constructor(from, to) {
    this.from = from;
    this.to = to;
  }
}

/** 状態の定義 (作物のテスト用) */
const STATE_RANGES = {
  "minecraft:wheat": { growth: 7 },
  "minecraft:carrots": { growth: 7 },
  "minecraft:potatoes": { growth: 7 },
  "minecraft:beetroot": { growth: 7 },
  "minecraft:nether_wart": { age: 3 },
};
export const BlockStates = {
  get(name) {
    if (name === "growth") return { id: "growth", validValues: [0, 1, 2, 3, 4, 5, 6, 7] };
    if (name === "age") return { id: "age", validValues: [...Array(16).keys()] };
    return undefined;
  },
};

export class BlockPermutation {
  constructor(typeId, states = {}) {
    this.type = { id: typeId };
    this.states = { ...states };
  }
  static resolve(typeId, states = {}) {
    return new BlockPermutation(typeId, states);
  }
  getState(name) {
    return this.states[name];
  }
  getAllStates() {
    return { ...this.states };
  }
  withState(name, value) {
    const range = STATE_RANGES[this.type.id];
    if (!range || !(name in range) || value < 0 || value > range[name]) throw new Error(`invalid state ${name}=${value}`);
    return new BlockPermutation(this.type.id, { ...this.states, [name]: value });
  }
}

/* ---------------- Block ---------------- */
const key = (l) => `${Math.floor(l.x)},${Math.floor(l.y)},${Math.floor(l.z)}`;

export class Block {
  constructor(dimension, loc) {
    this.dimension = dimension;
    this.location = { x: Math.floor(loc.x), y: Math.floor(loc.y), z: Math.floor(loc.z) };
  }
  get _cell() {
    return this.dimension._cells.get(key(this.location));
  }
  get typeId() {
    return this._cell?.perm.type.id ?? "minecraft:air";
  }
  get isAir() {
    return this.typeId === "minecraft:air";
  }
  get isLiquid() {
    return /water|lava/.test(this.typeId);
  }
  get permutation() {
    return this._cell?.perm ?? new BlockPermutation("minecraft:air");
  }
  setType(typeId) {
    this.dimension.setBlock(this.location, typeId);
  }
  setPermutation(perm) {
    this.dimension._cells.set(key(this.location), { ...(this._cell ?? {}), perm });
  }
  getComponent(name) {
    const c = this._cell;
    if (name === "minecraft:inventory" && c?.items) {
      const items = c.items;
      return {
        container: {
          size: items.length,
          getItem: (i) => items[i],
          setItem: (i, v) => {
            items[i] = v;
          },
        },
      };
    }
    return undefined;
  }
  getRedstonePower() {
    return this._cell?.power ?? 0;
  }
}

/* ---------------- Entity ---------------- */
let nextEntityId = 1;
const LIVING = /player|zombie|skeleton|spider|cow|pig|sheep|chicken|creeper|enderman|slime|bee|snow_golem/;

export class Entity {
  constructor(dimension, typeId, loc) {
    this.id = String(nextEntityId++);
    this.dimension = dimension;
    this.typeId = typeId;
    this._loc = { ...loc };
    this.tags = new Set();
    this.impulses = [];
    this.knockbacks = [];
    this.effects = [];
    this.damage = 0;
    this.valid = true;
    this.nameTag = "";
    this.families = typeId.match(/zombie|skeleton|spider|creeper/) ? ["monster"] : [];
    this.dynamic = {};
    this.gameMode = "Survival";
    this.isSneaking = false;
  }
  get location() {
    if (!this.valid) throw new Error("entity removed");
    return { ...this._loc };
  }
  get isValid() {
    return this.valid;
  }
  addTag(t) {
    this.tags.add(t);
    return true;
  }
  getTags() {
    return [...this.tags];
  }
  remove() {
    this.valid = false;
    this.dimension._entities = this.dimension._entities.filter((e) => e !== this);
  }
  applyImpulse(v) {
    this.impulses.push(v);
  }
  applyKnockback(h, v) {
    if (!LIVING.test(this.typeId)) throw new Error("not a mob");
    this.knockbacks.push({ h, v });
  }
  clearVelocity() {}
  teleport(loc) {
    this._loc = { ...loc };
  }
  addEffect(id, ticks, opts) {
    this.effects.push({ id, ticks, ...opts });
  }
  applyDamage(n) {
    this.damage += n;
    return true;
  }
  setOnFire() {
    return true;
  }
  extinguishFire() {
    return true;
  }
  getComponent(name) {
    if (name === "minecraft:health" && LIVING.test(this.typeId)) return { currentValue: 20 };
    return undefined;
  }
  getDynamicProperty(k) {
    return this.dynamic[k];
  }
  setDynamicProperty(k, v) {
    if (v === undefined) delete this.dynamic[k];
    else this.dynamic[k] = v;
  }
  getGameMode() {
    return this.gameMode;
  }
  getViewDirection() {
    return this.viewDirection ?? { x: 1, y: 0, z: 0 };
  }
  sendMessage(m) {
    world._messages.push(m);
  }
  get onScreenDisplay() {
    return { setActionBar: (m) => world._actionBars.push({ player: this.id, m }) };
  }
  playSound() {}
}

/* ---------------- Dimension ---------------- */
export class Dimension {
  constructor(id) {
    this.id = id;
    this._cells = new Map();
    this._entities = [];
    this.explosions = [];
    this.fills = 0;
    this.commands = [];
    this.weather = undefined;
    this.heightRange = { min: -64, max: 320 };
    this.unloaded = new Set(); // "cx,cz" のチャンクを未ロード扱いにする
    this.spawned = {}; // typeId -> 召喚した回数
  }
  _checkLoaded(loc) {
    if (this.unloaded.has(`${Math.floor(loc.x / 16)},${Math.floor(loc.z / 16)}`)) throw new Error("LocationInUnloadedChunkError");
  }
  setBlock(loc, typeId, extra = {}) {
    if (typeId === "minecraft:air") this._cells.delete(key(loc));
    else this._cells.set(key(loc), { perm: new BlockPermutation(typeId, extra.states), ...extra });
  }
  typeAt(loc) {
    return this._cells.get(key(loc))?.perm.type.id ?? "minecraft:air";
  }
  getBlock(loc) {
    this._checkLoaded(loc);
    if (loc.y < this.heightRange.min || loc.y >= this.heightRange.max) throw new Error("out of range");
    return new Block(this, loc);
  }
  isChunkLoaded(loc) {
    return !this.unloaded.has(`${Math.floor(loc.x / 16)},${Math.floor(loc.z / 16)}`);
  }
  fillBlocks(volume, typeId, opts = {}) {
    const ex = new Set(opts.blockFilter?.excludeTypes ?? []);
    for (let x = volume.from.x; x <= volume.to.x; x++) {
      for (let y = volume.from.y; y <= volume.to.y; y++) {
        for (let z = volume.from.z; z <= volume.to.z; z++) {
          const t = this.typeAt({ x, y, z });
          if (!ex.has(t)) this.setBlock({ x, y, z }, typeId);
          this.fills++;
        }
      }
    }
  }
  spawnEntity(typeId, loc) {
    this.spawned[typeId] = (this.spawned[typeId] ?? 0) + 1;
    const e = new Entity(this, typeId, loc);
    this._entities.push(e);
    return e;
  }
  spawnItem(stack, loc) {
    const e = new Entity(this, "minecraft:item", loc);
    e.item = stack;
    this._entities.push(e);
    return e;
  }
  getEntities(opts = {}) {
    let list = this._entities.filter((e) => e.valid);
    if (opts.type) list = list.filter((e) => e.typeId === opts.type);
    if (opts.families) list = list.filter((e) => opts.families.every((f) => e.families.includes(f)));
    if (opts.excludeGameModes) list = list.filter((e) => e.typeId !== "minecraft:player" || !opts.excludeGameModes.includes(e.gameMode));
    if (opts.location && opts.maxDistance !== undefined) {
      const c = opts.location;
      list = list.filter((e) => {
        const l = e._loc;
        return (l.x - c.x) ** 2 + (l.y - c.y) ** 2 + (l.z - c.z) ** 2 <= opts.maxDistance ** 2;
      });
      if (opts.closest) {
        list.sort((a, b) => {
          const da = (a._loc.x - c.x) ** 2 + (a._loc.y - c.y) ** 2 + (a._loc.z - c.z) ** 2;
          const db = (b._loc.x - c.x) ** 2 + (b._loc.y - c.y) ** 2 + (b._loc.z - c.z) ** 2;
          return da - db;
        });
        list = list.slice(0, opts.closest);
      }
    }
    return list;
  }
  createExplosion(location, power, options) {
    this.explosions.push({ location, power, options, tick: system.currentTick });
    return true;
  }
  spawnParticle() {}
  playSound() {}
  runCommand(cmd) {
    this.commands.push(cmd);
    return { successCount: 1 };
  }
  setWeather(type, duration) {
    this.weather = { type, duration };
  }
}

/* ---------------- world ---------------- */
const dims = new Map();
export const world = {
  _dynamic: {},
  _messages: [],
  _actionBars: [],
  _time: 1000,
  afterEvents: {
    worldLoad: new Signal(),
    playerInteractWithBlock: new Signal(),
    projectileHitBlock: new Signal(),
    playerPlaceBlock: new Signal(),
    itemUse: new Signal(),
  },
  beforeEvents: { explosion: new Signal() },
  getDimension(id) {
    if (!dims.has(id)) dims.set(id, new Dimension(id));
    return dims.get(id);
  },
  getDynamicProperty(k) {
    return this._dynamic[k];
  },
  setDynamicProperty(k, v) {
    if (v === undefined) delete this._dynamic[k];
    else this._dynamic[k] = v;
  },
  getEntity(id) {
    for (const d of dims.values()) {
      const e = d._entities.find((x) => x.id === id && x.valid);
      if (e) return e;
    }
    return undefined;
  },
  sendMessage(m) {
    this._messages.push(m);
  },
  getTimeOfDay() {
    return this._time;
  },
  setTimeOfDay(t) {
    this._time = t;
  },
};

/** テスト用: プレイヤーを出す */
export function spawnPlayer(dimension, loc, name = "Steve") {
  const p = dimension.spawnEntity("minecraft:player", loc);
  p.name = name;
  p.playerPermissionLevel = PlayerPermissionLevel.Operator;
  return p;
}
