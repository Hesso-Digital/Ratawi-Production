# Ratawi Production

Ceremony dashboard for the AGUP Phase 1 RFSU opening. A standalone Vite and React app in the Al-Haris family, not part of IOC or WBMS.

| Route | What it is |
| --- | --- |
| `/` | Hall screen. Shows the Night Reveal 3D view (or whichever view the operator selects). |
| `/operator` | Hidden operator console, PIN-gated (`OPERATOR_PIN` in `src/config.ts`). |
| `/classic` | The original control-room grid. Kept as the fallback. |
| `/fallback` | Minimal 2D screen (hero, tiles, countdown, gold moment) with no WebGL. |

## The ceremony

One scenario drives everything (`src/data/scenario.ts`, evaluated by `src/scene/ceremonyTimeline.ts`):

1. **Establishing shot.** 25 wells, 105 kbopd, AG-25 on standby.
2. **Step 1.** Valves open at CPF-1, the gathering lines brighten, oil climbs 105 to 110 kbopd.
3. **Countdown.** 3, 2, 1 over the field. Step 2 starts by itself when it ends.
4. **Step 2.** The 7 AGUP wells come online one after another, their oil races to CPF-1, gas flows to AG-25 (52 MMscfd) and oil climbs to 120 kbopd. The gold milestone fires at 120.
5. **Replay.** The ribbon draws June to December 2026 in nine seconds, with tiles and chart moving with it, and ends on the same 120 kbopd.

The operator clicks Step 1, then starts the countdown on the narrator's "three". Everything on screen (hero number, tiles, tags, ribbon, classic and fallback views) comes from the same scene state, so nothing can drift apart.

Two windows on the same machine stay in sync through `localStorage` and `BroadcastChannel`. A cue stores its start time, so a refreshed or late-joining hall window resumes mid-sequence.

## Configuration

Venue, wording, gas figure, run of show and the monthly series live in one file: `src/data/ceremonyConfig.ts`. Timings are in `src/data/scenario.ts`. Chart and tile figures are in `src/data/defaults.ts`.

## Rehearsal helpers

- `/?frame=F1` to `F6` and `F2b` freeze the hall view at a named beat. `?t=<seconds>` does the same on the scenario clock.
- `?quality=low|medium|high` overrides the quality profile. `?debug=orbit` unlocks the camera.
- The operator console has a "Jump to beat" menu and "Run the whole ceremony".

The venue checklist is in `docs/venue-rehearsal-checklist.md`.

## Develop

```bash
npm install
npm run dev
npm run build
npm run lint
npm test            # unit tests
npm run e2e         # browser tests (uses the system Chrome, builds first with npm run build)
npx playwright test e2e/capture.spec.ts   # replays the ceremony and saves stills to docs/screens/after
```

Data is entered on the operator console today, with a feed interface (`src/data/feed.ts`) that can later swap in PI Vision.
