/**
 * If a GLB fails to load or parse, render the procedural geometry instead and
 * keep the show running (the scene-level SceneErrorBoundary is never tripped).
 */
import { Component, type ReactNode } from 'react';

export class ModelBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn('[field-models] using procedural geometry:', error);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
