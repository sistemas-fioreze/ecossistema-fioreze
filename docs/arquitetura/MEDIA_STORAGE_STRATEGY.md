# Estrategia De Midia E Assets

Nesta fase, assets publicos ficam em `app/public/assets/`.

O D1 guarda somente metadados em `media_assets`. Ele nunca armazena binarios de imagem, documentos ou outros arquivos.

## Regras

- assets compartilhados ficam em `public/assets/shared/`;
- assets de hotel ficam em `public/assets/hotels/<hotel_id>/`;
- somente assets sanitizados e permitidos devem ser copiados;
- nao usar URLs externas de producao sem revisao;
- nao versionar credenciais, imagens privadas ou arquivos com dados de hospedes.
- registrar apenas metadados de assets sanitizados em `media_assets`;
- usar `storage_provider = static` para assets versionados em `public/assets/` nesta fase;
- nao criar bucket R2 nesta etapa;
- nao importar URLs externas reais.

## Futuro

Se o volume crescer, a plataforma pode migrar midias para R2 ou outro armazenamento permitido. O D1 deve continuar guardando apenas metadados e caminhos publicos, nao binarios grandes.

O servico de midia em `app/src/services/media-service.js` ja rejeita URL remota como padrao conservador.

A migration `0007_core_service_hours_media_assets.sql` criou `media_assets` de forma incremental porque `0001` a `0006` ja estavam aplicadas no D1 remoto de desenvolvimento.
