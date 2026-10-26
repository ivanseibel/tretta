/**
 * Avaliação das medições. Cada check tem status:
 *  - pass: atende
 *  - fail: bloqueia o aceite da T019F
 *  - review: precisa de inspeção humana/visual, não bloqueia sozinho
 *  - skip: não se aplica a este estado/viewport
 */
import { FONT_FLOORS, LIMITS, REACTION_LABELS } from './config.mjs';
import { requiredRatio, round2 } from './contrast.mjs';

const normalize = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim()
  .toLowerCase();

const normalizeLabel = (value) => normalize(value);

const containsLabel = (haystack, label) => normalize(haystack).includes(normalize(label));

const makeCheck = (id, label, status, detail = null, data = null) => ({
  id,
  label,
  status,
  detail,
  ...(data === null ? {} : { data })
});

function regexOf(definition) {
  try {
    return new RegExp(definition.source, definition.flags || '');
  } catch (error) {
    return null;
  }
}

function checkViewport(measurement, viewport) {
  return makeCheck(
    'viewport.exact',
    `Viewport exato ${viewport.width}×${viewport.height} @${viewport.dpr}x`,
    measurement.viewport.width === viewport.width &&
      measurement.viewport.height === viewport.height &&
      Math.abs(measurement.viewport.dpr - viewport.dpr) < 0.01
      ? 'pass'
      : 'fail',
    `medido ${measurement.viewport.width}×${measurement.viewport.height} @${measurement.viewport.dpr}x`
  );
}

function checkScroll(measurement, state, viewport) {
  const checks = [];
  const horizontalOk = !measurement.scroll.horizontalOverflow;
  checks.push(
    makeCheck(
      'scroll.no-horizontal',
      'Sem rolagem horizontal da página',
      horizontalOk ? 'pass' : 'fail',
      `docW ${measurement.scroll.docW} / innerW ${measurement.scroll.innerW}`,
      horizontalOk ? null : { candidates: measurement.scroll.candidates }
    )
  );

  if (state.tableScroll) {
    const allow = !!viewport.allowTableScroll;
    const docOk = !measurement.scroll.verticalOverflow;
    const innerTableScrollers = measurement.scroll.candidates.filter(
      (candidate) => candidate.scrollHeight > candidate.clientHeight + 1 &&
        /auto|scroll|overlay/.test(candidate.overflowY) &&
        candidate.clientHeight > 0
    );
    // Só conta rolagem vertical de elementos que não sejam a gaveta ou uma
    // lista explicitamente rolável; a mesa inteira não pode rolar.
    const tableScrolls = innerTableScrollers.filter((candidate) => {
      const label = `${candidate.el} ${JSON.stringify(candidate.data || [])}`.toLowerCase();
      if (/gaveta|drawer|chat|historico|conversa|lista|jogadores/.test(label)) return false;
      // A mão rola verticalmente por contrato: uma fileira visível e a
      // próxima espiando. Ela tem checagem própria em checkCards.
      if (/hand|mao|mão/.test(label)) return false;
      return true;
    });
    const ok = allow || (docOk && tableScrolls.length === 0);
    checks.push(
      makeCheck(
        'scroll.table-no-vertical',
        allow
          ? 'Rolagem vertical permitida neste viewport de altura curta'
          : 'Mesa sem rolagem vertical',
        allow ? 'skip' : ok ? 'pass' : 'fail',
        allow
          ? `viewport ${viewport.id} marcado como altura curta`
          : `docH ${measurement.scroll.docH} / innerH ${measurement.scroll.innerH}; rolagens internas ${tableScrolls.length}`,
        allow || ok ? null : { tableScrolls, scroll: measurement.scroll }
      )
    );
  }

  return checks;
}

