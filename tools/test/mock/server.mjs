/**
 * @minecraft/server の代役。
 *
 * ゲームを起動せずにアドオンの動きを確かめるためのもの。本物と同じ形の
 * API を持ち、ブロック・エンティティ・タイマーを素朴に再現する。
 * テストからは world._blocks などを直接覗いて結果を確かめる。
 */

/* ------------------------------------------------------------------ */
/*  タイマー                                                           */
/* ------------------------------------------------------------------ */
class Scheduler {
  constructor() {
    this.tick = 0;
    this.timers = new Map();
    this.jobs = new Map();
    this.nextId = 1;
  }

  runTimeout(fn, delay = 0) {
    const id = this.nextId++;
    this.timers.set(id, { fn, at: this.tick + Math.max(0, delay), repeat: 0 });
    return id;
  }

  runInterval(fn, interval = 1) {
    const id = this.nextId++;
    const period = Math.max(1, interval);
    this.timers.set(id, { fn, at: this.tick + period, repeat: period });
    return id;
  }

  run(fn) {
    return this.runTimeout(fn, 1);
  }

  clearRun(id) {
    this.timers.delete(id);
  }

  runJob(generator) {
    const id = this.nextId++;
    this.jobs.set(id, generator);
    return id;
  }

  clearJob(id) {
    const gen = this.jobs.get(id);
    this.jobs.delete(id);
    if (gen && typeof gen.return === "function") gen.return();
  }

  waitTicks(ticks) {
    return new Promise((resolve) => this.runTimeout(resolve, ticks));
  }

  /** ジョブを 1tick ぶん進める。本物と違って上限は固定 */
  stepJobs(budget = 4000) {
    for (const [id, gen] of [...this.jobs]) {
      for (let i = 0; i < budget; i++) {
        let step;
        try {
          step = gen.next();
        } catch (err) {
          this.jobs.delete(id);
          throw err;
        }
        if (step.done) {
          this.jobs.delete(id);
          break;
        }
      }
    }
  }

  /** 時間を進める */
  advance(ticks = 1, { jobBudget = 4000 } = {}) {
    for (let n = 0; n < ticks; n++) {
      this.tick++;
      for (const [id, timer] of [...this.timers]) {
        if (timer.at > this.tick) continue;
        if (timer.repeat > 0) timer.at = this.tick + timer.repeat;
        else this.timers.delete(id);
        timer.fn();
      }
      this.stepJobs(jobBudget);
    }
  }

  /** ジョブが終わるまで進める */
  drainJobs(maxTicks = 4000) {
    let n = 0;
    while ((this.jobs.size > 0 || this.timers.size > 0) && n < maxTicks) {
      this.advance(1);
      n++;
    }
    return n;
  }
}

/* ------------------------------------------------------------------ */
/*  イベント                                                           */
/* ------------------------------------------------------------------ */
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
  emit(event) {
    for (const handler of this.handlers) handler(event);
    return event;
  }
}

/* ------------------------------------------------------------------ */
/*  ブロック                                                           */
/* ------------------------------------------------------------------ */
class Permutation {
  constructor(typeId, states = {}) {
    this.typeId = typeId;
    this.states = { ...states };
  }
  getState(name) {
    return this.states[name];
  }
  withState(name, value) {
    return new Permutation(this.typeId, { ...this.states, [name]: value });
  }
}

class Block {
  constructor(dimension, x, y, z) {
    this.dimension = dimension;
    this.x = x;
    this.y = y;
    this.z = z;
  }
  get location() {
    return { x: this.x, y: this.y, z: this.z };
  }
  get key() {
    return `${this.x},${this.y},${this.z}`;
  }
  get typeId() {
    return this.dimension._blocks.get(this.key)?.typeId ?? "minecraft:air";
  }
  get isAir() {
    return this.typeId === "minecraft:air";
  }
  get isValid() {
    return true;
  }
  get permutation() {
    const stored = this.dimension._blocks.get(this.key);
    return new Permutation(this.typeId, stored?.states ?? {});
  }
  setType(typeId) {
    this.dimension._setBlock(this.x, this.y, this.z, typeId);
  }
  setPermutation(permutation) {
    this.dimension._setBlock(this.x, this.y, this.z, permutation.typeId, permutation.states);
  }
  getRedstonePower() {
    return this.dimension._redstone.get(this.key) ?? 0;
  }
  above() {
    return this.dimension.getBlock({ x: this.x, y: this.y + 1, z: this.z });
  }
  below() {
    return this.dimension.getBlock({ x: this.x, y: this.y - 1, z: this.z });
  }
}

