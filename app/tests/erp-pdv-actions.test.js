import assert from "node:assert/strict";
import test from "node:test";
import {
  bindPdvCheckoutActions,
  bindPdvDropTarget,
  bindPdvProductDrag,
  PDV_PRODUCT_DRAG_TYPE,
} from "../public/js/modules/room-service-erp/pdv-actions.js";

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

test("PDV arrasta um produto e o adiciona pela zona da comanda", () => {
  const product = eventTarget();
  const cart = eventTarget();
  const transfer = dataTransfer();
  const dropped = [];

  bindPdvProductDrag({ element: product, productId: "item-pizza" });
  bindPdvDropTarget({ target: cart, onProductDrop: (productId) => dropped.push(productId) });

  product.dispatch("dragstart", dragEvent(transfer));
  cart.dispatch("dragenter", dragEvent(transfer));
  const over = dragEvent(transfer);
  cart.dispatch("dragover", over);
  const drop = dragEvent(transfer);
  cart.dispatch("drop", drop);
  product.dispatch("dragend", dragEvent(transfer));

  assert.equal(transfer.effectAllowed, "copy");
  assert.equal(transfer.dropEffect, "copy");
  assert.equal(transfer.getData(PDV_PRODUCT_DRAG_TYPE), "item-pizza");
  assert.equal(over.defaultPrevented, true);
  assert.equal(drop.defaultPrevented, true);
  assert.deepEqual(dropped, ["item-pizza"]);
  assert.equal(product.classList.contains("is-dragging"), false);
  assert.equal(cart.classList.contains("is-drag-over"), false);
});

test("PDV ignora conteudo externo solto na comanda", () => {
  const cart = eventTarget();
  const transfer = dataTransfer(["text/plain"]);
  const dropped = [];
  bindPdvDropTarget({ target: cart, onProductDrop: (productId) => dropped.push(productId) });

  const drop = dragEvent(transfer);
  cart.dispatch("drop", drop);

  assert.equal(drop.defaultPrevented, false);
  assert.deepEqual(dropped, []);
});

function eventTarget() {
  const listeners = new Map();
  const classes = new Set();
  return {
    dataset: {},
    classList: {
      add: (...names) => names.forEach((name) => classes.add(name)),
      remove: (...names) => names.forEach((name) => classes.delete(name)),
      contains: (name) => classes.has(name),
    },
    addEventListener(type, listener) {
      const handlers = listeners.get(type) || [];
      handlers.push(listener);
      listeners.set(type, handlers);
    },
    dispatch(type, event) {
      (listeners.get(type) || []).forEach((listener) => listener(event));
    },
    contains(node) {
      return node === this;
    },
  };
}

function dataTransfer(initialTypes = []) {
  const values = new Map(initialTypes.map((type) => [type, "external"]));
  return {
    effectAllowed: "none",
    dropEffect: "none",
    get types() {
      return [...values.keys()];
    },
    setData(type, value) {
      values.set(type, value);
    },
    getData(type) {
      return values.get(type) || "";
    },
  };
}

function dragEvent(transfer) {
  return {
    dataTransfer: transfer,
    defaultPrevented: false,
    relatedTarget: null,
    preventDefault() {
      this.defaultPrevented = true;
    },
  };
}
