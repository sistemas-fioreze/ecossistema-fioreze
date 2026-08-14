export const ERP_STORAGE_VERSION = "rs-erp-v1";
export const ERP_APP_VERSION = "1.2.0";

export const NAV_ITEMS = [
  {
    key: "dashboard",
    label: "Dashboard",
    permission: "room-service.orders.read",
    description: "Resumo operacional do dia.",
  },
  {
    key: "pos",
    label: "PDV Direto",
    permission: "room-service.orders.write",
    description: "Criacao assistida de pedidos pela equipe.",
  },
  {
    key: "orders",
    label: "Pedidos",
    permission: "room-service.orders.read",
    description: "Acompanhamento e atualizacao dos pedidos.",
  },
  {
    key: "guests",
    label: "Hospedes",
    permission: "room-service.orders.read",
    description: "Consulta operacional preparada para integracao PMS.",
  },
  {
    key: "billing",
    label: "Faturamento",
    permission: "room-service.orders.read",
    description: "Indicadores financeiros do modulo.",
  },
  {
    key: "catalog",
    label: "Editor de Cardapio",
    permission: "room-service.orders.read",
    description: "Fundacao para categorias, produtos e disponibilidade.",
  },
  {
    key: "settings",
    label: "Configuracoes",
    permission: "room-service.orders.read",
    description: "Preferencias locais e status operacional.",
    sidebar: false,
  },
];

export const STATUS_LABELS = {
  sent: "Enviado",
  printed: "Impresso",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

export const HELP_TOPICS = {
  dashboard: ["Use os indicadores para entender o volume atual.", "Os numeros usam apenas dados autorizados da unidade selecionada."],
  pos: ["O PDV Direto sera concluido no PR da plataforma operacional.", "Pedidos offline permanecem bloqueados nesta fase."],
  orders: ["Selecione um pedido para ver itens, historico e situacao de impressao.", "A impressao continua desativada em desenvolvimento."],
  guests: ["Sem PMS integrado, esta area mostra apenas estado preparado.", "Dados pessoais nao sao salvos em armazenamento local."],
  billing: ["Relatorios devem ser calculados pelo backend.", "Exportacoes futuras nao devem conter tokens ou credenciais."],
  catalog: ["Imagens devem vir da Biblioteca de Imagens.", "URLs externas arbitrarias nao sao aceitas como imagem principal."],
  settings: ["Preferencias locais permitidas: tema, escala, unidade e sidebar.", "Credenciais e dados operacionais nunca entram no localStorage."],
};