function checkSeats(measurement, state, viewport) {
  const checks = [];
  const seats = measurement.seats || [];
  const expected = state.seats;

  if (expected) {
    const countOk = expected.exact !== undefined
      ? seats.length === expected.exact
      : seats.length >= (expected.min ?? 2) && seats.length <= (expected.max ?? 8);
    checks.push(
      makeCheck(
        'seats.count',
        expected.exact !== undefined
          ? `${expected.exact} assentos visíveis`
          : `${expected.min ?? 2}–${expected.max ?? 8} assentos visíveis`,
        countOk ? 'pass' : 'fail',
        `${seats.length} assento(s): ${seats.map((seat) => seat.name || '(sem nome)').join(', ')}`
      )
    );

    if (state.table || state.kind === 'waiting') {
      const outside = seats.filter((seat) => !seat.fullyInViewport);
      checks.push(
        makeCheck(
          'seats.fully-visible',
          'Todos os assentos inteiros no viewport',
          outside.length === 0 ? 'pass' : 'fail',
          outside.length ? outside.map((seat) => seat.name || '(sem nome)').join(', ') : 'todos inteiros'
        )
      );
    }

    checks.push(
      makeCheck(
        'seats.overlap',
        'Sem sobreposição entre assentos/centro',
        measurement.seatOverlaps.length === 0 ? 'pass' : 'fail',
        measurement.seatOverlaps.length
          ? measurement.seatOverlaps.map((pair) => pair.join(' × ')).join('; ')
          : 'nenhuma sobreposição'
      )
    );

    if (measurement.table.rect) {
      checks.push(
        makeCheck(
          'seats.inside-table',
          'Assentos dentro da moldura da mesa',
          measurement.seatsOutsideTable.length === 0 ? 'pass' : 'fail',
          measurement.seatsOutsideTable.length
            ? measurement.seatsOutsideTable.join(', ')
            : 'todos dentro da mesa'
        )
      );
    }

    if (state.ariaCurrent === 'one') {
      checks.push(
        makeCheck(
          'seats.aria-current',
          'Exatamente um assento com aria-current',
          measurement.aria.currentSeats === 1 ? 'pass' : 'fail',
          `${measurement.aria.currentSeats} assento(s) com aria-current`
        )
      );
    } else if (state.ariaCurrent === 'none') {
      checks.push(
        makeCheck(
          'seats.aria-current',
          'Nenhum assento com aria-current fora do turno',
          measurement.aria.currentSeats === 0 ? 'pass' : 'review',
          `${measurement.aria.currentSeats} assento(s) com aria-current`
        )
      );
    }

    const features = state.features || [];
    if (features.includes('bots') || features.includes('training')) {
      const bots = seats.filter((seat) => seat.bot);
      const minimum = features.includes('training') ? 2 : 1;
      checks.push(
        makeCheck(
          'seats.bots',
          'Assentos com bot identificados',
          bots.length >= minimum ? 'pass' : 'fail',
          `${bots.length} assento(s) com bot`
        )
      );
    }
    if (features.includes('substitute')) {
      const substitutes = seats.filter((seat) => seat.substitute);
      checks.push(
        makeCheck(
          'seats.substitute',
          'Assento de substituto identificado',
          substitutes.length >= 1 ? 'pass' : 'fail',
          `${substitutes.length} assento(s) com substituto`
        )
      );
    }
    if (features.includes('absent')) {
      const offline = seats.filter((seat) => seat.offline);
      checks.push(
        makeCheck(
          'seats.absent',
          'Assento ausente/desconectado identificado',
          offline.length >= 1 ? 'pass' : 'fail',
          `${offline.length} assento(s) ausente(s)`
        )
      );
    }

    if (['mesa-2', 'mesa-3', 'mesa-4', 'mesa-5', 'mesa-6', 'mesa-7', 'mesa-8', 'mesa-cheia'].includes(state.id)) {
      const sides = measurement.seatSides;
      const distributionOk = sides.bottom === 1 && sides.top >= 1 && sides.unknown === 0;
      checks.push(
        makeCheck(
          'seats.distribution',
          'Base própria + topo oposto + laterais no perímetro',
          distributionOk ? 'pass' : 'review',
          `topo ${sides.top}, base ${sides.bottom}, esquerda ${sides.left}, direita ${sides.right}, incerto ${sides.unknown}`
        )
      );
    }
  }

  const shortNames = (measurement.names || []).filter((name) => name.short);
  const truncatedShort = shortNames.filter((name) => name.truncated || name.clippedX);
  checks.push(
    makeCheck(
      'names.short-not-truncated',
      `Nomes curtos (até ${LIMITS.shortNameMax}) sem truncar`,
      shortNames.length === 0
        ? 'skip'
        : truncatedShort.length === 0
          ? 'pass'
          : 'fail',
      shortNames.length === 0
        ? 'sem assentos/nomes neste estado'
        : truncatedShort.length
          ? truncatedShort.map((name) => name.name).join(', ')
          : `${shortNames.length} nome(s) curto(s) sem truncar`
    )
  );

  const longNames = (measurement.names || []).filter((name) => name.long);
  const clippedWithoutEllipsis = longNames.filter(
    (name) => name.clippedX && !/ellipsis/i.test(name.textOverflow || '')
  );
  checks.push(
    makeCheck(
      'names.long-ellipsis',
      'Nomes longos usam reticências quando não cabem',
      longNames.length === 0
        ? 'skip'
        : clippedWithoutEllipsis.length === 0
          ? 'pass'
          : 'fail',
      longNames.length === 0
        ? 'sem nomes longos'
        : clippedWithoutEllipsis.length
          ? clippedWithoutEllipsis.map((name) => name.name).join(', ')
          : `${longNames.length} nome(s) longo(s) com tratamento adequado`
    )
  );

  const missingAriaName = (measurement.names || []).filter(
    (name) => name.name && name.ariaHasFullName === false
  );
  checks.push(
    makeCheck(
      'names.accessible-full',
      'Nome completo no nome acessível do assento',
      missingAriaName.length === 0 ? 'pass' : 'fail',
      missingAriaName.length ? missingAriaName.map((name) => name.name).join(', ') : 'todos os nomes completos no aria'
    )
  );

  return checks;
}

