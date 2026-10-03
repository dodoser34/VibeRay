import { useSyncExternalStore } from 'react';
import { getGraphicsMode, isLiteGraphics, subscribeGraphics } from './graphicsMode';

// Выбранный режим графики («auto» | «full» | «lite»).
export function useGraphicsMode() {
  return useSyncExternalStore(subscribeGraphics, getGraphicsMode);
}

// Показывать ли лёгкую графику вместо тяжёлых сцен (с учётом «авто»).
export function useLiteGraphics() {
  return useSyncExternalStore(subscribeGraphics, isLiteGraphics);
}
