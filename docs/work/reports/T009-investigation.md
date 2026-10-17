# T009 — investigação da recusa de reentrada (report do executor)

**Resultado: concluída (diagnóstico com causa comprovada localmente; correção não implementada, conforme o contrato).**

- Data: 16/10/2026.
- Papel: executor de investigação T009, sessão independente, conforme `docs/work/T009-investigation.md`.
- Fonte: working tree local do repositório `/Users/ivanseibel/dev/personal/tretta` (inclui as alterações de T008 não commitadas — o mesmo conteúdo publicado).
- Nada foi implementado, commitado, empurrado ou publicado; nenhum serviço externo (Vercel/Render) foi tocado; o site público permanece como estava.

## 1. Resultado em uma frase

A recusa “Esta identidade já está conectada em outra aba ou dispositivo” acontece porque, após queda abrupta de transporte (celular suspenso/trocando de rede), o **socket antigo continua meio aberto no servidor por até ~45 s** (janela = `pingInterval` 25 s + `pingTimeout` 20 s, padrões do Engine.IO), enquanto o **cliente tenta a reentrada apenas 4× em ~1,2 s e desiste sem nova tentativa automática**. A sala fica `paused` até que o jogador atualize de novo manualmente. A proteção contra duas abas vivas está correta e foi preservada; o E2E local passa porque reload/desconexão de teste fecham o socket graciosamente (reconhecimento em ~21 ms local), o que não cobre o caminho meio aberto.

## 2. Diagnóstico e confiança

### Causa comprovada (reproduzida localmente)

1. **Janela de reconhecimento do servidor**: o servidor cria o `Server` do Socket.IO sem configurar keepalive (`apps/server/src/server.ts` linhas 34–39), então valem os padrões do Engine.IO: `pingInterval` 25 s e `pingTimeout` 20 s. Se o cliente some sem FIN/RST (suspensão de app, troca de rede, blackout), o servidor só reconhece a queda quando o ping timeout expira — medido localmente entre 45,0 s e 45,3 s após o último tráfego (cenários B e G).
2. **Desistência do cliente**: `rejoinInternal` (`apps/web/app/providers.tsx` linhas 461–509) tenta `client:joinRoom` 4× com espera de 400 ms e, no 4º `ALREADY_CONNECTED`, define o erro “Esta identidade já está conectada em outra aba ou dispositivo.” e retorna `'already'` sem nenhum retry posterior (linhas 485–502). Burst medido: 4 recusas em 1,21 s.
3. **Enquanto o socket antigo não expira**, o servidor mantém `existing.connected === true` e recusa a reentrada com `ALREADY_CONNECTED` (`apps/server/src/rooms.ts` linhas 318–325). O vínculo só é liberado em `handleDisconnect` (linhas 386–397), que roda na expiração do ping timeout.
4. **Consequência no app**: com o resultado `'already'`, a página `/sala/[code]` cai no formulário de entrada (`apps/web/app/sala/[code]/page.tsx` linhas 44–70: `result === 'already'` → `setMode('join')`). O servidor ainda considera a pessoa conectada (a rodada pausa para os demais em ~45 s). Se a pessoa preencher o formulário e clicar “Entrar”, **o servidor aceita como participante novo** (cenário F) e `saveIdentity` sobrescreve a credencial antiga no `localStorage` — perda da mão e da identidade naquela sala. Esse é o risco de produto mais grave confirmado.
5. **Sem retry automático também na reconexão de transporte** (cenário G): quando o socket.io reconecta sozinho após a queda, o app repete o fluxo 4× em ~1,2 s e para; a sala permanece `paused` e o jogador não se recupera sem nova ação manual (no caso do usuário: atualizar de novo mais tarde).

### Contribuintes

- O burst de retry (4× 400 ms) é curto demais para qualquer coisa além de jitter de rede: presumivelmente dimensionado para o caso em que o socket antigo fecha em milissegundos (que é o caso do reload gracioso e do E2E), não para a janela de 45 s.
- A UI coloca a pessoa direto no formulário de “entrar” após a recusa, sem estado intermediário de “aguardando reconexão”.
- `ALREADY_CONNECTED` tem dois significados misturados na mesma tela: “outra aba realmente ativa” (proteção legítima) e “seu socket antigo ainda não expirou” (transitório). O texto atual sugere o primeiro.

