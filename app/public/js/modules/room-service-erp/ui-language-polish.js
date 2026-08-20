const WORD_REPLACEMENTS = Object.freeze({
  acomodacao: "acomodação",
  acomodacoes: "acomodações",
  acao: "ação",
  acoes: "ações",
  agil: "ágil",
  alteracao: "alteração",
  alteracoes: "alterações",
  aplicacao: "aplicação",
  aplicacoes: "aplicações",
  area: "área",
  areas: "áreas",
  atencao: "atenção",
  ate: "até",
  atualizacao: "atualização",
  atualizacoes: "atualizações",
  autorizacao: "autorização",
  autorizacoes: "autorizações",
  automatico: "automático",
  automaticos: "automáticos",
  botao: "botão",
  botoes: "botões",
  cardapio: "cardápio",
  catalogo: "catálogo",
  catalogos: "catálogos",
  codigo: "código",
  codigos: "códigos",
  configuracao: "configuração",
  configuracoes: "configurações",
  conexao: "conexão",
  conexoes: "conexões",
  conteudo: "conteúdo",
  conteudos: "conteúdos",
  criacao: "criação",
  descricao: "descrição",
  descricoes: "descrições",
  disponivel: "disponível",
  disponiveis: "disponíveis",
  edicao: "edição",
  exibicao: "exibição",
  exclusao: "exclusão",
  exportacao: "exportação",
  exportacoes: "exportações",
  fundacao: "fundação",
  gestao: "gestão",
  historico: "histórico",
  historicos: "históricos",
  horario: "horário",
  horarios: "horários",
  hospede: "hóspede",
  hospedes: "hóspedes",
  icone: "ícone",
  icones: "ícones",
  impressao: "impressão",
  indisponivel: "indisponível",
  indisponiveis: "indisponíveis",
  informacao: "informação",
  informacoes: "informações",
  instalacao: "instalação",
  instalacoes: "instalações",
  integracao: "integração",
  integracoes: "integrações",
  lancamento: "lançamento",
  lancamentos: "lançamentos",
  maximo: "máximo",
  maxima: "máxima",
  maximos: "máximos",
  maximas: "máximas",
  media: "média",
  medias: "médias",
  midia: "mídia",
  midias: "mídias",
  minimo: "mínimo",
  minima: "mínima",
  minimos: "mínimos",
  minimas: "mínimas",
  modulo: "módulo",
  modulos: "módulos",
  nao: "não",
  notificacao: "notificação",
  notificacoes: "notificações",
  numero: "número",
  numeros: "números",
  observacao: "observação",
  observacoes: "observações",
  opcao: "opção",
  opcoes: "opções",
  operacao: "operação",
  operacoes: "operações",
  pagina: "página",
  paginas: "páginas",
  padrao: "padrão",
  padroes: "padrões",
  periodo: "período",
  periodos: "períodos",
  permissao: "permissão",
  permissoes: "permissões",
  possivel: "possível",
  preferencia: "preferência",
  preferencias: "preferências",
  preco: "preço",
  precos: "preços",
  proxima: "próxima",
  proximas: "próximas",
  proximo: "próximo",
  proximos: "próximos",
  publico: "público",
  publicos: "públicos",
  rapido: "rápido",
  rapida: "rápida",
  recepcao: "recepção",
  relacao: "relação",
  relacoes: "relações",
  relatorio: "relatório",
  relatorios: "relatórios",
  reinicio: "reinício",
  selecao: "seleção",
  selecoes: "seleções",
  sessao: "sessão",
  sessoes: "sessões",
  situacao: "situação",
  situacoes: "situações",
  suite: "suíte",
  suites: "suítes",
  tecnico: "técnico",
  tecnica: "técnica",
  tecnicos: "técnicos",
  tecnicas: "técnicas",
  titulo: "título",
  titulos: "títulos",
  unica: "única",
  unicas: "únicas",
  unico: "único",
  unicos: "únicos",
  usuario: "usuário",
  usuarios: "usuários",
  validacao: "validação",
  versao: "versão",
  versoes: "versões",
  visao: "visão",
  voce: "você",
});

