import { Outlet } from 'react-router';
import { useViewport } from '@/adaptations/core';
import { MobileNav } from '@/adaptations/mobile/navigation/MobileNav';
import { AnimatedBackground } from './layout/AnimatedBackground';
import { TabBar } from './layout/TabBar';
import { TransitionProvider } from './transitions/TransitionProvider';
import { useLanguageRoute } from './useLanguageRoute';
import { useRoleRoute } from './useRoleRoute';

export function App() {
  // Язык — из адреса (/en/…); оболочка (шапка, меню) перерисовывается на новом языке без
  // перезагрузки.
  useLanguageRoute();
  useRoleRoute();
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
