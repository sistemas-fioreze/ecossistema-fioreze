# Paginas HTML Personalizadas

As paginas HTML personalizadas permitem publicar uma experiencia visual especifica dentro do ecossistema sem transformar o HTML enviado em codigo confiavel da plataforma.

## Fluxo

1. Um usuario com acesso a unidade abre `Conteudos > Paginas HTML`.
2. O HTML e sanitizado no Worker antes de qualquer escrita.
3. Somente a versao sanitizada e armazenada em `custom_portal_pages`.
4. Uma pagina `published` pode ser consultada tecnicamente em `/portal-content/<hotel_slug>/<page_slug>` fora do domínio oficial.
5. A Central pode usar essa URL como destino de um link curto e gerar o QR correspondente.

Esta estrutura permanece apenas para compatibilidade histórica. O domínio `portal.hoteisfioreze.com.br` não publica mais essas páginas nem o antigo shell do Portal do Hóspede. Novos conteúdos devem ser criados no Construtor Visual e usam `/<hotel_slug>/<portal_slug>`.

Rascunhos e paginas arquivadas retornam 404. A consulta publica exige hotel ativo e modulo `guest-portal` publico e habilitado.

## Isolamento

O sanitizador usa lista positiva. Scripts, iframes, objetos, formularios, campos interativos, event handlers e esquemas executaveis sao removidos. Estilos inline passam por filtro de propriedades CSS.

A resposta publica cria um `iframe` com `sandbox`, sem `allow-scripts` e sem `allow-same-origin`. A Content Security Policy bloqueia scripts, conexoes, objetos e formularios. O conteudo personalizado nao recebe sessao administrativa nem acesso as APIs internas.

Cada pagina pertence a um `hotel_id`, tem slug unico dentro da unidade e registra SHA-256, versao do sanitizador, autores e timestamps. Consultas administrativas sempre usam os hoteis autorizados da sessao.

## Migration

`0020_portal_custom_pages_qr_links.sql` cria `custom_portal_pages`, seus indices e a permissao de exclusao definitiva de links. A migration e aditiva e deve ser aplicada antes de publicar o codigo que usa a tabela.

## Limites

- ate 250.000 caracteres de HTML sanitizado;
- sem JavaScript personalizado;
- sem formularios ou incorporacoes de terceiros;
- imagens por HTTPS ou `data:image`;
- audio e video somente por HTTPS;
- HTML original nao e persistido.
