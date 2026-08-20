export const ERP_SEARCH_CONTEXTS = Object.freeze({
  dashboard: Object.freeze({ placeholder: "Pesquisar no sistema...", mode: "navigation" }),
  vendas: Object.freeze({ placeholder: "Pesquisar no cardápio", mode: "filter" }),
  hist: Object.freeze({ placeholder: "Pesquisar pedidos", mode: "filter" }),
  hospedes: Object.freeze({ placeholder: "Pesquisar hóspedes", mode: "filter" }),
  faturamento: Object.freeze({ placeholder: "Pesquisar faturamento", mode: "filter" }),
  cardapio: Object.freeze({ placeholder: "Pesquisar no cardápio", mode: "filter" }),
  admin: Object.freeze({ placeholder: "Pesquisar configurações", mode: "filter" }),
});

export function getErpSearchContext(route) {
  return ERP_SEARCH_CONTEXTS[route] || ERP_SEARCH_CONTEXTS.dashboard;
}
