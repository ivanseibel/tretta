# Ordem das jogadas

Escopo aprovado em 17/10/2026. Após a inspeção do código e das capturas aceitas de T011, o usuário respondeu **“Aprovado”** à recomendação de mesa em circuito e ao recorte abaixo. Implementação por executor manual, com validação do orquestrador antes da publicação.

## Objetivo

Permitir que quem joga no celular ou computador reconheça o percurso completo dos participantes, sua própria posição, quem está na vez e como uma Inversão muda esse percurso. A lista de adversários e o rótulo isolado de sentido atuais exigem deduzir uma relação espacial que a interface não mostra.

## Experiência aprovada

- Representar os **2–8 assentos da rodada em circuito**, com avatar, nome e contagem pública de cartas. A própria pessoa integra a representação e fica na base, identificada como “Você”.
- Manter posições estáveis durante a rodada: mudança de vez e Inversão alteram destaque e setas, sem trocar as pessoas de lugar. A disposição pode se adaptar à largura, preservando a ordem circular.
- Mostrar setas de percurso, direção por texto e destaque textual da vez (“Sua vez” / “Vez de…”). A compreensão permanece possível sem cor, som ou animação.
- Tornar a Inversão perceptível e manter seu resultado visível depois do efeito. Respeitar preferências existentes de animação e movimento reduzido.
- Aplicar a mesma lógica à mesa de treino e à mesa pública de quem aguarda. Observadores ficam fora do circuito; na visão pública, a orientação tem referência estável nos assentos, sem inventar uma posição para o observador.
- Preservar a representação correta em pausa e reload. A pausa não convida a jogar; a recuperação apresenta o estado recebido, sem simular uma nova Inversão.
- Manter o visual de mesa aconchegante: feltro verde, superfícies de papel creme, borda dourada, amarelo de destaque e vermelho de atenção, com tipografia e controles existentes.

## Semântica e regras preservadas

O circuito mostra **ordem dos assentos no sentido vigente**, não uma previsão garantida dos turnos seguintes. Bloqueio e compras obrigatórias podem pular pessoas; a vez atual sempre vem do estado autoritativo. Nenhum rótulo “próximo a jogar” é necessário neste recorte.

A fonte da ordem é `view.players` / `table.players`, derivada de `state.seats`, e não `room.participants`. Metadados de nome/avatar/tipo/presença são associados por id. Uma rotação para colocar a própria pessoa na base preserva a orientação do ciclo, sem espelhá-lo.

Com mais de dois assentos, Inversão troca o sentido. Com dois, funciona como Bloqueio e mantém o sentido, conforme o motor atual. Bots fixos e substitutos preservam identificação e vaga; bots de treino não aparecem como desconectados.

## Limites

Mudanças na apresentação da mesa e em seus testes. Regras, servidor, protocolo, estratégia dos bots, mãos privadas, recuperação T010/T011, sons, chat, provocações e infraestrutura permanecem com o comportamento aceito. A região de participantes pode substituir a lista atual para evitar duplicação; a mão e as ações continuam acessíveis.

Publicação é etapa posterior. Este aceite não autoriza commit, push, deploy ou restart de serviços.

## Continuidade

[T012 — mesa em circuito](../work/T012.md) e [ajustes A1–A3](../work/T012-adjustments.md) executados manualmente e **aceitos localmente** em [validação final](../work/reports/T012.final-validation.md). Sem implementação pendente. [Publicação T012](../work/T012-publication.md) autorizada pelo usuário com “Vamos” em 17/10/2026, executada manualmente e [aceita pelo orquestrador](../work/reports/T012-publication.validation.md), somente frontend. Mesa em circuito publicada em `https://tretta.vercel.app`; sem execução de T012 pendente. Servidor preservado, sem commit/push. Preferência: `gpt-6-luna`, reasoning `max`. T011 está [publicada e aceita](../work/reports/T011-publication.validation.md).

Inspeção de planejamento: código atual e capturas T011B/T011-public aceitas conferidos; a tentativa de inspeção ao vivo pelo browser-harness foi impedida pela permissão do navegador. Não houve nova partida, prova pública ou teste físico nesta definição.