### Hipóteses verificadas e descartadas

- **“É o Render/acordar do free tier”**: descartada como causa primária. A reprodução local com servidor real e proxy de rede produz exatamente o mesmo comportamento (recusa ~45 s, retomada após reconhecimento) sem nenhum componente de nuvem.
- **“O E2E local prova que não existe problema”**: parcialmente falsa. O E2E passa porque `page.reload()`/`__trettaTest.disconnect()` fecham o socket graciosamente (FIN imediato) — o servidor reconhece em ~21 ms localmente e a 1ª tentativa de rejoin funciona. O caminho do sintoma é o **half-open** (sem FIN/RST quando o transporte morre), que o E2E não exercita.
- **“Faltam tentativas / é só aumentar retries”**: aumentar o número sem mudar a arquitetura do burst não é diagnóstico nem correção suficiente — ver proposta (seção 6); a correção precisa cobrir a janela inteira com espera visível, preservar credencial/mão e manter a proteção de duas abas.

### Pendências / hipóteses não confirmadas em aparelho físico

- A emulação mobile do navegador (viewport + touch) não reproduz suspensão real de Safari/Chrome (congelamento de processo, descarte de contexto). O mecanismo provável no aparelho físico (socket meio aberto por suspensão) foi reproduzido por proxy com blackhole; a correlação exata evento-a-evento no aparelho do usuário não foi medida.
- Não foi possível determinar a frequência real do sintoma no celular (“especialmente no celular” é relato, não medição). A janela de 45 s explica por que atualizar “duas vezes” funciona.

### Confiança

- **Alta** para o mecanismo e a lacuna cliente-servidor (comprovados com o código real, servidor real e medições repetidas em cenários independentes: B, G e navegador com contexto mobile).
- **Alta** para a proteção de duas abas continuar correta (cenários C e D).
- **Média** para a frequência relativa no celular físico (sem instrumentação no aparelho; comportamento inferido do mecanismo mais emulação).

## 3. Linha do tempo consolidada (cenário B/G, tempos medidos)

Aliases: P1 = cliente/socket antigo (Bia antes da queda), P2 = cliente novo (Bia após reload/reconexão). Todos os tempos em ms relativos ao corte de rede (t0); servidor real (dist) + proxy TCP com blackhole sem FIN/RST.

| t (ms) | Evento | Evidência |
| --- | --- | --- |
| 0 | Corte de rede (proxy para de repassar bytes; sem FIN/RST) | `proxy.blackhole` |
| ~1,2 s | P2 conecta (novo transporte) e inicia rejoin | `phone.connect` |
| 2,4–3,6 s | 4× `ALREADY_CONNECTED`; última tentativa e desistência | cenário G: 2375/2778/3181/3586 ms; cenário B: burst em 1210 ms |
| ~45,0 s | A sala pausa para o outro jogador | cenário B: pausa observada em 45 000 ms |
| ~45,1 s | Servidor reconhece a queda de P1 (`handleDisconnect` do socket antigo) | cenário G: 45 078 ms (timeline: 45 020 ms) |
| ~45,3 s | Com retry manual, 1ª tentativa de P2 tem sucesso; mesma identidade e mão | cenário B: sucesso em 45 317 ms, reconhecimento em 45 316 ms |
| — | Sem retry manual, nada acontece: sala segue `paused` | cenário G: `autoRetryAfterRefusal: 0`, `roomStatusAfter: "paused"` |

Controle de reload gracioso (cenário A): `handleDisconnect` em 21 ms; rejoin OK na 1ª tentativa (23 ms totais) — é exatamente o que o E2E local enxerga.

## 4. Evidência por critério de aceite

