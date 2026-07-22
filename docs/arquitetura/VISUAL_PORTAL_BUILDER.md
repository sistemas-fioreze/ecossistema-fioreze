# Construtor Visual de Portais

## Objetivo

O Construtor Visual permite criar portais e páginas profissionais na Central Administrativa sem duplicar aplicações por hotel. Ele é a superfície oficial para novos sites públicos, lojas digitais, campanhas, eventos e experiências futuras. `admin` e a gestão operacional de `room-service` permanecem como produtos próprios, mas o cardápio público pode ser incluído como uma página nativa de qualquer portal da unidade.

Os antigos tipos de conteúdo continuam preservados no banco para compatibilidade e histórico, mas não aparecem como produtos separados na navegação da Central. Novos projetos são criados no editor visual e recebem seu próprio endereço público. A configuração operacional do Room Service pertence exclusivamente ao ERP do hotel.

## Experiência administrativa

O construtor fica em **Central Administrativa > Criador de portais** e oferece:

- canvas em tela cheia;
- criação, duplicação, exclusão e edição de páginas dentro do mesmo site;
- slug personalizado e único para cada página interna;
- controle por página para exibir ou ocultar seu botão na navegação;
- navegação interna por seletor de páginas, sem exigir que a equipe digite URLs;
- destino especial para o Room Service da unidade, resolvido pelo `hotel_slug`;
- página pronta de Room Service, conectada ao catálogo, aos horários e aos quartos da unidade, sem iframe nem segundo cabeçalho;
- página pronta de Blog, conectada ao feed público oficial e adaptada à identidade e ao cabeçalho do portal;
- alternância e pré-visualização separada para desktop e mobile;
- biblioteca de blocos com inclusão por clique ou arrastar e soltar;
- camadas reordenáveis por arrastar e soltar, botões de ordem ou painel de camadas;
- movimento livre de blocos nos eixos horizontal e vertical, com valores independentes por dispositivo;
- propriedades globais e substituições por dispositivo;
- tipografia, espaçamento, colunas, cores, largura e visibilidade ajustáveis separadamente para desktop e mobile;
- imagens e vídeos da Biblioteca de Mídia, com navegação por unidade autorizada e pasta, upload dentro do próprio seletor e cópia segura para a unidade do portal;
- favicon e cabeçalho opcional com logotipo, menu, cores, transparência total, desfoque e ação principal;
- capa com até quatro ações, títulos, textos, botões, imagens, vídeos, galeria, cards de serviço, depoimentos, lista com ícones, chamada em destaque, perguntas frequentes, indicadores, linha do tempo, citação, contato, incorporações, divisor e espaçador;
- transparência nos seletores de cor, cantos aplicados diretamente ao componente e guia central durante o movimento livre;
- cards de serviço empilhados ou sobre a imagem, com controle independente de cor, transparência e desfoque do fundo, além da cor do texto;
- navegação desktop alinhada à esquerda ou ao centro e gaveta mobile com cores e desfoque configuráveis;
- incorporações HTTPS para Google Maps, páginas hospedadas e serviços compatíveis com `iframe`;
- incorporações de HTML sanitizado em iframe isolado e sem execução de scripts;
- desfazer, refazer, copiar, colar, duplicar, mover e excluir blocos;
- pré-visualização do rascunho;
- salvamento manual e automático com intervalo configurável e controle de revisão;
- publicação explícita;
- acesso direto à versão publicada pela barra do editor;
- histórico de versões com prévia visual desktop/mobile antes da restauração para um novo rascunho;
- duplicação de portal na mesma unidade ou em outra unidade autorizada, copiando e remapeando as mídias referenciadas;
- arquivamento reversível e exclusão definitiva, disponível somente para portais já arquivados;
- modelos internos e modelos salvos pela equipe.

## Modelo de dados

A migration `0025_visual_portal_builder.sql` cria:

- `visual_portals`: metadados, rascunho, versão publicada e revisões;
- `visual_portal_versions`: snapshots de rascunho, publicação e restauração;
- `visual_portal_templates`: modelos reutilizáveis por hotel e módulo.

