import type { Workspace, Run, Settings, ModelDefinition } from "../types";
function fail(): never {
  throw new Error("Invalid or unsupported workspace backup");
}
function obj(v: unknown): Record<string, unknown> {
  if (
    !v ||
    typeof v !== "object" ||
    Array.isArray(v) ||
    Object.getPrototypeOf(v) !== Object.prototype
  )
    fail();
  return v as Record<string, unknown>;
}
function str(v: unknown, max = 10000) {
  if (typeof v !== "string" || v.length > max) fail();
  return v;
}
function num(v: unknown, min = -1e15, max = 1e15): number {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max)
    fail();
  return v;
}
function safe(v: unknown, depth = 0): void {
  if (depth > 40) fail();
  if (v === null || typeof v === "string" || typeof v === "boolean") return;
  if (typeof v === "number") {
    num(v);
    return;
  }
  if (Array.isArray(v)) {
    if (v.length > 1000000) fail();
    v.forEach((x) => safe(x, depth + 1));
    return;
  }
  const o = obj(v);
  for (const [k, x] of Object.entries(o)) {
    if (["__proto__", "prototype", "constructor"].includes(k)) fail();
    safe(x, depth + 1);
  }
}
const bounds: Record<keyof Settings, [number, number]> = {
  speed: [0, 1000],
  yaw: [-180, 180],
  pitch: [-180, 180],
  temperature: [-100, 100],
  altitude: [-1000, 50000],
  turbulence: [0, 100],
  gust: [0, 1000],
  gustFrequency: [0, 100],
  roughness: [0, 1],
  scale: [0.001, 1000],
  duration: [0.01, 86400],
};
export function validateSettings(v: unknown): asserts v is Settings {
  const o = obj(v);
  for (const k of Object.keys(bounds) as (keyof Settings)[])
    num(o[k], ...bounds[k]);
}
function vector(v: unknown, positive = false) {
  if (!Array.isArray(v) || v.length !== 3) fail();
  v.forEach((x) => num(x, positive ? 0.000001 : -1e6, 1e6));
}
export function validateModel(v: unknown): asserts v is ModelDefinition {
  const o = obj(v);
  for (const k of ["id", "name", "category", "description", "kind"]) str(o[k]);
  if (!o.id || !o.name) fail();
  vector(o.dimensions, true);
  num(o.cd, 0, 100);
  num(o.liftSlope, -100, 100);
  if (o.custom !== undefined && typeof o.custom !== "boolean") fail();
  if (o.mesh !== undefined) {
    obj(o.mesh);
    safe(o.mesh);
  }
  if (o.parts !== undefined) {
    if (!Array.isArray(o.parts) || o.parts.length > 1000) fail();
    for (const p of o.parts) {
      const part = obj(p);
      str(part.id);
      str(part.name);
      str(part.color, 100);
      if (
        ![
          "box",
          "sphere",
          "cylinder",
          "cone",
          "torus",
          "wing",
          "capsule",
        ].includes(part.shape as string)
      )
        fail();
      vector(part.position);
      vector(part.rotation);
      vector(part.scale, true);
    }
  }
}
const metricKeys = [
  "speed",
  "drag",
  "lift",
  "cd",
  "cl",
  "pressure",
  "reynolds",
  "mach",
  "density",
  "area",
  "efficiency",
] as const;
export function validateRun(v: unknown): asserts v is Run {
  const o = obj(v);
  for (const k of ["id", "name", "createdAt", "scenarioId", "notes", "color"])
    str(o[k]);
  if (!o.id || !o.name || !Number.isFinite(Date.parse(o.createdAt as string)))
    fail();
  validateModel(o.model);
  validateSettings(o.settings);
  num(o.duration, 0, 86400);
  if (!Array.isArray(o.samples) || o.samples.length > 100000) fail();
  let time = -1;
  for (const sample of o.samples) {
    const s = obj(sample);
    const t = num(s.time, 0, 86400);
    if (t < time || t > (o.duration as number) + 0.001) fail();
    time = t;
    for (const k of metricKeys) num(s[k]);
  }
}
export function validateWorkspace(v: unknown): asserts v is Workspace {
  safe(v);
  const o = obj(v);
  if (
    o.version !== 1 ||
    !Array.isArray(o.models) ||
    o.models.length > 2000 ||
    !Array.isArray(o.runs) ||
    o.runs.length > 2000
  )
    fail();
  validateSettings(o.settings);
  str(o.activeModelId);
  const ids = new Set<string>();
  for (const m of o.models) {
    validateModel(m);
    if (ids.has(m.id)) fail();
    ids.add(m.id);
  }
  ids.clear();
  let count = 0;
  for (const r of o.runs) {
    validateRun(r);
    if (ids.has(r.id)) fail();
    ids.add(r.id);
    count += r.samples.length;
    if (count > 100000) fail();
  }
}
function checkBackupSize(text: string) {
  if (
    text.length > 25 * 1024 * 1024 ||
    new TextEncoder().encode(text).byteLength > 25 * 1024 * 1024
  )
    throw new Error("Backup exceeds the 25 MB limit.");
}
export function parseWorkspace(text: string): Workspace {
  checkBackupSize(text);
  const value: unknown = JSON.parse(text);
  validateWorkspace(value);
  return value;
}
function download(value: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([value], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function filename(name: string) {
  return name.replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 80) || "aerolab";
}
export function downloadWorkspace(workspace: Workspace): void {
  validateWorkspace(workspace);
  const text = JSON.stringify(workspace, null, 2);
  checkBackupSize(text);
  download(text, "aerolab-workspace.json", "application/json");
}
export function downloadRunJson(run: Run): void {
  validateRun(run);
  download(
    JSON.stringify(run, null, 2),
    `${filename(run.name)}.json`,
    "application/json",
  );
}
function csv(v: unknown) {
  let s = String(v ?? "");
  if (/^[\s]*[=+@-]/.test(s) && typeof v !== "number") s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}
export function downloadRunCsv(run: Run): void {
  validateRun(run);
  const rows: unknown[][] = [
    ["AeroLab run", run.name],
    ["ID", run.id],
    ["Created", run.createdAt],
    ["Model", run.model.name],
    ["Model snapshot", JSON.stringify(run.model)],
    ["Scenario", run.scenarioId],
    ["Notes", run.notes],
    ["Duration (s)", run.duration],
    ["Settings", JSON.stringify(run.settings)],
    [
      "Units",
      "speed m/s; yaw/pitch degrees; temperature °C; altitude m; duration s; drag/lift N; pressure Pa; density kg/m³; area m²",
    ],
    [],
    [
      "time (s)",
      ...metricKeys.map(
        (k) =>
          (
            ({
              speed: "speed (m/s)",
              drag: "drag (N)",
              lift: "lift (N)",
              pressure: "pressure (Pa)",
              density: "density (kg/m³)",
              area: "area (m²)",
            }) as Record<string, string>
          )[k] ?? k,
      ),
    ],
    ...run.samples.map((s) => [s.time, ...metricKeys.map((k) => s[k])]),
  ];
  download(
    "\uFEFF" + rows.map((row) => row.map(csv).join(",")).join("\r\n"),
    `${filename(run.name)}.csv`,
    "text/csv;charset=utf-8",
  );
}
