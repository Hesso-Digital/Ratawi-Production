/**
 * Thin view switch (plan section 4.4): renders whichever audience screen the
 * operator has selected, or a forced view for /classic, /reveal, /fallback.
 * Falls back to the classic grid automatically if the 3D view can't run.
 */
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { ClassicAudience } from './ClassicAudience';
import { FallbackAudience } from './FallbackAudience';
import { AdminMenu } from '../components/reveal/AdminMenu';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { useCeremonyStore } from '../data/store';
import type { ViewMode } from '../data/types';

/**
 * The 3D reveal screen (three/R3F/drei/postprocessing) is code-split into its
 * own chunk, so /classic, /fallback and /operator never download it (plan
 * section 4.4: "vite.config.ts manualChunks... so classic loads without
 * them"). Prefetched eagerly below so switching to "Reveal" is instant.
 */
const loadReveal = () => import('./RevealAudience');
const RevealAudience = lazy(() => loadReveal().then((m) => ({ default: m.RevealAudience })));

export function AudiencePage({ forceView }: { forceView?: ViewMode }) {
  const store = useCeremonyStore();
  const osReduced = usePrefersReducedMotion();
  const reduced = osReduced || store.settings.reducedMotion;
  const [autoFallback, setAutoFallback] = useState<string | null>(null);
  const onFallback = useCallback((reason: string) => setAutoFallback(reason), []);

  const view = forceView ?? (autoFallback || reduced ? 'classic' : store.view);

  useEffect(() => {
    if (view === 'reveal') loadReveal();
  }, [view]);

  let screen;
  if (view === 'reveal') {
    screen = (
      <Suspense fallback={<ClassicAudience />}>
        <RevealAudience onFallback={onFallback} />
      </Suspense>
    );
  } else if (view === 'fallback') {
    screen = <FallbackAudience />;
  } else {
    screen = <ClassicAudience />;
  }

  return (
    <>
      {screen}
      <AdminMenu />
    </>
  );
}