O endereço público oficial é único por hotel:

```text
https://portal.hoteisfioreze.com.br/:hotel_slug/:portal_slug
```

O registro continua vinculado a `hotel_id` e `module_key`. A rota pública responde somente quando hotel, módulo e portal estão ativos e públicos. `VISUAL_PORTAL_PUBLIC_ORIGIN` define a origem exibida pela Central; sem ela, ambientes locais usam a origem técnica da requisição.

As páginas internas usam o mesmo endereço canônico, com o slug da página no terceiro segmento:

```text
https://portal.hoteisfioreze.com.br/:hotel_slug/:portal_slug/:page_slug
```

O formato anterior `/portal/:hotel_slug/:portal_slug` redireciona permanentemente para o endereço canônico. No domínio oficial, o shell legado do Portal do Hóspede e as antigas páginas em `/portal-content/*` não são expostos: `/:hotel_slug` retorna 404, e qualquer segundo segmento só responde quando corresponde a um portal personalizado publicado. `/:hotel_slug/room-service` permanece reservado à experiência independente. Dentro de um portal, uma página do tipo `room-service` usa `/:hotel_slug/:portal_slug/:page_slug` e herda o cabeçalho do próprio portal.

## Documento visual

O campo JSON usa `schema_version=2`. Documentos `schema_version=1` são promovidos automaticamente para um site de uma página durante a leitura, sem migration destrutiva e sem perder blocos. A estrutura atual contém configurações compartilhadas e páginas independentes:

```json
{
  "schema_version": 2,
  "settings": {
    "primary_color": "#513b2d",
    "font_family": "Inter, system-ui, sans-serif",
    "favicon_media_asset_id": "",
    "header": {
      "enabled": true,
      "style": "floating",
      "position": "sticky",
      "logo_media_asset_id": "",
      "show_navigation": true
    },
    "editor": {
      "autosave_enabled": true,
      "autosave_interval_seconds": 30
    }
  },
  "pages": [
    {
      "id": "inicio",
      "type": "standard",
      "slug": "",
      "name": "Início",
      "show_in_navigation": true,
      "settings": {
        "background_color": "#ffffff",
        "background_media_asset_id": "",
        "background_fit": "cover"
      },
      "blocks": []
    }
  ]
}
```

Cada página possui identidade estável, `type`, slug único, visibilidade no menu, fundo e blocos próprios. O tipo padrão é `standard`. Os tipos `room-service` e `blog` são páginas de sistema sem blocos personalizados; existe no máximo uma de cada por portal e ambas carregam dados públicos do hotel indicado pelo `hotel_slug`. Cada bloco comum possui `id`, `type`, `content`, `styles.base`, `styles.desktop`, `styles.mobile` e `visibility`. Os estilos por dispositivo incluem os deslocamentos `offset_x` e `offset_y`, usados pelo movimento livre sem misturar o layout desktop com o mobile. O Worker normaliza o documento antes de salvá-lo e novamente antes de servi-lo.

No site publicado, a navegação desktop usa links diretos para os slugs configurados. Em telas móveis, as páginas visíveis são apresentadas em uma gaveta lateral aberta pelo botão de menu, com animação, fechamento por fundo, botão, link ou tecla `Escape`. O botão recebe contraste automático conforme a cor do cabeçalho. Páginas ocultas continuam publicáveis e acessíveis pelo endereço, mas não aparecem no menu.

Páginas conectadas (`room-service` e `blog`) usam fundo e cabeçalho brancos para não herdar a imagem ou o vídeo da página inicial. Elas mantêm a navegação do portal, não renderizam um segundo cabeçalho e não aceitam blocos personalizados. A página independente do Room Service continua disponível em `/:hotel_slug/room-service` e usa a logo reduzida cadastrada na identidade da unidade.

## Segurança

