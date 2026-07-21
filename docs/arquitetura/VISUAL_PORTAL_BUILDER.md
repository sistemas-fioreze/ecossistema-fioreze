# Construtor Visual de Portais

## Objetivo

O Construtor Visual permite criar portais e páginas profissionais na Central Administrativa sem duplicar aplicações por hotel. Ele é a superfície oficial para novos sites públicos, lojas digitais, campanhas, eventos e experiências futuras. `admin` e `room-service` permanecem fora desse editor porque possuem produtos e fluxos próprios.

Os antigos tipos de conteúdo continuam preservados no banco para compatibilidade e histórico, mas não aparecem como produtos separados na navegação da Central. Novos projetos são criados no editor visual e recebem seu próprio endereço público. A configuração operacional do Room Service pertence exclusivamente ao ERP do hotel.

## Experiência administrativa

O construtor fica em **Central Administrativa > Criador de portais** e oferece:

- canvas em tela cheia;
- alternância e pré-visualização separada para desktop e mobile;
- biblioteca de blocos com inclusão por clique ou arrastar e soltar;
- camadas reordenáveis por arrastar e soltar, botões de ordem ou painel de camadas;
- movimento livre de blocos nos eixos horizontal e vertical, com valores independentes por dispositivo;
- propriedades globais e substituições por dispositivo;
- tipografia, espaçamento, colunas, cores, largura e visibilidade ajustáveis separadamente para desktop e mobile;
- imagens e vídeos da Biblioteca de Mídia da própria unidade, inclusive como fundo da página;
- capa, títulos, textos, botões, imagens, vídeos, galeria, grade, citação, contato, incorporações, divisor e espaçador;
- incorporações HTTPS para Google Maps, páginas hospedadas e serviços compatíveis com `iframe`;
- desfazer, refazer, copiar, colar, duplicar, mover e excluir blocos;
- pré-visualização do rascunho;
- salvamento com controle de revisão;
- publicação explícita;
- histórico de versões com restauração para um novo rascunho;
- duplicação de portal;
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

O formato anterior `/portal/:hotel_slug/:portal_slug` redireciona permanentemente para o endereço canônico. No domínio oficial, o shell legado do Portal do Hóspede e as antigas páginas em `/portal-content/*` não são expostos: caminhos como `/:hotel_slug` ou `/:hotel_slug/inicio` retornam 404. `/:hotel_slug/room-service` permanece reservado ao Room Service e continua fora do construtor.

## Documento visual

O banco não armazena HTML livre. O campo JSON usa `schema_version=1` e contém:

```json
{
  "schema_version": 1,
  "settings": {
    "background_color": "#ffffff",
    "background_media_asset_id": null,
    "background_overlay": 0,
    "background_position": "center",
    "background_fit": "cover",
    "background_fixed": false,
    "text_color": "#202124",
    "primary_color": "#513b2d",
    "font_family": "Inter, system-ui, sans-serif"
  },
  "blocks": []
}
```

Cada bloco possui `id`, `type`, `content`, `styles.base`, `styles.desktop`, `styles.mobile` e `visibility`. Os estilos por dispositivo incluem os deslocamentos `offset_x` e `offset_y`, usados pelo movimento livre sem misturar o layout desktop com o mobile. O Worker normaliza o documento antes de salvá-lo e novamente antes de servi-lo.

## Segurança

- textos são tratados como texto e escapados na renderização;
- URLs aceitam apenas caminhos internos, HTTPS, `mailto:` e `tel:`;
- mídias são referências a `media_assets` ativas da mesma unidade;
- não são aceitos scripts, eventos HTML, CSS arbitrário ou HTML livre no documento;
- incorporações aceitam apenas URLs HTTPS sem credenciais e rejeitam endereços locais ou privados;
- iframes são renderizados em sandbox e limitados pela CSP a origens HTTPS;
- a página pública principal usa CSP sem JavaScript próprio;
- APIs administrativas exigem sessão, permissão e acesso ao hotel;
- mutações exigem origem válida e o header administrativo;
- o editor usa `expected_revision` para impedir sobrescrita silenciosa;
- a publicação copia o rascunho validado para um snapshot imutável de publicação;
- arquivar remove a disponibilidade pública sem excluir o histórico.

## Templates

Existem pontos de partida internos para hospitalidade, loja digital, campanha, eventos, página de serviço e página em branco. Os modelos usam cartões, botões e seções com cantos arredondados e permanecem integralmente editáveis. Um usuário autorizado pode salvar o documento atual como modelo da unidade e aplicá-lo em outro portal. Um modelo guarda apenas o documento visual e referências de mídia; não copia usuários, configurações privadas ou dados operacionais.

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

## Próximas evoluções

- seções e colunas aninhadas;
- biblioteca de componentes globais da marca;
- agendamento de publicação;
- colaboração em tempo real;
- domínio próprio por portal;
- formulários conectados a contratos específicos de cada módulo;
- importação controlada de templates externos para o documento estruturado.

## Limites operacionais

- mover livremente aplica deslocamentos visuais ao bloco selecionado; a ordem semântica do documento continua definida pelas camadas;
- uma incorporação pode ser recusada pelo site de origem quando ele proíbe `iframe` por cabeçalhos próprios;
- arquivos usados como fundo permanecem vinculados à Biblioteca de Mídia da unidade e precisam estar ativos;
- conteúdos antigos não são excluídos automaticamente durante a adoção do novo criador.
