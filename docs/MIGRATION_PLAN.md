# Plano de Migracao

Esta etapa nao inicia a migracao para Cloudflare.

## Fase atual

1. Preservar entrada original intacta.
2. Criar copia organizada e sanitizada em `legacy/`.
3. Documentar funcionamento, riscos e dados sensiveis nao migrados.

## Fases futuras

1. Criar base em `app/`.
2. Definir migrations.
3. Modelar multi-hotel com `hotel_id`.
4. Criar Worker e D1 em ambiente de desenvolvimento.
5. Criar importadores usando apenas dados ficticios.
6. Testar sem acessar producao e sem impressora real.
