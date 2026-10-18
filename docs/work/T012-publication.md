# Prompt manual — Publicar a mesa em circuito T012

**Estado: executada e aceita pelo orquestrador em 17/10/2026.** [Validação P1–P5](reports/T012-publication.validation.md), report em [reports/T012-publication.md](reports/T012-publication.md) e evidências em `reports/assets/T012-public/` e `reports/assets/T012-public-validation/`. Contrato histórico abaixo preservado; não repetir a publicação sem nova tarefa. O usuário respondeu **“Vamos”** em 17/10/2026 após o aceite local. Preferência `gpt-6-luna`, reasoning `max`. Execução manual, sem subagentes.

## Papel, autorização e contexto

Você é o executor da publicação T012 no repositório `/Users/ivanseibel/dev/personal/tretta`. Publique o **frontend aceito** na Vercel existente e entregue report para validação do orquestrador. A autorização cobre upload, build de produção, promoção do mesmo build, smoke em salas próprias e restauração do frontend anterior se houver falha. O servidor/protocolo/motor não mudaram; esta publicação **não exige commit, push ou atualização do Render**.

Leia `AGENTS.md`, `.agents/skills/orchestrate-work/SKILL.md`, status/plano, `docs/product/ordem-das-jogadas.md`, **`docs/work/reports/T012.final-validation.md`**, `docs/work/deployment-free.md` e o aceite público T011. Use `vercel:deployments-cicd`, `vercel:vercel-cli`, `browser-harness` para inspeção interativa e `writing-for-agents` para instruções. Consulte Context7 para dúvidas atuais de CLI/API; confira a ajuda instalada para opções específicas.

T012 está aceita localmente após A1–A3: circuito completo/estável, própria pessoa na base, setas/sentido e vez, nomes consultáveis por toque/teclado, percurso acessível no sentido vigente, treino/público e recuperação. A3 corrigiu a sincronização de um teste, não o jogo. Build/tipos, 145 unitários e 14 E2E independentes passaram. As provas locais não precisam ser repetidas para publicar a mesma fonte.

Use o **working tree completo aceito**, incluindo arquivos novos. HEAD `3ae459e` contém T011, não T012. Preserve todas as alterações, ignorados, reports e capturas existentes; nada de reset ou checkout que descarte a entrega.

## Alvos e preparação conferida

Reconfirme antes de qualquer mutação; não substitua recursos nem crie outro projeto:

| Alvo | Referência |
| --- | --- |
| Vercel | Projeto `tretta`, `prj_CYHWGKoqqCZEGVVXN3Tbx1nnBMw8`; time `team_4mQparNtNCNqsb95uxf2FzoD`, workspace **Seibel — Hobby** (`seibel`) |
| Configuração | Next.js, root `apps/web`, Node `22.x`, `sourceFilesOutsideRootDirectory=true`, sem integração Git |
| Domínio | `https://tretta.vercel.app` |
| Frontend anterior / rollback | T011 `dpl_fiXC5suPTF2VCW22fEVf64HZYhNP`, READY/production; `https://tretta-qj6nwkkie-seibel.vercel.app` |
| Backend somente leitura | Render `srv-db95f2u7bikc73dpndt0`, Free, `https://tretta-server.onrender.com`; referência do aceite T011: Live `dep-db9lnpm1egvs73ct80ig`, revisão `3ae459e` |

[Readback da preparação](reports/assets/T012-public-preparation/readback.json): 159 fontes iguais ao manifesto aceito, alias direto no build T011, projeto/time/Hobby/READY conferidos, fontes externas habilitadas e home HTTP 200. O primeiro healthcheck excedeu 20 s; a nova consulta respondeu HTTP 200 `{"ok":true}`. Não foi atribuída causa ao timeout. A preparação não consultou novamente a API do Render para confirmar deploy/plano; faça a leitura necessária como baseline do executor. Não houve criação de salas, publicação ou mutação remota nesta preparação.

## Execução

### 1. Conferir a fonte e os destinos

