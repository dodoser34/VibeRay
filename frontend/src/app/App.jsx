import { Outlet } from 'react-router';
import { useViewport } from '@/adaptations/core';
import { useAuth } from '@/features/auth';
import { useLanguage } from '@/shared/hooks/useLanguage';
import { MobileNav } from '@/adaptations/mobile/components/navigation/MobileNav';
import { AnimatedBackground } from './layout/AnimatedBackground';
import { TabBar } from './layout/TabBar';
import { useTabBarFit } from './layout/useTabBarFit';
import { TransitionProvider } from './transitions/TransitionProvider';
import { useLanguageRoute } from './routing/useLanguageRoute';
import { useRoleRoute } from './routing/useRoleRoute';

export function App() {
  // Язык — из адреса (/ru/…); оболочка (шапка, меню) перерисовывается на новом языке без
  // перезагрузки.
  useLanguageRoute();
  useRoleRoute();
  const { phoneNav } = useViewport();
  const { user } = useAuth();
  const language = useLanguage();
  // Вкладки таб-бара не поместились (замер — в самом TabBar) — навигация меню, как на телефоне.
  const tabBar = useTabBarFit(`${language}|${user?.id ?? ''}|${user?.role ?? ''}`);
  return (
    <TransitionProvider>
      <AnimatedBackground />
      {phoneNav || !tabBar.fits ? <MobileNav /> : <TabBar onOverflow={tabBar.reportOverflow} />}
      <main>
        <Outlet />
      </main>
    </TransitionProvider>
  );
}
