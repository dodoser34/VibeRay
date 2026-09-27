import { useCallback, useEffect, useRef, useState } from 'react';

// Загружает данные по строковому ключу. Пока грузится новый ключ, держит прежние данные, чтобы
// панели и карта не мигали пустотой при смене периода.
export function useRequest(key, fetcher) {
  const fetcherRef = useRef(fetcher);
  const [state, setState] = useState({ key: null, data: null, error: null });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  useEffect(() => {
    if (key === null) return undefined;
    let cancelled = false;
    fetcherRef.current().then(
      (data) => !cancelled && setState({ key, data, error: null }),
      (error) => !cancelled && setState((prev) => ({ key, data: prev.data, error })),
    );
    return () => {
      cancelled = true;
    };
  }, [key, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  return {
    data: state.data,
    error: state.error,
    loading: key !== null && state.key !== key,
    reload,
  };
}