- Compare os **159 arquivos funcionais/configurações** com `docs/work/reports/assets/T012-final-validation/source-sha256.json`. Diferença funcional exige retornar ao orquestrador antes de publicar código não revisado; documentos posteriores não invalidam a implementação.
- Confira Git, projeto/time/plano e alias atual. Registre o frontend efetivamente público e confirme que o rollback T011 segue disponível. Se o domínio tiver passado a outra versão, apure a divergência antes de sobrepô-la.
- Registre o estado/deploy Render por leitura e HTTP `/healthz`. Se o serviço não responder, investigue por leituras e registre o limite; não publique apoiado num backend indisponível e não reinicie para contornar o problema.

### 2. Congelar um snapshot de upload

- Prepare diretório temporário com a fonte aceita, manifests/lockfile/workspace e pacotes locais necessários. Exclua `.git`, dependências, `dist`, `.next`, caches, `.env*`, `.vercel` preexistente, storage/credenciais, ZIPs brutos e reports/evidências não necessários ao build. Preserve os originais no repositório.
- Use o projeto/time explícitos; se necessário, crie **somente um vínculo local descartável no snapshot** para os IDs existentes. Não permita que resolução automática crie projeto ou altere alvo. A ausência de `.vercel/project.json` na árvore original não é motivo para criar recursos remotos.
- Confira os arquivos reais com `vercel deploy --dry` e gere lista/manifesto SHA-256 do upload. Registre separadamente o manifesto de fonte aceita e o manifesto de upload; `next-env.d.ts`, se gerado/necessário, deve ser identificado como tal. Env efêmera criada pelo CLI fica fora do envio e dos artefatos.
- Identifique a publicação por tarefa/digest e **base** `3ae459e` nos metadados. Não apresente o commit T011 como se contivesse T012: a proveniência da nova interface é o working tree validado + manifesto exato do snapshot.

### 3. Fazer build de produção sem alterar o domínio

- Selecione Node 22 explicitamente também no temporário; o shell fora do repo pode usar Node 16. Use pnpm 11.14.0, instalação congelada e Corepack como no projeto. Preserve `apps/web/vercel.json` e as fontes externas ao root.
- Confirme `NEXT_PUBLIC_SERVER_URL=https://tretta-server.onrender.com` e `NEXT_PUBLIC_TEST_HOOKS=0`. Preserve proteção e configuração de projeto; não altere faturamento, planos ou CORS. Nunca publique token ou variável privada em comandos/logs.
- Faça **staged production** com `vercel deploy --prod --skip-domain`, projeto/workspace explícitos. Aguarde READY e confira build/logs/versões, metadados e HTTP/bundle da URL gerada usando acesso autenticado quando necessário. O domínio principal continua T011.
- Confira os marcadores da mesa em circuito/consulta no bundle e hooks do cliente desativados. Não amplie CORS para testar o jogo no domínio temporário: a prova integrada será feita em `tretta.vercel.app` após a promoção.
- Se o staged falhar, preserve evidência e reporte; produção não precisa mudar.

### 4. Promover o mesmo build e conferir

- Promova **o staged production READY exato**, sem rebuild. Não use Preview como equivalente de produção: sua promoção pode reconstruir o build.
- Leia diretamente o alias `tretta.vercel.app` e confirme o ID/projeto do deployment servido, além de HTTP público 200. A lista embutida de aliases do deployment pode omitir o domínio principal; use leitura de alias/CLI/API apropriada.
- A CLI 57.0.0 foi conferida na preparação: `deploy --dry`, `--project`, `--prod`, `--skip-domain` e `--meta` disponíveis. `project inspect` retorna texto, não aceita `--json`; APIs podem fornecer o readback estruturado. Não use `alias inspect`, que não é subcomando válido nesse histórico do CLI.

### 5. Smoke público focado na T012

Use somente salas e identidades próprias, com clientes reais, regras normais e hooks públicos desativados:

