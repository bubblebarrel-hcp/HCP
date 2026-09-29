'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

// A generic QR renderer — the passport share link is its first caller
// (FR-PASSPORT-007); membership invitations (D53) want one too and can reuse
// this rather than each growing its own.
export function QrCode({ value, size = 160, className }: { value: string; size?: number; className?: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value, { width: size, margin: 1 })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (!dataUrl) {
    return <div className={className} style={{ width: size, height: size }} aria-hidden />;
  }
  // eslint-disable-next-line @next/next/no-img-element -- a generated data URL, not a remote image
  return <img src={dataUrl} width={size} height={size} alt="" className={className} data-testid="qr-code" />;
}
