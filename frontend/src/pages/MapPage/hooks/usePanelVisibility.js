import { useState } from 'react';
import { readFlag, writeFlag } from '@/shared/lib/localFlag';

// Скрытые боковые панели запоминаются: левая — всегда, правая — если её скрыли на общем обзоре.
const LEFT_HIDDEN_KEY = 'viberay:map:left-hidden';
const RIGHT_HIDDEN_KEY = 'viberay:map:right-hidden';
const OVERVIEW_KEY = 'overview::';

// Видимость боковых панелей. Правая скрыта для того содержимого (contentKey), при котором её
// скрыли: выбор района или проблемы открывает её снова, а возврат к обзору — снова прячет.
export function usePanelVisibility(contentKey) {
  const [leftHidden, setLeftHidden] = useState(() => readFlag(LEFT_HIDDEN_KEY));
  const [rightHiddenOn, setRightHiddenOn] = useState(() =>
    readFlag(RIGHT_HIDDEN_KEY) ? OVERVIEW_KEY : null,
  );
  const rightHidden = rightHiddenOn === contentKey;

  const toggleLeft = () => {
    writeFlag(LEFT_HIDDEN_KEY, !leftHidden);
    setLeftHidden(!leftHidden);
  };
  const toggleRight = () => {
    const next = rightHidden ? null : contentKey;
    writeFlag(RIGHT_HIDDEN_KEY, next === OVERVIEW_KEY);
    setRightHiddenOn(next);
  };

  return { leftHidden, rightHidden, toggleLeft, toggleRight };
}
