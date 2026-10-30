# AeroLab — Airflow Studio

A complete interactive 3D airflow workbench built with React, TypeScript and Three.js. The browser computes **approximate aerodynamic estimates**, not validated computational fluid dynamics.

## Run locally

Install Node.js 22 or newer, then run:

```sh
npm ci
npm run dev
```

Open the URL printed by Vite (normally http://127.0.0.1:5173). In the original workspace, `./start.sh` also detects the locally installed Node runtime.

## Included workflows

- 20 procedural reference models: cars, truck, aircraft, glider, wing, drone, rocket, buildings, bridge, primitives, and streamlined bodies.
- 12 scenario presets, with independent wind speed, turbulence, yaw, pitch, altitude, temperature, gust amplitude/frequency, surface roughness and model scale controls.
- Orbit, pan, zoom, four camera presets, grid/tunnel toggles, density adjustment and PNG screenshots.
- Streamlines, animated tracers and approximate surface pressure/velocity visualizations.
- Multi-part geometry editor: seven primitives, drag gizmos, numeric position/rotation/scale, material color, duplication, deletion, undo/redo and model saving.
- Import GLB, self-contained glTF, STL and material-free OBJ; export geometry as GLB. Imported models are normalized to a 4 m longest dimension. Set object scale to adjust physical dimensions. Planar meshes use a minimum 1 cm envelope thickness for estimates while retaining their original rendered geometry.
- Record 10–120 second experiments, pause/resume, adjust playback rate and replay using the timeline.
- Each run stores an immutable geometry snapshot, conditions and samples at 0.1 s intervals.
- Parameter sweeps create 2–10 estimated runs across wind speed, yaw, pitch or altitude; these are labeled as computed runs.
- Archive search/sort, notes and renaming, up to four comparisons, baseline deltas, charts and condition tables.
- CSV and JSON run exports; complete workspace backup/restore, including imported geometry.

## Persistence

IndexedDB stores runs, custom models and the last selected model/settings. Data stays in the current browser profile and origin. Local preview and the deployed Site have **separate** storage; use Export workspace and Restore workspace to transfer data. Clearing browser data removes this local archive. Export backups to retain copies. Backups preserve the latest saved model revision during historical replay and include unsaved edits as separate drafts. Restores merge by stable ID in one transaction; they do not erase unrelated runs.

Model imports are limited to 25 MB and 500,000 triangles. Backup files are limited to 25 MB UTF-8, 2,000 models, 2,000 runs and 100,000 total samples. Export errors explain when a workspace exceeds those limits; per-run exports remain available. External glTF/OBJ dependencies and compressed meshes requiring external decoders are not supported.

## Physics model and limitations

Drag is computed as `D = ½ρV² A Cd`. Lift uses the same dynamic pressure with an illustrative pitch-dependent coefficient. Temperature and altitude affect density; dynamic viscosity follows Sutherland's relation. Reynolds and Mach values describe the entered envelope/conditions.

Preset drag and lift coefficients are **illustrative assumptions**, not measured reference values. Imported and assembled objects use transformed bounding envelopes; holes, local mesh topology, shielding between parts, boundary layers and detailed surface forces are not solved. Turbulence and wakes are illustrative. Surface pressure/velocity colors are steady approximate samples, refreshed on configuration changes. They are not a Navier–Stokes solution or a convergence result. Parameter sweeps compare the same approximation consistently.

References: [NASA drag equation](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/drag-equation/), [NASA drag coefficient](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/drag-coefficient/), [Three.js documentation](https://threejs.org/docs/).

## Keyboard shortcuts

Space pauses/resumes. R starts/stops recording. F resets the camera. Shortcuts are ignored while editing form fields. Drag to orbit, right-drag to pan, and scroll to zoom.

## Verification and build

```sh
npm test
npm run build
npm run test:e2e
```

Unit tests cover force scaling, zero wind, rotated envelope bounds, generated sweeps, IndexedDB atomicity, validation, CSV bytes and imported geometry round trips. Browser tests cover playback, recording/replay, custom edits, imports, persistence and exports. Playwright uses installed macOS Chrome when available; elsewhere run `npx playwright install chromium` or set `PLAYWRIGHT_CHROME_PATH`.

The production output is `dist/`. It can be served from any static host. Sites deployment identity is in `.openai/hosting.json`; source synchronization and publication use the Sites plugin workflow.

## Source map

`src/App.tsx` coordinates interaction and recordings. `src/components/Viewport.tsx` owns Three.js rendering; `src/lib/geometry.ts` builds and loads meshes. Pure functions in `physics.ts` and `sweep.ts` compute estimates. `storage.ts` owns IndexedDB and `exports.ts` validates portable files. `Experiments.tsx` handles archive and comparisons.
