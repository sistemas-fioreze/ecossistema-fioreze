# Estrategia De Midia E Assets

O Ecossistema Fioreze separa metadados e binarios:

- D1 guarda registros em `media_assets` e a organizacao em `media_folders`;
- R2 guarda os binarios enviados pela Biblioteca de Imagens;
- Static Assets guarda somente arquivos versionados e sanitizados em `app/public/assets/`;
- `/media/:id` entrega uma imagem ativa sem expor o `object_key` do R2.

## Regras

- cada registro pertence a um `hotel_id` quando aplicavel;
- pastas e subpastas nunca podem misturar hoteis;
- o Worker gera `object_key`, `asset_id` e `public_url`;
- mover imagens entre pastas altera somente `folder_id`;
- mover pastas valida a cadeia de pais e bloqueia ciclos;
- arquivar uma imagem nao apaga automaticamente o objeto R2;
- pastas com imagens ou subpastas ativas nao podem ser arquivadas;
- D1 nunca armazena o corpo binario da imagem;
- credenciais, imagens privadas e arquivos com dados de hospedes nao podem ser versionados.

## Caminhos E URLs

Objetos enviados usam:

```text
hotels/<hotel_id>/<module_or_shared>/<yyyy>/<mm>/<asset_id>.<ext>
```

A URL publica permanece estavel:

```text
/media/<asset_id>
```

A pasta administrativa nao faz parte desses caminhos. Assim, reorganizar a biblioteca nao invalida logos, produtos ou conteudos que ja usam a imagem.

## Permissoes

- `portals.media.read`: visualizar imagens e pastas;
- `portals.media.upload`: enviar imagens;
- `portals.media.update`: editar metadados e organizar imagens e pastas;
- `portals.media.archive`: arquivar imagens.

Todas as mutacoes exigem sessao, acesso explicito ao hotel e as protecoes administrativas de origem e cabecalho.

## Static Assets

- compartilhados: `app/public/assets/shared/`;
- por hotel: `app/public/assets/hotels/<hotel_id>/`;
- somente arquivos sanitizados e autorizados podem entrar no Git.

O servico em `app/src/services/media-service.js` rejeita URL remota como padrao conservador. `/media/*` permanece em `assets.run_worker_first` para que o Worker processe a rota antes do fallback SPA.

## Evolucoes Futuras

- redimensionamento e variantes responsivas;
- compressao e remocao controlada de metadados EXIF;
- selecao multipla e operacoes em lote;
- lixeira com politica de retencao;
- regras de lifecycle no R2;
- dominios de midia dedicados, mantendo o bucket privado.