/* ------------------------------------------------------------------ */
/*  エンティティ                                                       */
/* ------------------------------------------------------------------ */
let entitySeq = 0;

class Entity {
  constructor(dimension, typeId, location) {
    this.id = `e${++entitySeq}`;
    this.dimension = dimension;
    this.typeId = typeId;
    this._location = { ...location };
    this.tags = new Set();
    this.properties = new Map();
    this.events = [];
    this.effects = [];
    this.impulses = [];
    this.knockbacks = [];
    this.damage = [];
    this.removed = false;
    this.onFire = 0;
  }
  get isValid() {
    return !this.removed;
  }
  /**
   * 消えたエンティティに触ると本物は例外を投げる。
   * そこを黙って通してしまうと「消えたのに気づけない」不具合を
   * テストで再現できなくなるので、同じように投げる。
   */
  get location() {
    if (this.removed) throw new Error("entity is no longer valid");
    return { ...this._location };
  }
  set location(value) {
    this._location = { ...value };
  }
  addTag(tag) {
    this.tags.add(tag);
    return true;
  }
  removeTag(tag) {
    return this.tags.delete(tag);
  }
  hasTag(tag) {
    return this.tags.has(tag);
  }
  getTags() {
    return [...this.tags];
  }
  setProperty(name, value) {
    this.properties.set(name, value);
  }
  getProperty(name) {
    return this.properties.get(name);
  }
  triggerEvent(name) {
    this.events.push(name);
  }
  applyImpulse(vec) {
    if (this.typeId === "minecraft:player") throw new Error("applyImpulse is not supported for players");
    this.impulses.push({ ...vec });
  }
  applyKnockback(horizontal, vertical) {
    this.knockbacks.push({ horizontal, vertical });
  }
  applyDamage(amount) {
    this.damage.push(amount);
    return true;
  }
  addEffect(effectId, duration, options = {}) {
    if (!/^minecraft:[a-z_]+$/.test(effectId)) throw new Error(`unknown effect ${effectId}`);
    this.effects.push({ effectId, duration, ...options });
  }
  setOnFire(seconds) {
    this.onFire = seconds;
    return true;
  }
  extinguishFire() {
    this.onFire = 0;
    return true;
  }
  teleport(location) {
    this.location = { ...location };
  }
  tryTeleport(location, options = {}) {
    if (options.checkForBlocks) {
      const block = this.dimension.getBlock(location);
      if (block && !block.isAir) return false;
    }
    this.location = { ...location };
    return true;
  }
  getComponent(name) {
    return this.components?.[name];
  }
  remove() {
    this.removed = true;
    this.dimension._entities = this.dimension._entities.filter((e) => e !== this);
  }
  sendMessage(text) {
    world._messages.push(text);
  }
  runCommand() {
    return { successCount: 1 };
  }
}

/* ------------------------------------------------------------------ */
/*  ディメンション                                                     */
/* ------------------------------------------------------------------ */
class Dimension {
  constructor(id) {
    this.id = id;
    this._blocks = new Map();
    this._redstone = new Map();
    this._entities = [];
    this.heightRange = { min: -64, max: 320 };
    // テストから覗くための記録
    this.explosions = [];
    this.particles = [];
    this.sounds = [];
    this.commands = [];
    this.items = [];
    // 呼び出し回数。実機での重さはだいたいこれに比例する
    this.calls = { fillBlocks: 0, setBlock: 0, getBlock: 0 };
  }

  _setBlock(x, y, z, typeId, states = {}) {
    this.calls.setBlock++;
    const key = `${x},${y},${z}`;
    if (typeId === "minecraft:air") this._blocks.delete(key);
    else this._blocks.set(key, { typeId, states });
  }

  /** テストの下準備。直方体を埋める */
  fill(from, to, typeId) {
    for (let x = from.x; x <= to.x; x++) {
      for (let y = from.y; y <= to.y; y++) {
        for (let z = from.z; z <= to.z; z++) this._setBlock(x, y, z, typeId);
      }
    }
  }

