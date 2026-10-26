# T015 — investigação de frequência de vitórias dos bots

**Status:** proposta de conclusão para validação do orquestrador.

**Escopo:** revisão e simulação do treino Clássico sem alterar comportamento, regras ou fontes do produto.

## Conclusão

Não encontrei evidência de que o nome ou a identidade de Lila faça sua política jogar melhor: os três bots chamam a mesma função, recebem a mesma projeção limitada e não têm ramificação por apelido ou id. Nas simulações com nomes permutados, a vantagem aparente de Lila muda com o RNG ou desaparece; na matriz que manteve a pessoa no assento 0 e trocou apenas os nomes dos bots, a taxa de Lila ficou estatisticamente compatível com a dos outros dois.

O resultado de uma pessoa contra três adversários pode favorecer a classe dos bots sem indicar uma falha: com uma política humana espelhada, cada identidade venceu aproximadamente 25% das rodadas; com a política de referência mais simples, a pessoa venceu cerca de 20,7%, enquanto cada bot venceu cerca de 25,6%–27,0%. Isso mede uma política simulada, não a habilidade nem as jogadas reais da pessoa.

Há uma interação exploratória por assento quando a pessoa fica no assento 0: sob essa política de referência, o bot no assento 1 venceu menos que os bots nos assentos 2 e 3 em ambas as configurações de RNG. A diferença acompanha o assento relativo à pessoa, não um nome; as seis permutações de nomes preservaram o efeito. Com o assento da pessoa também permutado, as taxas por assento voltaram a aproximadamente 25%. O achado é relevante para a mesa de treino, mas não demonstra defeito no motor: é uma comparação condicional a um jogador de política diferente e a intervalos exploratórios sem ajuste para múltiplas comparações.

Também encontrei acoplamento entre a fonte padrão de aleatoriedade do jogo e a dos efeitos cosméticos: na ausência de `TRE_TTA_SEED`, ambas retornam a função global `Math.random`. Eventos que escolhem uma variação visual avançam a mesma sequência usada por distribuições futuras. Não achei relação desse acoplamento com o nome de um bot ou evidência de viés na distribuição. É uma observação de baixa gravidade sobre isolamento e reprodutibilidade, não uma causa demonstrada para o placar.

O placar da captura — 13 rodadas, Pessoa 2, Tico 0, Lila 10 e Nino 1 — não reapareceu exatamente nas 10.000 sessões simuladas de cada política. Lila venceu pelo menos 10 das 13 rodadas em 0/10.000 sessões com a política espelhada e 1/10.000 com a política de referência (taxa empírica de 0,01%; IC95% de Wilson 0,0018%–0,0566%). A coincidência exata do placar apareceu em 0/10.000 por política (limite superior de 0,0384%). Essas amostras não provam que o resultado seja impossível ou explicam sessões históricas; a captura é uma observação, não uma estimativa da frequência passada.

## Caminho real do treino até o placar

