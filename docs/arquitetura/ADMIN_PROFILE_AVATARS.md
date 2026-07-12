# Perfil e avatares administrativos

Este documento descreve a fundacao de foto de perfil da Central Administrativa.

## Escopo

O avatar administrativo e privado e pertence ao usuario administrativo, nao a biblioteca publica de imagens.

Ele nao usa `media_assets` e nao cria URL publica em `/media/:id`.

## Armazenamento

O objeto fica no bucket R2 privado ja usado pela plataforma, com prefixo separado:

`admin-avatars/<user_id>/<avatar_id>.<ext>`

O nome original do arquivo nao e usado no objeto final.

## Schema

Migration `0013_admin_profile_avatars.sql` adiciona em `admin_users`:

- `avatar_object_key`;
- `avatar_mime_type`;
- `avatar_updated_at`.

## Formatos

Permitidos:

- JPEG;
- PNG;
- WebP;
- AVIF.

Limite:

- 3 MB.

Validacoes:

- MIME;
- magic bytes;
- tamanho;
- arquivo vazio.

## Rotas

- `GET /api/v1/admin/me/avatar`
- `HEAD /api/v1/admin/me/avatar`
- `POST /api/v1/admin/me/avatar`
- `DELETE /api/v1/admin/me/avatar`
- `GET /api/v1/admin/users/:id/avatar`
- `HEAD /api/v1/admin/users/:id/avatar`

Regras:

- o proprio usuario acessa sua foto;
- outro usuario exige `admin.users.read`;
- sem sessao retorna 401;
- fallback seguro retorna SVG de iniciais;
- `Cache-Control` e privado;
- nenhuma chave R2 e retornada.

## Troca segura

1. valida arquivo;
2. grava novo objeto;
3. atualiza D1;
4. se o D1 falhar, remove o objeto novo;
5. se sucesso, tenta remover objeto antigo;
6. registra auditoria sem segredo.

## Interface

`/admin/minha-conta/` exibe:

- identidade;
- avatar ou iniciais;
- upload de nova foto;
- remocao da foto;
- troca de senha.

## Limites atuais

- nao ha recorte de imagem;
- nao ha galeria de fotos antigas;
- remocao do objeto antigo e tolerante a falha para nao quebrar a conta;
- rollout remoto exige aplicar a migration antes do deploy do Worker.
