/**
 * Ceremony configuration: the one file that holds every venue, wording and
 * data choice the build depends on. Change a value here and the whole app
 * follows; nothing else hard-codes these.
 *
 * Items tagged "pending client confirmation" are the plausible working values
 * taken from the requirements document. They are final unless the client says
 * otherwise before the event.
 */

/** 1. Concession and SPP outlines. Pending client confirmation of the official vector. */
export const GEOMETRY = {
  concessionSource: 'field-trace-8-vertex',
  sppSource: 'field-trace',
  /** Swap src/data/field.ts for the official KML/SHP outline when issued; src/scene/world.ts reads it directly. */
} as const;

/** 2. Wells. Names and grid positions come from src/data/field.ts. Pending client confirmation of coordinates. */
export const WELLS = {
  online: 25,
  agupNames: ['RT-72', 'RT-71', 'RT-60', 'RT-68', 'RT-63', 'RT-66', 'RT-70'],
  total: 32,
} as const;

/** 3. Gas to AG-25 once Step 2 completes. Pending client confirmation of 52 versus 50. */
export const GAS = {
  step2Mmscfd: 52,
  /** AG-25 needs at least this much to operate. */
  minToOperateMmscfd: 50,
  /** Shown as an exact number, not as "50+". */
  showAsPlus: false,
} as const;
export const GAS_STEP2_MMSCFD = GAS.step2Mmscfd;

/** 4. Venue. Pending client confirmation of the hall hardware. */
export const VENUE = {
  display: 'led-wall' as 'led-wall' | 'projector',
  nativeWidthPx: 1920,
  nativeHeightPx: 1080,
  aspect: '16:9',
  viewingDistanceM: 12,
  playbackPc: { os: 'Windows 11', gpu: 'discrete', browser: 'Chrome' },
  hasInternet: false,
  /** Operator laptop on the desk, audience window full-screen on the wall output. */
  windows: { operator: 'operator laptop screen', audience: 'wall output, full screen' },
  /** Starting quality profile. The operator can change it at any time. */
  defaultQuality: 'medium' as 'low' | 'medium' | 'high',
} as const;

/** 5. Run of show. Pending client confirmation of date, time and narrator script. */
export const RUN_OF_SHOW = {
  date: '2026-11-26',
  localTime: '10:30',
  timeZone: 'Asia/Baghdad',
  /** The operator starts the countdown on the narrator's "three"; Step 2 then follows by itself. */
  countdownStartedByOperator: true,
  step2FollowsCountdown: true,
  /** The operator clicks Step 1 on "opening the valves"; the countdown does not trigger it. */
  step1FollowsCountdown: false,
} as const;

/**
 * 6. Monthly series, June to December 2026, with BSW (%), salt (mg/l) and plant
 * efficiency (%) alongside the production figures in src/data/defaults.ts.
 * Pending client confirmation: replace with the monthly workbook when received.
 */
export const MONTHLY_QUALITY: ReadonlyArray<{ bsw: number; salt: number; efficiency: number }> = [
  { bsw: 0, salt: 0, efficiency: 0 },
  { bsw: 0.14, salt: 148, efficiency: 90.5 },
  { bsw: 0.12, salt: 139, efficiency: 93.8 },
  { bsw: 0.1, salt: 131, efficiency: 96.2 },
  { bsw: 0.09, salt: 125, efficiency: 97.7 },
  { bsw: 0.08, salt: 121, efficiency: 98.6 },
  { bsw: 0.08, salt: 121, efficiency: 98.6 },
];

/** 7. Wording. Pending client confirmation of the header text. */
export const WORDING = {
  title: 'Ratawi Production',
  eyebrow: 'AGUP Phase 1 · RFSU Opening',
  commitmentLabel: 'Commitment',
  targetLabel: 'AGUP target',
} as const;

/** 8. Brand rules. Pending client confirmation: no client logos on screen. */
export const BRAND = {
  showClientLogos: false,
} as const;

/**
 * Isolated client questions. Swap an answer here (and, where noted, the
 * matching array in field.ts) without hunting through the scene.
 * None of these strings are shown on the hall screen.
 */
export const OPEN_QUESTIONS = {
  /** Brief said "elongated pentagon"; Mohammad's official red-line photo is an 8-vertex chamfered outline (aspect ≈ 1.72). */
  concessionShape: 'photo-8-vertex-unless-client-insists-on-pentagon',
  /** Working AGUP set; all seven appear on the 16 Nov wells photo, scattered rather than clustered. */
  agupNames: WELLS.agupNames,
  /** In the live well list but not labelled on the wells photo (far-west candidate was RT-06). Kept at the previous grid [4.5, 3.6]. */
  rt10: 'kept-at-previous-grid-not-on-wells-photo',
  /** "Beside the CPF", not labelled on the refs. Live SW grid [4.5, 8.7] is unchanged until confirmed. */
  ag25Position: 'kept-live-southwest-until-confirmed',
  /** Brief: visual only, not exact. Prototype ran ESE; the satellite corridor is more SE. Adopted SE. */
  exportHeading: 'southeast-indicative',
  /** Scale assumed the north highway on the wells photo is the road south of SPP. Bearings hold if this is wrong; distances scale uniformly. */
  wellsPhotoHighwayScale: 'assumed-road-south-of-spp',
  /** Official KML/SHP outline, if it arrives, replaces CONCESSION/SPP in field.ts. */
  officialVector: 'pending',
} as const;
