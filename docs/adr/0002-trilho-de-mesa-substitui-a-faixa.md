# Trilho de mesa substitui a faixa linear

Status: aceita em 25/10/2026. Substitui o [ADR 0001](0001-faixa-de-assentos-substitui-o-anel.md).

O [ADR 0001](0001-faixa-de-assentos-substitui-o-anel.md) trocou o anel por uma faixa linear para caber a mesa sem rolagem. O protótipo criado pelo usuário em [`docs/work/t016-prototype/`](../work/t016-prototype/) mostrou uma solução melhor: um **trilho contínuo em volta da mesa**, com assentos em placas e um peão ao lado de quem joga. Decidimos adotar o trilho em todas as telas e tamanhos, com 2–8 assentos distribuídos pelo perímetro e a própria pessoa na base.

## Consequências

A faixa linear deixa de existir. O trilho é a única representação da ordem e do sentido, e a leitura vem do caminho, do peão e do texto de 18px no topo. A mesa continua sem rolagem vertical em 412×915 e 360×640. A distribuição para 2–3 jogadores, que o protótipo não cobria, passa a ser um critério de aceite: dois frente a frente, três em triângulo, de quatro a oito no perímetro. O trilho exige geometria em SVG e recálculo em `ResizeObserver`, mas elimina a duplicação de layouts entre celular e desktop.

## Alternativas descartadas

- **Manter a faixa linear:** perde a metáfora de mesa e o peão, que é o que torna a passagem evidente e divertida.
- **Faixa no celular e trilho no desktop:** dois modelos mentais e dois conjuntos de teste.
- **Trilho só no desktop:** o celular é o dispositivo principal; a identidade ficaria pela metade.
