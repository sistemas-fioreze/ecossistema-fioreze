# Construtor Visual de Portais

## Objetivo

O Construtor Visual permite criar portais e páginas profissionais na Central de Portais sem duplicar aplicações por hotel. Ele atende `guest-portal`, `emporio`, `spa`, `romantic-packages` e módulos públicos futuros. `admin` e `room-service` permanecem fora desse editor porque possuem produtos e fluxos próprios.

## Experiência administrativa

O construtor fica em **Central de Portais > Conteúdos > Construtor** e oferece:

- canvas em tela cheia;
- visualização separada para desktop e mobile;
- biblioteca de blocos com inclusão por clique ou arrastar e soltar;
- camadas reordenáveis;
- propriedades globais e substituições por dispositivo;
- tipografia, espaçamento, colunas, cores, largura e visibilidade ajustáveis separadamente para desktop e mobile;
- imagens e vídeos da Biblioteca de Mídia da própria unidade;
- capa, títulos, textos, botões, imagens, vídeos, galeria, grade, citação, contato, divisor e espaçador;
- desfazer, refazer, duplicar e excluir blocos;
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

O endereço público é único por hotel:

```text
/portal/:hotel_slug/:portal_slug
```

O registro continua vinculado a `hotel_id` e `module_key`. A rota pública responde somente quando hotel, módulo e portal estão ativos e públicos.

## Documento visual

O banco não armazena HTML livre. O campo JSON usa `schema_version=1` e contém:

```json
{
  "schema_version": 1,
  "settings": {
    "background_color": "#ffffff",
    "text_color": "#202124",
    "primary_color": "#513b2d",
    "font_family": "Inter, system-ui, sans-serif"
  },
  "blocks": []
}
```

Cada bloco possui `id`, `type`, `content`, `styles.base`, `styles.desktop`, `styles.mobile` e `visibility`. O Worker normaliza o documento antes de salvá-lo e novamente antes de servi-lo.

## Segurança

- textos são tratados como texto e escapados na renderização;
- URLs aceitam apenas caminhos internos, HTTPS, `mailto:` e `tel:`;
- mídias são referências a `media_assets` ativas da mesma unidade;
- não são aceitos scripts, eventos HTML, CSS arbitrário, iframes ou formulários;
- a página pública usa CSP sem JavaScript;
- APIs administrativas exigem sessão, permissão e acesso ao hotel;
- mutações exigem origem válida e o header administrativo;
- o editor usa `expected_revision` para impedir sobrescrita silenciosa;
- a publicação copia o rascunho validado para um snapshot imutável de publicação;
- arquivar remove a disponibilidade pública sem excluir o histórico.

## Templates

Existem três pontos de partida internos: portal completo, página de serviço e página em branco. Um usuário autorizado pode salvar o documento atual como modelo da unidade e aplicá-lo em outro portal do mesmo módulo. Um modelo guarda apenas o documento visual e referências de mídia; não copia usuários, configurações privadas ou dados operacionais.

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
