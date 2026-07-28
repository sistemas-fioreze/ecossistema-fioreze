# Catálogo Compartilhado do Spa

## Princípio

O Spa Zena usa um único catálogo institucional para todo o Ecossistema Fioreze. Textos, regras, horários, contato, identidade do Spa, terapias, durações, preços e imagens são mantidos uma vez e reutilizados por todas as unidades.

A disponibilidade permanece por hotel:

- `modules` registra o módulo funcional `spa`;
- `hotel_modules` decide se o Spa está habilitado e público em cada unidade;
- `spa_shared_profile` guarda a apresentação global;
- `spa_shared_services` guarda o catálogo global;
- `media_assets` registra a logo e as imagens compartilhadas no R2.

Ativar o Spa em uma unidade não copia conteúdo. Desativá-lo remove o módulo da navegação e bloqueia sua API pública naquele hotel, sem alterar o catálogo comum.

## Portal Público

O endereço segue o padrão compartilhado:

```text
/:hotel_slug/spa
```

O frontend usa o cabeçalho oficial do Portal do Hóspede e reproduz a composição do portal anterior do Spa:

- apresentação e identidade do Spa;
- busca de serviços;
- cards com imagem, duração e preço;
- detalhes completos em modal;
- apresentação “Quem Somos”;
- regras de utilização;
- contato pelo WhatsApp com mensagem contextual.

Não existe tela intermediária de carregamento. O módulo monta sua estrutura imediatamente e preenche o catálogo pela API:

```text
GET /api/v1/public/hotels/:hotel_slug/spa/services
```

A API valida primeiro o hotel e o módulo habilitado. Ela retorna o mesmo catálogo global com o nome da unidade atual para personalizar a experiência e a mensagem de contato.

## Edição Administrativa

O editor fica na guia **Spa** em:

```text
/admin/portais/portal-hospede/
```

Ele administra:

- título, subtítulo e introdução;
- texto institucional;
- chamada de agendamento;
- WhatsApp e modelos das mensagens;
- horário exibido;
- regras de utilização;
- logo do Spa;
- nome, descrição, duração, preço, situação, ordem e imagem de cada serviço.

As APIs são protegidas por sessão e pelas permissões administrativas de consulta e manutenção das unidades:

```text
GET   /api/v1/admin/spa/catalog
PATCH /api/v1/admin/spa/profile
POST  /api/v1/admin/spa/services
PATCH /api/v1/admin/spa/services/:id
```

Toda mutação usa consultas parametrizadas, proteção administrativa de origem e auditoria em `admin_audit_log`. Uma imagem específica de hotel somente pode ser selecionada por usuário autorizado àquela unidade; mídias globais continuam disponíveis ao catálogo compartilhado.

## Migration e Mídia

`0030_spa_zena_shared_catalog.sql`:

- torna o módulo `spa` funcional;
- cria as duas tabelas compartilhadas e seus índices;
- registra o perfil e os treze serviços recuperados do portal anterior;
- registra a logo e treze imagens como objetos globais do R2.

Os binários não ficam no Git. Antes de aplicar a migration em um ambiente, os quatorze objetos devem ser enviados ao bucket configurado nos caminhos `shared/spa/brand/` e `shared/spa/catalog/`, preservando os hashes registrados.

O portal e o editor não chamam Apps Script, Google Sheets ou o endpoint antigo.
