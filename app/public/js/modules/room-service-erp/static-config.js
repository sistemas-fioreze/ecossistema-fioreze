export const ERP_STORAGE_VERSION = "rs-erp-v1";
export const ERP_APP_VERSION = "1.2.1";

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
    description: "Criação assistida de pedidos pela equipe.",
  },
  {
    key: "orders",
    label: "Pedidos",
    permission: "room-service.orders.read",
    description: "Acompanhamento e atualização dos pedidos.",
  },
  {
    key: "guests",
    label: "Hóspedes",
    permission: "room-service.orders.read",
    description: "Consulta operacional preparada para integração PMS.",
  },
  {
    key: "billing",
    label: "Faturamento",
    permission: "room-service.orders.read",
    description: "Indicadores financeiros do módulo.",
  },
  {
    key: "catalog",
    label: "Editor de Cardápio",
    permission: "room-service.orders.read",
    description: "Fundação para categorias, produtos e disponibilidade.",
  },
  {
    key: "settings",
    label: "Configurações",
    permission: "room-service.orders.read",
    description: "Preferências locais e status operacional.",
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
  dashboard: ["Use os indicadores para entender o volume atual.", "Os números usam apenas dados autorizados da unidade selecionada."],
  pos: ["O PDV Direto será concluído no PR da plataforma operacional.", "Pedidos offline permanecem bloqueados nesta fase."],
  orders: ["Selecione um pedido para ver itens, histórico e situação de impressão.", "A impressão continua desativada em desenvolvimento."],
  guests: ["Sem PMS integrado, esta área mostra apenas estado preparado.", "Dados pessoais não são salvos em armazenamento local."],
  billing: ["Relatórios devem ser calculados pelo backend.", "Exportações futuras não devem conter tokens ou credenciais."],
  catalog: ["Imagens devem vir da Biblioteca de Imagens.", "URLs externas arbitrárias não são aceitas como imagem principal."],
  settings: ["Preferências locais permitidas: tema, escala, unidade e sidebar.", "Credenciais e dados operacionais nunca entram no localStorage."],
};