function checkFonts(measurement, state) {
  const checks = [];
  const requiredByKind = {
    table: ['turn', 'direction', 'seatName', 'countNum', 'countLabel', 'cardName', 'body'],
    waiting: ['turn', 'direction', 'seatName', 'countNum', 'countLabel', 'body'],
    preparation: ['seatName', 'body'],
    result: ['body'],
    error: ['body'],
    home: ['body'],
    preview: ['body']
  };
  const required = requiredByKind[state.kind] || ['body'];

  for (const [category, floor] of Object.entries(FONT_FLOORS)) {
    const measured = measurement.fonts[category];
    if (!measured || measured.count === 0) {
      checks.push(
        makeCheck(
          `fonts.${category}`,
          `Piso de fonte ${category} (${floor}px)`,
          required.includes(category) && category !== 'body' ? 'fail' : 'skip',
          required.includes(category) && category !== 'body'
            ? 'elemento não encontrado no DOM'
            : 'categoria ausente neste estado'
        )
      );
      continue;
    }
    checks.push(
      makeCheck(
        `fonts.${category}`,
        `Piso de fonte ${category} (${floor}px)`,
        measured.px >= floor - 0.01 ? 'pass' : 'fail',
        `medido ${measured.px}px em ${measured.count} elemento(s)`,
        measured.samples
      )
    );
  }

  if (state.kind !== 'preview') {
    checks.push(
      makeCheck(
        'fonts.minimum-functional',
        `Nenhum texto funcional abaixo de ${LIMITS.minFunctionalText}px`,
        measurement.textBelowMinimum.length === 0 ? 'pass' : 'fail',
        measurement.textBelowMinimum.length
          ? measurement.textBelowMinimum
              .slice(0, 12)
              .map((item) => `${item.text || item.el} (${item.px}px)`)
              .join('; ')
          : `${measurement.textElementsChecked} elemento(s) com texto direto conferido(s)`
      )
    );
  }

  const loaded = measurement.fontsLoaded;
  checks.push(
    makeCheck(
      'fonts.loaded',
      'Fraunces e Atkinson carregadas',
      loaded && loaded.status === 'loaded' && loaded.atkinson && loaded.fraunces ? 'pass' : 'fail',
      loaded
        ? `status ${loaded.status}; Atkinson ${loaded.atkinson}; Fraunces ${loaded.fraunces}`
        : 'document.fonts indisponível'
    )
  );

  return checks;
}

