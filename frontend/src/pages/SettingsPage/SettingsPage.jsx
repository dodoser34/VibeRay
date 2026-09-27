import { useMemo } from 'react';
import { Navigate } from 'react-router';
import { useTransitionNavigate, useTransitionReady } from '@/app/transitions/useTransition';
import { useAuth } from '@/features/auth';
import { SettingsCenter } from '@/features/settings';
import { getCity } from '@/shared/api/endpoints/cities';
import { useRequest } from '@/shared/hooks/useRequest';

const CITY = 'kostanay';

export function SettingsPage() {
  const { user, logout, endSession } = useAuth();
  const go = useTransitionNavigate();
  const city = useRequest(user ? `city:${CITY}` : null, () => getCity(CITY));
  useTransitionReady(!user || Boolean(city.data));

  const districts = useMemo(
    () =>
      city.data?.districts.features.map((f) => ({
        slug: f.properties.slug,
        name: f.properties.name,
      })) ?? null,
    [city.data],
  );

  // Гостю настраивать нечего — сначала вход.
  if (!user) return <Navigate to="/login" replace />;

  // Сначала уходим с настроек, потом закрываем сессию: иначе страница успела бы увести гостя на вход.
  const leave = (close) => async () => {
    await go('/');
    await close();
  };

  return (
    <SettingsCenter
      districts={districts}
      onNavigate={go}
      onLogout={leave(logout)}
      onDeleted={leave(endSession)}
    />
  );
}
