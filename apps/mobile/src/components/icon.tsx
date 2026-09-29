import { SymbolView, type SymbolViewProps } from 'expo-symbols';

import { useTheme } from '@/hooks/use-theme';

// SF Symbols on iOS, Material Symbols on Android and web. One icon family per platform.
export function Icon({ name, size = 22, color }: { name: SymbolViewProps['name']; size?: number; color?: string }) {
  const theme = useTheme();
  return <SymbolView name={name} size={size} tintColor={color ?? theme.text} />;
}
