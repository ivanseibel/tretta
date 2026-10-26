/**
 * Utilidades WCAG 2.1 usadas no Node e nos relatórios.
 * A medição no DOM devolve cores computadas; o cálculo canônico fica aqui.
 */

const HEX = /^#([0-9a-f]{3,8})$/i;
const RGB = /^rgba?\(([^)]+)\)$/i;

export function parseColor(value) {
  if (!value || value === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  const text = String(value).trim().toLowerCase();

  if (HEX.test(text)) {
    let hex = text.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      hex = hex
        .split('')
        .map((c) => c + c)
        .join('');
    }
    if (hex.length === 6 || hex.length === 8) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1
      };
    }
  }

  if (RGB.test(text)) {
    const parts = text.slice(text.indexOf('(') + 1, -1).split(/[,/\s]+/).filter(Boolean);
    if (parts.length >= 3) {
      const channel = (part) => {
        const n = parseFloat(part);
        return Number.isFinite(n) ? Math.max(0, Math.min(255, part.endsWith('%') ? (n / 100) * 255 : n)) : 0;
      };
      const alphaPart = parts[3];
      const alpha = alphaPart === undefined ? 1 : alphaPart.endsWith('%') ? parseFloat(alphaPart) / 100 : parseFloat(alphaPart);
      return {
        r: channel(parts[0]),
        g: channel(parts[1]),
        b: channel(parts[2]),
        a: Number.isFinite(alpha) ? Math.max(0, Math.min(1, alpha)) : 1
      };
    }
  }

  // color(srgb r g b / a) e color(display-p3 ...) aparecem em telas wide-gamut.
  const modern = text.match(/^color\(([^)]+)\)$/i);
  if (modern) {
    const parts = modern[1].split(/[\s/]+/).filter(Boolean);
    if (parts.length >= 4) {
      const [, r, g, b, a] = parts;
      const to255 = (part) => Math.max(0, Math.min(255, parseFloat(part) * 255));
      const alpha = a === undefined ? 1 : parseFloat(a);
      return { r: to255(r), g: to255(g), b: to255(b), a: Number.isFinite(alpha) ? alpha : 1 };
    }
  }

  return null;
}

export function composite(fg, bg) {
  const a = fg.a + bg.a * (1 - fg.a);
  if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
  return {
    r: (fg.r * fg.a + bg.r * bg.a * (1 - fg.a)) / a,
    g: (fg.g * fg.a + bg.g * bg.a * (1 - fg.a)) / a,
    b: (fg.b * fg.a + bg.b * bg.a * (1 - fg.a)) / a,
    a
  };
}

export function channelLuminance(channel) {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(color) {
  return 0.2126 * channelLuminance(color.r) + 0.7152 * channelLuminance(color.g) + 0.0722 * channelLuminance(color.b);
}

export function contrastRatio(fg, bg) {
  const a = relativeLuminance(fg);
  const b = relativeLuminance(bg);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

export function contrastForColors(fgValue, bgValue) {
  const fg = parseColor(fgValue);
  const bg = parseColor(bgValue);
  if (!fg || !bg) return null;
  const effective = bg.a < 1 ? composite(bg, { r: 255, g: 255, b: 255, a: 1 }) : bg;
  return contrastRatio(composite(fg, effective), effective);
}

export function requiredRatio({ fontSize, fontWeight }) {
  const size = parseFloat(fontSize || '0');
  const weight = parseFloat(fontWeight || '400') || 400;
  const large = size >= 24 || (size >= 18.66 && weight >= 700);
  return large ? 3 : 4.5;
}

export function round2(value) {
  return Math.round(value * 100) / 100;
}
