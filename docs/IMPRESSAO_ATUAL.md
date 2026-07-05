# Impressao Atual

O servidor atual de impressao e um agente local Windows em Python.

Funcoes principais:

- consulta a fila de pedidos no sistema legado;
- imprime cupons via `win32print`;
- expoe API local em `127.0.0.1:5050`;
- permite pausar, retomar, listar impressoras, imprimir teste e reimprimir ultimo pedido.

Arquivos reais de credencial, config, logs, historico e status nao foram copiados. Foram criados exemplos ficticios em:

`legacy/hoteis/muller-fioreze/room-service/impressao/exemplos/`

Durante desenvolvimento e proibido acionar impressora real.
