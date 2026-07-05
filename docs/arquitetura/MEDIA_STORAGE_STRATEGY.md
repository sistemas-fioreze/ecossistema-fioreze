# Estrategia De Midia E Assets

Nesta fase, assets publicos ficam em `app/public/assets/`.

## Regras

- assets compartilhados ficam em `public/assets/shared/`;
- assets de hotel ficam em `public/assets/hotels/<hotel_id>/`;
- somente assets sanitizados e permitidos devem ser copiados;
- nao usar URLs externas de producao sem revisao;
- nao versionar credenciais, imagens privadas ou arquivos com dados de hospedes.

## Futuro

Se o volume crescer, a plataforma pode migrar midias para R2 ou outro armazenamento permitido. O D1 deve guardar apenas metadados e caminhos publicos, nao binarios grandes.

O servico de midia em `app/src/services/media-service.js` ja rejeita URL remota como padrao conservador.
