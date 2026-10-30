import { useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  Check,
  FlaskConical,
  Play,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import type { Run, Sample } from "../types";
import { downloadRunCsv, downloadRunJson } from "../lib/exports";
import { modelDimensions } from "../lib/physics";
import { LineChart, COLORS } from "./Charts";
type Props = {
  runs: Run[];
  onReplay: (run: Run) => void;
  onDelete: (id: string) => void;
  onUpdate: (run: Run) => void;
  onRecord: () => void;
};
type Metric = "drag" | "lift" | "cd" | "pressure";
const units: Record<Metric, string> = {
  drag: "N",
  lift: "N",
  cd: "",
  pressure: "Pa",
};
const titles: Record<Metric, string> = {
  drag: "Drag force",
  lift: "Lift force",
  cd: "Drag coefficient",
  pressure: "Dynamic pressure",
};
function average(run: Run, key: keyof Sample) {
  return run.samples.length
    ? run.samples.reduce((sum, s) => sum + s[key], 0) / run.samples.length
    : null;
}
function number(value: number | null, digits = 2) {
  return value === null
    ? "—"
    : value.toLocaleString(undefined, { maximumFractionDigits: digits });
}
function difference(value: number | null, baseline: number | null) {
  if (value === null || baseline === null) return "No sample data";
  if (baseline === 0) return value === 0 ? "No change" : "Baseline is zero";
  const percent = ((value - baseline) / Math.abs(baseline)) * 100;
  return `${percent > 0 ? "+" : ""}${percent.toFixed(1)}% vs baseline`;
}
// Interpolate by elapsed time so irregular recording intervals retain their relative position.
function normalized(run: Run, key: Metric) {
  if (!run.samples.length) return [];
  const samples = run.samples;
  let cursor = 0;
  const end = samples[samples.length - 1].time;
  return Array.from({ length: 101 }, (_, i) => {
    const t = (end * i) / 100;
    while (cursor < samples.length - 2 && samples[cursor + 1].time < t)
      cursor++;
    const a = samples[cursor],
      b = samples[Math.min(cursor + 1, samples.length - 1)];
    const f =
      b.time > a.time
        ? Math.max(0, Math.min(1, (t - a.time) / (b.time - a.time)))
        : 0;
    return a[key] + (b[key] - a[key]) * f;
  });
}
export function Experiments({
  runs,
  onReplay,
  onDelete,
  onUpdate,
  onRecord,
}: Props) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("recent");
  const [selected, setSelected] = useState<string[]>([]);
  const [metric, setMetric] = useState<Metric>("drag");
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const compared = selected
    .map((id) => runs.find((r) => r.id === id))
    .filter((r): r is Run => !!r);
  const visible = useMemo(
    () =>
      runs
        .filter((r) =>
          `${r.name} ${r.model.name} ${r.notes} ${r.scenarioId}`
            .toLowerCase()
            .includes(query.toLowerCase()),
        )
        .sort((a, b) =>
          sort === "name"
            ? a.name.localeCompare(b.name)
            : sort === "drag"
              ? (average(a, "drag") ?? Infinity) -
                (average(b, "drag") ?? Infinity)
              : Date.parse(b.createdAt) - Date.parse(a.createdAt),
        ),
    [runs, query, sort],
  );
  const editRun = runs.find((r) => r.id === editing);
  function toggle(id: string) {
    setSelected((ids) =>
      ids.includes(id)
        ? ids.filter((i) => i !== id)
        : ids.filter((i) => runs.some((r) => r.id === i)).length < 4
          ? [...ids.filter((i) => runs.some((r) => r.id === i)), id]
          : ids,
    );
  }
  function openDetails(run: Run) {
    setEditing(run.id);
    setName(run.name);
    setNotes(run.notes);
    setDeleting(null);
  }
  return (
    <main className="results-page">
      <header className="results-header">
        <div>
          <div className="eyebrow">EXPERIMENT ARCHIVE</div>
          <h1>
            Your experiments<span className="pill">{runs.length} saved</span>
          </h1>
          <p className="muted">
            Revisit recordings, compare performance, and take your data further.
          </p>
        </div>
        <button className="primary-button" onClick={onRecord}>
          <Plus size={16} />
          New experiment
        </button>
      </header>
      {!runs.length ? (
        <section className="card empty-state">
          <FlaskConical size={38} />
          <h2>Every discovery starts with a run.</h2>
          <p className="muted">
            Record a wind tunnel experiment to save its geometry, conditions,
            and time samples here.
          </p>
          <button className="primary-button" onClick={onRecord}>
            <Plus size={16} />
            Record first experiment
          </button>
        </section>
      ) : (
        <>
          <section className="card experiment-list">
            <div className="results-toolbar">
              <label className="search-field">
                <Search size={16} />
                <input
                  aria-label="Search experiments"
                  placeholder="Search experiments or models…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <label className="field">
                Sort by
                <select
                  aria-label="Sort experiments"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  <option value="recent">Most recent</option>
                  <option value="name">Name A–Z</option>
                  <option value="drag">Lowest mean drag</option>
                </select>
              </label>
            </div>
            <div className="table-scroll">
              <table className="run-table">
                <thead>
                  <tr>
                    <th scope="col">Compare</th>
                    <th scope="col">Experiment</th>
                    <th scope="col">Model / conditions</th>
                    <th scope="col">Mean drag</th>
                    <th scope="col">Duration</th>
                    <th scope="col">Recorded</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((run) => (
                    <tr key={run.id}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Compare ${run.name}`}
                          checked={selected.includes(run.id)}
                          disabled={
                            !selected.includes(run.id) && compared.length >= 4
                          }
                          onChange={() => toggle(run.id)}
                        />
                      </td>
                      <td>
                        <button
                          className="text-button"
                          onClick={() => openDetails(run)}
                        >
                          {run.name}
                          <ArrowUpRight size={13} />
                        </button>
                        <div className="muted">
                          {run.samples.length.toLocaleString()} samples
                        </div>
                      </td>
                      <td>
                        {run.model.name}
                        <div className="muted">
                          {number(run.settings.speed)} m/s ·{" "}
                          {number(run.settings.pitch)}° pitch
                        </div>
                      </td>
                      <td>
                        {number(average(run, "drag"))}{" "}
                        {run.samples.length ? "N" : ""}
                      </td>
                      <td>{number(run.duration)} s</td>
                      <td>
                        <time dateTime={run.createdAt}>
                          {new Date(run.createdAt).toLocaleDateString(
                            undefined,
                            { month: "short", day: "numeric", year: "numeric" },
                          )}
                        </time>
                      </td>
                      <td>
                        <div className="table-actions">
                          <button
                            className="text-button"
                            aria-label={`Replay ${run.name}`}
                            onClick={() => onReplay(run)}
                          >
                            <Play size={14} />
                            Replay
                          </button>
                          <button
                            className="text-button"
                            aria-label={`Export ${run.name} as CSV`}
                            onClick={() => downloadRunCsv(run)}
                          >
                            <ArrowDownToLine size={14} />
                            CSV
                          </button>
                          <button
                            className="text-button"
                            aria-label={`Export ${run.name} as JSON`}
                            onClick={() => downloadRunJson(run)}
                          >
                            JSON
                          </button>
                          <button
                            className="icon-button"
                            aria-label={`Delete ${run.name}`}
                            onClick={() => setDeleting(run.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        {deleting === run.id && (
                          <div
                            className="delete-confirmation"
                            role="group"
                            aria-label={`Confirm deletion of ${run.name}`}
                          >
                            <p>
                              Delete “{run.name}”? This removes the saved
                              recording.
                            </p>
                            <button
                              className="secondary-button danger"
                              onClick={() => {
                                onDelete(run.id);
                                setDeleting(null);
                                setSelected((ids) =>
                                  ids.filter((id) => id !== run.id),
                                );
                                if (editing === run.id) setEditing(null);
                              }}
                            >
                              Delete experiment
                            </button>
                            <button
                              className="text-button"
                              onClick={() => setDeleting(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!visible.length && (
              <div className="empty-state">
                <h3>No matching experiments</h3>
                <p className="muted">
                  Try another model, name, scenario, or note.
                </p>
                <button className="text-button" onClick={() => setQuery("")}>
                  Clear search
                </button>
              </div>
            )}
            <p className="muted compare-hint">
              Select up to four experiments to compare. The first selected run
              is your baseline.
            </p>
          </section>
          {editRun && (
            <section
              className="card experiment-details"
              aria-label="Edit experiment details"
            >
              <div className="results-header">
                <div>
                  <h2>Experiment details</h2>
                  <p className="muted">
                    {editRun.model.name} ·{" "}
                    {new Date(editRun.createdAt).toLocaleString()}
                  </p>
                </div>
                <button
                  className="icon-button"
                  aria-label="Close experiment details"
                  onClick={() => setEditing(null)}
                >
                  <X size={18} />
                </button>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!name.trim()) return;
                  onUpdate({ ...editRun, name: name.trim(), notes });
                  setEditing(null);
                }}
              >
                <label className="field">
                  Experiment name
                  <input
                    required
                    maxLength={150}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <label className="field">
                  Notes
                  <textarea
                    rows={3}
                    maxLength={10000}
                    placeholder="What did you learn from this run?"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </label>
                <div className="table-actions">
                  <button
                    className="primary-button"
                    type="submit"
                    disabled={!name.trim()}
                  >
                    <Check size={15} />
                    Save details
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => setEditing(null)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </section>
          )}
          <section className="comparison-section">
            <div className="results-header">
              <div>
                <div className="eyebrow">SIDE BY SIDE</div>
                <h2>
                  Compare experiments{" "}
                  <span className="pill">{compared.length} / 4</span>
                </h2>
                <p className="muted">
                  Sample means describe each full recording. Changes use the
                  first selected run as baseline.
                </p>
              </div>
              {compared.length > 0 && (
                <button className="text-button" onClick={() => setSelected([])}>
                  Clear selection
                </button>
              )}
            </div>
            {!compared.length ? (
              <div className="card empty-state">
                <h3>Find what makes the difference.</h3>
                <p className="muted">
                  Select experiments above to compare their forces, geometry,
                  and test conditions.
                </p>
              </div>
            ) : (
              <>
                <div className="comparison-grid">
                  {compared.map((run, index) => (
                    <article
                      className="card compare-card"
                      key={run.id}
                      style={{
                        borderTopColor: COLORS[index],
                        borderTopWidth: 3,
                        borderTopStyle: "solid",
                      }}
                    >
                      <div className="results-header">
                        <span className="pill">
                          {index === 0 ? "Baseline" : `Experiment ${index + 1}`}
                        </span>
                        <button
                          className="icon-button"
                          aria-label={`Remove ${run.name} from comparison`}
                          onClick={() => toggle(run.id)}
                        >
                          <X size={14} />
                        </button>
                      </div>
                      <h3>{run.name}</h3>
                      <p className="muted">{run.model.name}</p>
                      <div className="comparison-value">
                        {number(average(run, "drag"))}
                        <small> N mean drag</small>
                      </div>
                      <p className="muted">
                        {index === 0
                          ? "Reference recording"
                          : difference(
                              average(run, "drag"),
                              average(compared[0], "drag"),
                            )}
                      </p>
                      <dl className="comparison-stats">
                        <div>
                          <dt>Mean Cd</dt>
                          <dd>{number(average(run, "cd"), 3)}</dd>
                        </div>
                        <div>
                          <dt>Mean lift</dt>
                          <dd>{number(average(run, "lift"))} N</dd>
                        </div>
                        <div>
                          <dt>Test speed</dt>
                          <dd>{number(run.settings.speed)} m/s</dd>
                        </div>
                        <div>
                          <dt>Duration</dt>
                          <dd>{number(run.duration)} s</dd>
                        </div>
                      </dl>
                    </article>
                  ))}
                </div>
                <section className="card comparison-chart">
                  <div className="results-header">
                    <div>
                      <h3>Performance over time</h3>
                      <p className="muted">
                        Normalized recording progress. Each line spans its own
                        elapsed sample duration; recordings may have different
                        lengths.
                      </p>
                    </div>
                    <label className="field">
                      Metric
                      <select
                        value={metric}
                        onChange={(e) => setMetric(e.target.value as Metric)}
                      >
                        <option value="drag">Drag force (N)</option>
                        <option value="lift">Lift force (N)</option>
                        <option value="cd">Drag coefficient (Cd)</option>
                        <option value="pressure">Dynamic pressure (Pa)</option>
                      </select>
                    </label>
                  </div>
                  <div className="chart-legend">
                    {compared.map((run, i) => (
                      <span key={run.id} style={{ color: COLORS[i] }}>
                        {run.name} · {number(run.samples.at(-1)?.time ?? 0)} s
                      </span>
                    ))}
                  </div>
                  <div className="muted">
                    {titles[metric]} {units[metric] && `(${units[metric]})`}
                  </div>
                  {compared.some((r) => r.samples.length) ? (
                    <>
                      <LineChart
                        series={compared
                          .filter((r) => r.samples.length)
                          .map((r) => ({
                            name: r.name,
                            color: COLORS[compared.indexOf(r)],
                            values: normalized(r, metric),
                          }))}
                        height={230}
                        labels={false}
                      />
                      <div className="chart-axis">
                        <span>0%</span>
                        <span>50% recording progress</span>
                        <span>100%</span>
                      </div>
                    </>
                  ) : (
                    <p className="empty-state muted">
                      These recordings have no samples to chart.
                    </p>
                  )}
                </section>
                <section className="card">
                  <h3>Test conditions & geometry</h3>
                  <div className="table-scroll">
                    <table className="run-table">
                      <thead>
                        <tr>
                          <th scope="col">Parameter</th>
                          {compared.map((run) => (
                            <th key={run.id} scope="col">
                              {run.name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(
                          [
                            ["Geometry", (r: Run) => r.model.name],
                            [
                              "Dimensions (m)",
                              (r: Run) =>
                                modelDimensions(r.model)
                                  .map((d) => number(d * r.settings.scale))
                                  .join(" × "),
                            ],
                            [
                              "Geometry parts",
                              (r: Run) =>
                                r.model.parts?.length ??
                                (r.model.mesh ? "Imported mesh" : "Preset"),
                            ],
                            ["Scenario", (r: Run) => r.scenarioId || "Manual"],
                            [
                              "Speed (m/s)",
                              (r: Run) => number(r.settings.speed),
                            ],
                            [
                              "Yaw / pitch (°)",
                              (r: Run) =>
                                `${number(r.settings.yaw)} / ${number(r.settings.pitch)}`,
                            ],
                            [
                              "Temperature (°C)",
                              (r: Run) => number(r.settings.temperature),
                            ],
                            [
                              "Altitude (m)",
                              (r: Run) => number(r.settings.altitude),
                            ],
                            [
                              "Turbulence",
                              (r: Run) => number(r.settings.turbulence),
                            ],
                            [
                              "Gust amplitude (m/s)",
                              (r: Run) => number(r.settings.gust),
                            ],
                            [
                              "Gust frequency (Hz)",
                              (r: Run) => number(r.settings.gustFrequency),
                            ],
                            [
                              "Surface roughness",
                              (r: Run) => number(r.settings.roughness),
                            ],
                            [
                              "Model scale",
                              (r: Run) => `${number(r.settings.scale)}×`,
                            ],
                            [
                              "Mean drag (N)",
                              (r: Run) => number(average(r, "drag")),
                            ],
                            [
                              "Mean Cd",
                              (r: Run) => number(average(r, "cd"), 3),
                            ],
                            [
                              "Mean lift (N)",
                              (r: Run) => number(average(r, "lift")),
                            ],
                            [
                              "Recorded duration (s)",
                              (r: Run) => number(r.duration),
                            ],
                            ["Samples", (r: Run) => r.samples.length],
                            ["Notes", (r: Run) => r.notes || "—"],
                          ] as [string, (r: Run) => string | number][]
                        ).map(([label, value]) => (
                          <tr key={label}>
                            <th scope="row">{label}</th>
                            {compared.map((run) => (
                              <td key={run.id}>{value(run)}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            )}
          </section>
        </>
      )}
    </main>
  );
}
export default Experiments;
