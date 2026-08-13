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
