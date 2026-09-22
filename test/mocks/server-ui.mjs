// @minecraft/server-ui のテスト用モック。show() は常に「閉じた」扱い。
class Form {
  constructor() {
    this.parts = [];
  }
  _add(kind, ...args) {
    this.parts.push({ kind, args });
    return this;
  }
  title(t) {
    return this._add("title", t);
  }
  body(t) {
    return this._add("body", t);
  }
  button(t) {
    return this._add("button", t);
  }
  toggle(...a) {
    return this._add("toggle", ...a);
  }
  slider(...a) {
    return this._add("slider", ...a);
  }
  dropdown(...a) {
    return this._add("dropdown", ...a);
  }
  submitButton(t) {
    return this._add("submit", t);
  }
  show() {
    Form.shown.push(this);
    return Promise.resolve({ canceled: true });
  }
}
Form.shown = [];

export class ActionFormData extends Form {}
export class ModalFormData extends Form {}
export class MessageFormData extends Form {}
export const shownForms = Form.shown;
