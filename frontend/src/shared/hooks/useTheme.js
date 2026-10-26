import { useSyncExternalStore } from 'react';
import { getTheme, subscribeTheme } from '@/shared/lib/theme/theme';

// Текущая тема оформления; компонент перерисовывается, когда тема меняется.
export function useTheme() {
  return useSyncExternalStore(subscribeTheme, getTheme);
}
