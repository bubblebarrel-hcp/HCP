'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { MEMBERSHIPS_CHANGED } from '@/lib/membership';
import type { MyMembership, Page } from '@/lib/types';
import api from '@/services/api';

function fetchMine() {
  return api.get<{ data: Page<MyMembership> }>('/me/memberships').then((res) => res.data.data.items);
}

// The signed-in hasher's memberships. Reloads whenever any component announces
// a membership change (notifyMembershipsChanged).
export function useMyMemberships() {
  const { user } = useAuth();
  const [items, setItems] = useState<MyMembership[] | null>(null);
  const [error, setError] = useState(false);

  const reload = useCallback(async () => {
    try {
      setItems(await fetchMine());
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const refresh = () => {
      fetchMine()
        .then((data) => {
          if (cancelled) return;
          setItems(data);
          setError(false);
        })
        .catch(() => {
          if (!cancelled) setError(true);
        });
    };
    refresh();
    window.addEventListener(MEMBERSHIPS_CHANGED, refresh);
    return () => {
      cancelled = true;
      window.removeEventListener(MEMBERSHIPS_CHANGED, refresh);
    };
  }, [user]);

  return { memberships: user ? items : null, error: Boolean(user) && error, reload };
}
