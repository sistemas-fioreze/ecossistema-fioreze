# Portal do Hóspede Oficial

## Princípio

O Ecossistema Fioreze possui um único Portal do Hóspede compartilhado por todas as unidades. O HTML, o CSS, o JavaScript, a navegação e o comportamento são mantidos uma vez no repositório. Cada unidade fornece seus próprios dados pelo `hotel_id`.

Não existe um construtor livre de páginas. O template oficial mantém as seções:

- Início;
- Serviços;
- Eventos;
- Hotel;
- Blog.

Os serviços disponíveis dentro do portal são:

- `room-service`;
- `emporio`;
- `romantic-packages`;
- `spa`.

Ativar um serviço no editor altera `hotel_modules`. O módulo só aparece quando está habilitado e público para a unidade. A validação também permanece no Worker, portanto esconder um botão nunca substitui o controle do backend.

## Endereço

O endereço canônico de cada unidade é:

```text
https://portal.hoteisfioreze.com.br/:hotel_slug
```

Os módulos públicos usam:

```text
https://portal.hoteisfioreze.com.br/:hotel_slug/room-service
https://portal.hoteisfioreze.com.br/:hotel_slug/emporio
https://portal.hoteisfioreze.com.br/:hotel_slug/romantic-packages
https://portal.hoteisfioreze.com.br/:hotel_slug/spa
```

`GUEST_PORTAL_PUBLIC_ORIGIN` identifica a origem oficial. O slug resolve o hotel; o bootstrap e todas as consultas públicas permanecem limitados ao hotel resolvido.

## Editor Guiado

O editor fica em:

```text
/admin/portais/portal-hospede/
```

Ele permite somente escolhas que preservam o template:

- logo horizontal e logo reduzida;
- cor principal, destaque, fundo e texto;
- tipografia;
- imagem ou vídeo da capa;
- mensagem de boas-vindas e descrição institucional;
- feed público do blog;
- link e incorporações de mapas;
- nome, descrição, imagem e disponibilidade dos quatro serviços;
- títulos, imagens, quantidade e ordem dos destaques do carrossel do Empório;
- acesso direto aos eventos, às informações do hotel e à Biblioteca de Mídia.

O editor oferece prévia ao vivo em desktop e mobile. A prévia usa mensagens da mesma origem e não concede autorização. Salvar continua exigindo sessão, acesso ao hotel e as permissões administrativas de identidade, configurações e módulos.

## Dados

O portal usa somente estruturas compartilhadas:

- `hotels` para unidade, slug, idioma, moeda e fuso;
- `hotel_branding` para identidade e capa;
- `hotel_settings` para textos e configurações públicas;
- `hotel_modules` para serviços habilitados e suas imagens;
- `events` e `hotel_information` para conteúdo;
- `media_assets` e R2 para logos, fotos e vídeos;
- APIs específicas de cada módulo para catálogo e operação.

Nenhum HTML, nome de hotel, cor ou catálogo é duplicado por unidade. O Müller continua sendo o primeiro tenant, não uma exceção no código.

Os módulos internos usam a imagem cadastrada no próprio serviço como capa. A navegação permanece transparente sobre a mídia, o título usa o ícone do módulo e o degradê integra a capa ao conteúdo. No Room Service, o único complemento do título é o horário calculado a partir de `service_hours`. O Empório mantém sua composição comercial própria e lê os destaques editoriais de `emporio.carousel_slides`; quando a lista está vazia, usa as imagens disponíveis do catálogo como fallback.

## Segurança

- o bootstrap retorna somente dados públicos;
- consultas públicas são isoladas pelo hotel resolvido;
- o preview aceita mensagens apenas da janela administrativa e da mesma origem;
- mídias precisam estar ativas e pertencer à unidade ou ao acervo compartilhado;
- atualizações administrativas exigem origem válida, header administrativo, permissão e acesso ao hotel;
- o editor não chama Apps Script, Sheets ou impressão;
- `IMPRESSION_ENABLED=false` continua independente do portal.
