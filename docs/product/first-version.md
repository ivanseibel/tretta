# Primeira versão do Tretta

Escopo aprovado pelo usuário em 14 de outubro de 2026, após entrevista de definição da primeira versão. Detalhes locais de implementação cabem ao executor; novas decisões de produto voltam ao orquestrador e ao usuário.

## Experiência inicial

- Mesa privada acessível por link, com uma partida completa no modo Clássico.
- Animações automáticas e provocações manuais fazem parte da primeira versão para validar o humor junto com o jogo.
- Jogadores podem estar em casas diferentes, cada um usando celular ou computador.
- Chat de texto integrado. Nos primeiros testes, voz por chamada externa, como WhatsApp ou Discord; integração de voz fica para depois.
- Cartas especiais do modo Caos ficam para depois da validação da primeira experiência.

## Partidas e participação

- Rodadas independentes: vence quem terminar suas cartas. A sala mantém um placar de rodadas vencidas enquanto existir.
- O grupo pode iniciar outra rodada na mesma sala. Pontuação por cartas e campeonatos ficam para depois.
- Turnos sem cronômetro enquanto todos estiverem conectados.
- Entrada com apelido e avatar, sem cadastro.
- O anfitrião inicia com 2–8 jogadores quando todos os participantes da próxima rodada estiverem prontos.
- Quem entrar durante uma rodada aguarda no lobby e participa da seguinte.
- Decisão adicional aprovada em 15 de outubro de 2026: quem aguarda a próxima rodada pode acompanhar a mesa pública e enviar provocações, mantendo as mãos adversárias privadas. Acompanhar a mesa não concede controle de uma mão na rodada atual; o chat continua disponível para toda a sala.

## Desconexão e saída

- Uma desconexão pausa a rodada por até 90 segundos. O jogador pode retornar com a mesma mão.
- Após esse prazo, o anfitrião pode continuar com um substituto automático ou encerrar a rodada sem vencedor.
- O substituto automático faz jogadas válidas simples até o jogador retornar.
- Quem sair voluntariamente durante uma rodada é substituído automaticamente, mantendo sua vaga disponível para retornar. O substituto sai ao terminar a rodada; novas pessoas participam da rodada seguinte.
- Quando o anfitrião sair ou desconectar, seu papel passa ao participante conectado há mais tempo.
- O retorno do anfitrião anterior não reverte a transferência: o anfitrião atual mantém o papel.
- Quando todos saírem, a sala permanece disponível por 15 minutos para retorno e depois expira.
- Os 90 segundos liberam a opção de substituição. Sem decisão do anfitrião, a rodada continua pausada e o jogador pode retornar com sua mão; a vaga permanece recuperável até o fim da rodada.
- Sem pessoas conectadas, a partida fica congelada e os substitutos não jogam. Quem retornar durante os 15 minutos de retenção assume como anfitrião e encontra a partida pausada; pode aguardar os demais, continuar com substitutos ou encerrar sem vencedor.
- O substituto usa apenas sua própria mão e informações públicas. Joga a primeira carta válida, preferindo coloridas a coringas; escolhe a cor mais presente na mão e avisa “Última carta” automaticamente. Ao comprar, joga a carta comprada quando possível. Dificuldade competitiva fica para depois.
- O substituto automático não faz denúncias de última carta; as pessoas podem denunciar.

## Regras do Clássico

- Baralho de 108 cartas: quatro cores, cada uma com um zero, duas cartas de cada número de 1 a 9, dois Bloqueios, duas Inversões e duas Compra 2; mais quatro Coringas e quatro Compra 4.
- Cada participante recebe sete cartas. Uma carta numérica inicia o descarte; o primeiro jogador é sorteado e o sentido inicial é horário.
- As cores também são identificáveis por símbolos.
- O jogador pode descartar por cor, número ou símbolo, ou comprar uma carta mesmo tendo um descarte válido.
- Após comprar, pode descartar apenas a carta recém-comprada, se válida, ou passar. Cada turno permite um único descarte.
- Compra 2 e Compra 4 fazem o próximo jogador comprar a quantidade indicada e perder o turno, sem acumulação nem defesa.
- Compra 4 pode ser usada independentemente da mão. Ambos os coringas permitem escolher a cor.
- Bloqueio pula o próximo jogador. Inversão muda o sentido; com duas pessoas, funciona como Bloqueio.
- O aviso “Última carta!” pode ser ativado antes de confirmar o descarte que deixa uma carta na mão. Após esse descarte, o jogador ainda pode avisar enquanto ninguém o denunciar.
- A janela de denúncia termina na primeira compra voluntária ou descarte aceito seguinte, de quem efetivamente joga, inclusive quando a vez volta à mesma pessoa após um Bloqueio. Compras obrigatórias de Compra 2 ou Compra 4 não fecham essa janela. Selecionar cartas ou abrir menus mantém a janela aberta. O servidor decide pela ordem de recebimento dos eventos.
- Denúncia válida recebida antes do aviso acrescenta duas cartas à mão do denunciado. Denúncias inválidas não têm penalidade e recebem uma explicação.
- Qualquer carta pode ser a última. Seus efeitos obrigatórios, incluindo escolha de cor e compras, são resolvidos antes do resultado.
- Ao encerrar a rodada, qualquer janela de denúncia ainda aberta é encerrada. Denúncias posteriores são recusadas, sem alterar o resultado; comandos recebidos antes continuam sendo resolvidos na ordem de recebimento.
- Ao esgotar a pilha de compra, reembaralha-se o descarte preservando o topo. Se ainda faltarem cartas, entregam-se as disponíveis e o efeito é concluído.

