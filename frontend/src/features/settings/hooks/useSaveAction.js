import { useCallback, useEffect, useRef, useState } from 'react';

const SAVED_VISIBLE_MS = 2600;
const IDLE = { status: 'idle', error: null };

// Состояние кнопки «Сохранить»: saving → saved (подсказка гаснет сама) или error с ApiError.
export function useSaveAction() {
  const [state, setState] = useState(IDLE);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const run = useCallback(async (action) => {
    clearTimeout(timer.current);
    setState({ status: 'saving', error: null });
    try {
      const result = await action();
      setState({ status: 'saved', error: null });
      timer.current = setTimeout(() => setState(IDLE), SAVED_VISIBLE_MS);
      return { ok: true, result };
    } catch (error) {
      setState({ status: 'error', error });
      return { ok: false, error };
    }
  }, []);

  const reset = useCallback(() => {
    clearTimeout(timer.current);
    setState(IDLE);
  }, []);

  return { ...state, run, reset };
}
