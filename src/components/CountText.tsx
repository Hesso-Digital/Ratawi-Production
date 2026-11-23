import { useCountUp } from '../hooks/useCountUp';

/** GSAP-tweened numeric text with tabular figures so the layout does not jitter. */
export function CountText({
  value,
  decimals = 0,
  className,
}: {
  value: number;
  decimals?: number;
  className?: string;
}) {
  const ref = useCountUp<HTMLSpanElement>(value, { decimals, durationS: 0.42 });
  return (
    <span ref={ref} className={`count-text${className ? ` ${className}` : ''}`}>
      {value.toFixed(decimals)}
    </span>
  );
}
