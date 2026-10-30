export default function Methodology() {
  return (
    <div className="methodology">
      <p className="eyebrow">HOW AEROLAB WORKS</p>
      <h2>An interactive airflow approximation</h2>
      <p>
        AeroLab helps you explore how assumed shape, speed and air conditions
        change aerodynamic trends. The model is an immediate browser
        calculation, not computational fluid dynamics (CFD). Preset drag and
        lift coefficients are illustrative assumptions; the results have not
        been validated against wind-tunnel measurements.
      </p>
      <div className="method-grid">
        <section>
          <h3>Forces and air properties</h3>
          <p className="equation">
            D = ½ρv²AC<sub>d</sub> &nbsp; · &nbsp; L = ½ρv²AC<sub>l</sub>
          </p>
          <p>
            Dynamic pressure is q = ½ρv². Drag and lift combine q with the
            projected bounding-envelope area A and assumed coefficients. Yaw,
            pitch, surface roughness and turbulence adjust these assumptions.
            Changing a model’s scale changes its envelope area; editing
            primitive sizes, positions or rotations changes the inferred
            envelope.
          </p>
          <p className="equation">Re = ρvL/μ &nbsp; · &nbsp; M = v/a</p>
          <p>
            Reynolds number uses the envelope length L and temperature-dependent
            air viscosity μ. Mach number compares flow speed with the
            temperature-dependent speed of sound a. These are reference
            indicators; the model does not solve transition, stall, shocks or
            compressibility effects.
          </p>
          <p>
            Air density uses ρ = p/(RT), with your temperature in kelvin and an
            exponential pressure approximation with altitude. This simplified
            dry-air atmosphere supports comparisons; it is not a local weather
            observation or a layered standard-atmosphere solver. Gusts vary
            speed sinusoidally over time. Zero effective speed produces zero
            aerodynamic forces.
          </p>
        </section>
        <section>
          <h3>What the flow display represents</h3>
          <p>
            The visible tunnel samples a smooth analytic velocity field around a
            finite-size bounding envelope. Flow deflects around that envelope,
            slows in an assumed downstream wake and receives time-varying
            disturbances from the turbulence control. The field fades toward the
            freestream away from the body.
          </p>
          <p>
            The imported or procedural surface mesh is rendered, but its faces,
            holes and internal passages are not resolved by a fluid solver.
            Pressure and velocity colors are qualitative visual proxies derived
            from the analytic field, rather than measured surface pressures.
            Streamlines and particles illustrate the approximation; they do not
            establish aerodynamic accuracy.
          </p>
          <h3>Coordinate system and units</h3>
          <p>
            Freestream travels along +X; Y is up and Z is lateral. Lengths and
            altitude use metres, speed uses m/s, temperature uses °C,
            orientation uses degrees, forces use newtons and dynamic pressure
            uses pascals. Density is kg/m³; Reynolds number, Mach number and
            force coefficients are dimensionless. Scale is a multiplier.
          </p>
        </section>
      </div>
      <h3>From a shape to a comparison</h3>
      <ol>
        <li>
          Choose a library model or import a mesh. Set the coefficient
          assumptions and edit primitive assemblies when needed.
        </li>
        <li>
          Choose a scenario, then adjust speed, orientation, environment and
          surface controls. Keep the other conditions fixed when comparing one
          change.
        </li>
        <li>
          Record an experiment to save its settings, model snapshot and sampled
          metrics. Compare saved runs and export their data for inspection.
        </li>
        <li>
          Open a saved run to replay it and scrub its recorded timeline. A
          recording captures samples, not a new CFD solution.
        </li>
        <li>
          Download a project backup to preserve custom geometry and runs.
          Restore that JSON backup when moving browsers or recovering local
          work.
        </li>
      </ol>
      <div className="method-grid">
        <section>
          <h3>View controls</h3>
          <p>
            Drag to orbit, use the mouse wheel or trackpad to zoom, and
            right-drag to pan. Camera buttons provide repeatable viewpoints. Use
            the view selector for streamlines, particles, pressure or velocity;
            pause and playback-speed controls change the visualization timeline.
          </p>
          <p>
            Keyboard shortcuts: <kbd>Space</kbd> pauses or plays, <kbd>R</kbd>{" "}
            starts or stops recording, and <kbd>F</kbd> resets the camera.
            Shortcuts are inactive while typing in a field.
          </p>
          <p>
            Primitive editing provides translation, rotation and scale controls.
            Flow and force estimates respond to the resulting bounding envelope
            rather than detailed surface curvature.
          </p>
        </section>
        <section>
          <h3>Mesh imports</h3>
          <table>
            <thead>
              <tr>
                <th>Format</th>
                <th>Requirement</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>GLB / glTF</td>
                <td>
                  Self-contained geometry; embed resources. External files and
                  URLs are unsupported.
                </td>
              </tr>
              <tr>
                <td>OBJ</td>
                <td>
                  Geometry in a single file; external materials and textures are
                  unsupported.
                </td>
              </tr>
              <tr>
                <td>STL</td>
                <td>Single-file triangle geometry.</td>
              </tr>
            </tbody>
          </table>
          <p>
            Maximum file size: 25 MB. Inspect the imported envelope and
            dimensions before comparing results. Arbitrary imports use the same
            envelope approximation and coefficient assumptions as the library.
          </p>
        </section>
      </div>
      <h3>Storage and references</h3>
      <p>
        Your project stays in this browser’s local database. Browser storage can
        be cleared; downloaded backups provide a portable copy. CSV exports
        contain sampled metrics, while project JSON includes the workspace and
        saved geometry.
      </p>
      <p>
        Read NASA’s{" "}
        <a
          href="https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/drag-equation/"
          target="_blank"
          rel="noreferrer"
        >
          drag equation
        </a>
        ,{" "}
        <a
          href="https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/density-effects/"
          target="_blank"
          rel="noreferrer"
        >
          density effects
        </a>{" "}
        and{" "}
        <a
          href="https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/air-properties-definitions/"
          target="_blank"
          rel="noreferrer"
        >
          air-property definitions
        </a>{" "}
        for the physical relationships behind these calculations. These
        references explain the equations; they do not validate AeroLab’s
        coefficient presets or flow visualization.
      </p>
    </div>
  );
}
