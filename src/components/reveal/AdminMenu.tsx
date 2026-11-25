import { useEffect, useState } from 'react';
import { DataPresetsForm } from '../DataPresetsForm';
import { DisplaySettingsFields } from '../DisplaySettingsFields';
import { isAgupOnline } from '../../data/presets';
import { useCeremonyStore } from '../../data/store';
import { useLiveScene } from '../../scene/useLiveScene';
import { PlaybackBar } from './PlaybackBar';

const IDLE_MS = 2800;

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <circle cx="12" cy="6" r="1.6" fill="currentColor" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
      <circle cx="12" cy="18" r="1.6" fill="currentColor" />
    </svg>
  );
}

export function AdminMenu() {
  const store = useCeremonyStore();
  const scene = useLiveScene(store.cue, store.prevSnapshot, store.snapshot, 80, store.lines);
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState<'menu' | 'edit'>('menu');
  const [visible, setVisible] = useState(true);

  const online = isAgupOnline(store.snapshot, store.presets) || store.cue.kind === 'step2' || store.step >= 2;

  useEffect(() => {
    let timer = window.setTimeout(() => {
      if (!open) setVisible(false);
    }, IDLE_MS);
    const bump = () => {
      setVisible(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (!open) setVisible(false);
      }, IDLE_MS);
    };
    const onMove = () => bump();
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      if (e.key === 'A' && e.shiftKey) {
        e.preventDefault();
        setOpen((v) => !v);
        setPage('menu');
        setVisible(true);
      } else if (e.key === 'Escape' && open) {
        setOpen(false);
      } else {
        bump();
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) setVisible(true);
  }, [open]);

  const toggleAgup = () => {
    if (online) store.resetToCurrent();
    else store.bringAgupOnline();
  };

  return (
    <div className={`admin-menu${open ? ' open' : ''}${visible || open ? ' visible' : ''}`}>
      <div className="admin-menu-row">
      <button
        type="button"
        role="switch"
        aria-checked={online}
        aria-label={online ? 'AGUP online. Switch back to current' : 'Current. Switch to AGUP online'}
        title={online ? 'AGUP online. Click to go back to current' : 'Current. Click to bring AGUP online'}
        data-agup-switch=""
        className={`agup-switch${online ? ' on' : ''}`}
        onClick={toggleAgup}
      >
        <span className="agup-switch-label off">Current</span>
        <span className="agup-switch-track" aria-hidden="true">
          <i />
        </span>
        <span className="agup-switch-label on">AGUP online</span>
      </button>
      <button
        type="button"
        className="admin-menu-btn"
        aria-label="Open admin menu"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          setOpen((v) => !v);
          setPage('menu');
        }}
      >
        <MenuIcon />
      </button>
      </div>
      {open ? (
        <aside className="admin-drawer" role="dialog" aria-label="Admin menu">
          <header className="admin-drawer-head">
            <div className="admin-profile">
              <span className="admin-avatar" aria-hidden="true">
                A
              </span>
              <div>
                <div className="admin-name">Admin</div>
                <div className="admin-role">Hall controls</div>
              </div>
            </div>
            <button type="button" className="explore-close" aria-label="Close admin menu" onClick={() => setOpen(false)}>
              ×
            </button>
          </header>

          {page === 'edit' ? (
            <div className="admin-drawer-body">
              <button type="button" className="admin-back" onClick={() => setPage('menu')}>
                ← Menu
              </button>
              <h2>Edit KPI numbers</h2>
              <DataPresetsForm
                compact
                presets={store.presets}
                onSave={store.savePresets}
                onResetDefaults={store.resetPresets}
              />
            </div>
          ) : (
            <div className="admin-drawer-body">
              <div className="admin-section">
                <button type="button" className="btn admin-wide" onClick={() => setPage('edit')}>
                  Edit KPI numbers
                </button>
              </div>

              <div className="admin-section">
                <div className="admin-label">Playback</div>
                <PlaybackBar
                  state={scene}
                  interactive
                  onPlay={store.playStory}
                  onStop={store.stopStory}
                  onScrub={store.scrubPlayback}
                />
              </div>

              <div className="admin-section">
                <div className="admin-label">Settings</div>
                <DisplaySettingsFields
                  quality={store.quality}
                  settings={store.settings}
                  onQuality={store.setQuality}
                  onSettings={store.setSettings}
                />
              </div>

              <a className="admin-operator-link" href="/operator" target="_blank" rel="noreferrer">
                Open operator console
              </a>
              <p className="admin-hint">
                Shortcut <kbd>Shift</kbd> + <kbd>A</kbd>
              </p>
            </div>
          )}
        </aside>
      ) : null}
    </div>
  );
}
