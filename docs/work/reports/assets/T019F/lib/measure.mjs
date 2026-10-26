/**
 * Medição no DOM. Esta função é serializada e executada dentro da página pelo
 * Playwright; por isso não importa nada e não referencia variáveis externas.
 *
 * Retorna apenas dados serializáveis. Os cálculos de contraste canônicos são
 * refeitos no Node a partir das cores computadas; aqui fica uma cópia mínima
 * para classificar rapidamente os pares.
 */
export function measurePage(cfg) {
  const limits = cfg.limits;
  const selectors = cfg.selectors;
  const state = cfg.state;

  const warnings = [];
  const html = document.documentElement;
  const body = document.body;

  const round = (n) => Math.round(n * 10) / 10;
  const rectOf = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      x: round(r.x),
      y: round(r.y),
      w: round(r.width),
      h: round(r.height),
      top: round(r.top),
      right: round(r.right),
      bottom: round(r.bottom),
      left: round(r.left)
    };
  };

  const isVisible = (el) => {
    if (!el || !el.isConnected || el.getClientRects().length === 0) return false;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0.5 && r.height > 0.5;
  };

  const intersects = (a, b, tolerance = 1) =>
    a && b
      ? a.x < b.x + b.w - tolerance &&
        a.x + a.w > b.x + tolerance &&
        a.y < b.y + b.h - tolerance &&
        a.y + a.h > b.y + tolerance
      : false;

  const inViewport = (r) =>
    !!r && r.right > 0 && r.bottom > 0 && r.left < window.innerWidth && r.top < window.innerHeight;

  const fullyInViewport = (r) =>
    !!r && r.left >= -1 && r.top >= -1 && r.right <= window.innerWidth + 1 && r.bottom <= window.innerHeight + 1;

  const selectorList = (group) => (Array.isArray(selectors[group]) ? selectors[group] : [selectors[group]]);

  const all = (group, root = document) => {
    const found = new Set();
    for (const selector of selectorList(group)) {
      try {
        root.querySelectorAll(selector).forEach((el) => found.add(el));
      } catch (error) {
        warnings.push(`Seletor inválido em ${group}: ${selector}`);
      }
    }
    return Array.from(found);
  };

  const first = (group, root = document) => {
    for (const selector of selectorList(group)) {
      try {
        const el = root.querySelector(selector);
        if (el) return el;
      } catch (error) {
        warnings.push(`Seletor inválido em ${group}: ${selector}`);
      }
    }
    return null;
  };

  const firstVisible = (group, root = document) => all(group, root).find(isVisible) || null;

  const describe = (el) => {
    if (!el) return null;
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : '';
    const cls = typeof el.className === 'string' && el.className.trim()
      ? `.${el.className.trim().split(/\s+/).slice(0, 3).join('.')}`
      : '';
    return `${tag}${id}${cls}`;
  };

  const textOf = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');

  const attrList = (el, filter) =>
    Array.from(el.attributes)
      .filter((attr) => filter.test(attr.name))
      .map((attr) => ({ name: attr.name, value: attr.value.slice(0, 160) }));

  // ---------------------------------------------------------------- viewport
  const viewport = {
    width: window.innerWidth,
    height: window.innerHeight,
    dpr: window.devicePixelRatio,
    visualWidth: window.visualViewport ? round(window.visualViewport.width) : null,
    visualHeight: window.visualViewport ? round(window.visualViewport.height) : null
  };

  const scrolling = document.scrollingElement || html;

  const scrollCandidates = Array.from(document.querySelectorAll('*'))
    .filter((el) => {
      if (!isVisible(el)) return false;
      const cs = getComputedStyle(el);
      const scrollableY = /auto|scroll|overlay/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1;
      const scrollableX = /auto|scroll|overlay/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 1;
      return scrollableY || scrollableX;
    })
    .slice(0, 30)
    .map((el) => ({
      el: describe(el),
      data: attrList(el, /^data-tv2/),
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      overflowX: getComputedStyle(el).overflowX,
      overflowY: getComputedStyle(el).overflowY,
      insideTable: false
    }));

  const scroll = {
    docW: scrolling ? scrolling.scrollWidth : null,
    docH: scrolling ? scrolling.scrollHeight : null,
    bodyW: body ? body.scrollWidth : null,
    bodyH: body ? body.scrollHeight : null,
    innerW: window.innerWidth,
    innerH: window.innerHeight,
    horizontalOverflow: !!scrolling && scrolling.scrollWidth > window.innerWidth + 1,
    verticalOverflow: !!scrolling && scrolling.scrollHeight > window.innerHeight + 1,
    scrollingElement: scrolling ? describe(scrolling) : null,
    candidates: scrollCandidates
  };

  // ------------------------------------------------------------------ screen
  const screenEl = firstVisible('screen') || body;
  const screenRect = rectOf(screenEl);
  const screenKind = screenEl && screenEl.getAttribute('data-tv2-screen')
    ? screenEl.getAttribute('data-tv2-screen')
    : state.kind;

  const tableEl = firstVisible('table');
  const tableRect = rectOf(tableEl);
  const handEl = firstVisible('hand');
  const handRect = rectOf(handEl);
  const centerEl = firstVisible('center');
  const centerRect = rectOf(centerEl);

  // ------------------------------------------------------------------- seats
  const seats = all('seat')
    .filter(isVisible)
    .map((el) => {
      const nameEl = firstVisible('seatName', el);
      const countNumEl = firstVisible('countNum', el);
      const countLabelEl = firstVisible('countLabel', el);
      const onTurnEl = firstVisible('onTurn', el);
      const name = nameEl ? textOf(nameEl) : '';
      const ariaTarget = el.querySelector('[aria-haspopup="dialog"], [data-tv2-seat-hit]') || el.querySelector('[aria-label]');
      const aria = el.getAttribute('aria-label') || (ariaTarget ? ariaTarget.getAttribute('aria-label') : '') || '';
      const csName = nameEl ? getComputedStyle(nameEl) : null;
      const seatRect = rectOf(el);
      const nameRect = rectOf(nameEl);
      const clippedX = !!nameEl && nameEl.scrollWidth > nameEl.clientWidth + 1;
      const clippedY = !!nameEl && nameEl.scrollHeight > nameEl.clientHeight + 1;
      const statusText = (el.innerText || el.textContent || '').toLowerCase();
      return {
        name,
        aria: aria.slice(0, 220),
        rect: seatRect,
        nameRect,
        nameFont: csName ? parseFloat(csName.fontSize) : null,
        nameWeight: csName ? csName.fontWeight : null,
        nameOverflow: csName ? csName.textOverflow : null,
        nameWhiteSpace: csName ? csName.whiteSpace : null,
        nameScrollWidth: nameEl ? nameEl.scrollWidth : null,
        nameClientWidth: nameEl ? nameEl.clientWidth : null,
        nameScrollHeight: nameEl ? nameEl.scrollHeight : null,
        nameClientHeight: nameEl ? nameEl.clientHeight : null,
        count: countNumEl ? textOf(countNumEl) : null,
        countFont: countNumEl ? parseFloat(getComputedStyle(countNumEl).fontSize) : null,
        countLabel: countLabelEl ? textOf(countLabelEl) : null,
        countLabelFont: countLabelEl ? parseFloat(getComputedStyle(countLabelEl).fontSize) : null,
        onTurn: !!onTurnEl,
        onTurnFont: onTurnEl ? parseFloat(getComputedStyle(onTurnEl).fontSize) : null,
        current: el.getAttribute('aria-current') === 'true',
        side: el.getAttribute('data-tv2-seat-side') || null,
        bot: /(?:\bbot\b|robô|robo)/i.test(statusText),
        substitute: /substitut/i.test(statusText),
        offline: /(?:ausente|offline|caiu|desconect)/i.test(statusText),
        host: /anfitri|host/i.test(statusText),
        ready: /pronto/i.test(statusText) && !/não pronto|nao pronto/i.test(statusText),
        truncated: clippedX || (!!nameEl && /ellipsis/i.test(csName.textOverflow) && clippedX),
        clippedX,
        clippedY,
        fullyInViewport: fullyInViewport(seatRect),
        inViewport: inViewport(seatRect),
        insideTable: tableRect
          ? seatRect.left >= tableRect.left - 2 &&
            seatRect.right <= tableRect.right + 2 &&
            seatRect.top >= tableRect.top - 2 &&
            seatRect.bottom <= tableRect.bottom + 2
          : null
      };
    });

  const seatOverlaps = [];
  for (let i = 0; i < seats.length; i += 1) {
    for (let j = i + 1; j < seats.length; j += 1) {
      if (intersects(seats[i].rect, seats[j].rect, 2)) {
        seatOverlaps.push([seats[i].name || `assento ${i + 1}`, seats[j].name || `assento ${j + 1}`]);
      }
    }
  }
  if (centerRect) {
    for (const seat of seats) {
      if (intersects(seat.rect, centerRect, 2)) seatOverlaps.push([seat.name || 'assento', 'centro']);
    }
  }

  const seatSides = { top: 0, bottom: 0, left: 0, right: 0, unknown: 0 };
  // O trilho declara o lado geométrico; a heurística por centro é só fallback.
  const declaredSides = seats.map((seat) => seat.side);
  if (seats.length > 0 && declaredSides.every((side) => side !== null)) {
    for (const side of declaredSides) {
      if (side === 'base') seatSides.bottom += 1;
      else if (side === 'top') seatSides.top += 1;
      else if (side === 'left' || side === 'right') seatSides[side] += 1;
      else seatSides.unknown += 1;
    }
  } else if (tableRect) {
    for (const seat of seats) {
      const cx = seat.rect.x + seat.rect.w / 2;
      const cy = seat.rect.y + seat.rect.h / 2;
      const dx = Math.abs(cx - (tableRect.x + tableRect.w / 2));
      const dy = Math.abs(cy - (tableRect.y + tableRect.h / 2));
      if (dy > tableRect.h * 0.3 && dy >= dx) {
        if (cy < tableRect.y + tableRect.h / 2) seatSides.top += 1;
        else seatSides.bottom += 1;
      } else if (dx > tableRect.w * 0.3) {
        if (cx < tableRect.x + tableRect.w / 2) seatSides.left += 1;
        else seatSides.right += 1;
      } else {
        seatSides.unknown += 1;
      }
    }
  }

  const names = seats.map((seat) => ({
    name: seat.name,
    length: seat.name.length,
    short: seat.name.length > 0 && seat.name.length <= limits.shortNameMax,
    long: seat.name.length > limits.shortNameMax,
    truncated: seat.truncated,
    clippedX: seat.clippedX,
    clippedY: seat.clippedY,
    textOverflow: seat.nameOverflow,
    whiteSpace: seat.nameWhiteSpace,
    ariaHasFullName: seat.name ? seat.aria.toLowerCase().includes(seat.name.toLowerCase()) : null
  }));

  // ------------------------------------------------------------------- cards
  const cardRoot = handEl || tableEl || document;
  const cards = all('card', cardRoot)
    .filter(isVisible)
    .map((el) => {
      const nameEl = firstVisible('cardName', el);
      const cardRect = rectOf(el);
      return {
        label: (el.getAttribute('aria-label') || textOf(el)).slice(0, 160),
        name: nameEl ? textOf(nameEl) : null,
        nameFont: nameEl ? parseFloat(getComputedStyle(nameEl).fontSize) : null,
        rect: cardRect,
        w: cardRect.w,
        h: cardRect.h,
        tag: el.tagName.toLowerCase(),
        inHand: !!handEl && handEl.contains(el)
      };
    });

  const cardWidths = cards.map((card) => card.w);
  const cardsMin = cardWidths.length ? Math.min(...cardWidths) : null;
  const cardRows = (() => {
    const rows = [];
    for (const card of cards.slice().sort((a, b) => a.rect.y - b.rect.y)) {
      const row = rows.find((candidate) => Math.abs(candidate.y - card.rect.y) <= 8);
      if (row) {
        row.cards.push(card);
        row.y = (row.y * (row.cards.length - 1) + card.rect.y) / row.cards.length;
      } else {
        rows.push({ y: card.rect.y, cards: [card] });
      }
    }
    return rows.map((row) => ({ y: round(row.y), count: row.cards.length, width: round(row.cards[0] ? row.cards[0].w : 0) }));
  })();

  // ------------------------------------------------------------------- fonts
  const fontValue = (group, useFirst = false) => {
    const elements = all(group).filter(isVisible);
    if (!elements.length) return { px: null, count: 0, samples: [] };
    const values = elements.map((el) => ({
      px: parseFloat(getComputedStyle(el).fontSize),
      text: textOf(el).slice(0, 60),
      el: describe(el)
    }));
    const measured = useFirst
      ? values[0].px
      : Math.min(...values.map((value) => value.px));
    return {
      px: measured,
      minPx: Math.min(...values.map((value) => value.px)),
      maxPx: Math.max(...values.map((value) => value.px)),
      count: values.length,
      samples: values.slice(0, 4)
    };
  };

  const fonts = {
    turn: fontValue('turn'),
    direction: fontValue('direction'),
    countNum: fontValue('countNum'),
    countLabel: fontValue('countLabel'),
    seatName: fontValue('seatName'),
    cardName: fontValue('cardName'),
    body: fontValue('body', true),
    label: fontValue('label'),
    onTurn: fontValue('onTurn')
  };

  const textBelowMinimum = [];
  let textElementsChecked = 0;
  const isScreenReaderOnly = (el, cs) => {
    const r = el.getBoundingClientRect();
    return (r.width <= 1 || r.height <= 1) && (cs.overflow === 'hidden' || cs.clip !== 'auto');
  };
  for (const el of body.querySelectorAll('*')) {
    if (!(el instanceof HTMLElement)) continue;
    if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'OPTION'].includes(el.tagName)) continue;
    if (el.closest('.sprite, svg, [aria-hidden="true"], [data-tv2-ignore-text]')) continue;
    if (!isVisible(el)) continue;
    const cs = getComputedStyle(el);
    if (isScreenReaderOnly(el, cs)) continue;
    const hasDirectText = Array.from(el.childNodes).some(
      (node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 0
    );
    if (!hasDirectText) continue;
    textElementsChecked += 1;
    const px = parseFloat(cs.fontSize);
    if (px < limits.minFunctionalText) {
      textBelowMinimum.push({
        text: textOf(el).slice(0, 80),
        px,
        tag: el.tagName.toLowerCase(),
        el: describe(el)
      });
    }
    if (textElementsChecked >= 800) break;
  }

  // ---------------------------------------------------------------- targets
  const targetElements = all('focusable');
  const targets = targetElements
    .filter(isVisible)
    .filter((el) => {
      if (el.closest('[inert]')) return false;
      if (el.matches(':disabled, [aria-disabled="true"]')) return false;
      if (getComputedStyle(el).pointerEvents === 'none') return false;
      if (el.hasAttribute('data-tv2-target-exempt')) return false;
      return true;
    })
    .map((el) => {
      // Checkbox/radio nativo pode ser pequeno; o alvo real é o label que o
      // envolve (ou o label associado), como em "Avisar última".
      let targetElement = el;
      if (el.matches('input[type="checkbox"], input[type="radio"]')) {
        const label = el.closest('label') || (el.labels && el.labels[0]);
        if (label) targetElement = label;
      }
      const r = rectOf(targetElement);
      const labelledBy = el.getAttribute('aria-labelledby')
        ? textOf(document.getElementById(el.getAttribute('aria-labelledby')))
        : '';
      const labels = el.labels ? Array.from(el.labels).map((label) => textOf(label)).join(' ') : '';
      const label = (
        el.getAttribute('aria-label') ||
        labelledBy ||
        labels ||
        el.getAttribute('placeholder') ||
        el.getAttribute('title') ||
        textOf(el) ||
        ''
      ).slice(0, 100);
      return {
        label,
        tag: el.tagName.toLowerCase(),
        role: el.getAttribute('role'),
        rect: r,
        w: r.w,
        h: r.h,
        belowMin: r.w < limits.targetMin || r.h < limits.targetMin,
        disabled: el.matches(':disabled')
      };
    });
  const smallTargets = targets.filter((target) => target.belowMin);

  // ---------------------------------------------------------------- contrast
  const parse = (value) => {
    if (!value || value === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
    const text = String(value).trim().toLowerCase();
    if (text.startsWith('#')) {
      let hex = text.slice(1);
      if (hex.length === 3 || hex.length === 4) hex = hex.split('').map((c) => c + c).join('');
      if (hex.length === 6 || hex.length === 8) {
        return {
          r: parseInt(hex.slice(0, 2), 16),
          g: parseInt(hex.slice(2, 4), 16),
          b: parseInt(hex.slice(4, 6), 16),
          a: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1
        };
      }
    }
    const rgb = text.match(/^rgba?\(([^)]+)\)$/);
    if (rgb) {
      const parts = rgb[1].split(/[,/\s]+/).filter(Boolean);
      const channel = (part) => {
        const n = parseFloat(part);
        if (!Number.isFinite(n)) return 0;
        return Math.max(0, Math.min(255, part.endsWith('%') ? (n / 100) * 255 : n));
      };
      const alphaPart = parts[3];
      const alpha = alphaPart === undefined
        ? 1
        : alphaPart.endsWith('%')
          ? parseFloat(alphaPart) / 100
          : parseFloat(alphaPart);
      return {
        r: channel(parts[0]),
        g: channel(parts[1]),
        b: channel(parts[2]),
        a: Number.isFinite(alpha) ? Math.max(0, Math.min(1, alpha)) : 1
      };
    }
    const modern = text.match(/^color\(([^)]+)\)$/);
    if (modern) {
      const parts = modern[1].split(/[\s/]+/).filter(Boolean);
      if (parts.length >= 4) {
        return {
          r: Math.max(0, Math.min(255, parseFloat(parts[1]) * 255)),
          g: Math.max(0, Math.min(255, parseFloat(parts[2]) * 255)),
          b: Math.max(0, Math.min(255, parseFloat(parts[3]) * 255)),
          a: parts[4] === undefined ? 1 : parseFloat(parts[4])
        };
      }
    }
    return null;
  };

  const composite = (fg, bg) => {
    const a = fg.a + bg.a * (1 - fg.a);
    if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
    return {
      r: (fg.r * fg.a + bg.r * bg.a * (1 - fg.a)) / a,
      g: (fg.g * fg.a + bg.g * bg.a * (1 - fg.a)) / a,
      b: (fg.b * fg.a + bg.b * bg.a * (1 - fg.a)) / a,
      a
    };
  };
  const luminance = (color) => {
    const channel = (n) => {
      const c = n / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
  };
  const ratio = (a, b) => {
    const l1 = luminance(a);
    const l2 = luminance(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };

  const extractColors = (value) => {
    if (!value || value === 'none') return [];
    const matches = String(value).match(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|color\([^)]*\)/gi) || [];
    return matches
      .map((match) => parse(match))
      .filter((color) => color && color.a > 0);
  };

  const dedupeBackgrounds = (candidates) => {
    const seen = new Set();
    const result = [];
    for (const candidate of candidates) {
      const key = `${Math.round(candidate.color.r)},${Math.round(candidate.color.g)},${Math.round(candidate.color.b)},${candidate.image ? 1 : 0}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(candidate);
    }
    return result.slice(0, 8);
  };

  /**
   * Resolve o fundo efetivo inclusive para gradientes. Cada parada de gradiente
   * vira um candidato; o contraste é conferido contra o pior candidato. Imagens
   * sem cor declarada ficam marcadas como incertas (review), não como falha.
   */
  const effectiveBackgrounds = (el) => {
    const resolveNode = (node, depth) => {
      if (!node || depth > 40) {
        return [{ color: { r: 255, g: 255, b: 255, a: 1 }, image: false }];
      }
      const parentCandidates = resolveNode(node.parentElement, depth + 1);
      const cs = getComputedStyle(node);
      const ownColor = parse(cs.backgroundColor);
      let candidates = ownColor && ownColor.a > 0
        ? parentCandidates.map((candidate) => ({
            color: composite(ownColor, candidate.color),
            image: candidate.image
          }))
        : parentCandidates;

      const gradientColors = extractColors(cs.backgroundImage);
      if (gradientColors.length) {
        const fromGradient = [];
        for (const color of gradientColors) {
          for (const candidate of candidates) {
            fromGradient.push({
              color: composite(color, candidate.color),
              image: candidate.image
            });
          }
        }
        candidates = dedupeBackgrounds(fromGradient);
      } else if (cs.backgroundImage && cs.backgroundImage !== 'none') {
        candidates = candidates.map((candidate) => ({ ...candidate, image: true }));
      }
      return dedupeBackgrounds(candidates);
    };
    return resolveNode(el, 0);
  };

  const contrast = {
    text: { checked: 0, failures: [], reviews: [], unresolved: [], pairs: [] },
    ui: { checked: 0, failures: [], unresolved: [] }
  };

  const textCandidates = Array.from(body.querySelectorAll('*'))
    .filter((el) => el instanceof HTMLElement && isVisible(el))
    .filter((el) => !el.closest('.sprite, svg, [aria-hidden="true"], [data-tv2-contrast-exempt]'))
    .filter((el) => Array.from(el.childNodes).some((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim()))
    .slice(0, 500);

  for (const el of textCandidates) {
    const cs = getComputedStyle(el);
    const fg = parse(cs.color);
    const backgrounds = effectiveBackgrounds(el);
    if (!fg || !backgrounds.length) {
      contrast.text.unresolved.push({ el: describe(el), text: textOf(el).slice(0, 60) });
      continue;
    }
    const size = parseFloat(cs.fontSize);
    const weight = parseFloat(cs.fontWeight) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const required = large ? limits.largeTextContrast : limits.textContrast;
    let worst = null;
    for (const background of backgrounds) {
      const effectiveFg = fg.a < 1 ? composite(fg, background.color) : fg;
      const value = ratio(effectiveFg, background.color);
      if (!worst || value < worst.value) {
        worst = { value, background };
      }
    }
    const value = round(worst.value * 100) / 100;
    contrast.text.checked += 1;
    const item = {
      el: describe(el),
      text: textOf(el).slice(0, 70),
      color: cs.color,
      background: `rgb(${Math.round(worst.background.color.r)}, ${Math.round(worst.background.color.g)}, ${Math.round(worst.background.color.b)})`,
      fontSize: size,
      fontWeight: weight,
      ratio: value,
      required,
      image: worst.background.image
    };
    if (value < required) {
      if (worst.background.image) {
        contrast.text.reviews.push({ ...item, reason: 'fundo com imagem sem cor declarada; revisar manualmente' });
      } else {
        contrast.text.failures.push(item);
      }
    } else if (contrast.text.pairs.length < 12) {
      contrast.text.pairs.push(item);
    }
  }

  const uiCandidates = Array.from(
    body.querySelectorAll(
      '[data-tv2-ui], button, [role="button"], input, select, summary, [role="tab"], [data-tv2-seat], [data-tv2-assento], [data-tv2-card], [data-carta]'
    )
  )
    .filter(isVisible)
    .filter((el) => !el.matches(':disabled, [aria-disabled="true"]'))
    .slice(0, 300);

  for (const el of uiCandidates) {
    const cs = getComputedStyle(el);
    const borderWidths = [cs.borderTopWidth, cs.borderRightWidth, cs.borderBottomWidth, cs.borderLeftWidth]
      .map((width) => parseFloat(width) || 0);
    if (!borderWidths.some((width) => width > 0)) continue;
    if (cs.borderTopStyle === 'none' && cs.borderRightStyle === 'none' && cs.borderBottomStyle === 'none' && cs.borderLeftStyle === 'none') {
      continue;
    }
    const border = parse(cs.borderTopColor);
    const parents = el.parentElement ? effectiveBackgrounds(el.parentElement) : effectiveBackgrounds(el);
    if (!border || !parents.length) {
      contrast.ui.unresolved.push({ el: describe(el), color: cs.borderTopColor });
      continue;
    }
    let worst = null;
    for (const parent of parents) {
      const effectiveBorder = border.a < 1 ? composite(border, parent.color) : border;
      const value = ratio(effectiveBorder, parent.color);
      if (!worst || value < worst.value) worst = { value, background: parent };
    }

    // O limite visível pode ser a borda ou a própria superfície preenchida.
    // Controles com preenchimento contrastante não dependem de uma borda fina.
    const ownFill = parse(cs.backgroundColor);
    const ownGradient = extractColors(cs.backgroundImage);
    const fills = ownFill && ownFill.a > 0 ? [ownFill] : ownGradient;
    let fillContrast = 0;
    for (const fill of fills) {
      for (const parent of parents) {
        const value = ratio(fill.a < 1 ? composite(fill, parent.color) : fill, parent.color);
        if (value > fillContrast) fillContrast = value;
      }
    }

    const value = round(Math.max(worst.value, fillContrast) * 100) / 100;
    contrast.ui.checked += 1;
    if (value < limits.uiContrast) {
      contrast.ui.failures.push({
        el: describe(el),
        border: cs.borderTopColor,
        background: `rgb(${Math.round(worst.background.color.r)}, ${Math.round(worst.background.color.g)}, ${Math.round(worst.background.color.b)})`,
        ratio: value,
        required: limits.uiContrast
      });
    }
  }

  // -------------------------------------------------------------- reactions
  const reactionElements = all('reaction').filter(isVisible);
  const reactions = {
    count: reactionElements.length,
    labels: reactionElements.map((el) => (el.getAttribute('aria-label') || textOf(el)).slice(0, 100)),
    targetAttributes: [],
    trayVisible: !!firstVisible('reactionTray'),
    overlayVisible: !!firstVisible('overlay')
  };
  for (const el of reactionElements) {
    const attrs = attrList(el, /jogador|player|target|alvo|destinat/i);
    if (attrs.length) {
      reactions.targetAttributes.push({ el: describe(el), attrs });
    }
  }

  // -------------------------------------------------------------------- aria
  const liveRegions = all('live').map((el) => ({
    el: describe(el),
    live: el.getAttribute('aria-live'),
    role: el.getAttribute('role'),
    text: textOf(el).slice(0, 260),
    visible: isVisible(el)
  }));

  const currentElements = Array.from(document.querySelectorAll('[aria-current]'))
    .filter((el) => el.getAttribute('aria-current') !== 'false')
    .map((el) => ({
      el: describe(el),
      value: el.getAttribute('aria-current'),
      text: textOf(el).slice(0, 80),
      insideSeat: !!el.closest(selectors.seat.join(','))
    }));

  const dialogs = all('dialog')
    .filter(isVisible)
    .map((el) => ({
      el: describe(el),
      role: el.getAttribute('role'),
      modal: el.getAttribute('aria-modal'),
      label: (el.getAttribute('aria-label') || (el.getAttribute('aria-labelledby')
        ? textOf(document.getElementById(el.getAttribute('aria-labelledby')))
        : '')).slice(0, 160)
    }));

  const unnamedTargets = targets.filter((target) => !target.label.trim());

  const tablists = Array.from(document.querySelectorAll('[role="tablist"]')).filter(isVisible).length;
  const tabs = Array.from(document.querySelectorAll('[role="tab"]')).filter(isVisible).length;

  // ------------------------------------------------------------------ drawer
  const drawerEl = firstVisible('drawer');
  const drawer = drawerEl
    ? {
        visible: true,
        rect: rectOf(drawerEl),
        position: getComputedStyle(drawerEl).position,
        layerPosition: drawerEl.parentElement ? getComputedStyle(drawerEl.parentElement).position : null,
        role: drawerEl.getAttribute('role'),
        modal: drawerEl.getAttribute('aria-modal'),
        label: (drawerEl.getAttribute('aria-label') || '').slice(0, 120),
        sections: Array.from(drawerEl.querySelectorAll('h2, h3, h4'))
          .map((heading) => textOf(heading))
          .filter(Boolean)
          .slice(0, 12),
        focusableCount: all('focusable', drawerEl).filter(isVisible).length,
        tableHeight: tableRect ? tableRect.h : screenRect ? screenRect.h : null
      }
    : { visible: false };

  if (drawer.visible) {
    drawer.tableHeightAfter = tableRect ? tableRect.h : screenRect ? screenRect.h : null;
  }

  // --------------------------------------------------------------- overlays
  const overlays = all('dialog')
    .filter(isVisible)
    .map((el) => ({
      el: describe(el),
      role: el.getAttribute('role'),
      text: textOf(el).slice(0, 220)
    }));

  // ----------------------------------------------------------------- preview
  const previewFrames = Array.from(document.querySelectorAll('[data-largura]'))
    .filter(isVisible)
    .map((el) => ({
      largura: el.getAttribute('data-largura'),
      rect: rectOf(el),
      label: (el.getAttribute('aria-label') || '').slice(0, 140),
      tableshell: !!el.querySelector('[class*="table"], [data-tv2-table]')
    }));

  // ------------------------------------------------------------- dom tokens
  const domTokens = [];
  const seenDomTokens = new Set();
  for (const el of body.querySelectorAll('*')) {
    for (const attr of Array.from(el.attributes)) {
      const suspiciousName = /taunt|provoc|jogador-alvo|reaction-target/i.test(attr.name);
      const suspiciousValue = /taunt|provoc/i.test(attr.value);
      if (!suspiciousName && !suspiciousValue) continue;
      const key = `${attr.name}=${attr.value}`;
      if (seenDomTokens.has(key)) continue;
      seenDomTokens.add(key);
      domTokens.push({ attr: attr.name, value: attr.value.slice(0, 160), el: describe(el) });
      if (domTokens.length >= 50) break;
    }
    if (domTokens.length >= 50) break;
  }

  // -------------------------------------------------------------- read-only
  const fontsStatus = document.fonts ? document.fonts.status : null;
  const fontsLoaded = document.fonts
    ? {
        atkinson: document.fonts.check('16px "Atkinson Hyperlegible Next"'),
        fraunces: document.fonts.check('32px "Fraunces"'),
        status: fontsStatus
      }
    : null;

  return {
    meta: {
      url: location.href,
      hash: location.hash,
      title: document.title,
      lang: html.getAttribute('lang'),
      readyState: document.readyState,
      state: state.id,
      kind: state.kind,
      screenKind,
      measuredAt: new Date().toISOString(),
      userAgent: navigator.userAgent.slice(0, 220),
      warnings
    },
    viewport,
    scroll,
    screen: { rect: screenRect, kind: screenKind },
    table: { rect: tableRect, centerRect },
    hand: {
      rect: handRect,
      scrollWidth: handEl ? handEl.scrollWidth : null,
      clientWidth: handEl ? handEl.clientWidth : null,
      scrollHeight: handEl ? handEl.scrollHeight : null,
      clientHeight: handEl ? handEl.clientHeight : null,
      overflowX: handEl ? getComputedStyle(handEl).overflowX : null,
      overflowY: handEl ? getComputedStyle(handEl).overflowY : null,
    },
    seats,
    seatCount: seats.length,
    seatSides,
    seatOverlaps,
    seatsOutsideTable: tableRect ? seats.filter((seat) => seat.insideTable === false).map((seat) => seat.name) : [],
    names,
    cards,
    cardsMin,
    cardRows,
    fonts,
    textBelowMinimum,
    textElementsChecked,
    targets: { total: targets.length, belowMin: smallTargets },
    contrast: {
      text: {
        checked: contrast.text.checked,
        failures: contrast.text.failures,
        reviews: contrast.text.reviews,
        unresolved: contrast.text.unresolved,
        pairs: contrast.text.pairs
      },
      ui: contrast.ui
    },
    reactions,
    aria: {
      liveRegions,
      currentElements,
      currentSeats: currentElements.filter((item) => item.insideSeat).length,
      dialogs,
      unnamedTargets,
      tablists,
      tabs
    },
    drawer,
    overlays,
    previewFrames,
    domTokens,
    fontsLoaded,
    bodyText: (body ? body.innerText : '').replace(/\n{3,}/g, '\n\n').slice(0, 60000),
    counts: {
      buttons: document.querySelectorAll('button').length,
      links: document.querySelectorAll('a[href]').length,
      dialogs: document.querySelectorAll('[role="dialog"], [role="alertdialog"]').length
    }
  };
}