function checkCards(measurement, state, viewport) {
  const checks = [];
  if (!state.hand) {
    if (measurement.hand.rect && measurement.hand.rect.h > 4) {
      checks.push(
        makeCheck(
          'cards.no-hand',
          'Estado sem mão privada',
          'fail',
          `mão visível com ${measurement.cards.length} carta(s)`
        )
      );
    } else {
      checks.push(
        makeCheck('cards.no-hand', 'Estado sem mão privada', 'pass', 'nenhuma mão visível')
      );
    }
    return checks;
  }

  const cards = measurement.cards || [];
  checks.push(
    makeCheck(
      'cards.count',
      'Mão renderizada',
      cards.length > 0 ? 'pass' : 'fail',
      `${cards.length} carta(s) na mão`
    )
  );
  checks.push(
    makeCheck(
      'cards.hand-present',
      'Contêiner da mão identificado',
      measurement.hand.rect ? 'pass' : 'review',
      measurement.hand.rect ? 'mão com geometria medida' : 'cards encontrados sem contêiner de mão reconhecido'
    )
  );

  if (state.handCards !== undefined) {
    checks.push(
      makeCheck(
        'cards.expected-count',
        `${state.handCards} cartas na mão`,
        cards.length === state.handCards ? 'pass' : 'fail',
        `${cards.length} carta(s) medidas`
      )
    );
  }

  const min = measurement.cardsMin;
  checks.push(
    makeCheck(
      'cards.min-size',
      `Cartas ≥ ${LIMITS.cardMin}px`,
      min !== null && min >= LIMITS.cardMin - 0.01 ? 'pass' : 'fail',
      min === null ? 'nenhuma carta medida' : `menor largura ${round2(min)}px`
    )
  );

  // Contrato aprovado do gate: até quatro cartas por fileira; com mais de
  // quatro, a primeira fileira fica inteira e a segunda espia dentro da mão,
  // que rola só na vertical. Vale em 320/360/412 e no desktop.
  const rows = measurement.cardRows || [];
  const cardsPerRowOk = rows.length > 0 && rows.every((row) => row.count <= 4) &&
    (cards.length <= 4 || rows[0]?.count === 4);
  const firstRow = rows[0];
  const secondRow = rows[1];
  const firstRowCard = firstRow === undefined
    ? undefined
    : cards.find((card) => Math.abs(card.rect.y - firstRow.y) <= 8);
  const secondRowCard = secondRow === undefined
    ? undefined
    : cards.find((card) => Math.abs(card.rect.y - secondRow.y) <= 8);
  const firstRowVisible = firstRowCard === undefined || (
    firstRowCard.rect.top >= (measurement.hand.rect?.top ?? 0) - 1 &&
    firstRowCard.rect.bottom <= (measurement.hand.rect?.bottom ?? Infinity) + 1
  );
  const secondPeeking = secondRowCard === undefined || (
    secondRowCard.rect.top < (measurement.hand.rect?.bottom ?? Infinity) &&
    secondRowCard.rect.bottom > (measurement.hand.rect?.bottom ?? Infinity)
  );
  const rowsOk = cardsPerRowOk && firstRowVisible && secondPeeking;
  checks.push(
    makeCheck(
      'cards.rows',
      'Até quatro cartas por fileira; primeira visível e segunda espiando',
      rowsOk ? 'pass' : 'fail',
      rows.map((row) => `${row.count} carta(s) @ y=${row.y}`).join('; ') +
        `; primeira ${firstRowVisible ? 'visível' : 'cortada'}; segunda ${secondPeeking ? 'espiando' : 'não espia'}`
    )
  );

  if (measurement.hand.scrollWidth !== null) {
    const widthOverflow = measurement.hand.scrollWidth > measurement.hand.clientWidth + 1;
    const widthOk = !widthOverflow && measurement.hand.overflowX === 'hidden';
    checks.push(
      makeCheck(
        'cards.hand-width',
        'A mão não corta nem rola nas laterais',
        widthOk ? 'pass' : 'fail',
        `scrollWidth ${measurement.hand.scrollWidth} / clientWidth ${measurement.hand.clientWidth}; overflowX ${measurement.hand.overflowX}`
      )
    );

    const multiRow = rows.length > 1;
    const heightOverflow = measurement.hand.scrollHeight !== null &&
      measurement.hand.clientHeight !== null &&
      measurement.hand.scrollHeight > measurement.hand.clientHeight + 1;
    const verticalLocal = /auto|scroll/.test(measurement.hand.overflowY || '');
    const verticalOk = multiRow
      ? verticalLocal && heightOverflow
      : !heightOverflow;
    checks.push(
      makeCheck(
        'cards.hand-vertical',
        multiRow
          ? 'Com mais de uma fileira, a mão rola só na vertical'
          : 'Com uma fileira, a mão não rola',
        verticalOk ? 'pass' : 'fail',
        `fileiras ${rows.length}; scrollHeight ${measurement.hand.scrollHeight} / clientHeight ${measurement.hand.clientHeight}; overflowY ${measurement.hand.overflowY}`
      )
    );
  }

  return checks;
}

