import { Navigate } from 'react-router';
import { useTransitionNavigate } from '@/app/transitions/useTransition';
import { useAuth } from '@/features/auth';
import { SettingsCenter } from '@/features/settings';
import { isModerator } from '@/shared/config/roles';
import { useLanguage } from '@/shared/hooks/useLanguage';
import { localizePath } from '@/shared/lib/i18n/language';

export function SettingsPage() {
  useLanguage(); // при смене языка страница перерисовывается целиком
  const { user, logout, endSession } = useAuth();
  const go = useTransitionNavigate();

  // Гостю настраивать нечего — сначала вход.
  if (!user) return <Navigate to={localizePath('/login')} replace />;

  // Сначала уходим с настроек, потом закрываем сессию: иначе страница успела бы увести гостя на
  // вход.
  const leave = (close) => async () => {
    await go('/');
    await close();
  };

  // Модератор выходит сразу: без сессии его настройки сами уводят на вход.
  if (isModerator(user)) {
    return <SettingsCenter onNavigate={go} onLogout={logout} />;
  }

  return <SettingsCenter onNavigate={go} onLogout={leave(logout)} onDeleted={leave(endSession)} />;
}
