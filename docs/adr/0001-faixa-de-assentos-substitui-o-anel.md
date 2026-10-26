# Faixa de assentos substitui o anel

Status: aceita em 25/10/2026.

O anel de assentos aprovado em [ordem-das-jogadas.md](../product/ordem-das-jogadas.md) custa 464px de altura no desktop e 512–544px no celular — até 60% de um Moto G9 Plus. Com mão em duas fileiras, centro, cabeçalho e ações, a mesa passa de 1.100px para uma tela de 915px. O anel também concentra os menores textos do produto: legenda de 13,6px e setas de 15px. Decidimos substituí-lo por uma faixa de assentos em uma ou duas fileiras, em serpente, com posições fixas e setas que viram quando o sentido da rodada inverte.

## Consequências

O conceito de circuito aprovado em T012 deixa de existir como desenho. A ordem dos assentos e o sentido da rodada continuam explícitos por texto, setas e adjacência entre células. A faixa é o único layout em todos os tamanhos, o que reduz a superfície de teste e permite aumentar todo o texto funcional. O sentido passa a ser indicado por setas entre assentos e pelo bloco do cabeçalho, não por uma forma circular.

## Alternativas descartadas

- **Anel só no desktop, faixa no celular:** preservaria o circuito onde ele cabe, ao custo de dois layouts e dois conjuntos de teste; no desktop o anel ainda estoura a altura disponível.
- **Anel à esquerda e mão à direita:** usa a largura, mas mantém os textos pequenos do anel e é o desenho mais complexo dos três.
- **Faixa com uma fileira de oito assentos menores:** viola o piso de texto aprovado em [acessibilidade-visual.md](../product/acessibilidade-visual.md).
