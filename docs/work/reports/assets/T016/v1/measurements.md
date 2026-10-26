# Medidas do artefato T016

Valores CSS medidos por `getBoundingClientRect()` no Chrome dedicado, DPR 1. Cabeçalho + faixa + centro + ações + mão são os cinco filhos da shell. Barra da gaveta fica fora da shell, com 52px. A folga é espaço real dentro da shell; não se usa `overflow:hidden` como prova de encaixe.

| Viewport / s2 (8 assentos, 8 cartas) | 360×640 | 412×915 | 430×932 | 1280×800 |
| --- | ---: | ---: | ---: | ---: |
| Cabeçalho | 52 | 56 | 56 | 60 |
| Faixa (2 fileiras) | 152 | 202 | 202 | 198 |
| Centro | 97 | 116 | 116 | 110 |
| Ações | 104 | 104 | 104 | 104 |
| Mão | 160.2 | 336 | 336 | 214 |
| Barra da gaveta | 52 | 52 | 52 | 52 |
| Gaps entre cinco regiões | 8 | 24 | 24 | 16 |
| Borda superior + padding vertical | 12 | 20 | 20 | 21 |
| Margem externa superior/inferior | 0 | 0 | 0 | 24 |
| Soma ocupada | 637.2 | 910 | 910 | 799 |
| Folga | 2.8 | 5 | 22 | 1 |

A faixa nunca reduz 8 assentos a uma fileira. Em 360×640, mão de uma fileira horizontal; em 412×915 e 430×932, duas fileiras. Desktop de 800px de altura usa a mesma degradação da mão para preservar as cartas de 96px.

| Viewport | Estado | Folga | Fileiras de assentos | Fileiras da mão | Documento H/W |
| --- | --- | ---: | ---: | ---: | --- |
| 360×640 | s1 | 82.8 | 1 | 1 | 640/360 |
| 360×640 | s2 | 2.8 | 2 | 1 | 640/360 |
| 360×640 | s3 | 2.8 | 2 | 1 | 640/360 |
| 360×640 | s4 | 2.8 | 2 | 1 | 640/360 |
| 360×640 | s5 | 2.8 | 2 | 1 | 640/360 |
| 360×640 | s6 | 71 | 2 | 0 | 640/360 |
| 360×640 | s7 | 2.8 | 2 | 1 | 640/360 |
| 360×640 | s8 | 82.8 | 1 | 1 | 640/360 |
| 360×640 | s9 | 2.8 | 2 | 1 | 640/360 |
| 360×640 | s10 | 2.8 | 2 | 1 | 640/360 |
| 412×915 | s1 | 97 | 1 | 2 | 915/412 |
| 412×915 | s2 | 5 | 2 | 2 | 915/412 |
| 412×915 | s3 | 5 | 2 | 2 | 915/412 |
| 412×915 | s4 | 5 | 2 | 2 | 915/412 |
| 412×915 | s5 | 5 | 2 | 2 | 915/412 |
| 412×915 | s6 | 162.5 | 2 | 0 | 915/412 |
| 412×915 | s7 | 137 | 2 | 2 | 915/412 |
| 412×915 | s8 | 97 | 1 | 2 | 915/412 |
| 412×915 | s9 | 137 | 2 | 2 | 915/412 |
| 412×915 | s10 | 5 | 2 | 2 | 915/412 |
| 430×932 | s1 | 114 | 1 | 2 | 932/430 |
| 430×932 | s2 | 22 | 2 | 2 | 932/430 |
| 430×932 | s3 | 22 | 2 | 2 | 932/430 |
| 430×932 | s4 | 22 | 2 | 2 | 932/430 |
| 430×932 | s5 | 22 | 2 | 2 | 932/430 |
| 430×932 | s6 | 179.5 | 2 | 0 | 932/430 |
| 430×932 | s7 | 154 | 2 | 2 | 932/430 |
| 430×932 | s8 | 114 | 1 | 2 | 932/430 |
| 430×932 | s9 | 154 | 2 | 2 | 932/430 |
| 430×932 | s10 | 22 | 2 | 2 | 932/430 |
| 1280×800 | s1 | 91 | 1 | 1 | 800/1280 |
| 1280×800 | s2 | 1 | 2 | 1 | 800/1280 |
| 1280×800 | s3 | 1 | 2 | 1 | 800/1280 |
| 1280×800 | s4 | 1 | 2 | 1 | 800/1280 |
| 1280×800 | s5 | 1 | 2 | 1 | 800/1280 |
| 1280×800 | s6 | 56.5 | 2 | 0 | 800/1280 |
| 1280×800 | s7 | 1 | 2 | 1 | 800/1280 |
| 1280×800 | s8 | 91 | 1 | 1 | 800/1280 |
| 1280×800 | s9 | 1 | 2 | 1 | 800/1280 |
| 1280×800 | s10 | 1 | 2 | 1 | 800/1280 |
