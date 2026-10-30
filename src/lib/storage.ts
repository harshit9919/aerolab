import type { Run, ModelDefinition, Settings, Workspace } from "../types";
import {
  validateWorkspace,
  validateRun,
  validateModel,
  validateSettings,
} from "./exports";
type Session = { settings: Settings; activeModelId: string };
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("aerolab", 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of ["runs", "models"])
        if (!db.objectStoreNames.contains(name))
          db.createObjectStore(name, { keyPath: "id" });
      if (!db.objectStoreNames.contains("session"))
        db.createObjectStore("session");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(new Error("AeroLab database is blocked by another tab"));
  });
}
async function transaction<T>(
  stores: string[],
  mode: IDBTransactionMode,
  action: (tx: IDBTransaction, receive: (value: T) => void) => void,
): Promise<T> {
  const db = await database();
  return new Promise<T>((resolve, reject) => {
    let value: T;
    const tx = db.transaction(stores, mode);
    tx.oncomplete = () => {
      db.close();
      resolve(value);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error("Database operation failed"));
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error ?? new Error("Database operation aborted"));
    };
    try {
      action(tx, (v) => {
        value = v;
      });
    } catch (error) {
      reject(error);
      tx.abort();
      db.close();
    }
  });
}
export async function getRuns(): Promise<Run[]> {
  const runs = await transaction<Run[]>(["runs"], "readonly", (tx, set) => {
    const r = tx.objectStore("runs").getAll();
    r.onsuccess = () => set(r.result);
  });
  return runs.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}
export async function saveRun(run: Run): Promise<void> {
  validateRun(run);
  run = structuredClone(run);
  return transaction(["runs"], "readwrite", (tx) => {
    tx.objectStore("runs").put(run);
  });
}
export async function deleteRun(id: string): Promise<void> {
  return transaction(["runs"], "readwrite", (tx) => {
    tx.objectStore("runs").delete(id);
  });
}
export async function getModels(): Promise<ModelDefinition[]> {
  return transaction(["models"], "readonly", (tx, set) => {
    const r = tx.objectStore("models").getAll();
    r.onsuccess = () => set(r.result);
  });
}
export async function saveModel(model: ModelDefinition): Promise<void> {
  validateModel(model);
  model = structuredClone(model);
  return transaction(["models"], "readwrite", (tx) => {
    tx.objectStore("models").put(model);
  });
}
export async function deleteModel(id: string): Promise<void> {
  return transaction(["models"], "readwrite", (tx) => {
    tx.objectStore("models").delete(id);
  });
}
export async function loadSession(): Promise<Session | null> {
  return transaction(["session"], "readonly", (tx, set) => {
    const r = tx.objectStore("session").get("current");
    r.onsuccess = () => set(r.result ?? null);
  });
}
export async function saveSession(session: Session): Promise<void> {
  validateSettings(session.settings);
  if (typeof session.activeModelId !== "string")
    throw new Error("Invalid active model");
  session = structuredClone(session);
  return transaction(["session"], "readwrite", (tx) => {
    tx.objectStore("session").put(session, "current");
  });
}
export async function restoreWorkspace(workspace: Workspace): Promise<void> {
  validateWorkspace(workspace);
  workspace = structuredClone(workspace);
  return transaction(["runs", "models", "session"], "readwrite", (tx) => {
    for (const run of workspace.runs) tx.objectStore("runs").put(run);
    for (const model of workspace.models) tx.objectStore("models").put(model);
    tx.objectStore("session").put(
      { settings: workspace.settings, activeModelId: workspace.activeModelId },
      "current",
    );
  });
}
