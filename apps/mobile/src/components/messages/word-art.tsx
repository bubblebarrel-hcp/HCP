import { Platform, StyleSheet, Text, View, type TextStyle } from 'react-native';

// Words on a sticker, in a style (D73). Everything is drawn from plain Text: React
// Native has no outline, glow or extrusion, so each effect is the same words drawn
// several times, nudged and tinted, with the real ones on top. What is drawn is
// captured as a picture, so what you see in the editor is what the sticker is.

export type ArtStyle = 'classic' | 'bubble' | 'comic' | 'neon' | 'retro' | 'banner' | 'shadow' | 'plain';
export type ArtFont = 'sans' | 'condensed' | 'serif' | 'mono' | 'casual' | 'cursive';

export const STYLES: { id: ArtStyle; label: string }[] = [
  { id: 'classic', label: 'Classic' },
  { id: 'bubble', label: 'Bubble' },
  { id: 'comic', label: 'Comic' },
  { id: 'neon', label: 'Neon' },
  { id: 'retro', label: '3D' },
  { id: 'banner', label: 'Banner' },
  { id: 'shadow', label: 'Shadow' },
  { id: 'plain', label: 'Plain' },
];

// Android names its fonts by family; iOS by face. Each is a font that ships with the
// phone, so there is nothing to download and nothing to licence.
const FAMILIES: Record<ArtFont, string> = Platform.select({
  ios: { sans: 'Helvetica Neue', condensed: 'AvenirNextCondensed-Bold', serif: 'Georgia', mono: 'Courier New', casual: 'MarkerFelt-Wide', cursive: 'SnellRoundhand-Bold' },
  default: { sans: 'sans-serif', condensed: 'sans-serif-condensed', serif: 'serif', mono: 'monospace', casual: 'casual', cursive: 'cursive' },
}) as Record<ArtFont, string>;

export const FONTS: { id: ArtFont; label: string }[] = [
  { id: 'sans', label: 'Clean' },
  { id: 'condensed', label: 'Tall' },
  { id: 'serif', label: 'Serif' },
  { id: 'mono', label: 'Type' },
  { id: 'casual', label: 'Marker' },
  { id: 'cursive', label: 'Script' },
];

export interface TextLayerData {
  id: string;
  text: string;
  color: string;
  style: ArtStyle;
  font: ArtFont;
  bold: boolean;
  italic: boolean;
  upper: boolean;
}

export const SIZE = 38;

// ── Colour helpers ──

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

const toHex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;

/** Black on a light colour, white on a dark one. */
export function contrast(hex: string) {
  const [r, g, b] = rgb(hex);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#111111' : '#ffffff';
}

/** Towards black by `amount` (0 to 1). */
export function darken(hex: string, amount: number) {
  const [r, g, b] = rgb(hex);
  return toHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
}

/** Towards white by `amount` (0 to 1). */
export function lighten(hex: string, amount: number) {
  const [r, g, b] = rgb(hex);
  return toHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount);
}

export function hslToHex(h: number, s: number, l: number) {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return l / 100 - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
  };
  return toHex(f(0) * 255, f(8) * 255, f(4) * 255);
}

// ── The effects ──

interface Copy {
  dx: number;
  dy: number;
  color: string;
  extra?: TextStyle;
}

const RING = [0, 45, 90, 135, 180, 225, 270, 315];
const ring = (r: number, color: string): Copy[] =>
  RING.map((deg) => ({ dx: Math.cos((deg * Math.PI) / 180) * r, dy: Math.sin((deg * Math.PI) / 180) * r, color }));

function effect(style: ArtStyle, color: string, size: number): { behind: Copy[]; front: Copy; pad: number; extra?: TextStyle } {
  const edge = contrast(color);
  switch (style) {
    case 'classic':
      return { behind: ring(size * 0.07, edge === '#ffffff' ? '#000000' : '#ffffff'), front: { dx: 0, dy: 0, color }, pad: size * 0.1 };
    case 'bubble':
      return {
        behind: [
          { dx: 0, dy: size * 0.1, color: 'rgba(0,0,0,0.35)', extra: { textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: size * 0.12 } },
          ...ring(size * 0.13, '#ffffff'),
          ...ring(size * 0.07, '#ffffff'),
        ],
        front: { dx: 0, dy: 0, color },
        pad: size * 0.2,
      };
    case 'comic':
      return {
        behind: [{ dx: size * 0.1, dy: size * 0.1, color: '#000000' }, ...ring(size * 0.08, '#000000')],
        front: { dx: 0, dy: 0, color },
        pad: size * 0.2,
      };
    case 'neon':
      return {
        behind: [{ dx: 0, dy: 0, color, extra: { textShadowColor: color, textShadowRadius: size * 0.5 } }, { dx: 0, dy: 0, color, extra: { textShadowColor: color, textShadowRadius: size * 0.2 } }],
        front: { dx: 0, dy: 0, color: lighten(color, 0.75) },
        pad: size * 0.55,
      };
    case 'retro': {
      const side = darken(color, 0.55);
      const steps = Array.from({ length: 9 }, (_, i) => ({ dx: (i + 1) * size * 0.025, dy: (i + 1) * size * 0.03, color: side }));
      return { behind: [...steps.reverse(), ...ring(size * 0.04, edge === '#ffffff' ? '#000000' : '#ffffff')], front: { dx: 0, dy: 0, color }, pad: size * 0.14 };
    }
    case 'shadow':
      return {
        behind: [{ dx: size * 0.05, dy: size * 0.07, color: 'rgba(0,0,0,0.6)', extra: { textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: size * 0.1 } }],
        front: { dx: 0, dy: 0, color },
        pad: size * 0.2,
      };
    case 'banner':
    case 'plain':
    default:
      return { behind: [], front: { dx: 0, dy: 0, color: style === 'banner' ? edge : color }, pad: 0 };
  }
}

/** One text layer, drawn. Single line: the copies would not line up across a wrap. */
export function WordArt({ layer }: { layer: TextLayerData }) {
  const text = layer.upper ? layer.text.toUpperCase() : layer.text;
  const size = SIZE;
  const fx = effect(layer.style, layer.color, size);
  const base: TextStyle = {
    fontFamily: FAMILIES[layer.font],
    fontSize: size,
    lineHeight: size * 1.25,
    fontWeight: layer.bold ? '900' : '500',
    fontStyle: layer.italic ? 'italic' : 'normal',
    includeFontPadding: false,
  };
  const body = (
    <View style={{ padding: fx.pad }}>
      {/* This one sets the size; the visible ones are laid over it. */}
      <Text numberOfLines={1} style={[base, { opacity: 0 }]}>
        {text}
      </Text>
      {[...fx.behind, fx.front].map((c, i) => (
        <Text
          key={i}
          numberOfLines={1}
          style={[base, StyleSheet.absoluteFill, { left: fx.pad + c.dx, top: fx.pad + c.dy, right: undefined, bottom: undefined, color: c.color }, c.extra]}>
          {text}
        </Text>
      ))}
    </View>
  );
  if (layer.style !== 'banner') return body;
  // A banner is the words on a coloured plate.
  return (
    <View style={{ backgroundColor: layer.color, borderRadius: size * 0.35, paddingHorizontal: size * 0.3, paddingVertical: size * 0.05 }}>
      {body}
    </View>
  );
}
