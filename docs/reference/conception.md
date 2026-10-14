# TRETTA — Histórico da conversa de concepção

> Transcrição organizada da conversa sobre a criação de um jogo multiplayer familiar. Inclui os requisitos, propostas, especificação e decisões. Os elementos visuais interativos e imagens das respostas originais são representados em texto.

## 1. Ideia inicial

**Usuário:** Se eu quisesse criar um app para jogar com a família, 2 a 8 jogadores, com opção de chat de texto e voz, no browser, fácil e divertido, para eu mesmo desenvolver e hospedar na Internet, que jogos você sugeriria?

**Assistente:** Propôs uma plataforma de party games acessível por navegador, sem instalação, com salas privadas e chat. Sugeriu oito jogos: telefone sem fio desenhado, agentes secretos (estilo Codenames), respostas absurdas (estilo Quiplash), desenhe e adivinhe, quem é o espião (estilo Spyfall), sintonia mental (estilo Wavelength), quiz familiar e vila dos impostores. Recomendou arquitetura modular com Next.js, React, TypeScript, Tailwind, Socket.IO, WebRTC/LiveKit, backend Node e hospedagem web. Primeira recomendação: começar com Quem é o espião? para validar o multiplayer. Perguntou sobre perfil etário, estilo e dispositivos.

## 2. Problema de visualização

**Usuário:** Enviou uma captura de tela mostrando que a resposta não aparecia corretamente.

**Assistente:** Identificou provável falha de renderização dos componentes visuais no ChatGPT para iPhone e ofereceu reenviar em texto simples.

**Usuário:** Sim.

**Assistente:** Reenviou as oito sugestões em texto e a proposta de arquitetura, reforçando a divisão em plataforma multiplayer, motor de jogo e módulos. Sugeriu quatro fases: salas, primeiro jogo, comunicação, expansão. Perguntou novamente sobre perfil de participantes e dispositivos.

## 3. Preferências da família

**Usuário:** 1: adultos, 2: minha irma, mae e cunhado gostam de jogar uno, nós jogávamos bastante jogo de tabuleiro quando éramos crianças, acho que jogo de tabuleiro e carta seria o ideal, 3: ambos

**Assistente:** Reorientou a proposta para uma mesa virtual de cartas e tabuleiro, com voz, chat e acesso por convite. Jogos sugeridos:

1. Mau-Mau / estilo UNO (2 a 8).
2. Rummikub (tradicionalmente 2 a 4).
3. Ludo (tradicionalmente 2 a 4).
4. Sequência / estilo Sequence (2 a 8).
5. General / estilo Yahtzee (2 a 8).
6. Dominó (tradicionalmente 2 a 4).
7. Rotas e destinos (inspirado em jogos de rotas).

Recomendou começar por cartas estilo UNO, General e Ludo. Descreveu lobby, avatares, mesa compartilhada, troca de jogos sem reconectar e UX adaptada para celular e computador. Alertou para não copiar nomes, artes e marcas de jogos comerciais. Perguntou se todos os jogos precisariam aceitar oito jogadores ou se cada jogo poderia ter limites próprios.

## 4. Mecânica de provocações

**Usuário:** Temos qua adicionar uma dinâmica com animaçoes engraçadas, onde um player pode provocar os outros, algumas podem ser automáticas quando você "lasca" com um usuário específico, com variaçoes para nao ficar repetitivo, e outras que você possa enviar para o grupo provocando um jogador em especial. Qual dos jogos você acha que se encaixa melhor nesse perfil de jogo?

**Assistente:** Escolheu um jogo de cartas original inspirado na dinâmica de UNO, seguido por Ludo. Identificou três categorias de animações:

### Automáticas por jogada

- Compra 4: avalanche de cartas, caminhão de cartas ou chuva de cartas sobre o avatar.
- Bloqueio: casca de banana, porta fechada ou placa de PARE.
- Contra-ataque: bumerangue, foguete retornando ou armadilha contra o atacante.

### Provocações manuais

O jogador seleciona um avatar e envia uma provocação vista por todos: tomate voador, chuva de risadas, troféu de azarado, dorminhoco ou olho gordo. São efeitos cosméticos, sem alterar as regras.

### Eventos contextuais

- Vingança: um alvo devolve posteriormente um ataque ao agressor.
- Perseguição: vários ataques consecutivos entre dois jogadores.
- Quase ganhou: jogador com uma carta recebe penalidade e volta a ter muitas cartas.
- Virada histórica: último colocado vence a rodada.

Sugeriu estatísticas de rivalidade, títulos humorísticos e duas escalas de animação: pequenas (1–2 s) e especiais (3–5 s). Tecnologia sugerida: Rive/Lottie/CSS. Propôs combinar provocações cosméticas e novas cartas de sabotagem, com modo Clássico e modo Caos.

