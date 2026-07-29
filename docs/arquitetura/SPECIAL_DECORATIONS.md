# Decorações Especiais

O módulo público mantém a chave interna `romantic-packages` por compatibilidade com URLs, dados e integrações já publicadas. O nome apresentado ao usuário é **Decorações Especiais**.

## Modelo multi-hotel

- `decoration_categories` organiza o catálogo de cada unidade.
- `romantic_packages` guarda experiências e adicionais.
- `hotel_id` e `module_key` delimitam todas as consultas.
- `item_type=package` representa uma experiência completa.
- `item_type=add-on` representa um adicional avulso.
- `media_asset_id` referencia somente uma imagem ativa da mesma unidade.
- o conteúdo publicado usa o mesmo layout editorial, com cores e tipografia vindas da identidade da unidade.

## Edição

Na Central Administrativa, abra **Portais > Portal do Hóspede > Decorações**. O botão **Abrir editor** mostra uma janela ampla com:

- criação e edição de categorias;
- experiências e adicionais;
- título, descrição e itens inclusos;
- preço ou preço sob consulta;
- ordem, status e tipo;
- escolha de foto existente;
- upload de uma nova foto para a biblioteca da unidade.

As alterações usam as APIs `/api/v1/admin/special-decorations/catalog/*`, exigem sessão administrativa, permissão de atualização de unidades e acesso explícito ao `hotel_id`. Toda mutação é auditada.

## Catálogo Müller

A migration `0033_muller_special_decorations_catalog.sql` prepara:

- uma categoria de Surpresas Românticas;
- sete experiências;
- oito adicionais;
- sete metadados de mídia no caminho R2 `hotels/muller-fioreze/portal/decoracoes-especiais/`.

Os arquivos binários não ficam no Git. O upload no R2 e a aplicação da migration devem ocorrer somente no rollout controlado do ambiente autorizado.
