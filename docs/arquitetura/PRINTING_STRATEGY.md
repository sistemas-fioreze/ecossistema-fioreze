# Estrategia De Impressao

A impressao pertence ao modulo `room-service`, nao ao core da plataforma.

## Estado Atual

- `IMPRESSION_ENABLED=false`;
- nenhuma rota chama Python;
- nenhuma rota chama localhost do servidor antigo;
- nenhuma rota chama impressora, spooler ou caminho de rede;
- nenhuma rota chama Apps Script ou planilha;
- `print_events` existe apenas como modelagem inicial.

## Interface Futura

O conceito de `PrintProvider` deve isolar a impressao:

- hotel sem impressora;
- uma impressora por hotel;
- varias impressoras por hotel;
- impressoras por setor;
- fila de impressao;
- tentativas;
- confirmacao;
- reimpressao;
- historico de erro.

Ativar impressao exige autorizacao explicita e configuracao por hotel. O core nao deve depender de detalhes de impressora.
