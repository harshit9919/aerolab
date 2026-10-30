# Verification record

Verified on 2026-10-30 with Node 22.20.0 and desktop Chrome.

- `npm test`: 48 tests passed across five unit test files.
- `npm run build`: TypeScript compilation and Vite production build passed.
- `npm audit --audit-level=moderate`: zero known dependency vulnerabilities.
- `npm run test:e2e`: six browser tests passed, covering pause and wind controls; recording, replay, export and reload; custom assembly persistence; STL import and invalid-file handling; parameter sweep comparison and persistence; mobile layout, condition controls and editor access.
- Visual inspection: desktop workbench, geometry editor, experiment comparisons and 390 px mobile layout. No browser page errors or mobile horizontal overflow in the final screenshot session.
- Independent review findings fixed and re-reviewed: historical replay cannot replace newer saved model revisions in backups; assembly translation does not change envelope dimensions or drag; planar model imports retain geometry and use a disclosed minimum aerodynamic envelope thickness.

These checks validate software behavior, persistence and arithmetic invariants. They do not validate the approximate aerodynamic model against real wind-tunnel or CFD data.
