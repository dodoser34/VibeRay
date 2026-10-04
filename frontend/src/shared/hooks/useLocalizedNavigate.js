import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { localizePath } from '@/shared/lib/language';

// navigate() для путей без префикса языка: navigate('/about') на английской версии ведёт на
// /en/about. Числа (история) и относительные пути проходят как есть.
export function useLocalizedNavigate() {
  const navigate = useNavigate();
  return useCallback(
    (to, options) =>
      navigate(typeof to === 'string' && to.startsWith('/') ? localizePath(to) : to, options),
    [navigate],
  );
}
