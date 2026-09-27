import { useCallback, useEffect, useRef, useState } from 'react';

const FEEDBACK_MS = 2200;

// «Поделиться»: на телефонах — системное меню, на компьютере — ссылка в буфер обмена.
// state: 'idle' | 'copied' | 'failed' — для короткой подсказки у кнопки.
export function useShare() {
  const [state, setState] = useState('idle');
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const share = useCallback(async ({ url, title }) => {
    clearTimeout(timer.current);
    const flash = (next) => {
      setState(next);
      timer.current = setTimeout(() => setState('idle'), FEEDBACK_MS);
    };
    try {
      if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
        await navigator.share({ url, title });
        return;
      }
      await navigator.clipboard.writeText(url);
      flash('copied');
    } catch (error) {
      if (error?.name !== 'AbortError') flash('failed');
    }
  }, []);

  return { state, share };
}
