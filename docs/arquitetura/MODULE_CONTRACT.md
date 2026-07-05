# Contrato De Modulos

Cada modulo deve seguir o mesmo contrato para evitar duplicacao.

## Identidade

- `module_key` unico em ingles, minusculo e com hifens.
- Registro obrigatorio na tabela `modules`.
- Habilitacao por hotel em `hotel_modules`.

## Rotas

Toda rota publica de modulo deve:

1. resolver o hotel por slug;
2. validar se o modulo esta habilitado para o hotel;
3. consultar apenas dados com `hotel_id`;
4. usar SQL parametrizado;
5. retornar erro controlado quando o modulo nao estiver habilitado.

Toda rota administrativa deve exigir autenticacao e autorizacao.

## Front-end

O modulo deve ter JavaScript e CSS proprios em `public/js/modules/<module_key>/` e `public/css/modules/<module_key>/`. O shell publico continua unico.

## Banco

Usar tabelas compartilhadas quando fizer sentido, como catalogos e pedidos. Criar tabelas proprias quando o fluxo tiver estado especifico, como Spa ou Pacotes Romanticos.

Migrations D1 executaveis ficam diretamente em `app/migrations/` e seguem uma unica sequencia numerica global. O contrato do modulo pode documentar quais migrations pertencem ao modulo, mas nao deve criar subpastas SQL executaveis ou sequencias independentes.

## Testes

Todo modulo deve testar:

- hotel existente e inexistente;
- modulo habilitado e desabilitado;
- isolamento por `hotel_id`;
- rejeicao de dados de outro modulo;
- permissoes administrativas quando houver ERP.