function checkTargets(measurement, state) {
  if (state.kind === 'preview') {
    return [
      makeCheck('targets.min', 'Alvos ≥ 44px', 'skip', 'preview de primitivos, não é tela de produto')
    ];
  }
  const small = measurement.targets.belowMin;
  return [
    makeCheck(
      'targets.min',
      `Alvos interativos ≥ ${LIMITS.targetMin}×${LIMITS.targetMin}px`,
      small.length === 0 ? 'pass' : 'fail',
      small.length
        ? small
            .slice(0, 15)
            .map((target) => `${target.label || target.el || target.tag} ${target.w}×${target.h}`)
            .join('; ')
        : `${measurement.targets.total} alvo(s) conferido(s)`
    )
  ];
}

function checkContrast(measurement, state) {
  if (state.kind === 'preview') {
    return [
      makeCheck('contrast.text', 'Contraste de texto ≥ 4,5:1', 'skip', 'preview de primitivos'),
      makeCheck('contrast.ui', 'Contraste de limites/foco ≥ 3:1', 'skip', 'preview de primitivos')
    ];
  }
  const text = measurement.contrast.text;
  const ui = measurement.contrast.ui;
  return [
    makeCheck(
      'contrast.text',
      'Contraste de texto ≥ 4,5:1 (3:1 para texto grande)',
      text.failures.length > 0 ? 'fail' : text.reviews.length > 0 ? 'review' : 'pass',
      text.failures.length
        ? text.failures
            .slice(0, 12)
            .map((item) => `${item.text || item.el} ${item.ratio}:1 (mín. ${item.required}:1)`)
            .join('; ')
        : `${text.checked} par(es) conferido(s); ${text.reviews.length} revisão(ões) por fundo com imagem`,
      { failures: text.failures, reviews: text.reviews, unresolved: text.unresolved }
    ),
    makeCheck(
      'contrast.ui',
      'Contraste de limites/foco ≥ 3:1',
      ui.failures.length === 0 ? 'pass' : 'review',
      ui.failures.length
        ? ui.failures
            .slice(0, 12)
            .map((item) => `${item.el} ${item.ratio}:1`)
            .join('; ')
        : `${ui.checked} limite(s) conferido(s)`,
      { failures: ui.failures, unresolved: ui.unresolved }
    )
  ];
}

