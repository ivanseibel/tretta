# T015 — validação da investigação dos bots

Data: 20/10/2026. Resultado: **aceita como investigação**, sem autorização ou implementação de correções/publicação.

Execução delegada conforme pedido explícito do usuário: subagente `investigate_bot_fairness`, modelo solicitado `gpt-6-luna`, reasoning `max`. O orquestrador revisou os artefatos; não executou a investigação nem repetiu as simulações.

## Evidências e aceite

- Caminho real de treino, estratégia comum dos bots, distribuição, primeiro jogador, reciclagem e placar documentados com referências no [report do executor](T015-investigation.md).
- [Runner](assets/T015-investigation/simulate.ts) usa RoomStore/agendador/decisão reais, transporte inerte e relógio imediato, com políticas e fontes de aleatoriedade explícitas. A amostra final contabiliza 192.000 rodadas de permutações completas, 60.000 com a pessoa fixa e 260.000 em sessões: 512.000 no total, excluindo fumaças e repetições.
- Tabelas principais de continuidade, nomes e assentos conferidas contra [resultados](assets/T015-investigation/simulation-results.json). Os números sustentam ausência de sinal estável específico de Lila nos cenários testados, diferença entre políticas e pequena interação exploratória por posição.
- Na validação inicial foi encontrado clamp incorreto nos intervalos de diferenças de taxas. O executor separou o cálculo de diferenças do cálculo de proporções e repetiu a amostra. A versão final preserva limites negativos e documenta multiplicidade e condicionamento à política simulada.
- Executor recompilou rules/protocol e entregou manifestos SHA-256 dos dist antes/depois. Comparação independente via `rtk proxy cmp` retornou sucesso (conteúdos idênticos), apoiando correspondência dos pacotes usados com as fontes atuais.
- Estado final de Git comparado com o inicial: novos artefatos T015; nenhuma fonte de produto entre as alterações adicionais. Alterações preexistentes do workspace permanecem. Nenhum commit, push ou deploy nesta tarefa.

## Limites e encaminhamento

Aceite dos seis critérios do prompt com base no report e nos artefatos, sem auditoria independente completa das fontes ou reexecução pelo orquestrador, respeitando o pedido de delegação. O diagnóstico não prova ausência de todo defeito e não determina a causa da recorrência percebida pelo usuário. Não houve replay de decisões humanas, leitura do histórico real de partidas, inspeção remota atual ou teste de interface/rede. RNG controlado das simulações não é Math.random de produção.

O placar exato da imagem não foi reproduzido. Lila com pelo menos dez vitórias em 13 apareceu uma vez nas dez mil sessões da política de referência e nenhuma nas dez mil espelhadas; taxas empíricas não são estimativas diretas da experiência do usuário.

O achado posicional e o compartilhamento do RNG cosmético são observações documentadas, sem defeito de distribuição demonstrado. Alterar estratégia, assentos, RNG ou instrumentação requer uma próxima tarefa delimitada. Status/plano históricos não foram reescritos nesta investigação.
