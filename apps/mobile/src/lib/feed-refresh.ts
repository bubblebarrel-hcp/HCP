// A tiny pub/sub so something posted from anywhere (the + button in the bottom bar)
// can make the home feed reload, the way the web raises FEED_REFRESH_EVENT.
type Listener = () => void;

const listeners = new Set<Listener>();

export function onFeedRefresh(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitFeedRefresh() {
  listeners.forEach((listener) => listener());
}
