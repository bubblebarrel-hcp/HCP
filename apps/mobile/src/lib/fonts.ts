// The web app's typeface is Geist (app/layout.tsx). React Native picks a custom font
// by family name, one family per weight, so a CSS-style fontWeight is mapped to the
// matching Geist file here.
export function fontFamilyFor(weight?: string | number | null) {
  const w = typeof weight === 'string' ? (weight === 'bold' ? 700 : weight === 'normal' ? 400 : Number(weight)) : (weight ?? 400);
  if (w >= 700) return 'Geist_700Bold';
  if (w >= 600) return 'Geist_600SemiBold';
  if (w >= 500) return 'Geist_500Medium';
  return 'Geist_400Regular';
}
