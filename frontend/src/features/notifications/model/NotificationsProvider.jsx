import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/features/auth';
import { getNotifications, markNotificationsRead } from '@/shared/api/endpoints/users';
import { NotificationsContext } from './NotificationsContext';

// Пока нет push-канала, уведомления опрашиваются: раз в POLL_MS и сразу при возврате на вкладку.
const POLL_MS = 20_000;
const EMPTY = { unread: 0, items: [] };

export function NotificationsProvider({ children }) {
  const { user } = useAuth();
  const [state, setState] = useState({ userId: null, data: EMPTY, loaded: false });
  const userId = user?.id ?? null;
  const userRef = useRef(userId);

  useEffect(() => {
    userRef.current = userId;
  }, [userId]);

  const refresh = useCallback(async () => {
    const requestedFor = userRef.current;
    if (!requestedFor) return;
    try {
      const data = await getNotifications();
      // Ответ мог прийти уже после выхода из аккаунта или смены пользователя.
      if (userRef.current === requestedFor) setState({ userId: requestedFor, data, loaded: true });
    } catch {
      // Сеть моргнула — следующий опрос попробует снова.
    }
  }, []);

  useEffect(() => {
    if (!userId) return undefined;
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    const onVisible = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [userId, refresh]);

  // Прочитанное отмечается сразу на экране, запрос уходит следом.
  const markRead = useCallback(
    async (ids) => {
      setState((current) => {
        const items = current.data.items.map((item) =>
          !ids || ids.includes(item.id) ? { ...item, read: true } : item,
        );
        return {
          ...current,
          data: { items, unread: items.filter((item) => !item.read).length },
        };
      });
      await markNotificationsRead(ids).catch(() => refresh());
    },
    [refresh],
  );

  const own = state.userId === userId && userId !== null;
  const value = useMemo(
    () => ({
      items: own ? state.data.items : EMPTY.items,
      unread: own ? state.data.unread : 0,
      loaded: own && state.loaded,
      refresh,
      markRead,
    }),
    [own, state, refresh, markRead],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}
