import type { ModelDefinition, Settings, Run, Sample } from "../types";
import { calculateMetrics } from "./physics";
import { validateModel, validateSettings } from "./exports";
export type SweepParameter = "speed" | "yaw" | "pitch" | "altitude";
export interface SweepConfig {
  parameter: SweepParameter;
  start: number;
  end: number;
  count: number;
}
export const SWEEP_PARAMETERS: Record<
  SweepParameter,
  { label: string; unit: string; min: number; max: number }
> = {
  speed: { label: "Wind speed", unit: "m/s", min: 0, max: 120 },
  yaw: { label: "Yaw angle", unit: "°", min: -90, max: 90 },
  pitch: { label: "Angle of attack", unit: "°", min: -30, max: 30 },
  altitude: { label: "Altitude", unit: "m", min: 0, max: 12000 },
};
const colors = ["#92e6bf", "#8cbdeb", "#e8be82", "#c5a1df"];
/** Deterministic metric samples; run IDs and creation metadata identify each generated snapshot. */
export function createSweep(
  model: ModelDefinition,
  settings: Settings,
  scenarioId: string,
  config: SweepConfig,
): Run[] {
  validateModel(model);
  validateSettings(settings);
  const spec = SWEEP_PARAMETERS[config.parameter];
  if (
    !spec ||
    !Number.isInteger(config.count) ||
    config.count < 2 ||
    config.count > 10
  )
    throw new Error("Choose a supported parameter and 2–10 runs.");
  if (
    !Number.isFinite(config.start) ||
    !Number.isFinite(config.end) ||
    config.start < spec.min ||
    config.start > spec.max ||
    config.end < spec.min ||
    config.end > spec.max
  )
    throw new Error(
      `${spec.label} must be between ${spec.min} and ${spec.max} ${spec.unit}.`,
    );
  // Bound synchronous work and archive size while supporting all in-app durations.
  if (settings.duration > 120)
    throw new Error(
      "Use a recording duration of 120 seconds or less for parameter sweeps.",
    );
  const createdAt = new Date().toISOString();
  return Array.from({ length: config.count }, (_, index) => {
    const value =
      index === config.count - 1
        ? config.end
        : config.start +
          ((config.end - config.start) * index) / (config.count - 1);
    const snapshot = structuredClone(settings);
    snapshot[config.parameter] = value;
    const geometry = structuredClone(model);
    const samples: Sample[] = [];
    for (let tick = 0; tick / 10 < snapshot.duration; tick++) {
      const time = tick / 10;
      samples.push({ time, ...calculateMetrics(geometry, snapshot, time) });
    }
    samples.push({
      time: snapshot.duration,
      ...calculateMetrics(geometry, snapshot, snapshot.duration),
    });
    return {
      id: crypto.randomUUID(),
      name: `${model.name} · ${spec.label} ${Number(value.toFixed(3))} ${spec.unit}`,
      createdAt,
      model: geometry,
      settings: snapshot,
      scenarioId,
      samples,
      duration: snapshot.duration,
      notes:
        "Computed parameter sweep; not a recorded viewport session. Estimated metrics use illustrative coefficient assumptions and the bounding-envelope model.",
      color: colors[index % colors.length],
    };
  });
}
