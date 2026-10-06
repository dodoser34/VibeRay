import { useMemo } from 'react';
import { Navigate, useSearchParams } from 'react-router';
import { useTransitionNavigate, useTransitionReady } from '@/app/transitions/useTransition';
import { useAuth } from '@/features/auth';
import { ModerationCenter } from '@/features/moderation';
import { getCity } from '@/shared/api/endpoints/cities';
import { isModerator } from '@/shared/config/roles';
import { useLanguage } from '@/shared/hooks/useLanguage';
import { useRequest } from '@/shared/hooks/useRequest';
import { localizePath } from '@/shared/lib/language';

const CITY = 'kostanay';

// Разделы модератора: очередь (/moderation, ?district= — очередь района), город и обращения.
// Гостя уводит на вход; житель сюда не попадает — его уводит app/useRoleRoute.js.
export function ModerationPage({ section }) {
  useLanguage();
  const { user } = useAuth();
  const go = useTransitionNavigate();
  const [params] = useSearchParams();
  const allowed = isModerator(user);
  const city = useRequest(allowed ? `city:${CITY}` : null, () => getCity(CITY));
  useTransitionReady(!allowed || Boolean(city.data));

  const districts = useMemo(
    () =>
      city.data?.districts.features
        .map((f) => ({ slug: f.properties.slug, name: f.properties.name }))
        .sort((a, b) => a.name.localeCompare(b.name)) ?? null,
    [city.data],
  );

  if (!user) return <Navigate to={localizePath('/login')} replace />;
  if (!allowed) return null;

  return (
    <ModerationCenter
      key={`${section}:${params.get('district') ?? ''}`}
      section={section}
      districts={districts}
      district={params.get('district') ?? ''}
      onOpenProblem={(id) => go(`/moderation/map?problem=${id}`)}
      onOpenDistrict={(slug) => go(`/moderation?district=${slug}`)}
    />
  );
}
