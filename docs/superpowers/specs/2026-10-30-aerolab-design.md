# AeroLab design

Build a substantial desktop-first responsive 3D airflow laboratory. The user selected interactive browser simulation with clearly labeled approximate metrics. Use React, TypeScript, Vite and Three.js. A dark graphite interface with mint controls frames a large 3D wind tunnel, asset library, experiment controls and live telemetry.

Approaches considered: browser approximation offers immediate interactive editing and local records; validated CFD requires a separate compute backend and mesh/solver validation. The user chose the browser approach. Physics must never be described as validated CFD.

Core workflow: choose a procedural model or import self-contained GLB/glTF, OBJ or STL; adjust shape and conditions; observe animated flow; record; compare saved runs; restore configuration and scrub recorded results. Provide primitive assembly editor, scenario presets, scale/orientation controls, camera views and zoom, pause, playback speed, pressure/velocity/streamline modes, metric histories, CSV/JSON export, project backup/restore and persistent local storage. Store immutable geometry snapshots with runs. Display errors on storage/import failures.

Catalog target: at least 16 meaningful procedural models and 8 condition presets. Geometry editing must affect rendered model and approximate aerodynamic properties. Imported arbitrary shapes use bounding-envelope approximations and user-adjustable coefficient assumptions, explicitly disclosed.

Data remains in this browser using IndexedDB; downloadable project archives carry runs and custom geometry. No accounts or external data collection. Publish a private static Site if supported. WebGL fallback is explicit. Scientific method documentation links NASA drag equation and Three.js loader documentation.
