import { useCallback, useMemo, useState } from 'react';
import * as authApi from '@/shared/api/endpoints/auth';
import { setAccessToken } from '@/shared/api/client';
import { AuthContext } from './AuthContext';

// Токен доступа живёт только в памяти (ARCHITECTURE.md, раздел 8).
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  const startSession = useCallback(({ access_token: token, user: sessionUser }) => {
    setAccessToken(token);
    setUser(sessionUser);
    return sessionUser;
  }, []);

  const login = useCallback(
    async (credentials) => startSession(await authApi.login(credentials)),
    [startSession],
  );

  const register = useCallback(
    async (data) => startSession(await authApi.register(data)),
    [startSession],
  );

  // Без запроса к серверу: после удаления аккаунта сессии на сервере уже нет.
  const endSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout().catch(() => null);
    endSession();
  }, [endSession]);

  const value = useMemo(
    () => ({ user, login, register, logout, updateUser: setUser, endSession }),
    [user, login, register, logout, endSession],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
