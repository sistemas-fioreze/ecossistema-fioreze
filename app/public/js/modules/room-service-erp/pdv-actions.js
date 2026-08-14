export const PDV_PRODUCT_DRAG_TYPE = "application/x-fioreze-pdv-product";

export function bindPdvCheckoutActions({ container, empty, onSubmit, onClear }) {
  const submit = container.querySelector(".erp-pdv-submit");
  const clear = container.querySelector(".erp-pdv-clear");

  if (submit) {
    submit.disabled = empty;
    if (!submit.dataset.bound) {
      submit.dataset.bound = "true";
      submit.addEventListener("click", onSubmit);
    }
  }

  if (clear) {
    clear.disabled = empty;
    if (!clear.dataset.bound) {
      clear.dataset.bound = "true";
      clear.addEventListener("click", onClear);
    }
  }

  return { submit, clear };
}

export function bindPdvProductDrag({ element, productId }) {
  if (!element || !productId || element.dataset.dragBound) return element;
  element.dataset.dragBound = "true";

  element.addEventListener("dragstart", (event) => {
    if (!event.dataTransfer) return;
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData(PDV_PRODUCT_DRAG_TYPE, productId);
    event.dataTransfer.setData("text/plain", productId);
    element.classList.add("is-dragging");
  });
  element.addEventListener("dragend", () => element.classList.remove("is-dragging"));

  return element;
}

export function bindPdvDropTarget({ target, onProductDrop }) {
  if (!target || target.dataset.dropBound) return target;
  target.dataset.dropBound = "true";

  const acceptsProduct = (event) => Array.from(event.dataTransfer?.types || []).includes(PDV_PRODUCT_DRAG_TYPE);
  const clearDragState = () => target.classList.remove("is-drag-over");

  target.addEventListener("dragenter", (event) => {
    if (!acceptsProduct(event)) return;
    event.preventDefault();
    target.classList.add("is-drag-over");
  });
  target.addEventListener("dragover", (event) => {
    if (!acceptsProduct(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  });
  target.addEventListener("dragleave", (event) => {
    if (!target.contains(event.relatedTarget)) clearDragState();
  });
  target.addEventListener("drop", (event) => {
    if (!acceptsProduct(event)) return;
    event.preventDefault();
    const productId = event.dataTransfer.getData(PDV_PRODUCT_DRAG_TYPE);
    clearDragState();
    if (productId) onProductDrop(productId);
  });

  return target;
}
