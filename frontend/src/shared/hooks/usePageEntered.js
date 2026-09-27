import { useSyncExternalStore } from 'react';
import { isPageEntered, subscribePageEntrance } from '@/shared/animations/pageEntrance';

// true, когда страница видна и её анимации появления могут играть (см. pageEntrance.js).
export function usePageEntered() {
  return useSyncExternalStore(subscribePageEntrance, isPageEntered, () => true);
}
