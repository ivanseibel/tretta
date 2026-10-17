# T009 — Validação da investigação pelo orquestrador

Data: 16/10/2026. **Diagnóstico aceito. Correção ainda não implementada.**

Contrato: [T009-investigation.md](../T009-investigation.md). [Report do executor](T009-investigation.md) e artefatos originais preservados. Próxima tarefa preparada para acionamento manual: [T010 — correção da recuperação](../T010-recovery-fix.md).

## Evidência independente

O orquestrador inspecionou os três scripts diagnósticos, seus resumos, o código cliente/servidor e a captura do erro com formulário em contexto mobile. Reexecutou o script A–F sem mudanças em uma cópia isolada já compilada, com Node 22.23.1. Os 19 arquivos de fonte do servidor/motor/protocolo comparados com o clone principal eram idênticos. A repetição abre apenas servidor/clientes locais, sem interagir com produção.

Resultado: **exit 0, sete asserções do orquestrador aprovadas**. Resumo sanitizado em [orchestrator-summary.json](assets/T009-investigation/orchestrator-summary.json).

| Controle | Resultado independente |
| --- | --- |
| Fechamento gracioso | Reconhecimento em 22 ms, recuperação com a mesma identidade |
| Conexão antiga meio aberta | Quatro recusas no burst de 1.212 ms; primeira recuperação em 45.367 ms; pausa observada em 45.003 ms |
| Identidade após liberação | Rejoin autorizado com o mesmo participante, rodada novamente playing |
| Duas conexões realmente ativas | Três recusas na segunda; primeira mantém vínculo e recebe snapshots |
| Reentrada simultânea | Um OK e um ALREADY_CONNECTED, apenas dois participantes na sala; vencedor mantém vínculo |
| Falhas definitivas básicas | CREDENTIAL_INVALID e ROOM_NOT_FOUND confirmados |
| Entrada sem credencial após recusa | Join aceito como terceiro participante, distinto do original |

A primeira tentativa de execução no sandbox foi impedida por `listen EPERM`; a repetição com permissão de abertura de sockets locais passou. A cópia usada foi `/private/tmp/tretta-t008-validation-bpp235w6`, script sob `apps/server/test/t009-orchestrator-w8pasr0l/`, permitindo resolver as dependências de teste do workspace. Para repetir em outra máquina, prepare uma cópia isolada com dependências e builds dos pacotes, copie `repro-raw.mjs` para um subdiretório de `apps/server/test`, e execute com Node 22 passando a raiz dessa cópia. O script original escreve resultados brutos em stdout; filtre respostas/identificadores antes de anexar novos artefatos.

## Parecer por critério

1. **Fluxo e vínculo:** aceito. `providers.tsx:461–508` contém o burst; `:395–406` dispara rejoin após reconnect, sem agendar nova recuperação após resultado diferente de ok. O transporte pode estar conectado sem autorização da identidade. `rooms.ts:318–345` protege o vínculo e `:386–416` libera a conexão ausente.
2. **Reprodução:** aceita, com A–F repetidos independentemente. G é um simulador do comportamento cliente, não a execução do provider React; H executa a aplicação real no navegador. O orquestrador inspecionou G/H e a captura, sem reexecutar o navegador nesta validação.
3. **Linha do tempo:** aceita com ressalva de medição. `serverRecognizedMs` no script B é amostragem do estado pelo loop, podendo ocorrer depois do callback real; a pausa observada fornece evidência adicional. Não interpretar 45.364 ms como instante exato do callback.
4. **Matriz e controles:** suficiente para diagnosticar o mecanismo. Emulação não comprova suspensão real do aparelho. O controle E testa códigos de sala inexistente/credencial inválida; não reproduz individualmente expiração por timer, remoção e saída voluntária. Essas variantes ficam exigidas na regressão da correção. H corta todas as conexões e também aciona retenção; não prova retomada automática de uma sala com outro humano continuamente conectado.
5. **Causa e limites:** aceitos. O desencontro entre a espera curta e o reconhecimento tardio foi reproduzido sem nuvem; o plano Render não é necessário para produzir o sintoma. A causa exata do episódio no celular do usuário e sua frequência continuam sem medição.
6. **Proposta mínima:** aceita como direção, detalhada no contrato T010. Somente aumentar um contador não basta: espera visível, deadline, cancelamento, preservação da identidade e autorização do vínculo são essenciais. Não há necessidade demonstrada de mudar o protocolo ou tomar a sessão ativa de outra aba.
7. **Preservação:** nenhum código funcional foi alterado nesta validação. Comparação de 138 caminhos de apps/packages com o manifesto da fonte publicada T008 não encontrou divergências. Working tree anterior, servidor publicado e aceites preservados. Sem commit/push/deploy.

## Precisões importantes

O heartbeat padrão é `pingInterval=25.000 ms` e `pingTimeout=20.000 ms`. A documentação primária confirma que o servidor envia ping e aguarda pong dentro do timeout. O atraso contado a partir de uma queda arbitrária depende da posição no ciclo; **45 s não é duração fixa para toda perda de rede**. O proxy, cortado logo após estabelecer a conexão, reproduz um caso próximo desse limite. Documentação consultada via Context7: [Socket.IO server options](https://socket.io/docs/v4/server-options/#pinginterval).

O risco de substituir a identidade é sustentado pela combinação de três provas: formulário real no cenário H, novo participante aceito em F, e `providers.tsx:615–636` salvando a credencial do novo join na mesma chave de storage (`client.ts:56–59`). O overwrite do storage após clicar foi inferido desse caminho, não medido pelo script bruto F. **Não é destruição da mão pelo motor**: a identidade antiga pode continuar no servidor; o navegador perde seu caminho normal de retorno ao substituir a credencial. A correção deve testar esse percurso completo na UI/API cliente.

## Decisões e continuidade

Direção definida pelo orquestrador para restaurar o requisito aprovado de recuperação no mesmo navegador: espera “Retomando sua sessão…”, tentativas moderadas com deadline máximo de 60 s por ciclo, recuperação automática quando autorizada, e controles explícitos de tentar novamente/voltar ao início ao esgotar o prazo. A credencial continua preservada; outra aba viva continua protegida. Essas são escolhas de implementação da recuperação, não nova regra de participação.

[T010-recovery-fix.md](../T010-recovery-fix.md) contém critérios, cancelamento, isolamento de callbacks, cuidado com intentId novo por tentativa e regressões exigidas. Preparada, não executada. Modo manual mantido, modelo preferido `gpt-6-luna`/`max`. O usuário traz o próximo report para validação antes de qualquer publicação.