**Usuário:** Aceito a sugestao. Quero que crie um product spec completo desse jogo, vou usar o gpt codex pra implementar ele em uma sessao nova, por isso vc vai ter que fornecer o máximo de informaçoes possível para ele entender o que desenhamos aqui

## 5. Product Specification — versão 1.0

**Assistente:** Criou a especificação a seguir. Nome inicial provisório: Mesa da Família (posteriormente substituído por TRETTA).

### 5.1 Visão e princípios

Jogo de cartas multiplayer original, para 2 a 8 adultos, acessível pelo navegador em computadores, celulares e tablets. Sala privada por link/código, sem cadastro obrigatório, sem publicidade, chat de texto e voz. Foco em humor, sabotagem, vingança, rivalidades e animações sincronizadas. Português brasileiro inicialmente, com possibilidade de internacionalização. Arquitetura extensível para futuros jogos.

### 5.2 Modos de jogo

**Clássico:** descarte de cartas por cor, número ou símbolo. Cartas de bloqueio, inversão, compra e coringa. Provocações cosméticas não alteram regras.

**Caos:** acrescenta ataques direcionados, trocas de mãos, defesas, contra-ataques e cartas especiais.

| Carta Caos | Efeito |
|---|---|
| Mira Certa | Escolhe um adversário para comprar 2 cartas |
| Troca-Troca | Troca toda a mão com outro jogador |
| Bumerangue | Reflete uma penalidade de compra ao atacante |
| Escudo | Cancela uma penalidade de compra recebida |
| Roubo Surpresa | Retira uma carta aleatória da mão de outro jogador |
| Presente de Grego | Entrega 2 cartas da própria mão a um adversário |

### 5.3 Regras formais

- 2 a 8 jogadores.
- Cada participante recebe 7 cartas.
- Embaralhamento e distribuição no servidor.
- Uma carta numérica inicia a pilha de descarte.
- Primeiro jogador e ordem inicial sorteados.
- Sentido inicial horário.
- O jogador ativo descarta uma carta válida ou compra uma. Se comprar, só pode jogar a carta recém-comprada, caso válida; também pode passar.
- Não pode jogar múltiplas cartas num turno.

**Baralho Clássico (108 cartas):** quatro cores (vermelho, azul, verde e amarelo). Para cada cor: um zero, duas de cada número 1–9, dois bloqueios, duas inversões e duas compras 2. Mais quatro coringas de cor e quatro coringas Compra 4.

**Efeitos:** Bloqueio faz o próximo perder o turno; Inversão troca a direção (com dois jogadores, funciona como bloqueio); Compra 2 obriga o próximo a comprar duas e perder o turno; Coringa escolhe cor; Coringa Compra 4 escolhe cor, obriga o próximo a comprar quatro e perder o turno. Nesta versão, Compra 4 pode ser jogada independentemente da mão e penalidades não se acumulam no modo Clássico.

**Fim da rodada:** quando alguém descarta a última carta e todos os efeitos obrigatórios são resolvidos. Pontuação: carta numérica vale o número; bloqueio/inversão/compra 2 valem 20; coringas valem 50; especiais do Caos valem 30. Formatos propostos: rodada única, melhor de três ou atingir 300 pontos.

**Última carta:** jogador com uma carta deve pressionar “Última carta!”. Outros podem denunciar a omissão antes do início da próxima jogada; denúncia válida adiciona duas cartas. Servidor decide pela ordem de recebimento dos eventos.

**Baralho Caos (124 cartas):** adiciona 4 Mira Certa, 2 Troca-Troca, 2 Bumerangue, 2 Escudo, 2 Roubo Surpresa e 4 Presente de Grego. Cartas especiais Caos contam como coringas para descarte. Mira Certa atinge qualquer adversário, exceto o próprio jogador; compra imediata de duas cartas, sem pular o próximo turno. Troca-Troca troca mãos integralmente. Bumerangue e Escudo são reações a penalidades de compra, numa janela de cinco segundos, e não admitem reação em cadeia ao mesmo ataque. Roubo Surpresa transfere uma carta aleatória escolhida pelo servidor. Presente de Grego transfere até duas cartas escolhidas pelo atacante, após descarte da carta de ação.

**Casos especiais:** reembaralhar descarte preservando carta ativa quando a pilha de compra esgotar; tratar desconexão em turno/seleção de cor/alvo; saídas, reações simultâneas, eventos duplicados, trocas que terminam rodada, empates, reentrada sem vazar informações privadas, partidas de dois jogadores e ações fora de turno. Desconectados permanecem 90 segundos; depois o servidor realiza ações automáticas conforme regras, e anfitrião pode removê-los entre rodadas. Máquina de estados explícita.

### 5.4 Animações e provocações

