# Painted terminal growth kit

This directory contains persistent transparent growth modules for the six playable fruit-tree species.

**Runtime correction:** only the shoot assets are currently composited. Root stamps are retained as generated source material but disabled: their mature-looking bark and joins clash with juvenile roots. `ui/root-growth.js` instead extends the exact root pixels in each stage specimen with a continuous, fixed-collar deformation. Root colour, texture and connected anatomy therefore remain consistent, and growth persists at the animation endpoint.

Each species has four runtime assets:

- `<species>-shoot-v1.png` — a small terminal branch shoot;
- `<species>-root-radicle-v1.png` — the first fine root extension;
- `<species>-root-forked-v1.png` — a young root with its first lateral forks;
- `<species>-root-fan-v1.png` — a compact juvenile root fan, also used for later fine-root extensions.

The complete painted life-stage specimen remains the authoritative trunk, major branch scaffold, and root system. These modules represent only growth purchased after entering the current life stage. When the tree advances, the next painted specimen absorbs the accumulated modules and establishes a new structural baseline.

Modules are drawn beneath the stage specimen so their clean cut attachment bases disappear inside opaque painted tissue. Their placement is deterministic from structural counts. New modules scale outward from their attachment point during the existing 650 ms growth reveal and remain visible afterward. Winter clips leafy shoots to their central woody axis while root modules remain unchanged.

The built-in image generator produced two transparent source sheets from a single board of the six canonical mature-tree paintings. The original sheets are preserved outside the repository in `~/.openclaw/playground/trees-growth-kit/`; the runtime files here were extracted non-destructively, low-alpha wash was removed, and root cells were cropped using reviewed subject bounds rather than an assumed equal grid. `manifest.json` records source and runtime hashes, and `prompts.json` records the generation specifications.
