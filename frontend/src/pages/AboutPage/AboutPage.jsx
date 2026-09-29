import { useTransitionNavigate } from '@/app/transitions/useTransition';
import { StoryExperience, StoryGuide } from '@/features/story';
import { useLanguage } from '@/shared/hooks/useLanguage';

export function AboutPage() {
  // Страница — корень своей ветки: при смене языка перерисовывается вместе со всем содержимым.
  useLanguage();
  const go = useTransitionNavigate();
  const openMap = () => go('/map/kostanay');

  return (
    <>
      <StoryExperience onOpenMap={openMap} />
      <StoryGuide onOpenMap={openMap} />
    </>
  );
}
