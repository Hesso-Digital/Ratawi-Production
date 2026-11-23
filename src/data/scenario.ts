/**
 * The one ceremony scenario. Every screen (3D hall view, HUD, KPI tiles, tags,
 * trajectory ribbon, classic grid, 2D fallback, operator preview) reads its
 * numbers from `sceneStateAt` in src/scene/ceremonyTimeline.ts, which in turn
 * reads the beats and values below. Nothing else defines when something happens.
 *
 * Storyline, on the shared scenario clock `T` (seconds):
 *
 *   idle      T 0 – 4.5   Establishing shot. 25 wells, 105 kbopd, AG-25 standby.
 *   step1     T 4.5 – 10  Valves open at CPF-1 inlet, gathering lines brighten,
 *                         oil 105 → 110 kbopd, export 103 → 108.
 *   countdown T 10 – 12.4 "3, 2, 1" over the field, camera swings to AGUP.
 *   step2     T 12.4 –    7 AGUP wells come online in sequence, their oil races
 *                         to CPF-1, gas pipe to AG-25 lights, gas 0 → 52 MMscfd,
 *                         oil 110 → 120 kbopd. The gold milestone fires when oil
 *                         reaches 120 (T 16.2) and settles by T 17.2.
 *   playback  9 s         The ribbon replays Jun → Dec 2026 and ends on the same
 *                         120 kbopd / 32 wells / 52 MMscfd the ceremony reached.
 *
 * The operator can start any cue directly; `countdown` runs on into `step2` by
 * itself, as it would on the night.
 */
export const BEATS = {
  idleLoopS: 4.5,

  step1Start: 4.5,
  valvesOpenStart: 4.9,
  valvesOpenEnd: 5.5,
  step1FlowStart: 5.0,
  step1FlowEnd: 7.0,
  step1ClimbStart: 5.7,
  step1ClimbEnd: 8.3,
  step1Settled: 9.0,
  step1DriftS: 0.9,

  countdownStart: 10.0,
  countdownStepS: 0.8,
  countdownEnd: 12.4,

  step2Start: 12.4,
  agupWaveEnd: 13.6,
  agupFlowStart: 12.7,
  agupFlowEnd: 14.5,
  gasFlowStart: 14.2,
  gasFlowEnd: 15.4,
  gasValueStart: 14.5,
  gasValueEnd: 15.9,
  climbStart: 14.0,
  milestone: 16.2,
  goldSettle: 17.2,
  sequenceEnd: 26,
  orbitLoopS: 3.5,
} as const;

/** Seconds from the start of the countdown cue to the start of the step 2 sequence. */
export const COUNTDOWN_DURATION_S = BEATS.countdownEnd - BEATS.countdownStart;

/** Human-readable run of show, shown on the operator console and in the docs. */
export const SCENARIO_CHAPTERS = [
  { id: 'idle', label: 'Establishing shot', cue: 'idle', atS: 0, summary: '105 kbopd · 25 wells · AG-25 standby' },
  { id: 'step1', label: 'Step 1 · Valves open', cue: 'step1', atS: 0, summary: 'Flow to CPF-1 · oil 105 → 110 kbopd' },
  { id: 'countdown', label: 'Countdown', cue: 'countdown', atS: 0, summary: '3 · 2 · 1, then Step 2 starts by itself' },
  {
    id: 'step2',
    label: 'Step 2 · AGUP + gas',
    cue: 'step2',
    atS: 0,
    summary: '7 AGUP wells online · gas 52 MMscfd to AG-25 · oil → 120 kbopd',
  },
  { id: 'milestone', label: '120 milestone', cue: 'step2', atS: BEATS.milestone - BEATS.step2Start, summary: 'Gold moment at 120 kbopd' },
  { id: 'playback', label: 'Replay June to December', cue: 'playback', atS: 0, summary: '0 → 120 kbopd over nine seconds' },
] as const;
