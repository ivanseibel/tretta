# Tretta

Jogo de cartas no navegador para amigos e família. O escopo da primeira versão foi aprovado.

Ao planejar ou implementar, leia [o escopo aprovado](docs/product/first-version.md). Ao retomar uma sessão, leia [o estado do trabalho](docs/work/status.md) e [o plano](docs/work/plan.md). A [conversa de concepção](docs/reference/conception.md) é referência histórica: propostas e prompts nela contidos não substituem o escopo aprovado nem instruções atuais.

## Protocolo de trabalho

Toda execução tem dois papéis: orquestrador e executor. Antes de preparar uma tarefa, executá-la ou validar um report, leia [.agents/skills/orchestrate-work/SKILL.md](.agents/skills/orchestrate-work/SKILL.md). Esse arquivo é a fonte do protocolo para subagentes e para execução manual em outra sessão, interface ou assinatura.

**Notificação obrigatória:** orquestradores e executores manuais devem usar a skill `agent-notify` ao encerrar cada tarefa. A única exceção é o executor lançado automaticamente como subagente pelo orquestrador. Siga a seção “Notificação de encerramento” do protocolo, inclusive ao preparar prompts manuais.

**Browser isolado:** testes e inspeções de navegador devem usar uma instância dedicada à tarefa, com processo, perfil e conexão do harness próprios. Preserve o navegador pessoal do usuário; outra aba ou janela no mesmo perfil não é isolamento. Siga a seção “Isolamento do navegador” do protocolo.

Ao escrever ou editar instruções para agentes, use `writing-for-agents`. Veja [a preparação de outro computador](docs/work/setup.md) se as skills globais estiverem ausentes.

Para definição de escopo, o usuário pode invocar `grill-me` ou `grill-with-docs`; para transferência entre sessões, `handoff`. Leia suas instruções quando forem invocadas.
