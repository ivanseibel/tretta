# Reações individuais substituem provocações com alvo

Status: aceita em 25/10/2026.

O escopo de [provocações pelo avatar e reações](../product/provocacoes-e-reacoes.md) entregou quatro provocações com alvo, resposta e três reações. O uso em família mostrou que o humor funciona melhor quando é mais simples: cada pessoa reage ao que aconteceu, sem escolher destinatário. Decidimos remover as provocações com alvo e ampliar as reações para **doze tipos**, em uma bandeja única, com apresentação central e fila curta.

## Consequências

- A UI perde `TauntPanel`, `TauntResponseNotice`, `TauntOverlay` e os menus de provocação por avatar.
- O protocolo e o servidor perdem tipos, comandos, eventos, limites e avisos de resposta de provocação; `REACTION_TYPES` passa de 3 para 12. Web e servidor sobem juntos.
- A preferência “Ocultar provocações” é removida; “Ocultar reações” permanece.
- Reações continuam individuais, públicas, silenciosas, com limite de 5s por emissor e fila de até 3.
- A ideia futura de reagir a alguém (torta, etc.) fica no backlog como desenho novo, não como restauração do modelo antigo.
- O [glossário](../../CONTEXT.md) deixa de definir provocação e resposta; reação passa a ser a expressão individual sobre a jogada.

## Alternativas descartadas

- **Manter as provocações com alvo:** contraria o pedido de simplificação e mantém dois sistemas de humor concorrentes.
- **Esconder a UI e manter o protocolo dormente:** custo de manutenção e risco de divergência entre cliente e servidor.
- **Manter as três reações atuais:** não aproveita a bandeja de doze do protótipo, que é parte da experiência aprovada.
