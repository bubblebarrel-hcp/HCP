// Banner crop position, shared by a kennel's banner (D37) and a hasher's (D56).
//
// The banner is cropped to a wide strip, so a picture that is not already that
// shape has more of itself than fits. Where that crop sits is `bannerPosition`,
// a CSS background-position pair the owner drags into place; null is centred.

export type BannerPoint = { x: number; y: number };

export const CENTRED: BannerPoint = { x: 50, y: 50 };
export const KEY_STEP = 2;

export function clamp(n: number) {
  return Math.min(100, Math.max(0, n));
}

export function parsePosition(value: string | null): BannerPoint {
  const match = /^(\d{1,3}(?:\.\d+)?)% (\d{1,3}(?:\.\d+)?)%$/.exec(value ?? '');
  if (!match) return CENTRED;
  return { x: clamp(Number(match[1])), y: clamp(Number(match[2])) };
}

export function formatPosition(point: BannerPoint) {
  return `${Math.round(point.x)}% ${Math.round(point.y)}%`;
}
