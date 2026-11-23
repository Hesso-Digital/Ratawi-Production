# Ratawi Production

Hall dashboard for the AGUP Phase 1 RFSU opening. A standalone Vite and React app in the Al-Haris family, not part of IOC or WBMS.

| Route | What it is |
| --- | --- |
| `/` | Hall screen. Live production view (3D field, or whichever view is selected). |
| `/operator` | Operator console. Opens directly, with no PIN. |
| `/classic` | The original control-room grid. Kept as the fallback. |
| `/fallback` | Minimal 2D screen (hero and tiles) with no WebGL. |

## How to switch to AGUP online

The hall screen shows one of two live states: **Current** (pre-AGUP figures) or **AGUP online** (higher KPIs, the seven AGUP wells connected, 32 of 32 wells online). The audience never sees ceremony steps, a countdown or replay chrome.

On the hall screen:

1. Move the pointer so the small three-dot control appears in the top-right corner, then click it. Or press **Shift+A**.
2. Use the **Current / AGUP online** switch, or **Bring AGUP online**. Numbers count up and the wells connect in sequence.
3. **Edit KPI numbers** opens the editor for both states (oil, wells, export, gas, BS&W, salt, plant efficiency, and the commitment and AGUP target lines). **Save** stores the values on this machine and updates the hall screen; **Reset to defaults** restores the original figures.
4. **Playback** in this menu (and on `/operator`) replays June to December. The audience does not see that chrome.
5. **Settings** cover quality, reduced motion, area markers, and the date/time display.
6. **Open operator console** opens `/operator` in a new tab, where the same controls are laid out in full.

From `/operator`, use **Bring AGUP online** / **Reset to current**. Two windows on the same machine stay in sync through `localStorage` and `BroadcastChannel`.

The Al-Haris mark beside the title opens the Al-Haris home at https://dev1.hessodigital.com/.

## Oil production timeline

The oil production view has a June 2026 to April 2027 timeline. Play runs the series in about seven seconds and stops on April 2027. Pause stops; **Live** returns to the current operating figures. Pointing at, clicking or dragging a date sets the “as of” date and the KPI numbers move to that month (actual versus commitment and target). With AGUP online, later months follow the AGUP forecast; otherwise they hold at the Current figures.

## Configuration

Venue, wording, gas figure, run of show and the monthly series live in one file: `src/data/ceremonyConfig.ts`. Timings are in `src/data/scenario.ts`. Chart and tile figures are in `src/data/defaults.ts`.

## Rehearsal helpers

- `/?frame=F1` to `F6` and `F2b` freeze the hall view at a named beat. `?t=<seconds>` does the same on the scenario clock.
- `?quality=low|medium|high` overrides the quality profile. `?debug=orbit` unlocks the camera.
- The operator console has a **Rehearsal** section for older sequence jumps.

The venue checklist is in `docs/venue-rehearsal-checklist.md`.

## Develop

```bash
npm install
npm run dev
npm run build
npm run lint
npm test            # unit tests
npm run e2e         # browser tests (uses the system Chrome, builds first with npm run build)
npx playwright test e2e/capture.spec.ts   # saves stills to docs/screens/after
```

Data is entered on the operator console today, with a feed interface (`src/data/feed.ts`) that can later swap in PI Vision.