function checkReactions(measurement, state) {
  const checks = [];
  const reactions = measurement.reactions;
  const trayOpen = state.reactions === 'tray';
  const overlay = state.reactions === 'overlay';

  if (trayOpen) {
    checks.push(
      makeCheck(
        'reactions.count',
        `${LIMITS.reactionCount} reações na bandeja`,
        reactions.count === LIMITS.reactionCount ? 'pass' : 'fail',
        `${reactions.count} reação(ões) visível(is)`
      )
    );

    const expectedNormalized = REACTION_LABELS.map(normalizeLabel);
    const missing = REACTION_LABELS.filter(
      (label) => !reactions.labels.some((candidate) => containsLabel(candidate, label))
    );
    const unknown = reactions.labels.filter(
      (candidate) => !REACTION_LABELS.some((label) => containsLabel(candidate, label))
    );
    checks.push(
      makeCheck(
        'reactions.labels',
        'Copy aprovada das 12 reações',
        missing.length === 0 && unknown.length === 0 ? 'pass' : 'fail',
        missing.length
          ? `faltando: ${missing.join(', ')}`
          : unknown.length
            ? `não previstas: ${unknown.join(', ')}`
            : '12 rótulos aprovados'
      )
    );

    checks.push(
      makeCheck(
        'reactions.grammar',
        'Bandeja em grade 4×3',
        reactions.count === 12 ? 'pass' : 'review',
        `${reactions.count} reação(ões); ordem ${reactions.labels.join(' | ')}`,
        { rows: 3, columns: 4, expected: expectedNormalized.length }
      )
    );
  }

  checks.push(
    makeCheck(
      'reactions.no-target',
      'Reação sem alvo/destinatário',
      reactions.targetAttributes.length === 0 ? 'pass' : 'fail',
      reactions.targetAttributes.length
        ? reactions.targetAttributes.map((item) => `${item.el}: ${item.attrs.map((attr) => attr.name).join(', ')}`).join('; ')
        : 'nenhum atributo de alvo nos controles de reação'
    )
  );

  if (overlay) {
    checks.push(
      makeCheck(
        'reactions.overlay',
        'Apresentação central de reação visível',
        reactions.overlayVisible ? 'pass' : 'review',
        reactions.overlayVisible ? 'overlay visível' : 'overlay não detectado'
      )
    );
  }

  return checks;
}

function checkForbiddenWithConfig(measurement, forbiddenCopy, forbiddenDom) {
  const text = measurement.bodyText || '';
  const hardMatches = [];
  const reviewMatches = [];
  const domMatches = [];

  for (const definition of forbiddenCopy.hard) {
    const regex = regexOf(definition);
    if (!regex) continue;
    const match = text.match(regex);
    if (match) hardMatches.push({ id: definition.id, match: match[0] });
  }
  for (const definition of forbiddenCopy.review) {
    const regex = regexOf(definition);
    if (!regex) continue;
    const match = text.match(regex);
    if (match) reviewMatches.push({ id: definition.id, match: match[0] });
  }
  for (const token of measurement.domTokens || []) {
    for (const definition of forbiddenDom.hard) {
      const regex = regexOf(definition);
      if (regex && (regex.test(token.value) || regex.test(token.attr))) {
        domMatches.push(token);
      }
    }
  }

  return [
    makeCheck(
      'forbidden.taunt-copy',
      'Nenhuma provocação/resposta na copy renderizada',
      hardMatches.length === 0 ? 'pass' : 'fail',
      hardMatches.length
        ? hardMatches.map((match) => `${match.id}: "${match.match}"`).join('; ')
        : 'nenhum termo proibido no texto visível',
      { hardMatches, reviewMatches }
    ),
    makeCheck(
      'forbidden.taunt-dom',
      'Nenhum resto de provocação em classes/atributos',
      domMatches.length === 0 ? 'pass' : 'fail',
      domMatches.length
        ? domMatches.map((token) => `${token.attr}=${token.value}`).join('; ')
        : 'nenhum token de provocação no DOM'
    ),
    makeCheck(
      'forbidden.review',
      'Termos ambíguos para inspeção',
      reviewMatches.length === 0 ? 'pass' : 'review',
      reviewMatches.length
        ? reviewMatches.map((match) => `${match.id}: "${match.match}"`).join('; ')
        : 'nenhum termo ambíguo',
      { reviewMatches }
    )
  ];
}

