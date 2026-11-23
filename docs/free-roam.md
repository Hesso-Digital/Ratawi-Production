# Free roam and inspect on the hall screen

The main screen (`/`, `/reveal`) keeps the cinematic show camera that /operator
drives, and lets anyone at the screen take the camera when they want to look
around.

## Controls

| Input | What it does |
|---|---|
| Drag (left mouse, one finger) | Orbit around the field. Starts free roam. |
| Right drag, two fingers, or Shift drag | Pan across the ground |
| Scroll, pinch | Zoom in and out |
| `E` or the **Explore** chip | Start free roam from the current view |
| `1` to `5` or the chips | Fly to Aerial, CPF-1, AG-25 gas plant, AGUP wells, Export line |
| Click an asset | Highlight it, open its info panel with live values, fly to frame it |
| `Esc`, click empty ground, or the × | Close the panel |
| `R` or **Back to show** | Ease back to the show camera |

Limits: distance 4 to 240 m, the camera never goes below the dunes, and the
orbit target stays inside the field.

## Hand-off with /operator

- Every /operator cue (Step 1, countdown, Step 2, replay, reset) hands the view
  back to the show camera with a 1.6 s eased move and closes any open panel.
  Free roam starts again as soon as someone touches the screen.
- After about 20 s without input (40 s with a panel open) the view eases back to
  the show's slow drift by itself.
- `?locked=1` turns free roam and inspect off for a display-only hall screen.
  `?quality=low` lowers render cost on laptops. `?models=procedural` forces the
  procedural geometry instead of the GLB models.

## Inspectable assets

CPF-1, AG-25, the CPF-1 flare, the gas line to AG-25, the export line, the
gathering network, the AGUP flowlines, the SPP and all 32 wellheads (25
producing, 7 AGUP). Values come from the same scene state as the HUD
(`src/scene/explore/assets.ts`).

## GLB models

`src/scene/models/` loads any GLB present in `public/models` at build time by
file name (`virtual:field-models` in `vite.config.ts`). Today CPF-1, AG-25, both
wellheads and the export markers use GLBs; the procedural geometry is the
Suspense and error fallback. Emissive materials become `toneMapped: false` HDR
colours so they bloom. Draco and KTX2 decoders are self-hosted under
`public/decoders` (the venue PC is offline) and meshopt is bundled, so updated
models drop in with no code change.
