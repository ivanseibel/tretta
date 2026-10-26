# Provocações pelo avatar e reações

**Substituído em 25/10/2026** por [mesa-e-reacoes.md](mesa-e-reacoes.md): as provocações com alvo saíram do produto e as reações individuais passaram a ser 12. Documento preservado como histórico.

**Escopo confirmado pelo usuário em 18/10/2026**, após entrevista com `grill-with-docs` (`grilling` e `domain-modeling`). O usuário aceitou as rodadas Q1–Q3, Q4–Q7, Q8–Q11 e Q12–Q15 com “Aceito” e Q16–Q19 com “sim”; confirmou o conjunto com “Confirmo, prontos para iniciarmos a execução através dos agentes executores, vamos de execução manual.” Execução dos agentes permanece manual, conforme o [protocolo](../../.agents/skills/orchestrate-work/SKILL.md).

## Objetivo

Permitir provocar pela mesa de jogadores, responder a provocações com facilidade e expressar reações sem destinatário, reduzindo rolagem e seleção repetida de alvo.

## Decisões aceitas

- **Q1 — Intenção:** distinguir [provocação, reação e resposta](../../CONTEXT.md). Manter as quatro provocações direcionadas atuais, incluindo risadas e choro; os textos devem deixar clara a diferença para expressar a própria emoção.
- **Q2 — Responder:** abrir opções com a pessoa que provocou já selecionada. Quem responde escolhe o tipo; o envio é uma nova provocação, sem vínculo de conversa com o evento anterior.
- **Q3 — Avatar adversário:** tocar no avatar abre opções com o nome do alvo; tocar numa opção envia imediatamente. Tocar fora fecha sem enviar. Preservar a consulta de detalhes pelo nome, incluindo apelidos longos.
- **Q4 — Acesso às reações:** tocar no próprio avatar abre as reações; tocar numa opção envia. Opções identificadas por texto e emoji.
- **Q5 — Catálogo inicial:** 😂 Rindo, 😭 Chorando e 😡 Bravo. Bravo expressa frustração brincalhona de quem envia, sem acusar outro participante.
- **Q6 — Apresentação das reações:** expressão breve junto ao avatar de quem enviou, visível para toda a sala, incluindo quem aguarda a próxima rodada, preservando a leitura das cartas.
- **Q7 — Acesso para responder:** aviso compacto próximo à mesa, separado da animação, com “Ana provocou você · Responder”, disponível por 30 segundos para quem recebeu. Abre opções com o emissor selecionado. Depois que o aviso some, o avatar continua permitindo provocar.
- **Q8 — Disponibilidade:** provocações e reações disponíveis na preparação, em qualquer vez, na pausa e nos resultados, incluindo pessoas que aguardam a próxima rodada, enquanto houver conexão com a sala. Quem está fora do circuito tem um botão “Reagir” junto à própria identificação; sua reação aparece junto à identificação correspondente para os demais.
- **Q9 — Bots e ausentes:** permitir provocar bots de treino e assentos controlados por substitutos, preservando a identidade do assento. Bots e substitutos não enviam provocações, respostas ou reações automaticamente. Desabilitar envio a alguém desconectado e sem substituto ativo, com explicação.
- **Q10 — Limites:** manter 15 segundos entre provocações de cada emissor e máximo compartilhado de três por minuto por alvo, incluindo respostas. Reações têm intervalo independente de cinco segundos por emissor, sem consumir cota de provocações. Mostrar quanto falta para novo envio.
- **Q11 — Preferências e áudio:** oferecer “Ocultar reações” separadamente da ocultação de provocações. Ocultar provocações também esconde o aviso de resposta. Reações seguem os modos de animação; no modo desligado, emoji e texto estáticos por um período breve. Reações sem som neste recorte; preservar o áudio atual das provocações.
- **Q12 — Painel inferior:** manter o formulário atual recolhido em “Mais opções de provocação”, como alternativa aos avatares, obedecendo aos mesmos limites e regras de disponibilidade.
- **Q13 — Duração e simultaneidade:** cada reação dura quatro segundos em todos os modos de animação. Pessoas diferentes podem reagir simultaneamente junto às respectivas identificações; uma nova reação da mesma pessoa substitui a anterior. Sem histórico e sem entrar na fila de efeitos centrais.
- **Q14 — Aviso mais recente:** mostrar apenas a provocação recebida mais recente, com 30 segundos contados da chegada, sem aguardar a animação central. A chegada de outro aviso nunca troca o alvo de um menu já aberto.
- **Q15 — Saída ou ausência do emissor:** se a pessoa sair da sala, encerrar o aviso e impedir envio pelo menu aberto, explicando a saída. Se apenas desconectar, desabilitar envio enquanto ausente sem substituto ativo. Pessoas com apelidos iguais continuam sendo destinatários distintos.
- **Q16 — Fechamento e acessibilidade:** um menu aberto por vez, com opções legíveis por toque e teclado. Escape fecha e devolve o foco ao controle de origem. Tocar fora apenas fecha, sem acionar uma carta por baixo. O aviso de resposta não desaparece enquanto estiver com foco; um menu já aberto não expira junto com os 30 segundos do aviso.
- **Q17 — Envio e falhas:** fechar o menu após a confirmação do envio e mostrar feedback breve. Enquanto aguarda confirmação, impedir envios repetidos. Em caso de recusa, manter a escolha e explicar o motivo, desde que a conexão e o destinatário continuem válidos. Nenhum envio fica programado para acontecer automaticamente depois.
- **Q18 — Mudança de fase e recuperação:** fechar menus nas mudanças de fase; preservar reações e avisos até o prazo normal na pausa, nos resultados e na volta à preparação. Nova rodada, saída da sala, perda de conexão e reload limpam esses elementos temporários, sem reapresentá-los ao retornar. Limites de envio continuam valendo.
- **Q19 — Ocultar e restaurar reações:** reações visíveis por padrão, com escolha de ocultar salva no navegador. Ocultar remove imediatamente as apresentações locais, inclusive as próprias; reativar mostra somente novas reações. O envio continua disponível com confirmação textual. Movimento reduzido do sistema limita as animações como já ocorre no jogo.