  getBlock(location) {
    this.calls.getBlock++;
    const { x, y, z } = location;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return undefined;
    if (y < this.heightRange.min || y > this.heightRange.max) return undefined;
    return new Block(this, Math.floor(x), Math.floor(y), Math.floor(z));
  }

  getBlocks(volume, filter = {}, _allowUnloaded = true) {
    const min = volume.getMin();
    const max = volume.getMax();
    const include = filter.includeTypes ? new Set(filter.includeTypes) : null;
    const exclude = filter.excludeTypes ? new Set(filter.excludeTypes) : null;
    const found = [];
    for (let x = min.x; x <= max.x; x++) {
      for (let y = min.y; y <= max.y; y++) {
        for (let z = min.z; z <= max.z; z++) {
          const typeId = this._blocks.get(`${x},${y},${z}`)?.typeId ?? "minecraft:air";
          if (include && !include.has(typeId)) continue;
          if (exclude && exclude.has(typeId)) continue;
          found.push({ x, y, z });
        }
      }
    }
    return new ListBlockVolume(found);
  }

  fillBlocks(volume, blockId, options = {}) {
    this.calls.fillBlocks++;
    const min = volume.getMin();
    const max = volume.getMax();
    const exclude = new Set(options.blockFilter?.excludeTypes ?? []);
    const include = options.blockFilter?.includeTypes ? new Set(options.blockFilter.includeTypes) : null;
    const touched = [];
    for (let x = min.x; x <= max.x; x++) {
      for (let y = min.y; y <= max.y; y++) {
        for (let z = min.z; z <= max.z; z++) {
          if (y < this.heightRange.min || y > this.heightRange.max) continue;
          const typeId = this._blocks.get(`${x},${y},${z}`)?.typeId ?? "minecraft:air";
          if (exclude.has(typeId)) continue;
          if (include && !include.has(typeId)) continue;
          this._setBlock(x, y, z, blockId);
          touched.push({ x, y, z });
        }
      }
    }
    return new ListBlockVolume(touched);
  }

  createExplosion(location, radius, options = {}) {
    this.explosions.push({ location: { ...location }, radius, ...options });
    return true;
  }

  spawnEntity(typeId, location) {
    const entity = new Entity(this, typeId, location);
    this._entities.push(entity);
    return entity;
  }

  spawnItem(itemStack, location) {
    const entity = new Entity(this, "minecraft:item", location);
    entity.itemStack = itemStack;
    this._entities.push(entity);
    this.items.push({ itemStack, location: { ...location } });
    return entity;
  }

  spawnParticle(id, location) {
    if (!/^minecraft:[a-z_]+$/.test(id)) throw new Error(`unknown particle ${id}`);
    this.particles.push({ id, location: { ...location } });
  }

  playSound(id, location, options) {
    this.sounds.push({ id, location: { ...location }, options });
  }

  runCommand(command) {
    this.commands.push(command);
    return { successCount: 1 };
  }

  isChunkLoaded(location) {
    return this.unloadedChunks
      ? !this.unloadedChunks.has(`${Math.floor(location.x / 16)},${Math.floor(location.z / 16)}`)
      : true;
  }

  setWeather(type, duration) {
    if (!WeatherType[type]) throw new Error(`unknown weather ${type}`);
    world._weather = { type, duration };
  }

  getEntities(options = {}) {
    let list = this._entities.filter((e) => !e.removed);
    if (options.location && options.maxDistance !== undefined) {
      const { x, y, z } = options.location;
      list = list.filter((e) => {
        const dx = e.location.x - x, dy = e.location.y - y, dz = e.location.z - z;
        return dx * dx + dy * dy + dz * dz <= options.maxDistance * options.maxDistance;
      });
    }
    return list;
  }

  getPlayers(options) {
    return this.getEntities(options).filter((e) => e.typeId === "minecraft:player");
  }
}

