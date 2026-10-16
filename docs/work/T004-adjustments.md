# T004 — Ajustes após validação

## Papel e objetivo

Você é o executor do Tretta, em modo manual. Corrija os cinco achados da validação de T004: preservação do placar, efeitos de transporte em replay, ack de saída, referências mantidas após expiração e invalidação de callbacks de bot. T001/T002/T003 estão aceitas; T004 requer ajustes. O usuário executa em outra sessão e leva o report ao orquestrador.

## Contexto

Leia `AGENTS.md`, `.agents/skills/orchestrate-work/SKILL.md`, `docs/product/first-version.md`, `docs/work/status.md`, `docs/work/T004.md`, `docs/work/reports/T004.md` e **`docs/work/reports/T004.validation.md`**. A validação contém causas, cenários e evidências independentes; o script em `docs/work/reports/assets/T004-validation/reproduce.mjs` imprime observações da implementação atual.

Preserve o working tree preexistente, aceites anteriores e documentos do orquestrador. Nenhum commit solicitado. Use RTK e as skills aplicáveis; use `writing-for-agents` ao editar instruções. Para mudanças em Next, cumpra também `apps/web/AGENTS.md`.

Decisões aprovadas continuam: recuperação da mesma mão até o fim da rodada; credencial removida não recupera autorização; antigo anfitrião não retoma o papel; sem pessoas, bots parados e retenção por 15 minutos; vitória automática sem ponto pessoal; nenhuma mudança de regra de produto nesta correção.

## Entregáveis e critérios de aceite

### 1. Placar independente da ocupação de vaga

Separar o histórico de vitórias da sala da lista de participantes ativos/recuperáveis. Liberar vaga por saída, remoção ou retirada de substituto no fim da rodada mantém as vitórias humanas já registradas até a sala expirar/reiniciar. Snapshot e resultados exibem esse placar histórico. Registros históricos não ocupam o limite de participantes, exigem prontidão nem concedem controles/retorno com credencial revogada. Identidades distintas com mesmo apelido permanecem distintas; não acrescentar fusão de contas/apelidos.

Demonstrar vitória humana real seguida de saída entre rodadas e de remoção; demonstrar retirada de substituto que já tinha vitórias de rodada anterior. Pontos anteriores permanecem; vitória automática/encerramento sem vencedor continuam sem ponto adicional. Nova preparação aceita participantes nas vagas liberadas e mostra placar conservado. Acrescentar evidência pela UI do placar após a saída.

### 2. Replay preserva ack sem reassociar transporte

`socket.join` em criação/entrada só pode ocorrer como efeito da execução autorizada correspondente. Replay de sucesso devolve exatamente o ack original sem reinscrever socket após saída/remoção, em outra sala ou no código de sala expirada. Nova entrada com credencial válida usa o fluxo normal autorizado.

Testar criação e entrada, saída e remoção, migração do mesmo socket para outra sala e expiração. Verificar a ausência de associação no transporte **e** que eventos posteriores da sala antiga não chegam ao socket revogado; autorização/mão privada permanecem corretas. Acks congelados, assinatura por evento e replays antigos de T003 continuam passando.

### 3. Ack original de saída mesmo depois de desfazer o vínculo

Repetir a mesma intenção de saída no mesmo socket devolve o sucesso/versão originais, sem exigir participante ainda vinculado. Uma execução nova consulta a autorização atual; assinatura divergente mantém o conflito previsto pelo protocolo. Depois de entrar em outra sala, repetir a saída antiga não remove a nova identidade nem altera a nova sala.

Adicionar regressões para resposta de saída perdida seguida de replay imediato, replay depois de entrar em outra sala e conflito entre eventos/payloads com o mesmo id. Cachear a resposta pública imutável, sem o objeto `Room` de `leaveRoom`.

### 4. Liberação de dados ao expirar com conexão ainda viva

Ao expirar uma sala após saída voluntária de todos, liberar seus dados internos, índices, registros de participantes e trabalhos agendados também quando os sockets permanecem conectados. Eliminar referências a `Room`, participantes, credenciais e estado privado nos registros retidos da conexão. Manter somente os dados mínimos de resposta pública/tombstone necessários para impedir reexecução obsoleta durante o escopo pertinente; explicar essa distinção e sua vida útil no report. Preservar registros válidos de outra sala usada pela mesma conexão e as garantias de T003, sem truncamento arbitrário por quantidade.

Teste no limite de 15 minutos com sockets vivos após saída: ausência da sala, índices e timers liberados, ausência de referências internas nos caches. Replays não recriam a sala expirada nem restauram transporte/autoridade. Repetir o ciclo com novas salas sem acumular objetos internos das expiradas. Expiração antiga não apaga uma sala recuperada.

### 5. Invalidação do agendamento do bot

Capturar a identidade/geração do timer e a versão pertinente no agendamento. Callback obsoleto deve retornar antes de alterar referência de timer, motor, versão ou emitir eventos. Revisar a ordem de `bump`/`syncBot` em todas as transições para que um agendamento novo continue válido após a própria transição. Manter as verificações de rodada, vez, controle, pausa e presença humana.

Acrescentar relógio/harness que consiga entregar um callback cancelado, simulando trabalho já enfileirado. Agendar bot → retorno humano → nova saída → entregar callback antigo sem avançar o prazo: nada muda e o timer atual continua identificado/funcional. Depois, entregar o timer atual no prazo: exatamente uma ação válida. Cobrir callbacks antigos em pausa/retomada, encerramento/nova rodada e expiração, sem duplicatas ou interferência no timer atual.

## Verificação

Criar regressões que falhem na implementação atual e passem após a correção; registrar o resultado antes/depois. O script do orquestrador é evidência histórica, não uma suíte de assertions do comportamento esperado e não deve ser modificado para esconder os achados.

Executar instalação congelada, build, suíte completa, tipos, E2E e `git diff --check` **sequencialmente**. Descobrir comandos no projeto; para tipos, usar `rtk proxy pnpm -r --if-present typecheck` após build. Registrar falhas e limitações honestamente. Nenhuma carga/publicação/hospedagem nesta tarefa; T005 permanece pendente.

## Retorno

Salvar `docs/work/reports/T004-adjustments.md` conforme o protocolo, com evidências para os cinco achados, testes antes/depois, arquivos, verificações e limitações. Explicar o histórico do placar e a limpeza/vida útil dos registros de intenção. Precisar que a transferência usa **menor `connectedSince`**, ou maior duração da conexão atual; o código anterior já seguia essa regra, embora o report original dissesse o contrário.

Atualizar `docs/work/status.md` para “T004 aguardando revalidação do orquestrador”, preservando aceites e execução manual. Preservar report original, validação, prompt e evidências do orquestrador. Parar e entregar o report para revalidação; nenhum commit solicitado e T005 não deve ser iniciada.
