'use client';

import { useEffect, useMemo } from 'react';
import { isVideoFile } from '@/lib/posts';

// A chosen file, seen, before anything is uploaded. The object URL is made once
// per file and handed back when it leaves the screen; nothing here touches the
// network. A clip is a muted still of its first frame, not a player: the real
// controls come once it is posted.
export function FilePreview({ file, className }: { file: File; className?: string }) {
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  if (isVideoFile(file)) {
    return <video src={`${url}#t=0.1`} muted playsInline preload="metadata" aria-label={file.name} className={className} />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={file.name} className={className} />;
}