1. `RoomStore.createRoom` cria a pessoa como anfitriã e registra o modo. No treino, `addTrainingBots` acrescenta Tico, Lila e Nino nessa ordem, com identidades fixas, prontas e já registradas no histórico da sala. Os ids dos bots são derivados do código da sala e do índice. Isso estabelece a ordem padrão: pessoa no assento 0, Tico no 1, Lila no 2 e Nino no 3. Ver [`rooms.ts`](../../../apps/server/src/rooms.ts#L292), [`rooms.ts`](../../../apps/server/src/rooms.ts#L360) e [`ids.ts`](../../../apps/server/src/ids.ts#L8).
2. A pessoa confirma e inicia a rodada. `startRound` inclui participantes conectados e bots, chama o motor real com `room.random` e cria o estado da rodada com ids e ordem dos assentos. Nas rodadas seguintes, as identidades e o histórico persistem; bots ficam prontos automaticamente e a pessoa confirma de novo. Ver [`rooms.ts`](../../../apps/server/src/rooms.ts#L685).
3. O motor cria 108 cartas, aplica Fisher–Yates, distribui sete cartas em rodízio pela ordem dos assentos, retira cartas não numéricas até encontrar a abertura e escolhe o primeiro jogador com índice aleatório. Se cartas não numéricas foram retiradas da abertura, elas voltam à pilha por novo embaralhamento. Ver [`card.ts`](../../../packages/rules/src/card.ts#L38), [`round.ts`](../../../packages/rules/src/round.ts#L44) e [`round.ts`](../../../packages/rules/src/round.ts#L51).
4. Uma ação da pessoa percorre `applyRoundCommand` e o motor compartilhado. Para uma ação de bot, o servidor agenda somente o assento atual, guarda geração/versão da sala e, quando o timer vence, obtém uma `PlayerView`, chama `decideBotCommand`, aplica a ação no mesmo motor e agenda o próximo turno. O teste usa atraso zero e relógio determinístico, mas mantém esse agendador e caminho de decisão do servidor. Ver [`rooms.ts`](../../../apps/server/src/rooms.ts#L762) e [`rooms.ts`](../../../apps/server/src/rooms.ts#L1212).
5. Ao terminar, `settleIfFinished` registra no máximo uma vitória por rodada. Bots de treino têm `autoControlled: false`, então a vitória deles é contabilizada como identidade própria; a exceção é o substituto de uma pessoa ausente. `snapshotOf` expõe o placar a partir do histórico por id, sem inferir vitória pelo assento. Ver [`rooms.ts`](../../../apps/server/src/rooms.ts#L1073) e [`rooms.ts`](../../../apps/server/src/rooms.ts#L1359).

## Estratégia, informação e aleatoriedade

`decideBotCommand` é comum a todos os bots. Ela recebe `PlayerView`, não mãos ocultas. Na fase normal, procura na ordem da mão uma carta colorida válida e só depois considera coringas. Ao usar coringa, escolhe a cor mais presente na mão, desempata pela ordem canônica vermelho, amarelo, verde e azul, e anuncia quando ficará com uma carta. Depois de comprar, joga somente a carta comprada se ela for válida; se não, passa. Sem descarte válido, compra. Não há consulta ao nome, id, avatar ou assento para escolher a jogada. Ver [`bot.ts`](../../../apps/server/src/bot.ts#L17).

Usei duas políticas explícitas para a pessoa simulada:

- **`mirror-bot`:** aplica a mesma função real `decideBotCommand` à projeção da pessoa. É um controle para procurar assimetrias de nome, assento, integração e placar sob políticas idênticas.
- **`first-legal`:** escolhe `playableCardIds[0]` na ordem da mão, ou compra; depois da compra, joga a carta recém-comprada se for válida ou passa. A simulação escolhe a cor mais presente ao usar coringa e anuncia a última carta. O bot, em contraste, prioriza uma carta colorida válida mesmo que um coringa apareça antes na mão. Essa é uma política de referência explícita, baseada no helper simples de testes, não uma cópia exata dele nem um modelo das decisões reais do usuário. O helper de testes não seleciona cor nem anuncia última carta no comando que envia. Ver [`training.ts`](../../../apps/server/test/training.ts#L69) e [`bot.ts`](../../../apps/server/src/bot.ts#L41).

O motor usa `randomIndex`, que escala um valor `[0,1)` por `floor`, e `shuffle`, que percorre a lista de trás para frente trocando com um índice uniforme, isto é, Fisher–Yates. A pilha reciclada também usa esse shuffle e mantém a carta superior do descarte fora dele. Não encontrei viés evidente na implementação do shuffle. Ver [`random.ts`](../../../packages/rules/src/random.ts#L25) e [`state.ts`](../../../packages/rules/src/state.ts#L127).

Em produção, o servidor usa `Math.random` como padrão para `room.random`; a fábrica padrão de `effectRandom` também retorna `Math.random`. Portanto, sem `TRE_TTA_SEED`, ambos os campos compartilham a mesma fonte global. A seleção de variantes de efeitos pode consumir valores entre decisões do motor, inclusive entre rodadas. Com a variável configurada, `index.ts` cria um fluxo seeded para as regras e outro, derivado com XOR `0x5eed`, para efeitos. A última evidência local do ambiente publicado que consultei, de 18/10/2026, registra `seedPresent: false`; não revalidei o ambiente remoto nesta investigação. Ver [`server.ts`](../../../apps/server/src/server.ts#L74), [`rooms.ts`](../../../apps/server/src/rooms.ts#L258), [`rooms.ts`](../../../apps/server/src/rooms.ts#L1298), [`index.ts`](../../../apps/server/src/index.ts#L5) e [snapshot do ambiente](assets/T014-public/08-render-env.json#L1).

O runner usa `createSeededRandom` (Mulberry32) para controlar as simulações; isso não é o RNG de produção. No cenário `shared-stream`, a mesma função seeded é injetada em `room.random` e `room.effectRandom`, reproduzindo a topologia de chamadas do padrão de produção sem semente. `separate-streams` usa dois geradores seeded e é uma comparação diagnóstica, não a configuração padrão atual. Ids de pessoas/rodadas, credenciais e códigos de sala usam `node:crypto` em `ids.ts`; não geram a ordem das cartas nem decidem vencedor.

## Simulação e resultados

O runner está em [`simulate.ts`](assets/T015-investigation/simulate.ts); os resultados completos estão em [`simulation-results.json`](assets/T015-investigation/simulation-results.json). Ele cria salas pelo `RoomStore` em modo `training`, usa os bots, comandos, motor, eventos, reciclagem e histórico reais; aplica as ações da pessoa via `applyRoundCommand` e drena o timer real de bots com relógio imediato. O transporte é inerte, pois nenhum estado de rede ou interface é necessário para esse caminho.

| Amostra | Configuração | Rodadas |
| --- | --- | ---: |
| Matriz completa, controle `mirror-bot` | 2.000 seeds × 24 permutações de pessoa + três bots, para cada um dos dois wirings de RNG | 96.000 |
| Matriz completa, pessoa `first-legal` | Mesma matriz, separada por shared/separate streams | 96.000 |
| Pessoa fixa no assento 0 | 5.000 seeds × seis permutações dos nomes dos bots, em cada wiring; pessoa e política constantes | 60.000 |
| Continuidade | 10.000 sessões de 13 rodadas por política, ordem padrão fixa e RNG compartilhado | 260.000 |
| **Total nesta versão final** | Sem incluir execuções anteriores de fumaça ou reruns | **512.000** |

Na matriz completa, as 24 permutações colocam cada identidade seis vezes em cada assento por seed. Os intervalos de 95% das matrizes e da continuidade usam proporções por seed/sessão como clusters e aproximação normal; os contrastes pareados da matriz pessoa-fixa preservam o agrupamento dos seis nomes permutados por seed e usam intervalo sem limite artificial em zero. As taxas de eventos raros são acompanhadas de intervalos de Wilson. Intervalos são exploratórios, não ajustados para multiplicidade.

### Permutação completa de nomes e assentos

Taxa de vitória por identidade, com intervalo de 95% entre colchetes:

| Política da pessoa | Wiring | Pessoa | Tico | Lila | Nino |
| --- | --- | ---: | ---: | ---: | ---: |
| `mirror-bot` | shared | 25,24% [24,84–25,63] | 24,90% [24,52–25,29] | 25,25% [24,86–25,65] | 24,61% [24,22–24,99] |
| `mirror-bot` | separate | 24,76% [24,39–25,14] | 24,82% [24,43–25,20] | 24,99% [24,60–25,38] | 25,43% [25,05–25,81] |
| `first-legal` | shared | 20,91% [20,55–21,27] | 26,56% [26,17–26,95] | 26,61% [26,21–27,00] | 25,92% [25,53–26,31] |
| `first-legal` | separate | 20,88% [20,53–21,24] | 26,03% [25,63–26,42] | 26,28% [25,87–26,68] | 26,81% [26,42–27,21] |

Sob `mirror-bot`, as taxas por assento físico ficaram entre 24,81% e 25,16%, próximas de 25%. Sob `first-legal`, mesmo com a vantagem dos três bots contra uma pessoa de política diferente, as taxas por assento ficaram entre 24,64% e 25,18% no shared stream e 24,93%–25,08% no separate stream. Os quatro assentos também foram escolhidos como primeiro jogador em aproximadamente 25% das partidas. A ligeira queda do Nino no espelho shared (IC nominal termina em 24,99%) troca de sinal em separate (25,43%); já nas permutações fixas, o contraste de cada nome com a média dos outros bots inclui zero nos dois wirings. Isso não aponta para viés estável por nome.

### Pessoa fixa no assento 0 e nomes dos bots permutados

Esta amostra mantém a topologia de treino e testa diretamente um efeito de posição que a matriz completa, onde a própria pessoa muda de assento, poderia diluir. As taxas abaixo são vitórias por rodada e IC95% agrupado por seed:

| Wiring | Pessoa/assento 0 | Assento 1 | Assento 2 | Assento 3 | Tico | Lila | Nino |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| shared | 20,84% [20,38–21,31] | 25,76% [25,27–26,26] | 26,77% [26,28–27,27] | 26,62% [26,12–27,12] | 26,63% | 26,36% | 26,16% |
| separate | 20,78% [20,32–21,24] | 25,52% [25,03–26,02] | 26,82% [26,31–27,32] | 26,88% [26,37–27,39] | 26,21% | 26,21% | 26,80% |

Contrastes pareados de taxa (assento esquerdo menos direito):

| Wiring | Contraste | Diferença | IC95% pareado |
| --- | --- | ---: | ---: |
| shared | 1 − 2 | −1,01 p.p. | [−1,82; −0,20] p.p. |
| shared | 1 − 3 | −0,86 p.p. | [−1,68; −0,04] p.p. |
| shared | 2 − 3 | +0,15 p.p. | [−0,66; +0,97] p.p. |
| separate | 1 − 2 | −1,29 p.p. | [−2,12; −0,46] p.p. |
| separate | 1 − 3 | −1,36 p.p. | [−2,18; −0,53] p.p. |
| separate | 2 − 3 | −0,06 p.p. | [−0,90; +0,77] p.p. |

Para cada nome, as duas configurações de RNG dão resultados semelhantes e sem um nome consistentemente acima dos demais. Os contrastes pareados de nome contra a média dos outros bots são: shared — Tico +0,37 p.p. [−0,35; +1,09], Lila −0,03 [−0,75; +0,68], Nino −0,34 [−1,06; +0,38]; separate — Tico −0,30 [−1,01; +0,42], Lila −0,30 [−1,01; +0,41], Nino +0,59 [−0,12; +1,31]. Todos incluem zero.

O contraste de assento 1 contra 2/3 persiste nos dois wirings quando a pessoa fica no assento 0. É uma interação mensurável da política simulada com a posição relativa à pessoa; não foi reproduzida como vantagem universal de assento quando os quatro participantes são permutados. Como os bots permanecem nos assentos padrão entre rodadas, a hipótese merece uma validação orientada a experiência se o objetivo do treino incluir paridade posicional. A amostra não isola se a causa é a política da pessoa, dinâmica de cartas de ação/sentido ou outra interação de assento.

### Placar em sessões de 13 rodadas

Ordem fixa de treino, RNG com stream compartilhado e 10.000 sessões independentes por política:

| Política | Pessoa | Tico | Lila | Nino | Lila primeira em sessões | Lila no top 2 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `mirror-bot` | 24,94% | 24,96% | 25,00% | 25,09% | 3.168/10.000 (31,68%) | 5.968/10.000 (59,68%) |
| `first-legal` | 20,73% | 25,60% | 26,72% | 26,95% | 3.674/10.000 (36,74%) | 6.513/10.000 (65,13%) |

Empates podem contar como primeira ou top-2 para mais de uma identidade. Na política de referência, Nino ficou ligeiramente acima de Lila; no espelho, os quatro ficaram praticamente iguais. A sessão 10/2/1/0 não apareceu. Isso mostra que a captura é compatível com uma sequência extrema possível, mas não foi comum nesta amostra; não mede a frequência real do usuário.

## Achados, gravidade e próximos passos

| Gravidade | Achado | Evidência e leitura |
| --- | --- | --- |
| Nenhuma falha de alta gravidade reproduzida | Sem ramo estratégico por identidade e sem viés de nome estável | Código de decisão comum; matriz de todos os assentos e nomes; contraste Lila versus outros bots inclui zero nos dois wirings com Pessoa fixa. |
| Baixa — observação de experiência | Assento 1 relativo à pessoa perde cerca de 0,9–1,4 p.p. para assentos 2/3 na política `first-legal` | 5.000 seeds, seis rotações de nomes por seed, Pessoa fixa em 0; contrastes exploratórios pareados. Não é falha confirmada do motor, e não aparece quando Pessoa também é permutada. |
| Baixa — reprodutibilidade/isolamento | RNG padrão de efeitos compartilha `Math.random` com regras quando não há seed | Chamada cosmética pode avançar a sequência usada por embaralhamento futuro. Não demonstra vantagem por identidade nem invalida o Fisher–Yates; separar os streams reduziria acoplamento para reprodução e auditoria. |
| Esperado pela configuração | Uma pessoa enfrenta três agentes e a política de referência não espelha a preferência de cartas do bot | Pessoa teve cerca de 20,7% das vitórias sob `first-legal`, enquanto três bots dividem a maioria restante. Isso não atribui a observação do usuário à sua habilidade. |

Não há um cenário mínimo de bug confirmado a relatar. O cenário mínimo para reproduzir a **observação posicional** é uma sessão de treino com Pessoa no assento 0, três bots de política comum, política `first-legal`, seis permutações de nomes e o runner do relatório; o resultado é agregado de 5.000 seeds por wiring, não uma falha determinística de uma única partida.

Próximo passo recomendado: manter este resultado como diagnóstico e, se a paridade visual entre bots for desejada no produto, pedir validação do orquestrador para uma experiência de rotação aleatória dos assentos dos bots por rodada ou por sessão, preservando cada identidade/placar. Em separado, decidir se o servidor deve isolar RNG cosmético de regras no caminho sem seed e adicionar verificação de regressão. Nenhuma dessas mudanças foi implementada nesta investigação.

## Verificação, limitações e alterações locais

Comandos executados a partir da raiz do repositório (Node `v22.23.1`):

```sh
rtk proxy pnpm --filter @tretta/server exec tsx ../../docs/work/reports/assets/T015-investigation/simulate.ts --quick > /tmp/t015-quick-stats-fixed.json
rtk proxy pnpm --filter @tretta/server exec tsx ../../docs/work/reports/assets/T015-investigation/simulate.ts > docs/work/reports/assets/T015-investigation/simulation-results.json
rtk proxy pnpm --filter @tretta/rules build
rtk proxy pnpm --filter @tretta/protocol build
```

O runner importa `packages/rules/dist/index.js`; o código server resolve `@tretta/rules` pelo mesmo `dist` exportado pelo pacote. Depois da simulação, compilei rules e protocol a partir das fontes atuais. Comparei manifestos SHA-256 de cada arquivo `dist` antes e depois da compilação: os conteúdos ficaram idênticos, então a amostra usou os artefatos gerados pelas fontes atuais. Os manifestos estão em [before-build](assets/T015-investigation/packages-dist-before-build.sha256) e [after-build](assets/T015-investigation/packages-dist-after-build.sha256).

O quick smoke confirmou a integração e o cálculo dos intervalos negativos. A execução completa terminou sem erro. O runner verifica uma vitória no histórico por rodada, total 13 no placar de cada sessão de continuidade, identidade e assento do vencedor, e se o callback agendado realmente executou cada vez que um bot estava ativo. Uma tentativa anterior de invocar o pacote a partir de `apps/server` usou o Node `16.13.2` do PATH daquele diretório e o pnpm recusou a versão; a execução válida foi repetida da raiz com Node `22.23.1`.

Limites desta evidência:

- Não há histórico público de milhares de partidas reais e a captura fornecida é apenas uma sessão. Não foram modeladas decisões humanas observadas.
- O runner não exercita o transporte Socket.IO, React, renderização, latências reais ou navegador. O motor, comandos, agendador do servidor e contagem de treino são os reais; o relógio apenas elimina a espera de 700 ms.
- Mulberry32 é a fonte seeded de controle, não `Math.random` da produção; `separate-streams` é comparação diagnóstica. A sequência de chamadas do motor e dos efeitos segue a integração real do `RoomStore`.
- Os ICs por seed/sessão são aproximações normais em clusters, sem correção de múltiplas comparações. Os resultados posicionais se condicionam à política de referência e à pessoa sempre no assento 0.
- O snapshot de configuração de produção citado é de 18/10/2026; não houve leitura de configuração remota atual.

Os únicos arquivos criados para T015 foram este relatório, [`simulate.ts`](assets/T015-investigation/simulate.ts) e [`simulation-results.json`](assets/T015-investigation/simulation-results.json). Nenhuma fonte do jogo, regra, deploy, status ou plano foi modificada por esta investigação; arquivos preexistentes do usuário foram preservados. Não foram criados commits nem efetuado push.

### Critérios de aceite

1. **Caminho de treino até placar:** documentado acima com arquivos e linhas de criação, distribuição, agendamento, decisão, settlement e snapshot.
2. **Aleatoriedade e shuffle:** revisados na implementação e diferenciados entre produção, efeitos, stream seeded de simulação e wiring de comparação.
3. **Amostra reprodutível com motor real:** script, seeds, políticas, permutações, assentos, intervalos, placar contínuo e resultados entregues nos artefatos; 512.000 partidas na amostra final.
4. **Padrão da captura e hipóteses:** frequência de vitórias extremas quantificada; observação posicional separada de identidade e de diferença estratégica esperada; nenhuma inferência baseada apenas no placar agregado.
5. **Gravidade e recomendação:** achados graduados e próximos passos recomendados sem correção do produto.
6. **Comandos, verificação, limites e alterações:** registrados nesta seção; histórico e plano/status preexistentes preservados.
