# Como Adicionar Um Modulo

1. Escolha um `module_key` estavel em ingles.
2. Adicione o modulo na seed local e em migrations se houver dados iniciais obrigatorios.
3. Crie `app/src/modules/<module_key>/`.
4. Registre rotas no `module-registry`.
5. Crie CSS e JS em `app/public/css/modules/<module_key>/` e `app/public/js/modules/<module_key>/`.
6. Adicione linhas em `hotel_modules` somente para os hoteis que podem usar o modulo.
7. Crie migrations especificas em `app/migrations/modules/<module_key>/` se o modulo tiver tabelas proprias.
8. Adicione testes de modulo habilitado, desabilitado e isolamento por hotel.
9. Atualize `app/README.md` e documentacao de API quando o modulo tiver endpoints publicos ou administrativos.

Um modulo desabilitado nao deve aparecer no bootstrap, nao deve aparecer na navegacao e nao deve responder como fluxo normal pela API.
