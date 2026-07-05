# Regras do Legado Muller & Fioreze

- Nao modificar a pasta de entrada original.
- Nao executar o servidor de impressao durante desenvolvimento.
- Nao enviar pedidos para producao.
- Nao chamar Apps Script ou planilhas reais sem autorizacao.
- Nao usar dados reais em testes.
- Manter arquivos em `legacy/` como referencia historica.
- Toda futura alteracao de banco devera usar migrations.
- O sistema futuro devera ser multi-hotel com `hotel_id`.
