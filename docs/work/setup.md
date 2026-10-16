# Preparar outro computador

Clone o Tretta, abra sua pasta no agente e leia `AGENTS.md`. Para desenvolver, instale Node.js 22.12 ou superior (referência em `.nvmrc`) e use o pnpm 11.14.0 fixado em `package.json`; com Corepack ativo, ele é selecionado automaticamente. Instruções de instalação, testes e tipos estão no [README](../../README.md).

## Skills globais

Origem: https://github.com/mattpocock/skills. A instalação inicial foi feita a partir do commit `49dd158`. Para repetir as mesmas instruções em outra máquina:

```sh
git clone https://github.com/mattpocock/skills.git ~/dev/matt-pocock-skills
git -C ~/dev/matt-pocock-skills checkout 49dd158
mkdir -p ~/.agents/skills
```

Copie cada diretório abaixo para `~/.agents/skills/`, mantendo o nome final e todos os arquivos internos. Confira destinos existentes antes de copiar para preservar personalizações.

| Diretório no repo de skills | Nome instalado |
| --- | --- |
| skills/productivity/writing-for-agents | writing-for-agents |
| skills/productivity/grill-me | grill-me |
| skills/engineering/grill-with-docs | grill-with-docs |
| skills/productivity/handoff | handoff |
| skills/productivity/grilling | grilling |
| skills/engineering/domain-modeling | domain-modeling |

As duas últimas são dependências das entrevistas. As skills globais não fazem parte do Git do Tretta; o protocolo local em `.agents/skills/orchestrate-work` já acompanha o clone. Se a interface não descobrir uma skill automaticamente, leia o `SKILL.md` pelo caminho e siga suas referências.
