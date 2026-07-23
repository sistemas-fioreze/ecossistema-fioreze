import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { tryOpenAdminSelectPicker } from "../public/js/modules/admin/shared/admin-select-picker.js";

function pickerFixture(overrides = {}) {
  const calls = [];
  const select = {
    tagName: "SELECT",
    disabled: false,
    multiple: false,
    size: 0,
    focus(options) {
      calls.push(["focus", options]);
    },
    showPicker() {
      calls.push(["showPicker"]);
    },
    ...overrides,
  };
  const event = {
    target: { closest: (selector) => selector === "select" ? select : null },
    defaultPrevented: false,
    button: 0,
    isPrimary: true,
    preventDefault() {
      calls.push(["preventDefault"]);
      this.defaultPrevented = true;
    },
  };
  return { calls, event, select };
}

test("clique administrativo abre o seletor pelo picker nativo suportado", () => {
  const { calls, event } = pickerFixture();

  assert.equal(tryOpenAdminSelectPicker(event), true);
  assert.deepEqual(calls.map(([name]) => name), ["focus", "showPicker", "preventDefault"]);
  assert.equal(event.defaultPrevented, true);
});

test("fallback preserva o comportamento nativo quando showPicker nao esta disponivel", () => {
  const { calls, event } = pickerFixture({ showPicker: undefined });

  assert.equal(tryOpenAdminSelectPicker(event), false);
  assert.deepEqual(calls, []);
  assert.equal(event.defaultPrevented, false);
});

test("falha do picker nao cancela o clique nativo", () => {
  const { calls, event } = pickerFixture({
    showPicker() {
      calls.push(["showPicker"]);
      throw new Error("picker indisponivel");
    },
  });

  assert.equal(tryOpenAdminSelectPicker(event), false);
  assert.deepEqual(calls.map(([name]) => name), ["focus", "showPicker"]);
  assert.equal(event.defaultPrevented, false);
});

test("seletor desabilitado, multiplo ou clique secundario nao e interceptado", () => {
  const disabled = pickerFixture({ disabled: true });
  const multiple = pickerFixture({ multiple: true });
  const secondary = pickerFixture();
  secondary.event.button = 2;

  assert.equal(tryOpenAdminSelectPicker(disabled.event), false);
  assert.equal(tryOpenAdminSelectPicker(multiple.event), false);
  assert.equal(tryOpenAdminSelectPicker(secondary.event), false);
  assert.deepEqual(disabled.calls, []);
  assert.deepEqual(multiple.calls, []);
  assert.deepEqual(secondary.calls, []);
});

test("shell compartilhado instala o picker para Central e construtor dinamico", () => {
  const authView = fs.readFileSync("public/js/modules/admin/shared/admin-auth-view.js", "utf8");

  assert.match(authView, /admin-select-picker\.js/);
  assert.match(authView, /installAdminSelectPicker\(\)/);
});
