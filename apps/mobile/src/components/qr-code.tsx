import { View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

// A generic QR renderer, the native twin of the web's components/QrCode.tsx: the passport
// share link was its first caller (FR-PASSPORT-007); membership invitations (D53) use it
// too. QR codes are always dark on white so they scan in either theme.
export function QrCode({ value, size = 160, padding = 8 }: { value: string; size?: number; padding?: number }) {
  return (
    <View
      testID="qr-code"
      accessibilityLabel="QR code"
      style={{ alignSelf: 'flex-start', padding, borderRadius: 8, borderWidth: 1, borderColor: '#0000001a', backgroundColor: '#ffffff' }}>
      <QRCode value={value} size={size} color="#000000" backgroundColor="#ffffff" quietZone={0} />
    </View>
  );
}
