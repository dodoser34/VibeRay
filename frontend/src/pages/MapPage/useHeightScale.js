import { useState } from 'react';
import { readNumber, writeNumber } from '@/shared/lib/localFlag';
import { HEIGHT_SCALE } from './heightScale';

const STORAGE_KEY = 'viberay:map:height-scale';

// Множитель высоты районов (ползунок в фильтрах); выбор запоминается в браузере.
export function useHeightScale() {
  const [heightScale, setHeightScale] = useState(() =>
    Math.min(HEIGHT_SCALE.max, Math.max(0, readNumber(STORAGE_KEY, HEIGHT_SCALE.initial))),
  );
  const changeHeightScale = (value) => {
    writeNumber(STORAGE_KEY, value);
    setHeightScale(value);
  };
  return [heightScale, changeHeightScale];
}
