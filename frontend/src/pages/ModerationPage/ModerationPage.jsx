import { useMemo } from 'react';
import { Navigate, useSearchParams } from 'react-router';
import { useTransitionNavigate, useTransitionReady } from '@/app/transitions/useTransition';
import { useAuth } from '@/features/auth';
import { ModerationCenter, setModerationCity, useModerationCity } from '@/features/moderation';
import { getCity } from '@/shared/api/endpoints/cities';
import { isModerator } from '@/shared/config/roles';
import { useLanguage } from '@/shared/hooks/useLanguage';
import { useRequest } from '@/shared/hooks/useRequest';
import { localizePath } from '@/shared/lib/i18n/language';

// Разделы модератора: очередь (/moderation, ?district= — очередь района), город и обращения.
// Очередь и «Город» — по городу, выбранному модератором (useModerationCity: любой город VibeRay).
// Гостя уводит на вход; житель сюда не попадает — его уводит app/routing/useRoleRoute.js.
export function ModerationPage({ section }) {
  useLanguage();
  const { user } = useAuth();
  const go = useTransitionNavigate();
  const [params] = useSearchParams();
  const allowed = isModerator(user);
  const citySlug = useModerationCity();
  const city = useRequest(allowed ? `city:${citySlug}` : null, () => getCity(citySlug));
  useTransitionReady(!allowed || Boolean(city.data));
  // Пока грузится новый город, useRequest держит прежний — его районы не показываем.
  const cityData = city.data?.slug === citySlug ? city.data : null;

  const districts = useMemo(
    () =>
      cityData?.districts.features
        .map((feature) => ({ slug: feature.properties.slug, name: feature.properties.name }))
        .sort((a, b) => a.name.localeCompare(b.name)) ?? null,
    [cityData],
  );

  if (!user) return <Navigate to={localizePath('/login')} replace />;
  if (!allowed) return null;

  return (
    <ModerationCenter
      key={`${section}:${params.get('district') ?? ''}`}
      section={section}
      city={citySlug}
      onCityChange={setModerationCity}
      districts={districts}
      district={params.get('district') ?? ''}
      onOpenProblem={(id) => go(`/moderation/map?problem=${id}`)}
      onOpenDistrict={(slug) => go(`/moderation?district=${slug}`)}
    />
  );
}
