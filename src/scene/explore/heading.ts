/** Live camera heading in degrees. Written from the Canvas each frame; read by the Compass via a ref. */
export const headingRef = { current: 0 };

/** 0° means the camera is looking toward world −Z, which this field treats as north. */
export function headingFromCamera(px: number, pz: number, tx: number, tz: number): number {
  return (Math.atan2(tx - px, -(tz - pz)) * 180) / Math.PI;
}

export function publishHeading(px: number, pz: number, tx: number, tz: number) {
  headingRef.current = headingFromCamera(px, pz, tx, tz);
}
