import { useSyncExternalStore } from 'react';

// Which legal documents have been read to the end during this sign-up. In memory
// only: the acceptance belongs to creating one account, so the register screen
// clears it when it opens and nothing carries over to the next attempt.

export type LegalConsent = { terms: boolean; privacy: boolean };

let state: LegalConsent = { terms: false, privacy: false };
const listeners = new Set<() => void>();

function emit(next: LegalConsent) {
  state = next;
  listeners.forEach((l) => l());
}

export function resetLegalConsent() {
  emit({ terms: false, privacy: false });
}

export function setLegalAccepted(slug: keyof LegalConsent, accepted: boolean) {
  emit({ ...state, [slug]: accepted });
}

export function useLegalConsent(): LegalConsent & { all: boolean } {
  const s = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
  );
  return { ...s, all: s.terms && s.privacy };
}
