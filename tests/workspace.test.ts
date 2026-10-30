import { describe, it, expect } from "vitest";
import { workspaceSnapshot } from "../src/lib/workspace";
import { DEFAULT_SETTINGS, MODELS } from "../src/lib/catalog";
describe("workspace snapshot revision preservation", () => {
  it("retains a newer saved model while replaying historical geometry", () => {
    const historical = {
      ...structuredClone(MODELS[0]),
      id: "custom-car",
      custom: true,
      cd: 0.3,
    };
    const revised = { ...historical, cd: 0.8 };
    const result = workspaceSnapshot(
      [revised],
      [],
      DEFAULT_SETTINGS,
      historical,
      true,
    );
    expect(result.models.find((m) => m.id === "custom-car")?.cd).toBe(0.8);
  });
  it("includes an unsaved custom draft without discarding its saved revision", () => {
    const saved = {
      ...structuredClone(MODELS[0]),
      id: "custom-car",
      custom: true,
      cd: 0.3,
    };
    const draft = { ...saved, cd: 0.8 };
    const result = workspaceSnapshot(
      [saved],
      [],
      DEFAULT_SETTINGS,
      draft,
      false,
    );
    expect(result.models).toHaveLength(2);
    expect(result.models.find((m) => m.id === "custom-car")?.cd).toBe(0.3);
    expect(result.models.find((m) => m.id === result.activeModelId)?.cd).toBe(
      0.8,
    );
  });
  it("captures edited preset geometry as a draft and makes an independent snapshot", () => {
    const draft = { ...structuredClone(MODELS[0]), cd: 1.7 };
    const result = workspaceSnapshot([], [], DEFAULT_SETTINGS, draft, false);
    expect(result.models).toHaveLength(1);
    expect(result.models[0].custom).toBe(true);
    expect(result.models[0].cd).toBe(1.7);
    draft.cd = 0.2;
    expect(result.models[0].cd).toBe(1.7);
  });
});
