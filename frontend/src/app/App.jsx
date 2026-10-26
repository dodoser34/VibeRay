import { Outlet } from 'react-router';
import { useViewport } from '@/adaptations/core';
import { MobileNav } from '@/adaptations/mobile/components/navigation/MobileNav';
import { AnimatedBackground } from './layout/AnimatedBackground';
import { TabBar } from './layout/TabBar';
import { TransitionProvider } from './transitions/TransitionProvider';
import { useLanguageRoute } from './routing/useLanguageRoute';
import { useRoleRoute } from './routing/useRoleRoute';

export function App() {
  // Язык — из адреса (/en/…); оболочка (шапка, меню) перерисовывается на новом языке без
  // перезагрузки.
  useLanguageRoute();
  useRoleRoute();
  const { phoneNav } = useViewport();
  return (
    <TransitionProvider>
      <AnimatedBackground />
      {phoneNav ? <MobileNav /> : <TabBar />}
      <main>
        <Outlet />
      </main>
    </TransitionProvider>
  );
}
