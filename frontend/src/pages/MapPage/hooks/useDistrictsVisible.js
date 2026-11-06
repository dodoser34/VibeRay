import { useState } from 'react';
import { readFlag, writeFlag } from '@/shared/lib/localFlag';

const STORAGE_KEY = 'viberay:map:districts-hidden';

// Показаны ли районы на карте (переключатель в фильтрах; без них — только карта дорог). Выбор
// запоминается в браузере.
export function useDistrictsVisible() {
  const [visible, setVisible] = useState(() => !readFlag(STORAGE_KEY));
  const changeVisible = (value) => {
    writeFlag(STORAGE_KEY, !value);
    setVisible(value);
  };
  return [visible, changeVisible];
}
