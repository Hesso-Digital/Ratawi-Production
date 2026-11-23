/**
 * Thin view switch (plan section 4.4): renders whichever audience screen the
 * operator has selected, or a forced view for /classic, /reveal, /fallback.
 * The default hall path never paints the classic grid while the 3D chunk
 * loads — a neutral boot cover is shown instead.
 */
import { lazy, Suspense, useEffect } from 'react';
import { ClassicAudience } from './ClassicAudience';
import { FallbackAudience } from './FallbackAudience';
import { AdminMenu } from '../components/reveal/AdminMenu';
import { HallBoot } from '../components/reveal/HallBoot';
import { useCeremonyStore } from '../data/store';
import type { ViewMode } from '../data/types';

/**
 * The 3D reveal screen (three/R3F/drei/postprocessing) is code-split into its
 * own chunk, so /classic, /fallback and /operator never download it (plan
 * section 4.4). Prefetched below so the hall screen starts loading immediately.
 */
const loadReveal = () => import('./RevealAudience');
const RevealAudience = lazy(() => loadReveal().then((m) => ({ default: m.RevealAudience })));

if (typeof window !== 'undefined') {
  const path = window.location.pathname;
  if (path === '/' || path === '/reveal') void loadReveal();
}

export function AudiencePage({ forceView }: { forceView?: ViewMode }) {
  const store = useCeremonyStore();
  const view = forceView ?? store.view;

  useEffect(() => {
    if (view === 'reveal') void loadReveal();
  }, [view]);

  let screen;
  if (view === 'reveal') {
    screen = (
      <Suspense fallback={<HallBoot />}>
        <RevealAudience />
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
