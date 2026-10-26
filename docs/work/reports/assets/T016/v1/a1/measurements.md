# Medidas T016 — Ajustes A1

Medidas CSS do artefato final, DPR 1. A folga é distribuída entre regiões por `space-between`. A tabela inclui os gaps efetivos medidos, sem contar duas vezes o espaço distribuído. O padding inferior continua dentro da shell; não existe excedente escondido por overflow.

| Região / s02 (8 assentos, 8 cartas) | 360×640 | 412×915 | 430×932 | 1280×800 |
| --- | ---: | ---: | ---: | ---: |
| Cabeçalho | 52 | 56 | 56 | 60 |
| Faixa de assentos | 152 | 202 | 202 | 198 |
| Centro | 97 | 116 | 116 | 110 |
| Ações (sem espera visual) | 44 | 44 | 44 | 44 |
| Mão | 160.2 | 336 | 336 | 214 |
| Barra da gaveta | 52 | 52 | 52 | 52 |
| Soma dos gaps efetivos | 70.77 | 89.0 | 106.0 | 77.0 |
| Borda superior + padding vertical | 12 | 20 | 20 | 21 |
| Margem externa vertical | 0 | 0 | 0 | 24 |
| Total com espaços distribuídos | 639.97 | 915.0 | 932.0 | 800.0 |
| Folga residual sob a mão | 0 | 0 | 0 | 0 |

A linha contextual visível de 56px continua existindo quando há Comprar carta. Na vez de outra pessoa, só a linha secundária de 44px é visível; a espera permanece em anúncio acessível sem ocupar altura.

| Caso | Antes v1 | Depois A1 |
| --- | --- | --- |
| Desktop: coluna | 760px | 936px |
| Desktop: janela da mão | 440px com rolagem | 908px úteis, oito cartas de 96px + sete gaps de 14px = 866px |
| Desktop s02: espera/ações | 104px | 44px |
| Desktop s02: gap entre regiões | 4px | 19,25px |
| Desktop s01: folga sob mão / gap | 91px / 4px | 0px / 26,75px |
| 360 s01: folga sob mão / gap | 82,8px / 2px | 0px / 22,69px |
| 360 s02: folga sob mão / gap | 2,8px / 2px | 0px / 17,69px |
| 412 s02: folga sob mão / gap | 5px / 6px | 0px / 22,25px |

| Viewport | Estado | Regiões: gaps efetivos mínimo–máximo | Folga residual | Mão (largura útil/scrollWidth) |
| --- | --- | ---: | ---: | --- |
| 360×640 | s1 | 22.69–22.70 | 0 | 334/572 |
| 360×640 | s2 | 17.69–17.70 | 0 | 334/654 |
| 360×640 | s3 | 17.69–17.70 | 0 | 334/654 |
| 360×640 | s4 | 2.69–2.70 | 0 | 334/490 |
| 360×640 | s5 | 17.69–17.70 | 0 | 334/408 |
| 360×640 | s6 | 25.66–25.67 | 0 | observador |
| 360×640 | s7 | 17.69–17.70 | 0 | 334/334 |
| 360×640 | s8 | 22.69–22.70 | 0 | 334/572 |
| 360×640 | s9 | 17.69–17.70 | 0 | 334/334 |
| 360×640 | s10 | 17.69–17.70 | 0 | 334/654 |
| 412×915 | s1 | 30.25–30.25 | 0 | 376/376 |
| 412×915 | s2 | 22.25–22.25 | 0 | 376/376 |
| 412×915 | s3 | 22.25–22.25 | 0 | 376/376 |
| 412×915 | s4 | 7.25–7.25 | 0 | 376/376 |
| 412×915 | s5 | 22.25–22.25 | 0 | 376/376 |
| 412×915 | s6 | 60.17–60.19 | 0 | observador |
| 412×915 | s7 | 55.25–55.25 | 0 | 376/376 |
| 412×915 | s8 | 30.25–30.25 | 0 | 376/376 |
| 412×915 | s9 | 55.25–55.25 | 0 | 376/376 |
| 412×915 | s10 | 22.25–22.25 | 0 | 376/376 |
| 430×932 | s1 | 34.50–34.50 | 0 | 394/394 |
| 430×932 | s2 | 26.50–26.50 | 0 | 394/394 |
| 430×932 | s3 | 26.50–26.50 | 0 | 394/394 |
| 430×932 | s4 | 11.50–11.50 | 0 | 394/394 |
| 430×932 | s5 | 26.50–26.50 | 0 | 394/394 |
| 430×932 | s6 | 65.84–65.84 | 0 | observador |
| 430×932 | s7 | 59.50–59.50 | 0 | 394/394 |
| 430×932 | s8 | 34.50–34.50 | 0 | 394/394 |
| 430×932 | s9 | 59.50–59.50 | 0 | 394/394 |
| 430×932 | s10 | 26.50–26.50 | 0 | 394/394 |
| 1280×800 | s1 | 26.75–26.75 | 0 | 908/908 |
| 1280×800 | s2 | 19.25–19.25 | 0 | 908/908 |
| 1280×800 | s3 | 19.25–19.25 | 0 | 908/908 |
| 1280×800 | s4 | 4.25–4.25 | 0 | 908/908 |
| 1280×800 | s5 | 19.25–19.25 | 0 | 908/908 |
| 1280×800 | s6 | 22.84–22.84 | 0 | observador |
| 1280×800 | s7 | 19.25–19.25 | 0 | 908/908 |
| 1280×800 | s8 | 26.75–26.75 | 0 | 908/908 |
| 1280×800 | s9 | 19.25–19.25 | 0 | 908/908 |
| 1280×800 | s10 | 19.25–19.25 | 0 | 908/908 |
