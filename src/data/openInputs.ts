/**
 * OPEN DATA INPUTS — single source of truth for everything the ceremony build
 * is still waiting on from Gulmira / Mohammad (integration-plan.md, section 10).
 *
 * Every value in this file is a PLACEHOLDER. None of it is an invented client
 * fact: each one is either the repo's existing assumption, or the value shown
 * in the approved design-3d frames (F1–F6), clearly labelled as unconfirmed.
 * Do not promote a value out of "pending" without a reply from Gulmira/Mohammad.
 *
 * When an answer arrives, change the value here (and only here) and remove the
 * `status: 'pending'` tag for that item.
 */

export type OpenInputStatus = 'pending' | 'confirmed';

export type OpenInput = {
  id: number;
  title: string;
  status: OpenInputStatus;
  note: string;
};

/** #1 — The official concession + SPP vector (KML/SHP/DWG). */
export const CONCESSION_VECTOR_SOURCE: OpenInput = {
  id: 1,
  title: 'Official concession vector',
  status: 'pending',
  note:
    "Using field.ts's 8-vertex chamfered shape traced from the reference photo. " +
    'The brief calls it an "elongated pentagon". Confirm which is authoritative, ' +
    'and the same for the SPP footprint. No geometry change made here; ' +
    'src/scene/world.ts reads field.ts directly, so a vector swap there is enough.',
};

/** #2 — Well coordinates + AGUP well name confirmation. */
export const WELL_COORDINATES_SOURCE: OpenInput = {
  id: 2,
  title: 'Well coordinates + AGUP well names',
  status: 'pending',
  note:
    'Using field.ts WELLS (25 online + 7 AGUP: RT-72, RT-71, RT-60, RT-68, ' +
    'RT-63, RT-66, RT-70) and its CPF-1 / AG-25 grid positions. Also confirm ' +
    'manifold locations and the export direction.',
};

/**
 * #3 — Gas at step 2: the repo previously assumed 50 MMscfd; the approved
 * design frames (F4 milestone, F5 close-up) show 52. This file now follows
 * the approved frames as the best available signal, but it is NOT confirmed.
 */
export const GAS_STEP2_INPUT: OpenInput = {
  id: 3,
  title: 'Gas to AG-25 at step 2 (MMscfd)',
  status: 'pending',
  note:
    'Repo default was 50. Approved design frames F4/F5 show 52. This file uses ' +
    '52 (the frames) as the placeholder. Confirm the real figure with Mohammad, ' +
    'and whether the HUD should show it as "50+" / "52+" rather than a bare number.',
};
export const GAS_STEP2_MMSCFD = 52;

/** #4 — Venue display and playback PC. */
export const VENUE_INPUT: OpenInput = {
  id: 4,
  title: 'Venue display + playback PC',
  status: 'pending',
  note:
    'Unknown: LED wall or projector, native resolution and aspect ratio, ' +
    'viewing distance, playback PC GPU/OS, whether the venue has internet, and ' +
    'the window/monitor layout for operator vs audience. The quality profile ' +
    '(src/scene/quality.ts) defaults to "medium" and is operator-switchable ' +
    'until this is confirmed; verify on the actual hardware (see ' +
    'docs/venue-rehearsal-checklist.md).',
};
export const VENUE_DEFAULTS = {
  displayKind: 'unknown' as 'unknown' | 'led-wall' | 'projector',
  nativeWidthPx: null as number | null,
  nativeHeightPx: null as number | null,
  hasInternet: false,
};

/** #5 — Run-of-show: date/time and narrator cue timing. */
export const RUN_OF_SHOW_INPUT: OpenInput = {
  id: 5,
  title: 'Run-of-show timing',
  status: 'pending',
  note:
    'Unknown: exact ceremony date/time, the narrator script cues (when "3, 2, ' +
    '1" happens), and whether Step 1 should auto-follow the countdown or wait ' +
    'for a click. The operator console currently requires an explicit Step 1 ' +
    'click after the countdown (manual, safer for rehearsal); this can be made ' +
    'automatic once confirmed.',
};
export const STEP1_AUTO_FOLLOWS_COUNTDOWN = false;

/** #6 — The real monthly Excel figures, plus historical BSW/salt. */
export const MONTHLY_DATA_INPUT: OpenInput = {
  id: 6,
  title: 'Monthly Excel (real trajectory, BSW, salt)',
  status: 'pending',
  note:
    'TRAJECTORY in defaults.ts is still the illustrative v8 series. Historical ' +
    'BSW and salt are not available; the trajectory ribbon and playback reuse ' +
    "BASELINE's BSW/salt for every month as a placeholder. Phase 2 " +
    '(src/data/excelImport.ts, not yet built) will replace this with SheetJS ' +
    'import of the real file.',
};

/** #7 — Wording: "Commitment 90" vs "Budget 90", header date/title approval. */
export const WORDING_INPUT: OpenInput = {
  id: 7,
  title: 'Wording: Commitment vs Budget, header copy',
  status: 'pending',
  note:
    'This build now labels 90 as "Commitment" everywhere (plan recommendation, ' +
    'matching the design frames). BUDGET_KBOPD is kept as a compatibility alias ' +
    'in defaults.ts. Header date/title text have not been separately approved.',
};

/** #8 — Brand rules: confirm no client logos on screen. */
export const BRAND_RULES_INPUT: OpenInput = {
  id: 8,
  title: 'Brand rules (no client logos)',
  status: 'pending',
  note:
    'Assumed: no TotalEnergies/ADNOC/client logos anywhere on screen, matching ' +
    'the approved design frames. Nothing in this build renders a logo. Confirm ' +
    'before the ceremony that this is still correct.',
};

/** All 8 open inputs, in plan order, for the operator console / docs to render. */
export const OPEN_INPUTS: OpenInput[] = [
  CONCESSION_VECTOR_SOURCE,
  WELL_COORDINATES_SOURCE,
  GAS_STEP2_INPUT,
  VENUE_INPUT,
  RUN_OF_SHOW_INPUT,
  MONTHLY_DATA_INPUT,
  WORDING_INPUT,
  BRAND_RULES_INPUT,
];
