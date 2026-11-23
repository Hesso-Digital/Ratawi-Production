/**
 * Numbered area markers (Zirku-style) floating over the eight focus areas.
 * Hidden in show mode and while the camera is returning to the show. Each
 * marker keeps a fixed, small CSS size, shrinks a little and fades with
 * camera distance (look/tagStyle.ts) so it never covers the models.
 */
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { Vector3 } from 'three';
import { AREA_MARKERS } from './areas';
import { useCeremonyStore } from '../../data/store';
import { exploreStore, useExploreState } from './exploreStore';
import { markerStyleForDistance } from '../look/tagStyle';

type Marker = (typeof AREA_MARKERS)[number];

function AreaMarker({ m, on }: { m: Marker; on: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const p = useRef(new Vector3(...(m.position as [number, number, number])));
  useFrame(({ camera }) => {
    const el = ref.current;
    if (!el) return;
    const { scale, opacity } = markerStyleForDistance(camera.position.distanceTo(p.current));
    el.style.transform = `scale(${scale.toFixed(3)})`;
    el.style.opacity = (on ? 1 : opacity).toFixed(2);
  });
  return (
    <Html position={m.position} center occlude={false} zIndexRange={[5, 1]} style={{ pointerEvents: 'auto' }}>
      <div ref={ref} style={{ transformOrigin: '50% 50%' }}>
        <button
          type="button"
          className={`area-marker${on ? ' on' : ''}`}
          data-area={m.id}
          aria-label={`${m.key}. ${m.label}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            exploreStore.flyToPreset(m.id);
          }}
        >
          <span className="n">{m.key}</span>
          <span className="l">{m.label}</span>
        </button>
      </div>
    </Html>
  );
}

export function AreaMarkers() {
  const { mode, areaId } = useExploreState();
  const show = useCeremonyStore().settings.showAreaMarkers;
  if (!show || mode === 'show' || mode === 'returning') return null;

  return (
    <group>
      {AREA_MARKERS.map((m) => (
        <AreaMarker key={m.id} m={m} on={areaId === m.id} />
      ))}
    </group>
  );
}