## Critérios observáveis para a entrega

| Critério | Resultado a verificar |
| --- | --- |
| C1 — Acesso contextual | Provocar pelo avatar em dois toques, com alvo visível e correto, inclusive com apelidos iguais. Próprio avatar abre reações; consulta do nome e alternativa recolhida disponíveis (Q1, Q3, Q4, Q12). |
| C2 — Reações | Três opções compartilhadas com toda a sala; quatro segundos, simultaneidade entre pessoas, substituição da própria reação e identificação fora do circuito conforme definido (Q5, Q6, Q8, Q13). |
| C3 — Resposta | Aviso de quem recebeu, mais recente, janela de 30 segundos e proteção do foco; alvo estável no menu, inclusive se chega outra provocação. Saída/desconexão do emissor não redireciona nem permite envio inválido (Q2, Q7, Q14–Q16). |
| C4 — Participação e limites | Preparação, jogo, pausa e resultados; pessoas que aguardam, treino, bots e substitutos com disponibilidade correta. Limites de provocação/resposta e reação independentes conforme definido, inclusive após reload (Q8–Q10, Q18). |
| C5 — Preferências | Padrão visível, persistência e ocultação local imediata, sem replay ao reativar; animações e movimento reduzido respeitados. Reações silenciosas; áudio vigente das provocações preservado (Q11, Q19). |
| C6 — Envio e ciclo de vida | Feedback e prevenção de repetição enquanto envia; recusas explicadas e ausência de envio adiado. Mudanças de fase e recuperação preservam ou limpam os elementos nos casos definidos (Q16–Q18). |
| C7 — Uso e regressão | Toque e teclado, foco e avisos acessíveis; 320/390 px e desktop, mesa de oito assentos, treino e mesa pública. Cartas, nomes longos, vez, sentido, mãos privadas, chat e recuperação permanecem utilizáveis e corretos. |

Os critérios foram definidos na entrevista com documentos e código. A verificação da implementação e seus limites estão no [aceite local final](../work/reports/T014B.final-validation.md); não houve teste em aparelho físico.

## Escopo e continuidade

O recorte reúne provocações pelo avatar, resposta rápida, reações sem destinatário e painel alternativo. Preservar o visual de mesa aconchegante, circuito aceito, regras das cartas, estratégia dos bots, chat, privacidade das mãos e recuperação. Entradas históricas de pessoas que saíram não são destinatários atuais, conforme o comportamento vigente.

Histórico de reações, conversas vinculadas a provocações, humor automático dos bots, novas regras de cartas e correção de áudio no iPhone ficam fora deste recorte. O [Clássico aprovado](first-version.md) permanece como referência das regras; este documento detalha a ampliação do humor e seus acessos.

Primeiro incremento: [T014A — protocolo e servidor](../work/T014A.md), executada manualmente e [aceita A1–A8](../work/reports/T014A.validation.md) em 18/10/2026. [T014B](../work/T014B.md) e ajustes executados e [aceitos localmente B1–B10/U1–U3](../work/reports/T014B.final-validation.md) em 18/10/2026; C1–C7 atendidos com T014A. [Publicação T014 executada manualmente e aceita P1–P5](../work/reports/T014-publication.validation.md) em 18/10/2026, após autorização específica e janela confirmada. Nenhum ajuste de implementação ou publicação pendente; versão pública atual T014. Próximo passo: uso humano e feedback no celular/som. As regras de produto acima permanecem aprovadas. Preferência de executor: `gpt-6-luna`, reasoning `max`. Hospedagem permanece gratuita; o aceite não autoriza novos pushes/reinícios.

## Referências vigentes

- [Primeira versão](first-version.md): provocações atuais, limites e preferências.
- [Ordem das jogadas](ordem-das-jogadas.md): circuito de assentos aceito e consulta de nomes.
- Handoff lido: `/var/folders/r_/xrvhskhx45l6n66k99kzs61r0000gn/T/tretta-handoff-provocacoes-f36e8gl6/handoff-provocacoes-e-reacoes.md`.