## Humor e preferências

- Provocações manuais iniciais: tomate voador, torta na cara, chuva de risadas e choro dramático. Cada envio tem um alvo e é visto por toda a mesa, sem alterar regras.
- Intervalo de 15 segundos por emissor; cada alvo recebe no máximo três provocações por minuto.
- Animações automáticas para compra por penalidade, bloqueio, inversão e vitória, com duas variações por evento. Todos recebem a mesma variação.
- Efeitos são curtos e permitem continuar jogando. Efeitos maiores entram em fila para evitar sobreposição.
- Cada pessoa pode selecionar animações completas, reduzidas ou desativadas, silenciar sons e ocultar provocações recebidas. Os avisos necessários para entender as jogadas continuam visíveis.

## Chat e resultados

- Chat único da sala, acessível no lobby, durante o jogo e nos resultados, com histórico enquanto a sala existir e sem mensagens privadas.
- Até 500 caracteres por mensagem e cinco mensagens a cada dez segundos por pessoa.
- O resultado mostra o vencedor e o placar de vitórias. O grupo volta à preparação na mesma sala; todos confirmam novamente que estão prontos e o anfitrião inicia.
- Estatísticas de rivalidade e prêmios humorísticos ficam para depois.
- Vitória obtida por substituto automático aparece como “substituto de [apelido]” e não soma ao placar pessoal. Se a pessoa retornar e assumir a mão antes do fim, a vitória conta normalmente para ela.

## Controle da sala e recuperação

- O anfitrião pode remover participantes no lobby ou entre rodadas e encerrar uma rodada sem vencedor para reorganizar o grupo, inclusive quando alguém abandona a partida mantendo o navegador conectado.
- Cada pessoa pode silenciar localmente as mensagens de outro participante.
- Identidade e mão são recuperadas no mesmo navegador, inclusive após atualizar a página. Transferência entre dispositivos fica fora da primeira versão.
- O link permite entrar na sala; a credencial individual de retorno fica guardada no navegador.
- Uma reinicialização do servidor encerra as salas e apaga placares e chats. A interface informa quando a sala deixar de existir.
- Recuperação de conexão depende de a sala continuar disponível no servidor. Persistência após reinício fica para depois.

## Identidade e acesso

- Visual de mesa de cartas descontraída, com cores vivas, avatares expressivos e humor de desenho animado.
- Cartas e interface próprias, texto legível e boa usabilidade no celular, sem personagens ou artes de jogos comerciais.
- Seleção de avatares prontos e apelidos. Fotos enviadas, contas e itens desbloqueáveis ficam para depois.

## Aceite da primeira entrega

- Acesso por HTTPS e rodadas completas em celulares e computadores, incluindo uma mesa de oito jogadores.
- Retorno após desconexão, chat e provocações funcionando.
- Cartas privadas dos adversários protegidas e preferências de animação respeitadas.
- Antes de contratar hospedagem, apresentar a opção e o custo ao usuário para aprovação.

## Hospedagem nesta fase

Decisão do usuário em 15 de outubro de 2026: o Tretta será usado como hobby para brincar com a família. **A hospedagem inteira deve ter custo zero nesta fase.** Uma eventual transformação em produto e adoção de serviços pagos serão decisões futuras.

Preparar planos gratuitos, sem contratação paga, upgrade automático ou cobrança de excedentes. Cotas, suspensão por inatividade e tempo de despertar devem ser explicados na proposta e conferidos na implantação. O requisito não muda as regras de jogo nem autoriza commits, envio a serviços externos ou acesso a contas por si só. As provas locais já aceitas permanecem válidas; a publicação pública ainda precisa ser concluída.

## Base técnica e sequência

- TypeScript, React/Next.js no navegador e Node.js com Socket.IO no servidor.
- Motor de regras em pacote independente da interface. Servidor autoritativo valida jogadas e entrega projeções específicas por jogador, protegendo mãos adversárias.
- Uma instância de servidor; dez salas simultâneas como alvo inicial de teste. Múltiplos servidores ficam para depois.
- Entregas pequenas: regras testadas; sala e partida Clássica jogável; recuperação; chat e humor; interface e validação final.
- A primeira partida funcional pode ter apresentação simples. Animações e provocações continuam obrigatórias para concluir a primeira versão.

## Referência

A [conversa de concepção](../reference/conception.md) preserva a proposta original. Este documento prevalece sobre ela quando houver divergências; itens históricos ausentes daqui continuam sendo propostas.
