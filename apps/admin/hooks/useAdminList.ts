'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import api, { errorMessage } from '@/services/api';
import type { Page } from '@/lib/types';

// One fetch-and-paginate loop for every admin list. Filters are applied
// server-side; changing one sends the list back to page 1.
export function useAdminList<T>(path: string, filters: Record<string, string | undefined>, limit = 25) {
  const [data, setData] = useState<Page<T> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  // Callers pass a fresh object each render; the serialised form is the identity.
  const key = JSON.stringify(filters);
  const params = useMemo(
    () => Object.fromEntries(Object.entries(JSON.parse(key) as Record<string, string | undefined>).filter(([, v]) => v)),
    [key],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: Page<T> }>(path, { params: { page, limit, ...params } });
      setData(res.data.data);
    } catch (err) {
      setError(errorMessage(err, 'Could not load this list'));
    } finally {
      setLoading(false);
    }
  }, [path, page, limit, params]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount: the loader sets state as it starts
    void load();
  }, [load]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a changed filter starts again from page 1
    setPage(1);
  }, [key]);

  return { data, loading, error, page, setPage, reload: load, limit };
}
