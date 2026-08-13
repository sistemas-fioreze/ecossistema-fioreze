import assert from "node:assert/strict";
import test from "node:test";
import { bindPdvCheckoutActions } from "../public/js/modules/room-service-erp/pdv-actions.js";

function button() {
  return {
    dataset: {},
    disabled: false,
    listeners: [],
    addEventListener(type, listener) {
      if (type === "click") this.listeners.push(listener);
    },
    click() {
      this.listeners.forEach((listener) => listener());
    },
  };
}

test("PDV liga envio e limpeza pelos seletores estaveis do checkout", () => {
  const submit = button();
  const clear = button();
  const selectors = [];
  const container = {
    querySelector(selector) {
      selectors.push(selector);
      return selector === ".erp-pdv-submit" ? submit : clear;
    },
  };
  let submissions = 0;
  let clears = 0;

  bindPdvCheckoutActions({
    container,
    empty: false,
    onSubmit: () => { submissions += 1; },
    onClear: () => { clears += 1; },
  });
  bindPdvCheckoutActions({
    container,
    empty: false,
    onSubmit: () => { submissions += 10; },
    onClear: () => { clears += 10; },
  });

  submit.click();
  clear.click();

  assert.deepEqual(selectors.slice(0, 2), [".erp-pdv-submit", ".erp-pdv-clear"]);
  assert.equal(submit.listeners.length, 1);
  assert.equal(clear.listeners.length, 1);
  assert.equal(submissions, 1);
  assert.equal(clears, 1);
  assert.equal(submit.disabled, false);
  assert.equal(clear.disabled, false);
});

test("PDV desabilita as acoes quando a comanda esta vazia", () => {
  const submit = button();
  const clear = button();
  const container = {
    querySelector(selector) {
      return selector === ".erp-pdv-submit" ? submit : clear;
    },
  };

  bindPdvCheckoutActions({ container, empty: true, onSubmit() {}, onClear() {} });

  assert.equal(submit.disabled, true);
  assert.equal(clear.disabled, true);
});
