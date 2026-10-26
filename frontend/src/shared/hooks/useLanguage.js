import { useSyncExternalStore } from 'react';
import { getLanguage, subscribeLanguage } from '@/shared/lib/i18n/language';

// Текущий язык интерфейса; компонент перерисовывается, когда язык меняется.
export function useLanguage() {
  return useSyncExternalStore(subscribeLanguage, getLanguage);
}
