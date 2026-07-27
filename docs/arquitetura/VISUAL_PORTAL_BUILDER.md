# Criador Visual Descontinuado

O criador visual livre foi retirado da plataforma. Ele permitia criar sites, páginas e templates independentes, mas também tornava possível afastar cada unidade do padrão oficial e multiplicar estruturas públicas difíceis de manter.

A migration `0025_visual_portal_builder.sql` permanece imutável no histórico. A migration aditiva `0026_retire_visual_portal_builder.sql` remove os registros de `visual_portals` e `visual_portal_templates`; as versões são removidas pela relação `ON DELETE CASCADE`. As tabelas históricas não são apagadas, e nenhuma tabela de hotéis, conteúdo, eventos, mídia, pedidos ou impressão é alterada.

Antes de aplicar a migration no D1 de desenvolvimento, o procedimento exige:

1. confirmar que somente a `0026` está pendente;
2. registrar as contagens de portais, versões e templates;
3. registrar as contagens protegidas de pedidos, itens, histórico, impressão e mídia;
4. criar um bookmark Time Travel imediatamente antes da aplicação;
5. aplicar a migration uma única vez;
6. confirmar que os registros do criador foram removidos e as contagens protegidas não mudaram.

As antigas rotas administrativas `/admin/creator/*` e `/admin/portais/conteudos/*` redirecionam para `/admin/portais/portal-hospede/`. As APIs do criador não são mais registradas. No domínio público oficial, endereços de portais personalizados aposentados retornam `404` e não recebem o fallback do SPA.

O produto substituto está documentado em [GUEST_PORTAL_TEMPLATE.md](./GUEST_PORTAL_TEMPLATE.md).
