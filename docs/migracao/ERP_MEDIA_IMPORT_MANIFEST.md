# Manifesto de Migracao de Midia do ERP Room Service

Este manifesto lista categorias de midia encontradas no HTML de referencia. Nenhuma URL externa completa foi copiada para este documento.

| Categoria | Origem antiga | Destino no ecossistema | Status |
| --- | --- | --- | --- |
| Logo horizontal da unidade | Imagem externa no HTML legado | `hotel_branding` e/ou `media_assets` autorizados | Pendente de upload oficial |
| Selo/simbolo da unidade | Imagem externa ou fallback visual | `hotel_branding` ou fallback com iniciais | Fallback implementado |
| Imagens de cardapio | URLs externas por item | `media_assets` + associacao ao item de catalogo | Pendente de migracao segura |
| Avatar de usuario | Admin legado/local | Rota privada de avatar administrativo | Usar fluxo atual, sem `media_assets` |
| Icones de interface | SVGs inline e classes utilitarias | SVG/CSS local no frontend | Preservar localmente |
| Imagens decorativas | URLs externas | `media_assets` por hotel/modulo quando autorizadas | Pendente de curadoria |
| Changelog/ajuda | Conteudo estatico do HTML | Texto local nao sensivel | Preservar sem imagens externas |

## Regras

- Nao usar Postimg, Google Drive, Sheets, URLs temporarias ou links de terceiros.
- Nao tornar R2 publico.
- Nao expor `object_key` em API publica.
- Avatares administrativos nao usam `media_assets`.
- Enquanto a logo oficial nao estiver no R2, o ERP usa fallback elegante com iniciais da unidade.

## Proximo Rollout de Midia

1. Curar as imagens autorizadas.
2. Enviar pela Biblioteca de Imagens.
3. Relacionar cada midia ao hotel, modulo e entidade correta.
4. Validar que a API retorna apenas `public_url` e metadados permitidos.
5. Atualizar o ERP para consumir as referencias oficiais.