/* ------------------------------------------------------------------ */
/*  体積                                                               */
/* ------------------------------------------------------------------ */
export class BlockVolume {
  constructor(from, to) {
    this.from = { ...from };
    this.to = { ...to };
  }
  getMin() {
    return {
      x: Math.min(this.from.x, this.to.x),
      y: Math.min(this.from.y, this.to.y),
      z: Math.min(this.from.z, this.to.z),
    };
  }
  getMax() {
    return {
      x: Math.max(this.from.x, this.to.x),
      y: Math.max(this.from.y, this.to.y),
      z: Math.max(this.from.z, this.to.z),
    };
  }
}

export class ListBlockVolume {
  constructor(locations = []) {
    this.locations = locations.map((l) => ({ ...l }));
  }
  getBlockLocationIterator() {
    return this.locations[Symbol.iterator]();
  }
  getCapacity() {
    return this.locations.length;
  }
}

/* ------------------------------------------------------------------ */
/*  アイテム                                                           */
/* ------------------------------------------------------------------ */
export class ItemStack {
  constructor(typeId, amount = 1) {
    if (!/^(minecraft|manytnt):[a-z0-9_]+$/.test(typeId)) throw new Error(`unknown item ${typeId}`);
    this.typeId = typeId;
    this.amount = amount;
  }
}

export const EquipmentSlot = { Mainhand: "Mainhand", Offhand: "Offhand" };
export const WeatherType = { Clear: "Clear", Rain: "Rain", Thunder: "Thunder" };

/* ------------------------------------------------------------------ */
/*  world と system                                                    */
/* ------------------------------------------------------------------ */
const scheduler = new Scheduler();

export const system = {
  get currentTick() {
    return scheduler.tick;
  },
  run: (fn) => scheduler.run(fn),
  runTimeout: (fn, delay) => scheduler.runTimeout(fn, delay),
  runInterval: (fn, interval) => scheduler.runInterval(fn, interval),
  clearRun: (id) => scheduler.clearRun(id),
  runJob: (gen) => scheduler.runJob(gen),
  clearJob: (id) => scheduler.clearJob(id),
  waitTicks: (ticks) => scheduler.waitTicks(ticks),
  beforeEvents: { startup: new Signal(), shutdown: new Signal() },
  afterEvents: { scriptEventReceive: new Signal() },
  // テスト用
  _scheduler: scheduler,
  advance: (ticks, options) => scheduler.advance(ticks, options),
  drain: (maxTicks) => scheduler.drainJobs(maxTicks),
};

const dimensions = new Map();

export const world = {
  _properties: new Map(),
  _messages: [],
  _weather: null,
  _time: 1000,
  gameRules: { tntExplodes: true, mobGriefing: true, doFireTick: true },

  beforeEvents: { explosion: new Signal() },
  afterEvents: {
    worldLoad: new Signal(),
    playerInteractWithBlock: new Signal(),
    projectileHitBlock: new Signal(),
    projectileHitEntity: new Signal(),
    entitySpawn: new Signal(),
    itemUse: new Signal(),
  },

  getDimension(id) {
    if (!dimensions.has(id)) dimensions.set(id, new Dimension(id));
    return dimensions.get(id);
  },
  sendMessage(text) {
    world._messages.push(text);
  },
  getDynamicProperty(key) {
    return world._properties.get(key);
  },
  setDynamicProperty(key, value) {
    if (value === undefined) world._properties.delete(key);
    else world._properties.set(key, value);
  },
  getDynamicPropertyIds() {
    return [...world._properties.keys()];
  },
  getTimeOfDay() {
    return world._time;
  },
  setTimeOfDay(value) {
    world._time = value;
  },
  getPlayers() {
    return [...dimensions.values()].flatMap((d) => d.getPlayers());
  },
  getAllPlayers() {
    return world.getPlayers();
  },
};

/* ------------------------------------------------------------------ */
/*  テスト用                                                           */
/* ------------------------------------------------------------------ */

/** すべての状態を初期化する。テストごとに呼ぶ */
export function resetMock() {
  scheduler.tick = 0;
  scheduler.timers.clear();
  scheduler.jobs.clear();
  dimensions.clear();
  world._properties.clear();
  world._messages.length = 0;
  world._weather = null;
  world._time = 1000;
  world.gameRules = { tntExplodes: true, mobGriefing: true, doFireTick: true };
  entitySeq = 0;
}

export function overworld() {
  return world.getDimension("minecraft:overworld");
}

export { Signal, Entity, Dimension, Block };
