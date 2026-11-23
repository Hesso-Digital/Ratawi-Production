import { useEffect, useState } from 'react';
import { adaptiveDpr } from '../scene/quality';

/** Caps Canvas dpr at 2, and lower on 2K/4K so the hall machine stays smooth. */
export function useAdaptiveDpr(range: [number, number]): [number, number] {
  const [dpr, setDpr] = useState<[number, number]>(() => adaptiveDpr(range));
  useEffect(() => {
    const measure = () => setDpr(adaptiveDpr(range));
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [range[0], range[1]]);
  return dpr;
}