function checkAria(measurement, state) {
  const checks = [];
  const live = measurement.aria.liveRegions || [];

  if (state.live === 'required') {
    const withText = live.filter((region) => region.text.trim().length > 0);
    checks.push(
      makeCheck(
        'aria.live',
        'Região aria-live com anúncio do estado',
        live.length > 0 && withText.length > 0 ? 'pass' : 'fail',
        live.length
          ? live.map((region) => `${region.live || region.role}: "${region.text.slice(0, 120)}"`).join(' | ')
          : 'nenhuma região aria-live'
      )
    );
  } else {
    checks.push(
      makeCheck(
        'aria.live',
        'Região aria-live (opcional neste estado)',
        live.length > 0 ? 'pass' : 'skip',
        live.length ? `${live.length} região(ões)` : 'sem região aria-live'
      )
    );
  }

  const unnamed = measurement.aria.unnamedTargets || [];
  checks.push(
    makeCheck(
      'aria.names',
      'Todo controle interativo tem nome acessível',
      unnamed.length === 0 ? 'pass' : 'fail',
      unnamed.length ? unnamed.slice(0, 12).map((target) => target.el || target.tag).join('; ') : 'todos nomeados'
    )
  );

  if (state.drawer) {
    checks.push(
      makeCheck(
        'aria.drawer',
        'Gaveta visível com papel/abas identificados',
        measurement.drawer.visible && measurement.aria.tablists >= 1 && measurement.aria.tabs >= 3
          ? 'pass'
          : 'fail',
        measurement.drawer.visible
          ? `role ${measurement.drawer.role}; tabs ${measurement.aria.tabs}; seções ${measurement.drawer.sections.join(', ')}`
          : 'gaveta não encontrada'
      )
    );
    checks.push(
      makeCheck(
        'drawer.sections',
        'Seções Sala/Jogadores/Apresentação/Anfitrião',
        ['Sala', 'Jogadores', 'Apresentação', 'Anfitrião'].every((section) =>
          measurement.drawer.sections.some((candidate) => normalize(candidate).includes(normalize(section)))
        )
          ? 'pass'
          : 'fail',
        measurement.drawer.sections.join(', ') || 'nenhuma seção'
      )
    );
    checks.push(
      makeCheck(
        'drawer.fixed',
        'Gaveta fixa, sem mudar a altura da mesa',
        measurement.drawer.position === 'fixed' || measurement.drawer.layerPosition === 'fixed' ? 'pass' : 'review',
        `position ${measurement.drawer.position}; camada ${measurement.drawer.layerPosition}; altura da mesa ${measurement.drawer.tableHeight}px`
      )
    );
  }

  return checks;
}

function checkCopy(measurement, state) {
  const checks = [];
  const text = measurement.bodyText || '';
  for (const requirement of state.mustContain || []) {
    const regex = regexOf(requirement);
    checks.push(
      makeCheck(
        `copy.${requirement.id}`,
        `Copy preservada: ${requirement.id}`,
        regex && regex.test(text) ? 'pass' : 'fail',
        regex && regex.test(text) ? 'encontrada' : `não encontrada (${requirement.source})`
      )
    );
  }
  return checks;
}

function checkPreview(measurement, state) {
  if (state.kind !== 'preview') return [];
  const frames = measurement.previewFrames || [];
  const widths = new Set(frames.map((frame) => frame.largura));
  return [
    makeCheck(
      'preview.frames',
      'Frames de 412 e 1280 presentes no preview',
      widths.has('412') && widths.has('1280') && frames.length >= 4 ? 'pass' : 'fail',
      `${frames.length} frame(s): ${frames.map((frame) => frame.largura).join(', ')}`
    )
  ];
}

function checkRuntime(measurement, runtime) {
  const errors = runtime && runtime.consoleErrors ? runtime.consoleErrors : [];
  const pageErrors = runtime && runtime.pageErrors ? runtime.pageErrors : [];
  const failedRequests = runtime && runtime.failedRequests ? runtime.failedRequests : [];
  return [
    makeCheck(
      'runtime.console',
      'Sem erros de console/página na captura',
      errors.length === 0 && pageErrors.length === 0 ? 'pass' : 'review',
      errors.length || pageErrors.length
        ? [...errors, ...pageErrors].slice(0, 8).join(' | ')
        : 'nenhum erro'
    ),
    makeCheck(
      'runtime.requests',
      'Sem requisições de rede falhando',
      failedRequests.length === 0 ? 'pass' : 'review',
      failedRequests.length ? failedRequests.slice(0, 8).join(' | ') : 'nenhuma requisição falhou'
    )
  ];
}

