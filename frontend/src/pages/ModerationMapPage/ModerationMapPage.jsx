import { useCallback, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router';
import { useTransitionReady } from '@/app/transitions/useTransition';
import { useAuth } from '@/features/auth';
import { ModerationMap } from '@/features/moderation';
import { getCity, getCityMoods } from '@/shared/api/endpoints/cities';
import { isModerator } from '@/shared/config/roles';
import { useLanguage } from '@/shared/hooks/useLanguage';
import { useRequest } from '@/shared/hooks/useRequest';
import { localizePath } from '@/shared/lib/language';

const CITY = 'kostanay';

// Карта модератора: тот же город, что у жителей, но с очередью проблем и действиями модератора.
// ?problem= — проблема, открытая из очереди.
export function ModerationMapPage() {
  useLanguage();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const allowed = isModerator(user);
  const city = useRequest(allowed ? `city:${CITY}` : null, () => getCity(CITY));
  const moods = useRequest(allowed ? `moods:${CITY}:week` : null, () => getCityMoods(CITY, 'week'));
  const [problemsReady, setProblemsReady] = useState(false);
  const markReady = useCallback(() => setProblemsReady(true), []);
  useTransitionReady(!allowed || Boolean(city.data && moods.data && problemsReady));

  if (!user) return <Navigate to={localizePath('/login')} replace />;
  if (!allowed) return null;

  return (
    <ModerationMap
      city={city.data}
      moods={moods.data}
      problemId={params.get('problem')}
      onReady={markReady}
    />
  );
}
