# T005A — Bloquear envio até confirmar o vínculo recuperado

## Papel e objetivo

Você é o executor do Tretta em modo manual. Complete o critério de autorização do chat: transporte reconectado ainda não habilita envio enquanto a reentrada individual está pendente. A recuperação do histórico e o descarte de acks antigos já foram confirmados; preserve essas correções. T001–T004 estão aceitas; T005A aguarda este ajuste e revalidação.

## Contexto

Leia `AGENTS.md`, `.agents/skills/orchestrate-work/SKILL.md`, escopo/status/plano, `docs/work/T005A.md`, `docs/work/T005A-adjustments.md`, `docs/work/reports/T005A-adjustments.md` e **`docs/work/reports/T005A.revalidation.md`**. A revalidação contém a causa e um teste suplementar com provider/painel reais. Artefatos em `docs/work/reports/assets/T005A-revalidation/`.

Preserve o working tree, aceites, reports e documentos do orquestrador. Nenhum commit solicitado. Use RTK e as skills aplicáveis; observe `apps/web/AGENTS.md`. As decisões de produto permanecem; T005B/C continuam pendentes.

## Correção e aceite

`connect` coloca o cliente em `live` antes de o join terminar. `ChatPanel` habilita envio só por esse estado, e `sendChat` não confere autorização recuperada. Assim, com ack de join pendente, botão habilitado e chamada direta à API já emitem chat. O servidor ainda valida o vínculo; o problema é o cliente permitir a tentativa antes da confirmação.

Representar de modo explícito a disponibilidade do vínculo autorizado pertinente ao chat, ou adotar solução equivalente. Invalidar a disponibilidade ao perder a conexão/vínculo e restabelecê-la apenas após criação/entrada/reentrada confirmada. Botão e API de envio devem respeitar essa disponibilidade; proteção só visual não basta. Preservar o rascunho e dar indicação compreensível de recuperação, sem mudar regras de jogo ou limites.

Regressões determinísticas com componentes reais e transporte controlado devem confirmar:

1. Desconectar e restaurar o transporte com join pendente: texto digitado preservado, botão bloqueado, chamada direta de `sendChat` sem emissão ao socket. Nenhuma consulta prematura de histórico.
2. Join autorizado: histórico sincroniza, envio se habilita e uma mensagem válida gera exatamente uma intenção/registro, com merge idempotente de ack/broadcast.
3. Reentrada recusada, em tentativa posterior ou sem confirmação: chat não se habilita pelo simples `connect`. Saída/remoção/sala inexistente mantêm bloqueio e invalidação adequados; o vínculo válido posterior habilita somente seu próprio contexto.
4. As sete regressões anteriores permanecem verdes: intervalos de várias páginas acessíveis, acks antigos sem contaminação, flags do contexto atual preservadas, silêncio local e rascunho mantidos. Chat/leitura continuam sem tocar versão/motor/bot.

Limitar mudanças ao cliente e à cobertura necessária; escolhas concretas de estado/tipagem cabem ao executor. Não ampliar para nova autenticação de contas, mudar protocolos de acesso ou revisar controles de jogo fora do escopo.

## Verificação e retorno

Registrar teste antes/depois. O teste suplementar do orquestrador pode ser usado como referência; preserve o artefato histórico e acrescente a regressão permanente à suíte adequada. Seu runner cria/remove somente um teste temporário próprio e deve ser executado separado da suíte completa.

Executar instalação congelada, build, suíte completa, tipos, E2E e diff-check sequencialmente; tipos após build: `rtk proxy pnpm -r --if-present typecheck`. Registrar falhas e limitações honestamente. Preservar scripts/reports anteriores.

Salvar `docs/work/reports/T005A-adjustments-2.md` conforme o protocolo, com causa/correção, arquivos, regressões antes/depois e verificações. Atualizar status para “T005A aguardando revalidação final do orquestrador”, preservando modo manual e aceites. Parar e entregar o report. Nenhum commit solicitado; T005B depende do aceite.
