# Venue rehearsal checklist

Values below come from `src/data/ceremonyConfig.ts`. Change them there if the venue differs.

## Before the day

- [ ] Playback PC: Windows 11, discrete GPU, Chrome, hall screen output set to 1920x1080 (16:9).
- [ ] No internet needed. Fonts and 3D assets are bundled. Load `/` once with the network unplugged to confirm.
- [ ] Open `/` full screen on the hall output and `/operator` on the operator laptop. Both must be on the same machine and browser profile for the sync to work.
- [ ] Keep the hall screen in its own window on the wall output. A hall view that sits in a browser tab behind the operator page is throttled by the browser.
- [ ] Set the screen to 100% scaling and disable the browser's sleep, notifications and update prompts.

## Dry run (do it twice)

1. On `/operator`, enter the PIN and press Reset. The hall shows the establishing shot at 105 kbopd.
2. Press **1 · Step 1 · Valves open**. Valves turn green, oil climbs to 110.0 kbopd, export 108.
3. Press **2 · Countdown 3 · 2 · 1** on the narrator's "three". The ring counts down and Step 2 starts by itself.
4. Watch the 7 AGUP wells come online, gas reach 52 MMscfd at AG-25 and oil reach 120.0 kbopd with the gold look.
5. Press **3 · Replay June to December**. The ribbon draws in nine seconds and ends on 120 kbopd.
6. Press Reset. The hall returns to 105 kbopd.
7. Refresh the hall window in the middle of Step 2. It must resume mid-sequence, not restart.

## Frame rate and fallback

- [ ] Hall view holds a steady frame rate at the venue's output. If not, set Quality to Low on the operator console.
- [ ] Switch View to Classic and to Fallback on the operator console and confirm both show the same numbers. These are the fallbacks if 3D misbehaves.
- [ ] Confirm `/classic` and `/fallback` load directly.

## Deep links for checking each beat

`/?frame=F1` establishing, `F2` Step 1, `F2b` countdown, `F3` AGUP coming online, `F4` the 120 gold moment, `F5` close-up on CPF-1 and AG-25, `F6` the finished replay.

## Items to confirm with the client

These are set to working values in `src/data/ceremonyConfig.ts` and marked there as pending client confirmation: official concession outline, well coordinates, gas figure at Step 2, hall display and playback PC, ceremony date and narrator script, monthly series with BSW and salt, header wording, and the no-logos rule.
