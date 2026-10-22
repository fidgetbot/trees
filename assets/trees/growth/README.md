# Painted terminal growth kit

This directory contains persistent transparent growth modules for the six playable fruit-tree species.

**Runtime correction:** only the shoot assets and approved juvenile root presentation are currently composited. Root stamps are retained as generated source material but disabled. Seed, Sprout, and Seedling keep their reviewed painted roots; `ui/root-growth.js` crops later stage specimens at a measured collar and draws one deterministic botanical graph beneath them. The graph persists through every later life-stage handoff and develops by tip extension, finer lateral branching, and thickening older support.

Each species has four runtime assets:

- `<species>-shoot-v1.png` — a small terminal branch shoot;
- `<species>-root-radicle-v1.png` — the first fine root extension;
- `<species>-root-forked-v1.png` — a young root with its first lateral forks;
- `<species>-root-fan-v1.png` — a compact juvenile root fan, also used for later fine-root extensions.

The complete painted life-stage specimen remains authoritative for trunk and major branch scaffolding. It is also authoritative for Seed, Sprout, and Seedling roots. From Sapling onward, the persistent graph is authoritative underground; later paintings contribute only their above-ground pixels and measured root collar.

Shoot and juvenile modules are drawn beneath the stage specimen so their clean cut attachment bases disappear inside opaque painted tissue. Their placement is deterministic from structural counts. New shoots scale outward from their attachment point during the existing 650 ms growth reveal and remain visible afterward. Winter clips leafy shoots to their central woody axis. Later roots use a 900 ms reveal and do not depend on these module images.

The built-in image generator produced two transparent source sheets from a single board of the six canonical mature-tree paintings. The original sheets are preserved outside the repository in `~/.openclaw/playground/trees-growth-kit/`; the runtime files here were extracted non-destructively, low-alpha wash was removed, and root cells were cropped using reviewed subject bounds rather than an assumed equal grid. `manifest.json` records source and runtime hashes, and `prompts.json` records the generation specifications.
