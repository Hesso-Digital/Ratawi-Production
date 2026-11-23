import { useEffect, useRef } from 'react';
import { exploreStore } from '../../scene/explore/exploreStore';
import { headingRef } from '../../scene/explore/heading';

const LONG_PRESS_MS = 550;
const DOUBLE_MS = 280;

export function Compass() {
  const needle = useRef<SVGGElement>(null);
  const longPress = useRef<number | null>(null);
  const clickTimer = useRef<number | null>(null);
  const didLong = useRef(false);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const g = needle.current;
      if (g) g.setAttribute('transform', `rotate(${-headingRef.current} 28 28)`);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const clearLong = () => {
    if (longPress.current !== null) {
      window.clearTimeout(longPress.current);
      longPress.current = null;
    }
  };

  const wholeField = () => {
    if (clickTimer.current !== null) {
      window.clearTimeout(clickTimer.current);
      clickTimer.current = null;
    }
    exploreStore.flyToPreset('aerial');
  };

  const northUp = () => {
    exploreStore.orientNorthUp();
  };

  return (
    <button
      type="button"
      className="reveal-compass"
      aria-label="Reset to north-up"
      title="Reset to north-up. Double-click or hold for Whole field."
      onPointerDown={() => {
        didLong.current = false;
        clearLong();
        longPress.current = window.setTimeout(() => {
          didLong.current = true;
          wholeField();
          longPress.current = null;
        }, LONG_PRESS_MS);
      }}
      onPointerUp={clearLong}
      onPointerLeave={clearLong}
      onClick={() => {
        if (didLong.current) {
          didLong.current = false;
          return;
        }
        if (clickTimer.current !== null) {
          window.clearTimeout(clickTimer.current);
          clickTimer.current = null;
          wholeField();
          return;
        }
        clickTimer.current = window.setTimeout(() => {
          clickTimer.current = null;
          northUp();
        }, DOUBLE_MS);
      }}
    >
      <div className="lbl">N</div>
      <svg viewBox="0 0 56 56" width={52} height={52} aria-hidden="true">
        <circle cx={28} cy={28} r={26} fill="none" stroke="rgba(200,220,240,.25)" />
        <g ref={needle} transform="rotate(0 28 28)">
          <path d="M28 6 L33 30 L28 26 L23 30 Z" fill="#eaf2fb" />
          <path d="M28 50 L33 30 L28 34 L23 30 Z" fill="rgba(234,242,251,.25)" />
        </g>
      </svg>
    </button>
  );
}