const PHRASE_REPLACEMENTS = Object.freeze([
  [/\besta disponivel\b/giu, "está disponível"],
  [/\besta atualizado\b/giu, "está atualizado"],
  [/\besta atualizada\b/giu, "está atualizada"],
  [/\besta levando\b/giu, "está levando"],
  [/\bestao disponiveis\b/giu, "estão disponíveis"],
  [/\bestao desativadas\b/giu, "estão desativadas"],
  [/\bestao desativados\b/giu, "estão desativados"],
  [/\bsera concluido\b/giu, "será concluído"],
  [/\bsera concluida\b/giu, "será concluída"],
  [/\bsera iniciado\b/giu, "será iniciado"],
  [/\bsera iniciada\b/giu, "será iniciada"],
  [/\bamanha\b/giu, "amanhã"],
]);

const ATTRIBUTE_NAMES = Object.freeze(["aria-label", "aria-description", "placeholder", "title", "alt"]);
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "CODE", "PRE", "TEXTAREA"]);

export function normalizeErpPortugueseText(value) {
  let output = String(value ?? "");
  if (!output) return output;

  for (const [pattern, replacement] of PHRASE_REPLACEMENTS) {
    output = output.replace(pattern, (match) => applyCasePattern(match, replacement));
  }

  output = output.replace(/[A-Za-zÀ-ÿ]+/gu, (token) => {
    const replacement = WORD_REPLACEMENTS[token.toLocaleLowerCase("pt-BR")];
    if (!replacement) return token;
    return applyCasePattern(token, replacement);
  });

  return output;
}

export function setupErpPortuguesePolish(root = document) {
  if (!root?.body || root.body.dataset.erpPortuguesePolish === "ready") return;
  root.body.dataset.erpPortuguesePolish = "ready";

  root.title = normalizeErpPortugueseText(root.title);
  polishSubtree(root.body);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "characterData") {
        polishTextNode(mutation.target);
        continue;
      }
      if (mutation.type === "attributes") {
        polishElementAttributes(mutation.target);
        continue;
      }
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.TEXT_NODE) polishTextNode(node);
        if (node.nodeType === Node.ELEMENT_NODE) polishSubtree(node);
      }
    }
    const normalizedTitle = normalizeErpPortugueseText(root.title);
    if (normalizedTitle !== root.title) root.title = normalizedTitle;
  });

  observer.observe(root.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ATTRIBUTE_NAMES,
  });
}

function polishSubtree(root) {
  if (!root) return;
  if (root.nodeType === Node.ELEMENT_NODE) {
    if (shouldSkipElement(root)) return;
    polishElementAttributes(root);
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let node = walker.currentNode;
  while (node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      if (!shouldSkipElement(node)) polishElementAttributes(node);
    } else if (node.nodeType === Node.TEXT_NODE) {
      polishTextNode(node);
    }
    node = walker.nextNode();
  }
}

function polishTextNode(node) {
  const parent = node?.parentElement;
  if (!parent || shouldSkipElement(parent)) return;
  const normalized = normalizeErpPortugueseText(node.nodeValue);
  if (normalized !== node.nodeValue) node.nodeValue = normalized;
}

function polishElementAttributes(element) {
  if (!(element instanceof Element) || shouldSkipElement(element)) return;
  for (const name of ATTRIBUTE_NAMES) {
    if (!element.hasAttribute(name)) continue;
    const current = element.getAttribute(name);
    const normalized = normalizeErpPortugueseText(current);
    if (normalized !== current) element.setAttribute(name, normalized);
  }
}

function shouldSkipElement(element) {
  return SKIP_TAGS.has(element.tagName) || element.hasAttribute("data-erp-copy-preserve");
}

function applyCasePattern(source, replacement) {
  if (source === source.toLocaleUpperCase("pt-BR")) return replacement.toLocaleUpperCase("pt-BR");
  const first = source.charAt(0);
  const rest = source.slice(1);
  if (first === first.toLocaleUpperCase("pt-BR") && rest === rest.toLocaleLowerCase("pt-BR")) {
    return replacement.charAt(0).toLocaleUpperCase("pt-BR") + replacement.slice(1);
  }
  return replacement;
}
