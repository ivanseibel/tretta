# Prompt manual — T010: recuperar a sessão sem perder a identidade

**Estado:** executado manualmente e aceito após ajustes em [T010.final-validation.md](reports/T010.final-validation.md). [Publicação manual](T010-publication.md) preparada, não executada. Preferência `gpt-6-luna`/`max`; não acione outros agentes. Contrato original preservado abaixo.

## Papel, objetivo e contexto

Você é o executor da correção T010. Trabalhe no repositório `/Users/ivanseibel/dev/personal/tretta`, preservando o working tree existente. Em outro clone, obtenha os arquivos novos e alterações locais de T008; HEAD sozinho não contém a versão publicada.

Leia AGENTS, `.agents/skills/orchestrate-work/SKILL.md`, instruções locais do app, `docs/work/status.md`, `plan.md`, `docs/product/first-version.md`, `docs/work/reports/T009-investigation.md` e `T009-investigation.validation.md`. A investigação está concluída; esta tarefa implementa a correção local e para para validação. Publicação será tarefa posterior.

Diagnóstico: ao perder transporte sem fechar a conexão antiga, o servidor pode continuar considerando a identidade conectada por dezenas de segundos. O cliente atual esgota quatro tentativas em aproximadamente 1,2 s e não retoma sozinho. A página mostra o formulário de entrada; um novo join sem credencial pode substituir a identidade salva e deixar a mão antiga inacessível pela interface. A proteção do servidor contra duas conexões ativas da mesma identidade deve permanecer.

Evidências reutilizáveis: `docs/work/reports/assets/T009-investigation/`. O script bruto reproduz transporte/servidor; o script de navegador observa a UI real, mas corta todas as conexões, causando também retenção da sala. O teste da correção deve isolar a queda de um jogador e manter o outro conectado.

## Comportamento definido para a correção

Estas escolhas de implementação restauram o requisito aprovado de recuperar identidade e mão no mesmo navegador; não mudam regras de participação ou autorização:

1. Ao recuperar uma identidade existente, mostrar **“Retomando sua sessão…”**, com texto breve de que pode levar alguns segundos. `ALREADY_CONNECTED` inicia/continua espera limitada; não abre o formulário de novo participante nem apaga/substitui a credencial.
2. Repetir a recuperação enquanto houver contexto válido, com cadência moderada/backoff e **prazo total máximo de 60 segundos por ciclo**. Usar deadline efetivo, não apenas contador: timeout de ack, perda de transporte e disparos concorrentes não podem tornar o ciclo infinito. Não prometer que todo celular reconhece a queda em 45 s.
3. Se a identidade ficar disponível dentro da janela, confirmar o vínculo automaticamente e recuperar a mesma pessoa/mão/fase. Não exigir reload nem clique em Entrar. O sucesso encerra timers e limpa a mensagem de espera/erro transitório.
4. Ao esgotar o prazo, mostrar mensagem neutra: a sessão ainda pode estar ativa em outra aba/dispositivo ou a conexão anterior pode estar encerrando. Oferecer **“Tentar novamente”** (novo ciclo explícito) e **“Voltar ao início”**. Preservar a credencial; não oferecer entrada automática como participante novo nem expulsar a outra conexão.
5. Sala inexistente, credencial inválida/revogada, remoção e saída voluntária continuam seguindo seus fluxos definitivos atuais. Falta de identidade permite entrada normal. Falha de transporte não deve ser confundida com credencial inválida.
6. Navegar para outra sala, voltar ao início, sair ou desmontar o contexto cancela a recuperação correspondente. Respostas e timers antigos não podem alterar loading, erro, identidade, vínculo ou estado do contexto atual.

## Escopo e cuidados de implementação

