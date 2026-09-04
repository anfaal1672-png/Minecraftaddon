/**
 * @minecraft/server-ui の代役。
 *
 * 実際の画面は出せないので、組み立てられた内容 (題名・本文・ボタン) を
 * そのまま残しておき、テストからは「何が並んだか」を確かめる。
 * 返す答えは queueResponses で先に積んでおく。
 */
const pending = [];

/** 次に show が返す答えを積む。順番に取り出される */
export function queueResponses(...responses) {
  pending.push(...responses);
}

export function clearResponses() {
  pending.length = 0;
}

/** 組み立てられた画面の記録 */
export const shown = [];

export function clearShown() {
  shown.length = 0;
}

function nextResponse(form) {
  shown.push(form._snapshot());
  const response = pending.shift();
  return Promise.resolve(response ?? { canceled: true, cancelationReason: "UserClosed" });
}

export class ActionFormData {
  constructor() {
    this._title = "";
    this._body = "";
    this._buttons = [];
  }
  title(text) {
    this._title = text;
    return this;
  }
  body(text) {
    this._body = text;
    return this;
  }
  header(text) {
    this._body += `\n${text}`;
    return this;
  }
  label(text) {
    this._body += `\n${text}`;
    return this;
  }
  divider() {
    return this;
  }
  button(text, icon) {
    this._buttons.push({ text, icon });
    return this;
  }
  _snapshot() {
    return { kind: "action", title: this._title, body: this._body, buttons: this._buttons.map((b) => b.text) };
  }
  show() {
    return nextResponse(this);
  }
}

export class MessageFormData {
  constructor() {
    this._title = "";
    this._body = "";
    this._buttons = [];
  }
  title(text) {
    this._title = text;
    return this;
  }
  body(text) {
    this._body = text;
    return this;
  }
  button1(text) {
    this._buttons[0] = text;
    return this;
  }
  button2(text) {
    this._buttons[1] = text;
    return this;
  }
  _snapshot() {
    return { kind: "message", title: this._title, body: this._body, buttons: [...this._buttons] };
  }
  show() {
    return nextResponse(this);
  }
}

export class ModalFormData {
  constructor() {
    this._title = "";
    this._controls = [];
    this._submit = "";
  }
  title(text) {
    this._title = text;
    return this;
  }
  header(text) {
    this._controls.push({ type: "header", text });
    return this;
  }
  label(text) {
    this._controls.push({ type: "label", text });
    return this;
  }
  divider() {
    return this;
  }
  toggle(label, options = {}) {
    this._controls.push({ type: "toggle", label, ...options });
    return this;
  }
  slider(label, min, max, options = {}) {
    this._controls.push({ type: "slider", label, min, max, ...options });
    return this;
  }
  dropdown(label, items, options = {}) {
    this._controls.push({ type: "dropdown", label, items, ...options });
    return this;
  }
  textField(label, placeholder, options = {}) {
    this._controls.push({ type: "textField", label, placeholder, ...options });
    return this;
  }
  submitButton(text) {
    this._submit = text;
    return this;
  }
  _snapshot() {
    return { kind: "modal", title: this._title, controls: this._controls, submit: this._submit };
  }
  show() {
    return nextResponse(this);
  }
}

export const FormCancelationReason = { UserBusy: "UserBusy", UserClosed: "UserClosed" };
