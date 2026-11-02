import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

/** Loads data every time a screen comes into view, so it never shows something stale. */
export function useFocusData<T>(load: () => Promise<T>, initial: T) {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const next = await load();
    setData(next);
    setLoading(false);
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  return { data, loading, reload };
}
