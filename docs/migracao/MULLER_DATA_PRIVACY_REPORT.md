# Relatorio de privacidade e risco - dados Muller

Data da analise: 2026-07-05

Nenhum valor pessoal, segredo, URL completa ou ID real foi reproduzido neste documento.

## Grupo A - Permitido futuramente em D1 de desenvolvimento

Pode ser migrado para desenvolvimento apos aprovacao:

- categorias do cardapio;
- nomes publicos de produtos;
- descricoes publicas;
- precos;
- disponibilidade/estoque;
- ordenacao;
- horarios de funcionamento;
- configuracoes publicas nao sensiveis;
- links/imagens publicas autorizadas, apos validacao.

Observacao: links de imagem ainda precisam de autorizacao e plano de midia. Nao baixar imagens nesta tarefa.

## Grupo B - Usar apenas anonimizado em desenvolvimento

Dados que podem ser uteis para estatistica, teste de formato ou preservacao historica, mas nao devem ir reais para dev:

- pedidos;
- nomes de hospedes;
- telefones;
- quartos/acomodacoes usados;
- observacoes;
- atendentes;
- chat;
- historico operacional.

Tratamento recomendado:

- anonimizar nomes e contatos;
- mascarar acomodacoes;
- remover observacoes livres ou substituir por texto ficticio;
- manter apenas contagens e formatos;
- importar historico real somente se houver base legal/finalidade definida.

## Grupo C - Nao importar

Nao devem ser importados:

- senhas;
- hashes legados de senha;
- tokens;
- URLs completas de Apps Script;
- IDs reais de planilha;
- HTML armazenado dentro de planilha;
- registros tecnicos temporarios;
- conteudo ja processado de impressao;
- dados de hospedes sem finalidade operacional aprovada.

## Dados sensiveis detectados por arquivo

| Arquivo/aba | Categoria detectada | Tratamento |
| --- | --- | --- |
| Link Planilhas.txt | URLs/IDs de planilha | Nao versionar, nao reproduzir valores |
| Appscript.gs | Logica/campo de senha | Nao reutilizar diretamente |
| sistema gestao de pedidos erp .html | Endpoint Apps Script e referencias sensiveis | Nao copiar valores, nao executar |
| site pedidos.html | Endpoint Apps Script | Nao copiar valores, nao executar |
| Sistema / Pedidos | Dados pessoais de hospedes e acomodacao | Apenas anonimizado |
| Sistema / Usuarios | Senha e nomes de usuarios | Nao importar senha |
| Sistema / Hospedes | Nome, telefone, CPF, e-mail e acomodacao | Nao importar para dev |
| Sistema / Codigo | Endpoint/codigo legado | Nao migrar como dado |

## Riscos principais

- Misturar catalogo publico com historico de pedidos.
- Importar dados pessoais em fixtures ou documentacao.
- Reutilizar senha/hash legado.
- Preservar endpoint Apps Script em codigo novo.
- Baixar imagens sem autorizacao.
- Tentar mapear status legado sem tabela de equivalencia.
- Gravar historico real sem politica de retencao.

## Controles aplicados nesta tarefa

- Arquivos reais permaneceram nos locais originais.
- Saidas detalhadas foram gravadas apenas em `local-output/muller/`.
- `local-output/` e `local-input/` foram adicionados ao `.gitignore`.
- Documentacao versionada contem somente contagens, nomes de abas, cabecalhos e classificacoes.
- Dry-run gerou SQL com placeholders e parametros separados em pasta ignorada.
- Nenhuma escrita remota foi feita.
