# Trees sim scaffold

Current headless entrypoint:

- `node sim/run.js` — run one stubbed headless turn
- `node sim/run.js --turns 10` — run multiple stubbed headless turn-start cycles

Right now this exercises the shared engine with stubbed browser hooks so the Node path can grow incrementally while the browser refactor continues.
