import { Outlet } from 'react-router';
import { useViewport } from '@/adaptations/core';
import { MobileNav } from '@/adaptations/mobile/navigation/MobileNav';
import { useLanguage } from '@/shared/hooks/useLanguage';
import { AnimatedBackground } from './layout/AnimatedBackground';
import { TabBar } from './layout/TabBar';
import { TransitionProvider } from './transitions/TransitionProvider';

export function App() {
  // Оболочка (шапка, меню) перерисовывается на новом языке без перезагрузки.
  useLanguage();
  const { isMobile } = useViewport();
  return (
    <TransitionProvider>
      <AnimatedBackground />
      {isMobile ? <MobileNav /> : <TabBar />}
      <main>
        <Outlet />
      </main>
    </TransitionProvider>
  );
}