- Priorize `apps/web/app/providers.tsx`, `app/sala/[code]/page.tsx` e, se útil, um helper pequeno de recuperação. Ajuste controles/feedback apenas no necessário. Preserve visual T008, foco/teclado e preferências.
- Unifique/coalesça disparos concorrentes de recuperação da mesma sala/identidade: efeito da página, `connect` do socket e nova tentativa manual não devem criar loops sobrepostos. Proteja mudanças de sala/identidade e a conexão à qual o ack pertence. Cheque validade **depois dos awaits e antes dos efeitos colaterais**, não somente antes de enviar.
- Cada nova tentativa lógica de join precisa de `intentId` novo: o servidor memoriza recusas e reutilizar um id pode reproduzir para sempre o primeiro `ALREADY_CONNECTED`. Preserve a deduplicação existente; não reduza sua vida útil.
- Transporte conectado não confirma vínculo. Até o ack autorizado do contexto atual, bloqueie comandos da rodada, chat, provocações e controles mutáveis da sala tanto pela UI quanto pelas APIs cliente correspondentes. Um estado antigo retido na tela não autoriza envio. A própria tentativa de recuperação é a exceção necessária.
- Preserve credencial, identidade e preferências durante condição transitória. Rejoin em andamento/esgotado não deve permitir `joinRoom` sem credencial que sobrescreva a identidade daquela sala. Teste a chamada direta da API, além da ausência do formulário.
- Preserve reconexão na mesma sala, histórico do chat, proteção contra reapresentar efeitos/provocações e aviso de vez. Reconectar a mesma vez não deve gerar som duplicado.
- Servidor/protocolo/motor e configurações de hospedagem ficam preservados. Se o teste precisar encurtar heartbeat, prefira ajustar somente a instância local pelo harness. Uma opção interna de fábrica exclusivamente para teste é aceitável apenas se necessária, com defaults e configuração de produção intactos, sem env pública nem contrato de rede novo. Justifique a escolha no report.
- Não adicionar persistência, dependências, takeover de sessão ou nova regra de identidade. Uma solução que dependa dessas mudanças exige devolver a divergência ao orquestrador.

## Critérios de aceite e regressões

| Caso | Evidência esperada |
| --- | --- |
| Queda abrupta de apenas um jogador | Recusas iniciais → espera visível → recuperação automática; outro cliente permanece conectado, mesma identidade/mão/fase e rodada volta a ficar jogável |
| Janela real | Pelo menos uma reprodução controlada com heartbeat padrão e reconhecimento tardio, sem encurtar o prazo do produto para esconder o problema. Não usar `socket.disconnect()` como único substituto da queda abrupta |
| Prazo esgotado / duas abas vivas | Deadline testado com relógio controlado; tentativas param, credencial continua igual, controles de tentar novamente/voltar funcionam. Aba original segue autorizada; nenhuma tomada de mão |
| Formulário / API de nova entrada | Durante espera e após esgotar o ciclo, não há join sem credencial nem sobrescrita acidental da identidade. Entrada nova sem identidade continua funcionando |
| Disparos simultâneos | Página + reconnect + clique não multiplicam ciclos. Cada tentativa lógica usa id próprio; transporte desconectado não enfileira ações mutáveis |
| Cancelamento e ack atrasado | Cancelar/navegar/sair durante espera ou ack em voo não salva identidade nem redefine estado em outro contexto. Novo ciclo não é encerrado por callback antigo |
| Falhas definitivas | Sala expirada/reiniciada, credencial inválida/revogada e remoção encerram o fluxo corretamente, sem retries infinitos ou ressuscitar identidade |
| Regressões existentes | Reload gracioso, retorno com a própria mão, chat/autorização, provocações e aviso de vez continuam corretos. Testes do provider usam componentes reais com transporte controlado, sem copiar o algoritmo da implementação para fabricar sucesso |

Faça testes novos falharem no código anterior e passarem com a correção; registre quais comportamentos falharam. Use relógio controlado para deadline/cancelamento e navegador/servidor reais para a integração. Contexto mobile emulado não comprova suspensão de aparelho físico.

## Verificação e ambiente

Use `rtk` nos comandos, Node 22/pnpm 11.14.0 e sequência de build antes de testes que consomem `dist`. Execute instalação congelada, build, testes, tipos, E2E pertinentes e `git diff --check`. Não rode build/tipos/E2E em paralelo sobre os mesmos arquivos gerados. Preserve portas/processos já usados e capturas históricas; prefira cópia isolada para verificação completa.

Não faça commit, push, deploy, reinício Render ou alterações de plano/custo. A produção ainda tem T008 e não deve receber mudanças durante esta tarefa. Não use salas da família em testes. Artefatos novos em `docs/work/reports/assets/T010/`, com credenciais/storage bruto/mãos fora dos logs; use aliases e digests/asserts para comprovar preservação.

## Retorno e parada

Report em `docs/work/reports/T010.md`: resultado por critério, arquivos, decisões, política efetiva de deadline/cadência, falhas antes/depois, reprodução e comandos/resultados, limitações e pendências. Documente em README o comportamento final e atualize o trecho atual de status para **“T010 aguardando validação do orquestrador”**, incluindo a retomada para a próxima sessão. Preserve reports originais. Pare após entregar; não avance para publicação.
