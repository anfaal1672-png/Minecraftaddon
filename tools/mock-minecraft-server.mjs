/**
 * テスト用の @minecraft/server 最小モック。
 *
 * ゲームを起動しなくても BP/scripts/main.js をそのまま読み込んで動かせるように、
 * アドオンが実際に使っている API だけを再現している。
 * system の時間経過は system.advance(ticks) で手動で進める。
 */

export const EquipmentSlot = { Mainhand: "Mainhand" };

export class ItemStack {
  constructor(typeId, amount = 1) {
    this.typeId = typeId;
    this.amount = amount;
  }
}

const makeEvent = () => {
  const handlers = [];
  return { subscribe: (h) => (handlers.push(h), h), unsubscribe: () => {}, handlers };
};

export const world = {
  _props: new Map(),
  _messages: [],
  afterEvents: {
    worldLoad: makeEvent(),
    playerInteractWithBlock: makeEvent(),
    itemUse: makeEvent(),
    projectileHitBlock: makeEvent(),
  },
  beforeEvents: { explosion: makeEvent() },
  getDynamicProperty(key) {
    return this._props.get(key);
  },
  setDynamicProperty(key, value) {
    this._props.set(key, value);
  },
  sendMessage(message) {
    this._messages.push(message);
  },
};

export const system = {
  _tick: 0,
  _timers: [],
  _nextId: 1,
  afterEvents: { scriptEventReceive: makeEvent() },
  beforeEvents: { startup: makeEvent() },

  run(fn) {
    return this.runTimeout(fn, 1);
  },
  runTimeout(fn, delay) {
    const id = this._nextId++;
    this._timers.push({ id, fn, at: this._tick + Math.max(1, delay), repeat: 0 });
    return id;
  },
  runInterval(fn, interval) {
    const id = this._nextId++;
    this._timers.push({ id, fn, at: this._tick + interval, repeat: interval });
    return id;
  },
  clearRun(id) {
    this._timers = this._timers.filter((t) => t.id !== id);
  },

  /** ゲーム内の時間を ticks 分だけ進める */
  advance(ticks) {
    for (let i = 0; i < ticks; i++) {
      this._tick++;
      for (const timer of [...this._timers]) {
        if (timer.at !== this._tick) continue;
        if (timer.repeat > 0) timer.at = this._tick + timer.repeat;
        else this._timers = this._timers.filter((t) => t !== timer);
        try {
          timer.fn();
        } catch (err) {
          console.error("timer error:", err);
        }
      }
    }
  },
};