**Automáticas:** compra de cartas (avalanche, caminhão, chuva), bloqueio (casca de banana, porta, placa), inversão (mesa girando), ataque (foguete, torta, confete), defesa (escudo, guarda-chuva), contra-ataque (bumerangue, foguete de volta), troca de mãos (mãos gigantes), vitória (confete, dança, troféu). Idealmente três variações por evento, selecionadas no cliente com identificador compartilhado para reduzir repetições.

**Manuais:** tomate voador, torta na cara, troféu de azarado, chuva de risadas, bocejo gigante, galinha dançando, coroa de trapaceiro, choro dramático. Todos veem remetente e alvo. Cooldown de 15 segundos por emissor e no máximo três recebidas por alvo por minuto. Sem efeito mecânico.

**Contextuais:** vingança, perseguição (três ataques na rodada), quase vitória (uma carta e penalidade até quatro ou mais), virada (último no placar vence), alvo favorito e azarado da noite. Histórico leve de eventos no servidor.

**Prioridades:** baixa até 1,5 s sem bloquear; média até 2,5 s sobre a mesa; alta até 4 s em destaque. Eventos grandes não devem se sobrepor e nunca devem impedir uma jogada. Preferências: animações completas, reduzidas ou desativadas.

### 5.5 Estatísticas e rivalidades

Rastrear rodadas vencidas, cartas recebidas por penalidade, ataques aplicados/recebidos, ataques por adversário, contra-ataques, provocações, vitórias após estar em último e sequências de ataques. Prêmios: Rei das Maldades, Saco de Pancadas, Mestre da Vingança, Azarado da Noite, Campeão da Mesa.

### 5.6 Fluxos e UX

**Entrada:** criar sala ou entrar; apelido, avatar, link/código. Host configura modo, máximo de jogadores, limite de turno e formato de sessão.

**Lobby:** participantes, avatares, estado de prontidão, teste de microfone, chat e voz; host inicia com pelo menos dois.

**Mesa:** carta ativa, cor, compra, mão local, avatares e contagem de cartas dos adversários, turno, direção, cronômetro, botão Última carta, chat, voz e provocações. Cartas adversárias ocultas.

**Desktop:** mesa central e jogadores distribuídos ao redor. **Mobile:** mão local na parte inferior com rolagem horizontal, mesa compacta e chat em painel sobreposto.

**Acessibilidade:** contraste, teclado, foco, cartas distinguíveis além da cor, movimento reduzido, volumes independentes, efeitos silenciáveis e tipografia legível.

### 5.7 Comunicação

Chat de texto persistente ao longo da sessão, limite de 500 caracteres e cinco mensagens em dez segundos, histórico temporário, sem mensagens privadas no MVP.

Voz em grupo via WebRTC/LiveKit ou equivalente; microfone on/off, volume por pessoa, silenciar localmente, indicador de fala, reconexão. Permissão de microfone apenas após ação explícita. Jogo funciona sem voz; sem gravação.

### 5.8 Arquitetura

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js, React, TypeScript |
| UI | Tailwind CSS |
| Estado local | Zustand |
| Tempo real | Socket.IO |
| Backend | Node.js, TypeScript |
| Validação | Zod |
| Animações | CSS, Motion, Rive ou Lottie |
| Voz | LiveKit / WebRTC |
| Unit tests | Vitest |
| E2E | Playwright |
| Monorepo | pnpm workspaces |

```text
mesa-da-familia/
  apps/
    web/
    server/
  packages/
    game-engine/
    game-cards/
    shared/
    ui/
  assets/
    animations/
    sounds/
  docs/
    product/
    architecture/
  tests/
    e2e/
```

Ajustar nome da raiz para `tretta/` após decisão de branding.

Motor de regras independente de React e Socket.IO. Servidor autoritativo recebe intenções e valida regras, baralho, turnos, efeitos e pontuação. Projeções específicas para cada jogador ocultam cartas alheias e ordem do baralho.

**Entidades conceituais:** Room (id, code, hostPlayerId, status, settings, createdAt, expiresAt); Player (id, displayName, avatarId, connectionStatus, ready, sessionToken); GameSession (id, roomId, mode, status, currentRound, scores, statistics); Round (id, deck, discardPile, activeColor, currentPlayerId, direction, phase, pendingEffect, turnDeadline); GameEvent (id, sessionId, type, actorId, targetId, payload, timestamp, sequence); TauntEvent (id, actorId, targetId, animationId, createdAt).

### 5.9 Eventos multiplayer

Cliente → servidor: `room:create`, `room:join`, `room:ready`, `game:start`, `game:playCard`, `game:drawCard`, `game:chooseColor`, `game:chooseTarget`, `game:react`, `game:lastCard`, `game:challengeLastCard`, `taunt:send`, `chat:send`.

Servidor → cliente: `room:state`, `game:state`, `game:event`, `game:turnChanged`, `game:roundEnded`, `game:sessionEnded`, `taunt:received`, `chat:message`, `system:error`.

