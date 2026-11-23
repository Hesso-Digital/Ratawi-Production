/**
 * Catches WebGL context loss / render crashes in the 3D scene and auto-remounts
 * it, up to a few tries, before giving up and asking the page to fall back to
 * a non-3D view (pattern reused from the WBMS twin-canvas error boundary,
 * integration-plan.md section 6).
 */
import { Component, type ReactNode } from 'react';

const MAX_RETRIES = 3;

type Props = {
  children: ReactNode;
  /** Called once retries are exhausted. The page should render /classic or the fallback. */
  onFatal: (error: unknown) => void;
};

type State = { error: unknown; retryKey: number };

export class SceneErrorBoundary extends Component<Props, State> {
  state: State = { error: null, retryKey: 0 };

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { error };
  }

  componentDidCatch(error: unknown) {
    if (this.state.retryKey >= MAX_RETRIES) {
      this.props.onFatal(error);
      return;
    }
    // Give the GPU/driver a beat, then remount the whole subtree with a fresh key.
    window.setTimeout(() => {
      this.setState((s) => ({ error: null, retryKey: s.retryKey + 1 }));
    }, 300);
  }

  render() {
    if (this.state.error && this.state.retryKey >= MAX_RETRIES) {
      return null;
    }
    return <div key={this.state.retryKey}>{this.props.children}</div>;
  }
}

/**
 * Attaches to the canvas's webglcontextlost/restored events (R3F's <Canvas>
 * onCreated gives us the gl context). Context loss alone doesn't throw in
 * React, so this bridges it into the same onFatal/retry path as a render error.
 */
export function watchContextLoss(canvas: HTMLCanvasElement, onLost: () => void, onRestored: () => void) {
  const lost = (e: Event) => {
    e.preventDefault();
    onLost();
  };
  canvas.addEventListener('webglcontextlost', lost, false);
  canvas.addEventListener('webglcontextrestored', onRestored, false);
  return () => {
    canvas.removeEventListener('webglcontextlost', lost);
    canvas.removeEventListener('webglcontextrestored', onRestored);
  };
}