1. **Caminho do código explicado** — seção 2, itens 1–4 e 5; trechos: `providers.tsx` 461–509 e 697–712; `page.tsx` 44–70 e 112–120; `rooms.ts` 309–346 e 386–417; `server.ts` 34–39. Distinção transporte × vínculo: o socket.io reconecta o transporte sozinho e o cliente até conecta (`phone.connect` em 2,4 s), mas o **vínculo autorizado** continua preso ao socket antigo no servidor (`existing.connected`) até o ping timeout.
2. **Reprodução executável** — scripts e summaries em `docs/work/reports/assets/T009-investigation/` com comando e pré-condições na seção 8. Recusa reproduzida (cenários B, C, G) e recuperação reproduzida (A, B com retry manual, D, navegador). Reprodução no navegador com contexto mobile + screenshots: ver subseção 4.1.
3. **Linha do tempo correlacionando clientes/reconhecimento/decisões** — seção 3, separando medido (ms) de inferido/estimado (documentado como padrão do Engine.IO até prova local).
4. **Matriz de cenários** — seção 5, incluindo proteção de duas abas e limites emulação × aparelho físico.
5. **Diagnóstico com causas comprovadas, contribuintes e hipóteses descartadas** — seção 2; explicação do E2E local na seção 2 (contribuintes) e seção 5.
6. **Proposta mínima de correção com testes** — seção 6 (não implementada, por contrato).
7. **Estado final preservado** — seção 7: nenhum commit/push/deploy; artefatos listados; `apps/*`/`packages/*` intocados no working tree principal.

### 4.1 Reprodução no navegador (contexto mobile emulado)

Executado `repro-browser.mjs`: web app real (cópia isolada do working tree), servidor real, proxy com blackhole, Chromium com Pixel 7 emulado (viewport/touch/UA). Resultados completos em `repro-browser.summary.json`.

- **Corte** em todas as conexões existentes (sem FIN/RST); **Bia recarrega**: em **1,6 s** aparece "Esta identidade já está conectada em outra aba ou dispositivo." junto do **formulário de entrada** ("Entrar na sala …") — screenshot `bia-error-after-reload.png`. Sem mão nem credencial no artefato.
- **Sem retry automático**: aos **54,2 s** o banner de recusa ainda estava visível na tela.
- **Credencial preservada** durante a recusa (chave de identidade presente; nada sobrescrito nem limpo).
- **Recuperação**: reload após o reconhecimento do servidor recupera a sessão em **616 ms**, com a **mesma mão** (7 cartas, digest idêntico — asserção por digest, as cartas não foram publicadas).
- Pausa observada na página do anfitrião aos **48,0 s** (coerente com a janela de reconhecimento de ≈45 s).
- Nuance registrada: o corte atingiu **as duas** conexões simultaneamente; sem ninguém conectado, a sala entra em **retenção** e a pausa permanece até o anfitrião retomar (texto do próprio painel: "Ninguém está conectado…"). É comportamento projetado, não a falha investigada. O teste E2E da correção deve cortar apenas a conexão do jogador alvo para não cair nesse modo.

## 5. Matriz de cenários e controles

| # | Cenário | Resultado | Evidência |
| --- | --- | --- | --- |
| A | Reload gracioso (desktop/mobile), desconexão reconhecida rápido | **Reproduzido** — reconhecimento 21 ms; rejoin OK na 1ª tentativa; mesma identidade | `repro-raw.summary.json` `A_fechamento_gracioso`; E2E `recovery.spec.ts` |
| B | Perda abrupta de transporte (sem FIN/RST) com reconhecimento tardio | **Reproduzido** — 4 recusas em 1,21 s; reconhecimento 45,0–45,3 s; com retry manual, mesma identidade/mão e retomada | `repro-raw.summary.json` `B_queda_sem_fin`; assets de timeline |
| C | Duas abas realmente ativas com a mesma credencial | **Reproduzido (proteção OK)** — 3 recusas; aba 1 mantém posse e continua recebendo estado; após fechar a aba 1, rejoin da aba 2 funciona | `repro-raw.summary.json` `C_duas_abas_vivas` |
| D | Reentrada concorrente (duas conexões, mesma credencial, simultâneas) | **Reproduzido** — exatamente 1 `OK` e 1 `ALREADY_CONNECTED`; sem duplicação; dono é o vencedor | `repro-raw.summary.json` `D_reentrada_concorrente` |
| E | Sala expirada / credencial inválida / saída | **Reproduzido** — `CREDENTIAL_INVALID` e `ROOM_NOT_FOUND` são definitivos (sem retry no fluxo) | `repro-raw.summary.json` `E_falhas_definitivas` |
| F | “Entrar” após a recusa (formulário de entrada com identidade existente) | **Reproduzido (risco de produto)** — entrada nova aceita; participante novo difere do original; credencial sobrescrita → perda da mão | `repro-raw.summary.json` `F_entrar_apos_recusa` |
| G | Perda de transporte sem reload (reconexão automática do socket.io) | **Reproduzido** — 4 recusas (2,4–3,6 s), **0** novas tentativas depois; sala `paused` aos 45 s+ | `repro-reconnect.summary.json` |
| H | Navegador real com contexto mobile (Pixel 7 emulado) | **Reproduzido** — recusa em 1,6 s com formulário; banner ainda visível aos 54,2 s; reload pós-reconhecimento recupera em 616 ms com mesma mão | `repro-browser.summary.json` + `bia-error-after-reload.png` |
| — | Volta de aba/bloqueio de tela/queda breve de rede em aparelho físico | **Não reproduzido diretamente** — exige aparelho; mecanismo equivalente reproduzido por proxy (B/G) | Limitação declarada |

