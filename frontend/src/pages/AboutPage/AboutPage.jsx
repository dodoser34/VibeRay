import { useCallback, useState } from 'react';
import { useTransitionNavigate, useTransitionReady } from '@/app/transitions/useTransition';
import { StoryExperience, StoryGuide } from '@/features/story';
import { useLanguage } from '@/shared/hooks/useLanguage';

export function AboutPage() {
  // Страница — корень своей ветки: при смене языка перерисовывается вместе со всем содержимым.
  useLanguage();
  const go = useTransitionNavigate();
  const openMap = () => go('/map/kostanay');
  // Переход на страницу остаётся закрытым, пока 3D-комната не загрузится и не отрисует первый кадр.
  const [ready, setReady] = useState(false);
  useTransitionReady(ready);
  const onReady = useCallback(() => setReady(true), []);

  return (
    <>
      <StoryExperience onOpenMap={openMap} onReady={onReady} />
      <StoryGuide onOpenMap={openMap} />
    </>
  );
}
