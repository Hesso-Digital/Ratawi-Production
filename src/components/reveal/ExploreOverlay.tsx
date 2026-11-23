/**
 * Free-roam controls and the inspect panel on the hall screen (HTML over the
 * canvas). Unobtrusive in show mode; keys: E explore, R back to show,
 * 1 to 5 viewpoints, Esc closes the panel.
 */
import { useEffect } from 'react';
import { useSceneSnapshot } from '../../scene/useSceneClock';
import { VIEW_PRESETS, assetById } from '../../scene/explore/assets';
import { exploreStore, useExploreState } from '../../scene/explore/exploreStore';

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
}

export function useExploreKeys(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      const k = e.key.toLowerCase();
      if (k === 'e') exploreStore.startExplore();
      else if (k === 'r') exploreStore.backToShow();
      else if (k === 'escape') exploreStore.select(null);
      else {
        const preset = VIEW_PRESETS.find((p) => p.key === e.key);
        if (preset) exploreStore.flyToPreset(preset.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}

function InspectPanel({ id }: { id: string }) {
  const state = useSceneSnapshot();
  const asset = assetById(id);
  if (!asset) return null;
  const status = asset.status(state);
  return (
    <aside className="explore-panel" role="dialog" aria-label={`${asset.name} details`} data-asset={asset.id}>
      <header>
        <div>
          <div className="eyebrow">Asset</div>
          <h2>{asset.name}</h2>
        </div>
        <button type="button" className="explore-close" aria-label="Close" onClick={() => exploreStore.select(null)}>
          ×
        </button>
      </header>
      <p className="role">{asset.role}</p>
      <div className={`explore-status ${status.tone}`}>
        <i />
        {status.label}
      </div>
      <dl>
        {asset.rows(state).map((r) => (
          <div key={r.k} className="row">
            <dt>{r.k}</dt>
            <dd>
              {r.v}
              {r.unit ? <small>{r.unit}</small> : null}
            </dd>
          </div>
        ))}
      </dl>
      <footer>Esc to close · R back to show</footer>
    </aside>
  );
}

export function ExploreOverlay() {
  const { mode, selectedId } = useExploreState();
  useExploreKeys(true);
  const exploring = mode !== 'show';

  return (
    <div className={`explore-overlay ${exploring ? 'on' : ''}`}>
      <div className="explore-bar" role="toolbar" aria-label="Camera">
        {exploring ? (
          <button type="button" className="chip primary" onClick={() => exploreStore.backToShow()}>
            Back to show <kbd>R</kbd>
          </button>
        ) : (
          <button type="button" className="chip primary" onClick={() => exploreStore.startExplore()}>
            Explore <kbd>E</kbd>
          </button>
        )}
        {VIEW_PRESETS.map((p) => (
          <button key={p.id} type="button" className="chip" data-view={p.id} onClick={() => exploreStore.flyToPreset(p.id)}>
            <kbd>{p.key}</kbd>
            {p.label}
          </button>
        ))}
      </div>
      {exploring ? (
        <div className="explore-hint">Drag to orbit · right drag or two fingers to pan · scroll or pinch to zoom · click an asset</div>
      ) : null}
      {selectedId ? <InspectPanel id={selectedId} /> : null}
    </div>
  );
}
