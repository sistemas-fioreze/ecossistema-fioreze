# Como Adicionar Um Hotel

1. Defina `hotel_id` e `slug`.
2. Insira o hotel em `hotels`.
3. Configure `hotel_branding` com logo, cores e tipografia publicas.
4. Configure `hotel_settings` separando chaves publicas e internas.
5. Habilite modulos em `hotel_modules`.
6. Crie navegacao em `navigation_items`.
7. Cadastre quartos em `rooms` quando o modulo exigir acomodacao.
8. Cadastre catalogos, categorias e itens com `hotel_id`.
9. Adicione assets permitidos em `public/assets/hotels/<hotel_id>/`.
10. Crie testes garantindo que o hotel novo nao enxerga catalogos, pedidos, quartos ou configuracoes de outro hotel.

Nao duplicar HTML, Worker, ERP ou API para o novo hotel. O novo comportamento deve vir dos dados do D1.
