# Branding do ERP Room Service

## Objetivo

O ERP deve refletir a unidade selecionada sem duplicar codigo.

## PR 1

- Usa nome e nome curto da unidade vindos da sessao administrativa.
- Usa fallback com iniciais quando logo/selo oficial ainda nao estiver disponivel.
- Nao usa URLs externas do legado.
- Nao copia imagens do HTML antigo.

## Futuro

- Logo horizontal: `hotel_branding`/Biblioteca de Imagens.
- Selo compacto: `hotel_branding`/Biblioteca de Imagens.
- Produtos: `catalog_items` + `media_assets`.
- Decorativas: `media_assets` por hotel/modulo.

## Restricoes

- R2 permanece privado.
- API retorna `public_url`, nao `object_key`.
- Avatar administrativo usa rota privada propria, nao `media_assets`.