Comandos com identificadores únicos para deduplicação; eventos sequenciais para detectar perdas e resincronizar; protocolo versionado.

### 5.10 Segurança e privacidade

Salas privadas por convite, códigos não sequenciais, tokens imprevisíveis, validação de comandos, rate limiting, sanitização de texto, proteção de cartas privadas, controle de origem WebSocket, expiração de salas inativas, expulsão pelo host, mute local, sem gravação de áudio, sem exigência de dados reais. Estado em memória aceitável inicialmente com perda documentada após reinício do servidor.

### 5.11 Requisitos não funcionais

- 2 a 8 por sala.
- Alvo de teste inicial: 10 salas simultâneas.
- Meta de resposta percebida abaixo de 300 ms em condições normais, sem garantia.
- Reentrada em até 90 segundos.
- Chrome, Safari, Firefox e Edge atuais.
- Mobile e desktop.
- Disponibilidade best effort no MVP.
- Persistência temporária.

### 5.12 Testes

Testes unitários para distribuição, descarte, direção, bloqueio com dois jogadores, compra, reações, contra-ataques, troca de mãos, pontuação, reembaralhamento, reconexão, ações inválidas, duplicadas, fora de ordem e vazamento de informação. E2E com múltiplos navegadores. Falhas de animação não devem bloquear regras.

### 5.13 Roadmap

| Etapa | Entrega |
|---|---|
| 0 | Estrutura, arquitetura, contratos e testes |
| 1 | Motor Clássico testado sem UI |
| 2 | Salas multiplayer e sincronização |
| 3 | Interface Clássica jogável |
| 4 | Reconexão e robustez |
| 5 | Modo Caos e reações |
| 6 | Animações automáticas |
| 7 | Provocações manuais |
| 8 | Chat de texto |
| 9 | Chat de voz |
| 10 | Rivalidades e estatísticas |
| 11 | Deploy público HTTPS |
| 12 | Polimento, responsividade e acessibilidade |

Cada etapa deve ser executada e validada separadamente, aguardando autorização antes da próxima.

### 5.14 Aceite do MVP

Oito jogadores por sala, partida Clássica e Caos concluídas, cartas privadas protegidas, reconexão sem corromper jogo, texto e voz, ataques e provocações sincronizados, redução de animações, interface mobile/desktop, resultados com estatísticas e deploy público com custos documentados.

### 5.15 Decisões pendentes

Nome/identidade visual; estilo artístico; tempo por turno e expiração; persistência entre sessões; hospedagem/custos; provedor de voz; balanceamento Caos. Codex deve discutir decisões relevantes antes de implementá-las.

### 5.16 Prompt de handoff ao Codex

> Você será o arquiteto técnico e desenvolvedor principal do projeto TRETTA, uma aplicação web multiplayer original de cartas. Use este documento como fonte principal de requisitos. Analise integralmente a especificação, identifique ambiguidades, riscos e inconsistências, proponha arquitetura de alto nível e plano de implementação com etapas pequenas e verificáveis. Priorize TypeScript, Next.js, React, Tailwind, Node.js, Socket.IO, servidor autoritativo, motor independente da UI, testes, segurança, privacidade, baixo custo e extensibilidade. Não copie marcas ou artes de jogos existentes. Não implemente todo o projeto de uma vez. Primeiro apresente compreensão, arquitetura, riscos, decisões pendentes, etapas e definição de pronto. **Não escreva código ainda.** Aguarde aprovação. Em cada etapa futura, implemente apenas aquela etapa, informe arquivos alterados, execute testes, relate resultados e aguarde validação antes de continuar.

## 6. Escolha do nome

**Usuário:** Escolha um nome para o projeto, mesa da família é meio bobo

**Assistente:** Escolheu **TRETTA**. Justificativa: curto, memorável, com personalidade e ligado à proposta de provocar, sabotar, vingar-se e rir. Funciona como marca de plataforma para futuros jogos. Sugeriu **Tretta** como plataforma, **Tretta Cards** como primeiro jogo e slogan **“Amigos na vida. Rivais na mesa.”** Ressalvou que domínio e conflitos de marca ainda precisam ser verificados.

## 7. Solicitação de exportação

**Usuário:** Gere um arquivo markdown contendo toda essa conversa para eu fazer o download.

---

## Observações de fidelidade

Este arquivo preserva o conteúdo substantivo de toda a conversa e as decisões do projeto em ordem cronológica, mas **não é uma transcrição literal integral** das respostas anteriores: as respostas longas foram consolidadas, os componentes visuais não são reproduzidos e a imagem enviada pelo usuário é descrita. Para a implementação, a seção 5 é a especificação de referência, e a seção 6 substitui o nome provisório por **TRETTA**.
