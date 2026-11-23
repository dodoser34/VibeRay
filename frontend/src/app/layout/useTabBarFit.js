import { useCallback, useState, useSyncExternalStore } from 'react';

function subscribe(callback) {
  window.addEventListener('resize', callback);
  return () => window.removeEventListener('resize', callback);
}

// Помещается ли таб-бар: вкладки между логотипом и правыми кнопками. Сколько места им нужно,
// зависит от языка, роли и ника, поэтому порог не задан заранее — его измеряет сам таб-бар
// (TabBar → reportOverflow) и сообщает ширину окна, при которой вкладки поместятся. Пока окно уже
// этой ширины, App показывает меню-навигацию (MobileNav), а не обрезанные или наехавшие вкладки.
// Сменились язык или пользователь — замер сбрасывается: таб-бар появляется и меряет себя заново.
export function useTabBarFit(context) {
  const [overflow, setOverflow] = useState({ context, needed: 0 });
  const needed = overflow.context === context ? overflow.needed : 0;
  // Перерисовка — только когда окно пересекло нужную ширину, а не на каждый пиксель ресайза.
  const fits = useSyncExternalStore(subscribe, () => !needed || window.innerWidth >= needed);
  const reportOverflow = useCallback(
    (width) => setOverflow({ context, needed: Math.ceil(width) }),
    [context],
  );
  return { fits, reportOverflow };
}
