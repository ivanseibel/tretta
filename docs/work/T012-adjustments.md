# Prompt manual — Ajustes de T012

**Estado: executada e aceita localmente após ajustes**, conforme [validação final do orquestrador](reports/T012.final-validation.md) de 17/10/2026. Publicação posterior. Preferência `gpt-6-luna`, reasoning `max`. Contrato original abaixo preservado.

## Papel, tarefa e fontes

Você é o executor manual dos ajustes de **T012** no repositório `/Users/ivanseibel/dev/personal/tretta`. A implementação foi revisada e **requer ajustes**. Trabalhe sem subagentes e entregue um report para nova validação; publicação permanece posterior.

Leia `AGENTS.md`, `.agents/skills/orchestrate-work/SKILL.md`, `apps/web/AGENTS.md`, estado/plano atuais e `docs/product/ordem-das-jogadas.md`. Leia o contrato original `docs/work/T012.md`, o report `docs/work/reports/T012.md` e principalmente **`docs/work/reports/T012.validation.md`**, que contém o diagnóstico e os links das evidências A1–A3.

Use `coding-guidelines`, `interface-design`, práticas React e `writing-for-agents` quando aplicável. Siga a documentação Next local, Context7 quando precisar de docs e browser-harness para inspeção interativa; mantenha os testes reproduzíveis no harness do projeto. A permissão do navegador não é pré-requisito para os E2E locais já disponíveis. Preserve todas as alterações/documentos/evidências preexistentes do working tree.

## Entregas e critérios de aceite dos ajustes

### A1 — Leitura e conteúdo dos assentos no celular

Em 320/390 px, os badges atuais usam 8 px, contagens 9,28 px e nomes 10,88 px. Na prova de oito clientes, “desconectado” ocupa 67,09 px dentro de um chip de 54,39 px. Nomes longos com o mesmo prefixo ficam indistinguíveis, acessíveis integralmente apenas pelo `title` de um `span`.

- Reorganize a apresentação para leitura compatível com os textos auxiliares existentes da mesa. Resolva espaço por dimensões/reflow, mantendo o circuito e permitindo rolagem vertical. Evite a solução de reduzir ainda mais os textos necessários.
- Faça os conteúdos/badges caberem sem cobrir setas ou outros assentos, incluindo “Você”, “na vez”, “bot”, “desconectado” e “substituto”, em combinações reais.
- Apresente nomes completos ou ofereça uma consulta simples por toque e teclado quando truncados; preserve foco e identidade por id. `title` sozinho não satisfaz a consulta no celular.
- Verifique quatro e oito assentos em 320/390 px, tablet e desktop; inclua nomes com prefixos iguais, pessoa na vez, pausa e substituto. Inspecione capturas no tamanho real. Testes devem medir conteúdo/badges, além das caixas externas e largura da página; registre as medidas de fonte escolhidas. Preserve mão, ações e circuito estável.

Forma e medidas são decisões locais. Não substituir o circuito por lista parcial ou criar outra identidade visual.

### A2 — Alternativa textual do percurso invertido

`SeatCircuit.tsx` forma `orderText` sempre a partir de `seats` em ordem horária. Depois de Inversão, mantém “Você (Ana), Bia, Cai, Davi” e apenas troca a palavra de sentido. O percurso invertido a partir de Ana é Ana → Davi → Cai → Bia.

- Faça o resumo acessível descrever explicitamente o percurso dos assentos **no sentido vigente**, com retorno à referência, sem prever os turnos após efeitos de cartas.
- Preserve posições visuais, referência da própria pessoa na base e referência estável do público. A lista visual não precisa mudar de posição para mudar o resumo.
- Acrescente testes determinísticos para os dois sentidos, inversões consecutivas, mesa pública e pessoa fora do primeiro índice projetado, incluindo uma atualização por snapshot. Confira a semântica resultante sem depender de nomes na ordem do DOM visual; mantenha atualização passiva sem roubar foco ou repetir eventos.

A prova suplementar do orquestrador está em `docs/work/reports/assets/T012-validation/t012-review.spec.ts`. Para reproduzir, copie-a para `apps/web/e2e/` **da cópia isolada** e adapte apenas o destino das evidências. Ela testa os sintomas A1/A2; acrescente cobertura permanente adequada e não altere o esperado apenas para aceitar o comportamento atual.

### A3 — Diagnóstico e prova de rodada com oito clientes

O T007 de oito clientes falhou novamente em `waitForTurnChange` (15 s), sendo o primeiro teste da sessão do orquestrador. A mesma cópia com `globals.css`, `GameTable.tsx` e `WaitingRoom.tsx` anteriores, de HEAD `3ae459e`, passou. Isso não estabelece a causa, mas invalida atribuir a falha somente a uma sessão longa. Consulte os logs duráveis da validação.

- Capture, no ponto da falha, a seleção/ação enviada, confirmação ou erro, turno e pausa/recuperação dos clientes, com informação sanitizada. Determine se a ação se completou e se a condição de espera corresponde ao estado real.
- Corrija a interação/regressão da UI ou a sincronização do teste, conforme a causa demonstrada. Preserve a prova de rodada completa com oito clientes, recuperação e mesmo resultado. Não basta aumentar timeout, adicionar retry, remover asserções ou repetir até passar.
- Compare a versão anterior quando necessário. Se for comprovadamente um problema anterior independente da T012, entregue reprodução/evidência e o limite sem alterar regras/servidor; o orquestrador decidirá sobre tratamento separado. Se a solução exigir mudança de motor, servidor, protocolo ou produto, retorne com o diagnóstico antes de ampliar o escopo.
- Reexecute o cenário isolado e junto aos E2E relevantes, registrando todas as tentativas e falhas, não só a passagem final.

## Verificação, limites e retorno

Os critérios C1–C7 do contrato original continuam válidos; C2/C4 e a lógica central passaram na revisão. Preserve a geometria cíclica correta, vez autoritativa, regra de dois jogadores, privacidade, treino, público e recuperação. A semente controlada é aceitável; o circuito sem animação própria não precisa ganhar animações novas. Confira modo desligado/reduzido e preferência do sistema sobre o resultado dos ajustes.

Use cópia física isolada do working tree completo, dependências/processos próprios, Node/pnpm do projeto e `rtk`. Compile os pacotes internos antes dos testes web em cópia limpa. Faça build/tipos e unitários web completos, E2E T012 e regressões pertinentes às alterações, especialmente oito clientes e teclado/foco. Build/tipos/E2E sequenciais quando compartilham gerados. Registre fonte testada versus entregue, hashes dos históricos e liberação apenas dos processos próprios.

Novas evidências em **`docs/work/reports/assets/T012-adjustments/`**; preserve integralmente `assets/T012/`, `assets/T012-validation/` e todos os históricos. Sem commit, push, deploy, restart remoto ou uso de salas públicas. Não altere dependências/regras/servidor/protocolo sem retornar ao orquestrador.

Entregue **`docs/work/reports/T012-adjustments.md`**: resultado, arquivos alterados, evidência A1–A3 e regressões C1–C7, diagnóstico com alternativas descartadas, comandos/resultados e todas as falhas, limitações e preservação da fonte/históricos. Corrija os links documentais locais quebrados do report/plano tocados por T012. Atualize status/plano para “ajustes aguardando validação do orquestrador”. Preserve o report original e a validação como histórico.

Pare após entregar o report.
