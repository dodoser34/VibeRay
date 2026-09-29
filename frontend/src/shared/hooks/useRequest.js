import { useCallback, useEffect, useRef, useState } from 'react';
import { trackLanguageWork } from '@/shared/lib/language';
import { useLanguage } from './useLanguage';

// Загружает данные по строковому ключу. Пока грузится новый ключ, держит прежние данные, чтобы
// панели и карта не мигали пустотой при смене периода. При смене языка запрос повторяется: сервер
// отдаёт названия районов и свои подписи на языке запроса.
export function useRequest(key, fetcher) {
  const language = useLanguage();
  const languageRef = useRef(language);
  const fetcherRef = useRef(fetcher);
  const [state, setState] = useState({ key: null, data: null, error: null });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  useEffect(() => {
    if (key === null) return undefined;
    let cancelled = false;
    const request = fetcherRef.current().then(
      (data) => !cancelled && setState({ key, data, error: null }),
      (error) => !cancelled && setState((prev) => ({ key, data: prev.data, error })),
    );
    if (languageRef.current !== language) {
      languageRef.current = language;
      trackLanguageWork(request);
    }
    return () => {
      cancelled = true;
    };
  }, [key, version, language]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  return {
    data: state.data,
    error: state.error,
    loading: key !== null && state.key !== key,
    reload,
  };
}
