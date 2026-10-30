import { describe, expect, it } from "vitest";
import { createSweep } from "../src/lib/sweep";
import { DEFAULT_SETTINGS, MODELS } from "../src/lib/catalog";
describe("computed parameter sweeps", () => {
  it("generates independent snapshots and complete fixed-interval timelines", () => {
    const source = structuredClone(MODELS[0]);
    const settings = { ...DEFAULT_SETTINGS, duration: 0.25 };
    const runs = createSweep(source, settings, "baseline", {
      parameter: "speed",
      start: 0,
      end: 10,
      count: 3,
    });
    expect(new Set(runs.map((r) => r.id)).size).toBe(3);
    expect(runs.map((r) => r.settings.speed)).toEqual([0, 5, 10]);
    expect(runs[0].samples.map((s) => s.time)).toEqual([0, 0.1, 0.2, 0.25]);
    expect(
      runs.every(
        (r) =>
          r.duration === 0.25 &&
          r.notes.includes("not a recorded viewport session"),
      ),
    ).toBe(true);
    runs[0].model.name = "Changed";
    runs[0].settings.pitch = 12;
    expect(runs[1].model.name).toBe(source.name);
    expect(settings.pitch).toBe(0);
    expect(runs[1].settings.pitch).toBe(0);
  });
  it("increases drag across a zero-to-ten speed sweep", () => {
    const runs = createSweep(
      MODELS[0],
      { ...DEFAULT_SETTINGS, duration: 1 },
      "baseline",
      { parameter: "speed", start: 0, end: 10, count: 3 },
    );
    const drag = runs.map((r) => r.samples[0].drag);
    expect(drag[0]).toBe(0);
    expect(drag[1]).toBeGreaterThan(0);
    expect(drag[2] / drag[1]).toBeCloseTo(4);
    expect(runs[2].samples.at(-1)?.time).toBe(1);
  });
  it("rejects nonfinite, invalid bounds, and oversized sweeps", () => {
    for (const config of [
      { parameter: "speed", start: NaN, end: 10, count: 3 },
      { parameter: "speed", start: -1, end: 10, count: 3 },
      { parameter: "yaw", start: 0, end: 200, count: 3 },
      { parameter: "pitch", start: 0, end: 20, count: 11 },
      { parameter: "altitude", start: 0, end: 500, count: 2.5 },
      { parameter: "unknown", start: 0, end: 10, count: 3 },
    ]) {
      expect(() =>
        createSweep(
          MODELS[0],
          DEFAULT_SETTINGS,
          "baseline",
          config as Parameters<typeof createSweep>[3],
        ),
      ).toThrow();
    }
  });
  it("supports descending sweeps without mutating the source conditions", () => {
    const settings = { ...DEFAULT_SETTINGS, duration: 0.1 };
    const runs = createSweep(MODELS[0], settings, "crosswind", {
      parameter: "yaw",
      start: 30,
      end: -30,
      count: 3,
    });
    expect(runs.map((r) => r.settings.yaw)).toEqual([30, 0, -30]);
    expect(settings.yaw).toBe(0);
    expect(runs.every((r) => r.scenarioId === "crosswind")).toBe(true);
  });
});
