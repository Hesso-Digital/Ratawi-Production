/** Distance styling shared by the in-scene tags and area markers (keep labels small, fade far ones). */
/** Scale and opacity for a tag at distance `d` (world units).  */
export function tagStyleForDistance(d: number, primary: boolean): { scale: number; opacity: number } {
  const scale = Math.min(1, Math.max(0.6, 62 / Math.max(1, d)));
  const opacity = primary
    ? Math.min(1, Math.max(0.6, (260 - d) / 120))
    : Math.min(1, Math.max(0, (175 - d) / 75));
  return { scale, opacity };
}


/** Area markers (explore mode): never larger than their CSS size, smaller and fainter far away. */
export function markerStyleForDistance(d: number): { scale: number; opacity: number } {
  return { scale: Math.min(1, Math.max(0.55, 70 / Math.max(1, d))), opacity: Math.min(1, Math.max(0.35, (240 - d) / 120)) };
}
