/**
 * Lifts a slice of the field (surface facilities, gathering network) into its
 * layer of the exploded view. Reads explodeBlend every frame; zero re-renders.
 */
import { useFrame } from '@react-three/fiber';
import { useRef, type ReactNode } from 'react';
import type { Group } from 'three';
import { explodeBlend } from '../../state/sceneSettings';
import { layerLift, type LayerId } from './layout';

export function LayerLift({ layer, children }: { layer: LayerId; children: ReactNode }) {
  const ref = useRef<Group>(null);
  useFrame(() => {
    const g = ref.current;
    if (g) g.position.y = layerLift(layer, explodeBlend.value);
  });
  return <group ref={ref}>{children}</group>;
}