Limites explícitos: emulação mobile não congela o processo como o Safari/Chrome físico; o proxy local não simula RTT de rede celular (irrelevante para a janela do ping timeout, que é 45 s fixos); salas públicas da família não foram acessadas.

## 6. Proposta mínima de correção (não implementada — decisão do orquestrador/usuário)

Objetivo: recuperar identidade e mão no mesmo navegador após queda abrupta, sem enfraquecer a proteção contra duas abas ativas e sem retries infinitos.

1. **Espera de vínculo com retry limitado no cliente** (`apps/web/app/providers.tsx`, `rejoinInternal`): ao receber `ALREADY_CONNECTED`, tentar novamente com backoff limitado cobrindo a janela máximo do servidor (ex.: ~8 tentativas espaçadas, teto total ≈ 50–60 s), cancelável. É a mudança central.
2. **Estado/UI de espera em vez do formulário** (`apps/web/app/sala/[code]/page.tsx`): novo resultado/estado “aguardando reconexão” (spinner “Retomando sua sessão…”); **não** cair em `join` para `already`. Preserva credencial e evita o cenário F.
3. **Preservação da credencial** (`saveIdentity` só com resposta `ok`) e **cancelamento** ao sair/trocar de sala (abortar o loop quando o código muda ou desmonta — padrão de geração já existente no app).
4. **Bloqueio de ações até confirmação do vínculo**: `sendCommand` já bloqueia via `roundId` local; garantir que nenhuma tela de jogo fique interativa no estado de espera (o `checking` atual já é o análogo). Alternativa mais forte (protocolo): o servidor responde a `joinRoom` com um “probe” do socket antigo antes de recusar — só considerar se a solução de UI não for suficiente; é mudança de protocolo (decisão separada).
5. **Opcional/para testes**: expor `pingInterval`/`pingTimeout` como opções do `createTrettaServer` (defaults atuais preservados) para permitir E2E com janela curta.
6. **Testes de regressão**:
   - E2E novo com proxy blackhole local (como neste report) e timeouts encurtados: recusa inicial → espera → recuperação automática com mesma mão e rodada retomada. Cortar **apenas** a conexão do jogador alvo (cortar todas coloca a sala em retenção e exige retomada manual, conforme observado na seção 4.1).
   - E2E/unit: “Entrar” não é mais alcançável durante `already` transitório (formulário não aparece; credencial intacta).
   - Manter os testes atuais: `apps/server/test/recovery.test.ts` (recusa de duplicada, pausa) e `apps/web/e2e/recovery.spec.ts` (reload, duas abas) como regressão da proteção.

Decisão que o orquestrador precisa tomar: aceitar a mudança de comportamento de UI (espera longa com spinner em vez de erro + formulário) como correção mínima; alternativa protocol-level fica registrada mas não é necessária para cobrir o sintoma.

## 7. Alterações e artefatos