1. Sala comum com **quatro assentos ativos**, próprios contextos de navegador, e uma pessoa observando após o início. Confira circuito completo e ordem equivalente entre perspectivas, própria pessoa na base, observador fora do circuito/sem mão, rótulos/contagens e vez coerentes. Inclua apelido longo para conferir a consulta no celular e por teclado; capture emulação 320/390 px e desktop.
2. Observe **uma Inversão real com mais de dois assentos**: jogada legal pela UI, direção/setas e percurso acessível atualizados, vez recebida do servidor, posições estáveis. Use apenas mãos dos próprios clientes autorizados e suas ações legais. Não injete baralho/semente/estado nem habilite hooks. Não é necessário reproduzir duas Inversões consecutivas, oito aparelhos ou toda a suíte local em produção. Se não conseguir observar a Inversão, reporte essa prova como pendente em vez de forçá-la.
3. Reload de um participante numa rodada ativa: mesma identidade/mão por asserts/digests, mesmo ciclo/sentido do snapshot e continuação conforme o fluxo vigente; ações somente após vínculo. Confira que a inversão antiga não reaparece como evento novo. Inclua uma mensagem de chat entre clientes próprios e persistência da preferência de aviso de vez.
4. Treino pela home: pessoa + três bots no circuito, sem falso alerta de desconexão; iniciar e realizar uma jogada, com avanço de bot. Não é necessário concluir outra rodada inteira de treino só para repetir T011.
5. Verifique erros de página/console e HTTPS/WSS. Saia das salas próprias no fim; não reinicie o servidor para limpá-las. Se a inspeção interativa pelo browser-harness continuar indisponível, registre isso e use um smoke de navegador real pelo harness do projeto, adaptado ao público sem hooks, como nos artefatos T011. Não confunda emulação com teste físico.

Logs usam aliases, contagens e asserts/digests. Capturas contêm somente informação autorizada da própria UI; sem credenciais, storage bruto, convites de terceiros ou mãos dos bots. Não entre em salas da família.

### 6. Readback final e recuperação

- Confira domínio no ID novo, READY/production, mesmo projeto/time/Hobby; backend no mesmo estado/deploy observado antes, sem escrita/reinício causado pela tarefa; HTTP/health e ausência de falha material no smoke. Uma eventual alteração externa deve ser reportada, não ocultada ou revertida por conta própria.
- Se houver regressão material após a promoção, preserve evidência e **restaure somente o frontend** ao T011 previamente conferido, verificando alias/HTTP. Rollback/atribuição do domínio ao build anterior está autorizado para recuperar esta publicação. Não reconstrua ou reinicie o backend. Registre o deployment malsucedido e a versão efetivamente pública ao terminar.

## Critérios de aceite

| ID | Prova necessária |
| --- | --- |
| P1 — Proveniência | 159 fontes aceitas conferidas, snapshot e lista/manifesto do upload identificados, digest/metadados vinculando o working tree aceito; sem dados privados ou arquivos indevidos |
| P2 — Build/domínio | Mesmo projeto Seibel Hobby, staged production READY e promoção do mesmo build; alias direto/HTTP/bundle confirmam T012 no domínio |
| P3 — Experiência | Quatro assentos e observador, consulta do nome, Inversão legal e orientação correta, leitura em celular/desktop, sem erros materiais; treino com bots coerente |
| P4 — Recuperação | Reload preserva identidade/mão e circuito/sentido, sem replay de Inversão; chat e preferência mantidos; limites registrados |
| P5 — Operação | Backend preservado, custo zero, históricos intactos, nenhum commit/push/restart, estado final/rollback inequívoco |

## Report e parada

Entregue **`docs/work/reports/T012-publication.md`**, com resultados P1–P5, IDs/URLs/projeto/time/plano, fonte/digests, lista de upload, comandos/readbacks, logs e capturas sanitizados, falhas/limites, backend antes/depois e estado final. Evidências novas em **`docs/work/reports/assets/T012-public/`**. Preserve `assets/T012/`, `T012-validation/`, `T012-adjustments/`, `T012-final-validation/` e a preparação, além dos históricos anteriores.

Atualize runbook/status/plano para **“T012 publicada, aguardando validação do orquestrador”**, ou o estado parcial/rollback real. Nada de declarar aceite. Verificações locais que gerem capturas/métricas ficam em cópia isolada; reports/status novos permanecem no working tree. **Sem commit, push, deploy/restart Render, mudanças de plano ou serviços novos.** Pare após entregar o report.

## Referências conferidas

Fluxo consultado via Context7 em documentação oficial: [deploy / skip-domain](https://vercel.com/docs/cli/deploy), [promoção](https://vercel.com/docs/cli/promote) e [rollback](https://vercel.com/docs/deployments/rollback-production-deployment). Ajuda da CLI 57.0.0 e leituras de projeto/time/alias/READY conferidas na preparação; o executor deve reconfirmar o estado antes das mutações.
