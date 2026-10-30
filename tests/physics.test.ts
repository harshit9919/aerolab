import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, MODELS, SCENARIOS } from "../src/lib/catalog";
import {
  calculateMetrics,
  flowVelocity,
  modelDimensions,
  effectiveSpeed,
} from "../src/lib/physics";
const model = MODELS.find((m) => m.id === "sportscar")!;
describe("approximate aerodynamics", () => {
  it("offers a diverse usable catalog", () => {
    expect(MODELS.length).toBeGreaterThanOrEqual(18);
    expect(SCENARIOS.length).toBeGreaterThanOrEqual(10);
    expect(model.dimensions).toEqual([4.4, 1.3, 1.8]);
  });
  it("obeys quadratic drag and area scaling", () => {
    const base = calculateMetrics(model, DEFAULT_SETTINGS);
    const fast = calculateMetrics(model, { ...DEFAULT_SETTINGS, speed: 50 });
    const large = calculateMetrics(model, { ...DEFAULT_SETTINGS, scale: 2 });
    expect(fast.drag / base.drag).toBeCloseTo(4);
    expect(large.drag / base.drag).toBeCloseTo(4);
    expect(base.drag).toBeCloseTo(base.pressure * base.cd * base.area);
  });
  it("has no forces or flow when speed and gust are zero", () => {
    const settings = { ...DEFAULT_SETTINGS, speed: 0, gust: 0 };
    const result = calculateMetrics(model, settings, 1);
    expect([result.drag, result.lift, result.reynolds, result.mach]).toEqual([
      0, 0, 0, 0,
    ]);
    expect(flowVelocity([0, 2, 0], model, settings, 1)).toEqual([0, 0, 0]);
  });
  it("allows gust-only flow in the positive half-cycle and clamps reverse gusts", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      speed: 0,
      gust: 10,
      gustFrequency: 1,
    };
    expect(effectiveSpeed(settings, 0.25)).toBeCloseTo(10);
    expect(calculateMetrics(model, settings, 0.25).drag).toBeGreaterThan(0);
    expect(
      flowVelocity([1000, 1000, 1000], model, settings, 0.25)[0],
    ).toBeCloseTo(10);
    expect(effectiveSpeed(settings, 0.75)).toBe(0);
  });
  it("preserves envelope dimensions and forces when an entire assembly moves", () => {
    const parts = [
      {
        id: "a",
        name: "Box",
        shape: "box" as const,
        position: [0, 0, 0] as [number, number, number],
        rotation: [0, 0, 0] as [number, number, number],
        scale: [2, 1, 1] as [number, number, number],
        color: "#fff",
      },
      {
        id: "b",
        name: "Tail",
        shape: "box" as const,
        position: [2, 0, 0] as [number, number, number],
        rotation: [0, 0, 0] as [number, number, number],
        scale: [1, 1, 1] as [number, number, number],
        color: "#fff",
      },
    ];
    const source = { ...model, parts };
    const moved = {
      ...source,
      parts: parts.map((p) => ({
        ...p,
        position: [p.position[0] + 8, p.position[1] + 1, p.position[2] - 3] as [
          number,
          number,
          number,
        ],
      })),
    };
    expect(modelDimensions(source)).toEqual([3.5, 1, 1]);
    expect(modelDimensions(moved)).toEqual([3.5, 1, 1]);
    expect(calculateMetrics(moved, DEFAULT_SETTINGS).drag).toBe(
      calculateMetrics(source, DEFAULT_SETTINGS).drag,
    );
  });
  it("responds to environment, attitude, roughness, and gusts", () => {
    const base = calculateMetrics(model, DEFAULT_SETTINGS);
    expect(
      calculateMetrics(model, { ...DEFAULT_SETTINGS, altitude: 3000 }).density,
    ).toBeLessThan(base.density);
    expect(
      calculateMetrics(model, { ...DEFAULT_SETTINGS, yaw: 50, roughness: 1 })
        .drag,
    ).toBeGreaterThan(base.drag);
    expect(
      calculateMetrics(model, { ...DEFAULT_SETTINGS, pitch: 10 }).lift,
    ).not.toBe(base.lift);
    expect(
      calculateMetrics(model, { ...DEFAULT_SETTINGS, gust: 10 }, 0.37).speed,
    ).not.toBe(base.speed);
  });
  it("uses imported dimensions and edited part positions and scale", () => {
    const custom = {
      ...model,
      custom: true,
      dimensions: [2, 3, 4] as [number, number, number],
    };
    expect(calculateMetrics(custom, DEFAULT_SETTINGS).area).toBeCloseTo(12);
    expect(
      modelDimensions({
        ...custom,
        parts: [
          {
            id: "p",
            name: "p",
            shape: "box",
            position: [3, 0, 0],
            rotation: [0, 0, 0],
            scale: [2, 3, 4],
            color: "#fff",
          },
        ],
      }),
    ).toEqual([2, 3, 4]);
  });
  it("matches rendered XYZ Euler bounds for multi-axis part rotation", () => {
    const rotated = {
      ...model,
      parts: [
        {
          id: "rotated",
          name: "Rotated box",
          shape: "box" as const,
          position: [0, 0, 0] as [number, number, number],
          rotation: [30, 45, 60] as [number, number, number],
          scale: [2, 3, 4] as [number, number, number],
          color: "#fff",
        },
      ],
    };
    // Independent bounds from Three Box3.setFromObject for a 2×3×4 box.
    const dims = modelDimensions(rotated);
    expect(dims[0]).toBeCloseTo(5.372651213020122, 8);
    expect(dims[1]).toBeCloseTo(3.6482464050993357, 8);
    expect(dims[2]).toBeCloseTo(5.044132968541554, 8);
  });
  it("keeps freestream aligned with the tunnel when the body turns", () => {
    const velocity = flowVelocity([1000, 1000, 1000], model, {
      ...DEFAULT_SETTINGS,
      yaw: 35,
      pitch: 12,
    });
    expect(velocity[0]).toBeCloseTo(25);
    expect(velocity[1]).toBeCloseTo(0);
    expect(velocity[2]).toBeCloseTo(0);
  });
  it("deflects flow around the envelope and reduces wake speed", () => {
    const upstream = flowVelocity([-15, 1, 0], model, DEFAULT_SETTINGS);
    const near = flowVelocity([0, 1, 0], model, DEFAULT_SETTINGS);
    const wake = flowVelocity([4, 0, 0], model, DEFAULT_SETTINGS);
    expect(near[1]).toBeGreaterThan(upstream[1]);
    expect(wake[0]).toBeLessThan(upstream[0]);
    for (const p of [
      [0, 0, 0],
      [1e4, 1e4, 1e4],
    ] as [number, number, number][])
      expect(
        flowVelocity(p, model, DEFAULT_SETTINGS).every(Number.isFinite),
      ).toBe(true);
  });
});
