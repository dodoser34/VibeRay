import { useEffect } from 'react';
import { useAuth } from '@/features/auth';
import { isModerator } from '@/shared/config/roles';
import { useLocalizedNavigate } from '@/shared/hooks/useLocalizedNavigate';
import { usePagePath } from '@/shared/hooks/usePagePath';

const isModerationPath = (path) => path === '/moderation' || path.startsWith('/moderation/');

// Два интерфейса по роли: модератор работает только в своих разделах (/moderation/…), страницы
// жителей ему не открываются; житель — наоборот. Гость видит страницы жителей, а разделы
// модератора сами уводят его на вход.
export function useRoleRoute() {
  const { user } = useAuth();
  const path = usePagePath();
  const navigate = useLocalizedNavigate();
  const moderator = isModerator(user);
  const inModeration = isModerationPath(path);

  useEffect(() => {
    if (moderator && !inModeration) navigate('/moderation', { replace: true });
    else if (user && !moderator && inModeration) navigate('/', { replace: true });
  }, [user, moderator, inModeration, navigate]);
}
