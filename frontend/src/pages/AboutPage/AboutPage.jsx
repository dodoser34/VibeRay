import { useTransitionNavigate } from '@/app/transitions/useTransition';
import { StoryExperience, StoryGuide } from '@/features/story';

export function AboutPage() {
  const go = useTransitionNavigate();
  const openMap = () => go('/map/kostanay');

  return (
    <>
      <StoryExperience onOpenMap={openMap} />
      <StoryGuide onOpenMap={openMap} />
    </>
  );
}
