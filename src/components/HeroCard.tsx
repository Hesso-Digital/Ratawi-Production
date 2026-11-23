import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { useCountUp } from '../hooks/useCountUp';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { BUDGET_KBOPD, TARGET_KBOPD } from '../data/defaults';
import { isAboveCommitment, isGold } from '../data/kpis';
import { useCeremonyStore } from '../data/store';
import { OilDrop } from './OilDrop';

export function HeroCard({ oil }: { oil: number }) {
  const presets = useCeremonyStore().presets;
  const commitment = presets.commitmentKbopd ?? BUDGET_KBOPD;
  const target = presets.targetKbopd ?? TARGET_KBOPD;
  const celebrate = isGold(oil, target);
  const aboveCommitment = isAboveCommitment(oil, commitment);
  const valueRef = useCountUp<HTMLSpanElement>(oil, { decimals: 1, durationS: 0.42 });
  const cardRef = useRef<HTMLElement>(null);
  const wasGold = useRef(celebrate);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced) {
      wasGold.current = celebrate;
      return;
    }
    if (celebrate && !wasGold.current && cardRef.current) {
      gsap.fromTo(
        cardRef.current,
        { scale: 1 },
        { scale: 1.025, duration: 0.55, ease: 'elastic.out(1, 0.55)', yoyo: true, repeat: 1 },
      );
    }
    wasGold.current = celebrate;
  }, [celebrate, reduced]);

  const tone = celebrate ? 'gold' : aboveCommitment ? 'budget' : 'warn';
  const label = celebrate ? 'AGUP target reached' : aboveCommitment ? 'Above target' : 'Below target';
  const fill = Math.min(100, (oil / 140) * 100);
  const tick = (v: number) => ({ left: `${(v / 140) * 100}%` });

  return (
    <article
      ref={cardRef}
      className="panel hero"
      data-entrance
      data-celebrate={celebrate ? 'true' : 'false'}
    >
      <div className="hero-top">
        <div>
          <div className="eyebrow">Daily oil production</div>
          <div>
            <span className="hero-value" ref={valueRef}>
              {oil.toFixed(1)}
            </span>
            <span className="hero-unit">KBOPD</span>
          </div>
          <div className="hero-targets">
            <span>
              Target <b className={aboveCommitment ? 'on' : ''}>{commitment}</b>
            </span>
            <span>
              AGUP target <b className={celebrate ? 'on' : ''}>{target}</b>
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12 }}>
          <span className="status-pill" data-tone={tone}>
            <i />
            {label}
          </span>
          <OilDrop celebrate={celebrate} />
        </div>
      </div>
      <div className="meter" aria-hidden="true">
        <div className="meter-fill" style={{ width: `${fill}%` }} />
        <div className="meter-tick" style={tick(commitment)}>
          <span>{commitment}</span>
        </div>
        <div className="meter-tick" style={tick(target)}>
          <span>{target}</span>
        </div>
      </div>
    </article>
  );
}
