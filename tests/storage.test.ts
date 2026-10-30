import "fake-indexeddb/auto";
import { describe, it, expect, vi } from "vitest";
import {
  getRuns,
  saveRun,
  deleteRun,
  saveModel,
  getModels,
  deleteModel,
  loadSession,
  saveSession,
  restoreWorkspace,
} from "../src/lib/storage";
import {
  parseWorkspace,
  downloadRunCsv,
  downloadWorkspace,
} from "../src/lib/exports";
import type { Run, Workspace } from "../src/types";
const settings = {
  speed: 30,
  yaw: 0,
  pitch: 0,
  temperature: 15,
  altitude: 0,
  turbulence: 0,
  gust: 0,
  gustFrequency: 1,
  roughness: 0,
  scale: 1,
  duration: 10,
};
const model = {
  id: "test-model",
  name: "Box",
  category: "Basic",
  description: "",
  kind: "box",
  dimensions: [1, 1, 1] as [number, number, number],
  cd: 1,
  liftSlope: 0,
};
const run: Run = {
  id: "test-run",
  name: "Test",
  createdAt: "2026-01-01T00:00:00Z",
  model,
  settings,
  scenarioId: "manual",
  samples: [],
  duration: 10,
  notes: "",
  color: "#abcdef",
};
const workspace: Workspace = {
  version: 1,
  models: [model],
  runs: [run],
  settings,
  activeModelId: model.id,
};
describe("persistent workspace", () => {
  it("persists cloned records, models and session and deletes runs", async () => {
    await saveRun(run);
    run.notes = "changed";
    expect((await getRuns()).find((r) => r.id === run.id)?.notes).toBe("");
    await saveModel(model);
    expect(await getModels()).toContainEqual(model);
    await saveSession({ settings, activeModelId: model.id });
    expect(await loadSession()).toEqual({ settings, activeModelId: model.id });
    const reloaded = await import("../src/lib/storage");
    expect((await reloaded.getRuns()).find((r) => r.id === run.id)?.notes).toBe(
      "",
    );
    await deleteModel(model.id);
    expect((await getModels()).some((m) => m.id === model.id)).toBe(false);
    await deleteRun(run.id);
    expect((await getRuns()).some((r) => r.id === run.id)).toBe(false);
  });
  it("merges backup records and rejects invalid backup without changing storage", async () => {
    await restoreWorkspace(workspace);
    const previous = await getRuns();
    await expect(
      restoreWorkspace({
        ...workspace,
        runs: [{ ...run, settings: { ...settings, speed: NaN } }],
      }),
    ).rejects.toThrow();
    expect(await getRuns()).toEqual(previous);
  });
  it("rolls back all stores if a write fails midway", async () => {
    const previousRuns = await getRuns();
    const previousModels = await getModels();
    const previousSession = await loadSession();
    const original = IDBObjectStore.prototype.put;
    let calls = 0;
    const mock = vi
      .spyOn(IDBObjectStore.prototype, "put")
      .mockImplementation(function (
        this: IDBObjectStore,
        value: unknown,
        key?: IDBValidKey,
      ) {
        if (++calls === 2) throw new Error("Simulated quota failure");
        return key === undefined
          ? original.call(this, value)
          : original.call(this, value, key);
      });
    try {
      await expect(
        restoreWorkspace({
          ...workspace,
          runs: [{ ...run, id: "rollback-run" }],
          models: [{ ...model, id: "rollback-model" }],
        }),
      ).rejects.toThrow("Simulated quota failure");
    } finally {
      mock.mockRestore();
    }
    expect(await getRuns()).toEqual(previousRuns);
    expect(await getModels()).toEqual(previousModels);
    expect(await loadSession()).toEqual(previousSession);
  });
  it("validates complete finite nested data and pollution", () => {
    expect(parseWorkspace(JSON.stringify(workspace))).toEqual(workspace);
    for (const bad of [
      { ...workspace, settings: { speed: 2 } },
      {
        ...workspace,
        runs: [{ ...run, model: { ...model, dimensions: [1, 2] } }],
      },
      { ...workspace, runs: [{ ...run, samples: [{ time: 0 }] }] },
    ])
      expect(() => parseWorkspace(JSON.stringify(bad))).toThrow();
    expect(() => parseWorkspace('{"__proto__":{},"version":1}')).toThrow();
  });
});

describe("download encoding and backup limits", () => {
  it("writes real UTF-8 BOM and CSV newlines and escapes formula metadata", async () => {
    let saved: Blob | undefined;
    vi.spyOn(URL, "createObjectURL").mockImplementation((value) => {
      saved = value as Blob;
      return "blob:test";
    });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.stubGlobal("document", { createElement: () => ({ click: () => {} }) });
    try {
      downloadRunCsv({ ...run, name: "  =SUM(1,2)", notes: '@evil, "quoted"' });
      expect(saved).toBeDefined();
      const bytes = new Uint8Array(await saved!.arrayBuffer());
      expect([...bytes.slice(0, 3)]).toEqual([239, 187, 191]);
      const csv = new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes);
      expect(csv).toContain("\r\n");
      expect(csv).not.toContain("\\r\\n");
      expect(csv).toContain('"\'  =SUM(1,2)"');
      expect(csv).toContain('"\'@evil, ""quoted"""');
    } finally {
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    }
  });
  it("rejects backups exceeding 25 MB in UTF-8 before parsing or downloading", () => {
    const large: Workspace = {
      ...workspace,
      models: [{ ...model, mesh: { asset: "界".repeat(9 * 1024 * 1024) } }],
    };
    const text = JSON.stringify(large);
    expect(text.length).toBeLessThan(25 * 1024 * 1024);
    expect(() => parseWorkspace(text)).toThrow();
    expect(() => downloadWorkspace(large)).toThrow();
  });
});