- **Nenhuma alteração funcional** em `apps/*`/`packages/*`; nenhum commit/push/deploy; nenhum serviço alterado. Working tree preexistente (T008) preservado.
- Artefatos novos (diagnósticos, fora da versão publicada), em `docs/work/reports/assets/T009-investigation/`:
  - `repro-raw.mjs` — cenários A–F em Node com servidor real + proxy blackhole.
  - `repro-raw.summary.json` — resumo sanitizado (tempos, códigos, aliases).
  - `repro-reconnect.mjs` — cenário G (reconexão automática do socket.io sem reload).
  - `repro-reconnect.summary.json` — resumo sanitizado do G.
  - `repro-browser.mjs` — cenário H (navegador real, Pixel 7 emulado).
  - `repro-browser.summary.json` — resumo sanitizado do H.
  - `bia-error-after-reload.png` — captura do sintoma em contexto mobile (banner de erro + formulário; sem mão/credencial).
- Nada de credenciais, storage bruto ou cartas foi registrado; mãos comparadas por digest.
- Estado inicial registrado: HEAD `8967e94`, working tree com as alterações de T008 (não commitadas), Node v22.23.1, pnpm 11.14.0. `.next` do clone principal preservado (o web dev rodou em cópia isolada com `node_modules` clonado por APFS clone).

## 8. Comandos e reprodução (para o orquestrador)

Pré-condições: Node 22.23.1, dependências instaladas, `apps/server/dist` compilado. Portas 3099/3150/3160 livres. Tudo roda em cópia temporária; nada toca o clone principal.

```bash
# 1. build do servidor (dist é gitignored; já estava disponível e foi regerado)
rtk pnpm --filter @tretta/server build

# 2. cenários A–F (Node + servidor real + proxy blackhole)
cd <tmp>/T009/raw && node repro-raw.mjs /caminho/para/tretta <tmp>/T009/raw
# 3. cenário G (reconexão automática sem reload)
cd <tmp>/T009/raw && node repro-reconnect.mjs /caminho/para/tretta <tmp>/T009/raw
# 4. cenário H (navegador real; cópia isolada com node_modules próprio + next dev --webpack -p 3099)
#    pré-requisitos da cópia: node_modules clonado de verdade (symlink quebra o webpack dev),
#    packages/ do workspace copiados (@tretta/protocol, @tretta/rules) e acesso via localhost
#    (o Next 16 dev bloqueia recursos cross-origin em 127.0.0.1)
cd <tmp>/T009/browser && node repro-browser.mjs /caminho/para/tretta <tmp>/T009/browser
```

Os scripts imprimem JSON sanitizado (tempos, códigos, digests). O run de navegador gera `bia-error-after-reload.png` e o JSON de saída; a mesa recuperada não é capturada para não expor a mão privada (a recuperação fica no JSON).

Resultados-chave já medidos: cenário A 21 ms/OK 1ª tentativa; cenário B 4 recusas/1,21 s, reconhecimento 45 316 ms, sucesso 45 317 ms; cenário C 3 recusas com aba 1 preservada; cenário D 1 OK/1 recusa; cenário E códigos definitivos; cenário F identidade nova aceita (perda da mão); cenário G 4 recusas, 0 retries, sala `paused`; cenário H na seção 4.1.

## 9. Limitações

- Sem aparelho físico: suspensão real de app não foi reproduzida; o mecanismo (half-open por ausência de FIN/RST) foi reproduzido por proxy com o mesmo efeito no servidor.
- O run de navegador usa Pixel 7 emulado (viewport/touch/UA), não um aparelho real.
- A frequência do sintoma em uso real não foi medida; o report explica o mecanismo e a janela temporal, não estatística.
- Não foram repetidas as suítes completas (não requisitado); não foram adicionados testes ao repositório (correção futura os trará).

## 10. Próximo passo recomendado

1. Orquestrador valida este report (pode reproduzir pelo comando da seção 8).
2. Se aceito: preparar tarefa de correção mínima (seção 6) com os testes de regressão listados; a decisão de UX (espera com spinner vs. erro+formulário) deve ser registrada no escopo antes da implementação.
3. Opcional futuro: experimento humano curto no celular (atualizar durante queda de rede e observar se a espera automática resolve) para calibrar a frequência — não bloqueia a correção.
