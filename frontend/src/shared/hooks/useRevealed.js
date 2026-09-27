import { useEffect, useState } from 'react';

// false в первом кадре, true сразу после него: CSS-переходы тогда выращивают полоски с нуля.
export function useRevealed() {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setRevealed(true));
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  return revealed;
}