/**
 * @param {object} measurement
 * @param {object} state
 * @param {object} viewport
 * @param {object} options { forbiddenCopy, forbiddenDom, runtime, keyboard }
 */
export function evaluateMeasurement(measurement, state, viewport, options) {
  const {
    forbiddenCopy = { hard: [], review: [] },
    forbiddenDom = { hard: [] },
    runtime = {},
    keyboard = null
  } = options || {};

  const checks = [
    checkViewport(measurement, viewport),
    ...checkScroll(measurement, state, viewport),
    ...checkSeats(measurement, state, viewport),
    ...checkFonts(measurement, state),
    ...checkCards(measurement, state, viewport),
    ...checkTargets(measurement, state),
    ...checkContrast(measurement, state),
    ...checkReactions(measurement, state),
    ...checkForbiddenWithConfig(measurement, forbiddenCopy, forbiddenDom),
    ...checkAria(measurement, state),
    ...checkCopy(measurement, state),
    ...checkPreview(measurement, state),
    ...checkRuntime(measurement, runtime)
  ];

  if (keyboard) {
    checks.push(...evaluateKeyboard(keyboard, state));
  }

  return checks;
}

export function evaluateKeyboard(keyboard, state) {
  const checks = [];

  if (keyboard.tabStops) {
    const missingRing = keyboard.tabStops.filter((stop) => stop.name && !stop.ringVisible);
    const focusableSeen = keyboard.tabStops.filter((stop) => stop.name).length;
    checks.push(
      makeCheck(
        'keyboard.focus-visible',
        'Foco visível ao navegar por Tab',
        focusableSeen > 0 && missingRing.length === 0 ? 'pass' : focusableSeen === 0 ? 'review' : 'fail',
        focusableSeen === 0
          ? 'nenhum controle recebeu foco'
          : missingRing.length
            ? missingRing.map((stop) => `${stop.name} (${stop.tag})`).join('; ')
            : `${focusableSeen} parada(s) com anel visível`
      )
    );
    const outlineContrast = keyboard.tabStops.filter(
      (stop) => typeof stop.ringContrast === 'number' && stop.ringContrast < 3
    );
    checks.push(
      makeCheck(
        'keyboard.focus-contrast',
        'Anel de foco ≥ 3:1 contra o fundo',
        outlineContrast.length === 0 ? 'pass' : 'review',
        outlineContrast.length
          ? outlineContrast.map((stop) => `${stop.name}: ${stop.ringContrast}:1`).join('; ')
          : 'todos os anéis com contraste suficiente'
      )
    );
  }

  if (keyboard.drawer) {
    const drawer = keyboard.drawer;
    checks.push(
      makeCheck(
        'keyboard.drawer-trap',
        'Foco preso na gaveta (último → primeiro, primeiro → último)',
        drawer.trapForward && drawer.trapBackward ? 'pass' : 'fail',
        `forward ${drawer.trapForward}; backward ${drawer.trapBackward}`
      )
    );
    checks.push(
      makeCheck(
        'keyboard.drawer-escape',
        'Escape fecha a gaveta e devolve o foco',
        drawer.escapeClosed ? (drawer.focusReturned === false ? 'review' : 'pass') : 'fail',
        `fechou ${drawer.escapeClosed}; foco devolvido ${drawer.focusReturned}; ativo ${drawer.activeAfterEscape}`
      )
    );
  }

  if (keyboard.reducedMotion) {
    const rm = keyboard.reducedMotion;
    checks.push(
      makeCheck(
        'keyboard.reduced-motion',
        'prefers-reduced-motion honrado',
        rm.matches && rm.hasMediaRule ? 'pass' : 'fail',
        `matches ${rm.matches}; regra CSS ${rm.hasMediaRule}; animações ${rm.animations}`
      )
    );
  }

  return checks;
}
