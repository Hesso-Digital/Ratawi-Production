/**
 * Numbered area markers (Zirku-style) floating over the eight focus areas.
 * Hidden in show mode and while the camera is returning to the show.
 */
import { Html } from '@react-three/drei';
import { AREA_MARKERS } from './areas';
import { exploreStore, useExploreState } from './exploreStore';

export function AreaMarkers() {
  const { mode, areaId } = useExploreState();
  if (mode === 'show' || mode === 'returning') return null;

  return (
    <group>
      {AREA_MARKERS.map((m) => (
        <Html
          key={m.id}
          position={m.position}
          center
          occlude={false}
          distanceFactor={48}
          zIndexRange={[5, 1]}
          style={{ pointerEvents: 'auto' }}
        >
          <button
            type="button"
            className={`area-marker${areaId === m.id ? ' on' : ''}`}
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
        </Html>
      ))}
    </group>
  );
}
