import { useEffect, useState } from 'react';
import { STAGE_HEIGHT, STAGE_WIDTH } from '../config';

export function useStageScale() {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const measure = () => {
      const s = Math.min(window.innerWidth / STAGE_WIDTH, window.innerHeight / STAGE_HEIGHT);
      setScale(s);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  return scale;
}
