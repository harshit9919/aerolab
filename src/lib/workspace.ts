import type { ModelDefinition, Run, Settings, Workspace } from "../types";
import { MODELS } from "./catalog";
export function workspaceSnapshot(
  models: ModelDefinition[],
  runs: Run[],
  settings: Settings,
  active: ModelDefinition,
  replaying: boolean,
): Workspace {
  const saved = structuredClone(models);
  const existing =
    saved.find((m) => m.id === active.id) ??
    MODELS.find((m) => m.id === active.id);
  let activeModelId = active.id;
  if (!existing) {
    saved.push(structuredClone(active));
  } else if (
    !replaying &&
    JSON.stringify(existing) !== JSON.stringify(active)
  ) {
    const draft = {
      ...structuredClone(active),
      id: crypto.randomUUID(),
      name: `${active.name} (unsaved draft)`,
      category: "My models",
      custom: true,
    };
    saved.push(draft);
    activeModelId = draft.id;
  }
  return {
    version: 1,
    models: saved,
    runs: structuredClone(runs),
    settings: structuredClone(settings),
    activeModelId,
  };
}