- textos são tratados como texto e escapados na renderização;
- URLs aceitam apenas páginas do próprio site, o Room Service da unidade, caminhos internos, HTTPS, `mailto:` e `tel:`;
- mídias são referências a `media_assets` ativas da mesma unidade;
- HTML incorporado passa pelo sanitizador compartilhado antes de ser salvo; scripts, eventos, estilos perigosos e URLs inseguras são removidos;
- incorporações aceitam apenas URLs HTTPS sem credenciais e rejeitam endereços locais ou privados;
- incorporações HTML usam `srcdoc` em sandbox sem `allow-scripts`; incorporações HTTPS também não recebem `allow-same-origin`;
- o portal usa CSP estrita e executa somente o runtime local responsável pela navegação móvel;
- a página de Room Service libera `connect-src 'self'` somente para consultar as APIs públicas da própria origem;
- a página de Blog consulta somente a API pública da própria origem; links são limitados ao domínio oficial do Blog Fioreze e imagens externas são aceitas apenas como mídia;
- APIs administrativas exigem sessão, permissão e acesso ao hotel;
- mutações exigem origem válida e o header administrativo;
- o editor usa `expected_revision` para impedir sobrescrita silenciosa;
- a publicação copia o rascunho validado para um snapshot imutável de publicação;
- arquivar remove a disponibilidade pública sem excluir o histórico;
- excluir definitivamente exige que o portal esteja arquivado, respeita acesso à unidade e registra auditoria na mesma operação atômica.

## Templates

Existem pontos de partida internos para o Portal do Hóspede Fioreze, hospitalidade, loja digital, campanha, eventos, página de serviço e página em branco. O modelo do Portal do Hóspede entrega Início, Serviços, Eventos, Hotel, Blog e Como chegar, com navegação e destinos internos já conectados. Nesse modelo, Blog já nasce como página conectada ao feed oficial. Os modelos permanecem integralmente editáveis. Um usuário autorizado pode salvar o site completo como modelo da unidade e aplicá-lo em outro portal. Um modelo guarda apenas o documento visual e referências de mídia; não copia usuários, configurações privadas ou dados operacionais. A duplicação entre unidades cria novas mídias no destino e troca as referências no documento clonado, evitando dependência das permissões da unidade de origem.

## Links personalizados

Cada portal publicado fornece `public_url`. A Central pode enviar esse endereço ao módulo existente de Links e QR Codes. O domínio curto, analytics, propriedade e compartilhamento permanecem responsabilidades de `short_links`; o construtor não duplica essas regras.

## Publicação e rollback

1. editar o rascunho;
2. salvar uma nova revisão;
3. revisar desktop e mobile;
4. publicar explicitamente;
5. usar o histórico para restaurar uma versão anterior como novo rascunho;
6. publicar novamente após a revisão.

Nenhuma edição de rascunho muda uma página já publicada até a ação de publicação.

O histórico oferece uma prévia visual do snapshot antes da restauração. Confirmações, exclusões e restaurações usam diálogos e mensagens do próprio editor; o fluxo não depende de `alert`, `confirm` ou `prompt` do navegador.

## Próximas evoluções

- seções e colunas aninhadas;
- biblioteca de componentes globais da marca;
- agendamento de publicação;
- colaboração em tempo real;
- domínio próprio por portal;
- formulários conectados a contratos específicos de cada módulo;
- importação controlada de templates externos para o documento estruturado;
- captura persistida de miniatura do snapshot para complementar a prévia renderizada atual.

## Limites operacionais

- mover livremente aplica deslocamentos visuais ao bloco selecionado; a ordem semântica do documento continua definida pelas camadas;
- uma incorporação pode ser recusada pelo site de origem quando ele proíbe `iframe` por cabeçalhos próprios;
- arquivos usados como fundo permanecem vinculados à Biblioteca de Mídia da unidade e precisam estar ativos;
- conteúdos antigos não são excluídos automaticamente durante a adoção do novo criador.
- `public/index.html`, `portal-home.js` e os estilos do shell compartilhado não podem ser apagados nesta etapa: ainda sustentam o Room Service e rotas públicas de compatibilidade. A economia definitiva depende da retirada controlada dessas rotas após todos os hotéis possuírem portais publicados no construtor.
