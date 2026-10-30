import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Wind,
  Box,
  Layers3,
  ChartNoAxesCombined,
  FolderOpen,
  Plus,
  Upload,
  Play,
  Pause,
  Square,
  Circle,
  ChevronDown,
  ArrowUpRight,
  ArrowRight,
  Check,
  X,
  Download,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Maximize,
  Camera,
  Settings2,
  Search,
  SlidersHorizontal,
  Move3D,
  Rotate3D,
  Scaling,
  Copy,
  Trash2,
  Undo2,
  Redo2,
  Info,
  Sparkles,
  Grid3X3,
  ChevronRight,
  Save,
  FileJson,
  CircleHelp,
  Menu,
  Activity,
  Gauge,
  MousePointer2,
  Crosshair,
} from "lucide-react";
import Viewport, { type ViewportHandle } from "./components/Viewport";
import ModelArt from "./components/ModelArt";
import Experiments from "./components/Experiments";
import Methodology from "./components/Methodology";
import SweepDialog from "./components/SweepDialog";
import { LineChart, COLORS } from "./components/Charts";
import { Range, Toggle, IconButton } from "./components/Controls";
import { MODELS, SCENARIOS, DEFAULT_SETTINGS } from "./lib/catalog";
import { calculateMetrics, modelDimensions } from "./lib/physics";
import { importModel, exportModel } from "./lib/geometry";
import {
  getRuns,
  saveRun,
  deleteRun,
  getModels,
  saveModel,
  deleteModel,
  loadSession,
  saveSession,
  restoreWorkspace,
} from "./lib/storage";
import { downloadWorkspace, parseWorkspace } from "./lib/exports";
import { workspaceSnapshot } from "./lib/workspace";
import type {
  ModelDefinition,
  Settings,
  Run,
  Part,
  Primitive,
  ViewMode,
  Sample,
} from "./types";

type Page = "studio" | "editor" | "experiments" | "library";
const uid = () => crypto.randomUUID();
const clone = <T,>(v: T): T => structuredClone(v);
const fmt = (n: number, d = 2) =>
  Number.isFinite(n)
    ? n.toLocaleString("en-US", {
        maximumFractionDigits: d,
        minimumFractionDigits: d,
      })
    : "—";
const readableError = (e: unknown) =>
  e instanceof Error ? e.message : "Something went wrong. Please try again.";
const primitiveNames: Primitive[] = [
  "box",
  "sphere",
  "cylinder",
  "cone",
  "capsule",
  "wing",
  "torus",
];
function newPart(shape: Primitive): Part {
  return {
    id: uid(),
    name: shape.charAt(0).toUpperCase() + shape.slice(1),
    shape,
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: shape === "wing" ? [2, 0.2, 3] : [1, 1, 1],
    color: "#a4b7b0",
  };
}
function newAssembly(): ModelDefinition {
  return {
    id: uid(),
    name: "Untitled assembly",
    description: "A custom assembly built in AeroLab.",
    kind: "custom",
    category: "My models",
    dimensions: [2, 1, 1],
    cd: 0.65,
    liftSlope: 1,
    custom: true,
    parts: [{ ...newPart("box"), name: "Main body", scale: [2, 1, 1] }],
  };
}

export default function App() {
  const [page, setPage] = useState<Page>("studio");
  const [model, setModel] = useState<ModelDefinition>(MODELS[0]);
  const [settings, setSettings] = useState<Settings>({ ...DEFAULT_SETTINGS });
  const [scenario, setScenario] = useState("baseline");
  const [runs, setRuns] = useState<Run[]>([]),
    [models, setModels] = useState<ModelDefinition[]>([]),
    [loaded, setLoaded] = useState(false);
  const [playing, setPlaying] = useState(true),
    [time, setTime] = useState(0),
    [rate, setRate] = useState(1),
    [recording, setRecording] = useState(false),
    [replay, setReplay] = useState<Run | null>(null);
  const [mode, setMode] = useState<ViewMode>("streamlines"),
    [grid, setGrid] = useState(true),
    [tunnel, setTunnel] = useState(false),
    [density, setDensity] = useState(5);
  const [search, setSearch] = useState(""),
    [category, setCategory] = useState("All"),
    [rightTab, setRightTab] = useState<"conditions" | "display">("conditions");
  const [advanced, setAdvanced] = useState(false),
    [toast, setToast] = useState(""),
    [help, setHelp] = useState(false),
    [importing, setImporting] = useState(false),
    [mobilePanel, setMobilePanel] = useState(false);
  const [selectedPart, setSelectedPart] = useState<string | null>(null),
    [transform, setTransform] = useState<"translate" | "rotate" | "scale">(
      "translate",
    );
  const [undo, setUndo] = useState<ModelDefinition[]>([]),
    [redo, setRedo] = useState<ModelDefinition[]>([]),
    [history, setHistory] = useState<Sample[]>([]);
  const [stats, setStats] = useState({ fps: 0, triangles: 0 });
  const [sweep, setSweep] = useState(false);
  const viewport = useRef<ViewportHandle>(null),
    fileInput = useRef<HTMLInputElement>(null),
    backupInput = useRef<HTMLInputElement>(null),
    recordRef = useRef<Run | null>(null);
  const nowRef = useRef(0),
    settingsRef = useRef(settings),
    modelRef = useRef(model),
    replayRef = useRef(replay),
    savingRef = useRef(false);
  settingsRef.current = settings;
  modelRef.current = model;
  replayRef.current = replay;
  const notify = useCallback((message: string) => setToast(message), []);
  const allModels = useMemo(() => [...MODELS, ...models], [models]);
  const filtered = allModels.filter(
    (m) =>
      (category === "All" || m.category === category) &&
      `${m.name} ${m.category}`.toLowerCase().includes(search.toLowerCase()),
  );
  const categories = ["All", ...new Set(allModels.map((m) => m.category))];
  const metrics = useMemo(
    () =>
      replay && replay.samples.length
        ? replay.samples.reduce(
            (best, s) =>
              Math.abs(s.time - time) < Math.abs(best.time - time) ? s : best,
            replay.samples[0],
          )
        : calculateMetrics(model, settings, time),
    [model, settings, time, replay],
  );
  const activeScenario = SCENARIOS.find((s) => s.id === scenario);
  const part = model.parts?.find((p) => p.id === selectedPart);
  const dims = modelDimensions(model);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [r, m, s] = await Promise.all([
          getRuns(),
          getModels(),
          loadSession(),
        ]);
        if (!active) return;
        setRuns(r);
        setModels(m);
        if (s) {
          setSettings(s.settings);
          setModel(
            [...MODELS, ...m].find((x) => x.id === s.activeModelId) ||
              MODELS[0],
          );
        }
      } catch (e) {
        notify(`Local storage: ${readableError(e)}`);
      } finally {
        if (active) setLoaded(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [notify]);
  useEffect(() => {
    if (!loaded) return;
    const id = setTimeout(() => {
      saveSession({ settings, activeModelId: model.id }).catch((e) =>
        notify(`Settings could not be saved: ${readableError(e)}`),
      );
    }, 700);
    return () => clearTimeout(id);
  }, [settings, model.id, loaded, notify]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 6000);
    return () => clearTimeout(id);
  }, [toast]);
  const resetClock = useCallback(() => {
    nowRef.current = 0;
    setTime(0);
    setHistory([]);
  }, []);
  const finishRecording = useCallback(async () => {
    const run = recordRef.current;
    if (!run || savingRef.current) return;
    recordRef.current = null;
    setRecording(false);
    savingRef.current = true;
    run.duration = nowRef.current;
    const last = run.samples.at(-1);
    if (!last || last.time < run.duration)
      run.samples.push({
        time: run.duration,
        ...calculateMetrics(run.model, run.settings, run.duration),
      });
    try {
      await saveRun(run);
      setRuns((r) => [run, ...r.filter((x) => x.id !== run.id)]);
      notify(`“${run.name}” saved · ${run.samples.length} samples`);
    } catch (e) {
      setRuns((r) => [run, ...r]);
      notify(`Run is in memory only. Export a backup now: ${readableError(e)}`);
    } finally {
      savingRef.current = false;
    }
  }, [notify]);
  useEffect(() => {
    if (!playing || page === "library" || page === "experiments") return;
    let previous = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      const delta = Math.min((now - previous) / 1000, 0.2) * rate;
      previous = now;
      const recorded = recordRef.current;
      const selected = replayRef.current;
      const limit = recorded
        ? recorded.settings.duration
        : selected
          ? selected.duration
          : Infinity;
      const next = Math.min(nowRef.current + delta, limit);
      nowRef.current = next;
      setTime(next);
      const value = {
        time: next,
        ...calculateMetrics(modelRef.current, settingsRef.current, next),
      };
      if (recorded) {
        let sampleTime = (recorded.samples.at(-1)?.time ?? -0.1) + 0.1;
        while (sampleTime <= next + 0.000001) {
          recorded.samples.push({
            time: Number(sampleTime.toFixed(3)),
            ...calculateMetrics(recorded.model, recorded.settings, sampleTime),
          });
          sampleTime += 0.1;
        }
      }
      setHistory((h) => [...h.slice(-119), value]);
      if (next >= limit) {
        setPlaying(false);
        if (recorded) void finishRecording();
      }
    }, 50);
    return () => clearInterval(id);
  }, [playing, rate, page, finishRecording]);
  const startRecording = useCallback(() => {
    if (recordRef.current) {
      void finishRecording();
      return;
    }
    setReplay(null);
    resetClock();
    const run: Run = {
      id: uid(),
      name: `${model.name} · Run ${String(runs.length + 1).padStart(2, "0")}`,
      createdAt: new Date().toISOString(),
      model: clone(model),
      settings: clone(settings),
      scenarioId: scenario,
      samples: [{ time: 0, ...calculateMetrics(model, settings, 0) }],
      duration: 0,
      notes: "",
      color: COLORS[runs.length % COLORS.length],
    };
    recordRef.current = run;
    setRecording(true);
    setPlaying(true);
    setPage("studio");
    notify(
      "Recording started. Geometry and conditions are locked for this run.",
    );
  }, [
    finishRecording,
    resetClock,
    model,
    settings,
    scenario,
    runs.length,
    notify,
  ]);
  const togglePlay = useCallback(() => {
    if (replay && time >= replay.duration) resetClock();
    setPlaying((p) => !p);
  }, [replay, time, resetClock]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setHelp(false);
        setSweep(false);
      }
      if (
        (e.target as HTMLElement).closest(
          "input,textarea,select,[contenteditable]",
        ) ||
        help ||
        sweep
      )
        return;
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      }
      if (e.key.toLowerCase() === "r") startRecording();
      if (e.key.toLowerCase() === "f") viewport.current?.resetCamera();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [togglePlay, startRecording, help, sweep]);
  const change = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    if (recording) return;
    setReplay(null);
    setScenario("custom");
    setSettings((s) => ({ ...s, [key]: value }));
  };
  const chooseModel = (m: ModelDefinition) => {
    if (recording) return;
    setModel(clone(m));
    setReplay(null);
    setSelectedPart(m.parts?.[0]?.id ?? null);
    resetClock();
    setUndo([]);
    setRedo([]);
  };
  const chooseScenario = (id: string) => {
    if (recording) return;
    const s = SCENARIOS.find((v) => v.id === id);
    if (s) {
      setSettings({
        ...DEFAULT_SETTINGS,
        ...s.settings,
        scale: settings.scale,
        duration: settings.duration,
      });
      setScenario(id);
      setReplay(null);
      resetClock();
    }
  };
  const navigate = (p: Page) => {
    if (recording && (p === "editor" || p === "library")) {
      notify("Stop recording to change geometry.");
      return;
    }
    if (recording && p === "experiments") {
      void finishRecording();
    }
    setPage(p);
    setMobilePanel(false);
  };
  const editModel = (next: ModelDefinition) => {
    if (recording) return;
    setUndo((u) => [...u.slice(-39), clone(model)]);
    setRedo([]);
    setModel(next);
    setReplay(null);
  };
  const updatePart = (p: Part) =>
    editModel({
      ...model,
      parts: model.parts?.map((v) => (v.id === p.id ? p : v)),
    });
  const addPart = (shape: Primitive) => {
    const p = newPart(shape);
    const base = model.parts ? model : newAssembly();
    editModel({ ...base, parts: [...(model.parts ? model.parts : []), p] });
    setSelectedPart(p.id);
  };
  const createAssembly = () => {
    const m = newAssembly();
    chooseModel(m);
    setPage("editor");
  };
  const saveCurrentModel = async () => {
    try {
      const saved = {
        ...clone(model),
        id: model.custom ? model.id : uid(),
        category: "My models",
        custom: true,
        dimensions: modelDimensions(model),
      };
      await saveModel(saved);
      setModels((m) => [saved, ...m.filter((x) => x.id !== saved.id)]);
      setModel(saved);
      notify(`“${saved.name}” saved to My models.`);
    } catch (e) {
      notify(readableError(e));
    }
  };
  const handleImport = async (file?: File) => {
    if (!file) return;
    setImporting(true);
    try {
      const m = await importModel(file);
      await saveModel(m);
      setModels((v) => [m, ...v.filter((x) => x.id !== m.id)]);
      chooseModel(m);
      setPage("studio");
      notify(
        `Imported ${file.name}. Model units normalized to a 4 m envelope.`,
      );
    } catch (e) {
      notify(`Import failed: ${readableError(e)}`);
    } finally {
      setImporting(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };
  const backup = () => {
    try {
      downloadWorkspace(
        workspaceSnapshot(models, runs, settings, model, !!replay),
      );
      notify(
        "Workspace backup downloaded, including geometry and run history.",
      );
    } catch (e) {
      notify(readableError(e));
    }
  };
  const restore = async (file?: File) => {
    if (!file) return;
    try {
      if (file.size > 25 * 1024 * 1024)
        throw new Error("Backup exceeds the 25 MB limit.");
      const workspace = parseWorkspace(await file.text());
      await restoreWorkspace(workspace);
      const [r, m] = await Promise.all([getRuns(), getModels()]);
      setRuns(r);
      setModels(m);
      setSettings(workspace.settings);
      setModel(
        [...MODELS, ...m].find((v) => v.id === workspace.activeModelId) ||
          MODELS[0],
      );
      setReplay(null);
      resetClock();
      notify(
        `Restored ${workspace.runs.length} runs and ${workspace.models.length} custom models.`,
      );
    } catch (e) {
      notify(`Restore failed: ${readableError(e)}`);
    } finally {
      if (backupInput.current) backupInput.current.value = "";
    }
  };
  const replayRun = (run: Run) => {
    setModel(clone(run.model));
    setSettings(clone(run.settings));
    setScenario(run.scenarioId);
    setReplay(run);
    resetClock();
    setPlaying(false);
    setPage("studio");
    notify(
      "Recorded configuration restored. Press play or scrub the timeline.",
    );
  };
  const saveEditedRun = async (run: Run) => {
    try {
      await saveRun(run);
      setRuns((r) => r.map((v) => (v.id === run.id ? run : v)));
      notify("Experiment updated.");
    } catch (e) {
      notify(readableError(e));
    }
  };
  const removeRun = async (id: string) => {
    try {
      await deleteRun(id);
      setRuns((r) => r.filter((v) => v.id !== id));
      notify("Experiment deleted.");
    } catch (e) {
      notify(readableError(e));
    }
  };
  const exportGeometry = () =>
    exportModel(model).catch((e) => notify(readableError(e)));
  const graphData = replay
    ? replay.samples.filter((s) => s.time <= time)
    : history;

  return (
    <div className="app-shell">
      <input
        ref={fileInput}
        type="file"
        accept=".glb,.gltf,.stl,.obj"
        className="hidden"
        onChange={(e) => void handleImport(e.target.files?.[0])}
      />
      <input
        ref={backupInput}
        type="file"
        accept=".json"
        className="hidden"
        onChange={(e) => void restore(e.target.files?.[0])}
      />
      <header className="topbar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("studio");
          }}
        >
          <span className="brand-symbol">
            <Wind size={23} />
          </span>
          <span>
            AERO<span className="brand-light">LAB</span>
            <small>AIRFLOW STUDIO</small>
          </span>
        </a>
        <div className="project-breadcrumb">
          <span className="breadcrumb-divider" />
          <FolderOpen size={15} />
          <span>My workspace</span>
          <ChevronRight size={13} />
          <strong>Untitled exploration</strong>
          <span className="saved-indicator">
            <i />
            {recording ? "Recording" : loaded ? "Local workspace" : "Loading"}
          </span>
        </div>
        <div className="header-actions">
          <button
            className="text-button docs-button"
            onClick={() => setHelp(true)}
          >
            <CircleHelp size={15} /> Quick guide
          </button>
          <button
            className="secondary-button"
            onClick={backup}
            disabled={!loaded || recording}
          >
            <Download size={14} /> Export workspace
          </button>
          <span className="avatar">HG</span>
        </div>
      </header>
      <div className="app-body">
        <nav className="rail" aria-label="Main navigation">
          <div className="rail-main">
            {(
              [
                { id: "studio", icon: Wind, label: "Wind tunnel" },
                { id: "editor", icon: Box, label: "Geometry editor" },
                {
                  id: "experiments",
                  icon: ChartNoAxesCombined,
                  label: "Experiments",
                },
                { id: "library", icon: Layers3, label: "Model library" },
              ] as const
            ).map((n) => (
              <button
                key={n.id}
                aria-label={n.label}
                title={n.label}
                className={`rail-button ${page === n.id ? "selected" : ""}`}
                onClick={() => navigate(n.id)}
              >
                <n.icon size={21} />
                <span>{n.label}</span>
                {n.id === "experiments" && runs.length > 0 && (
                  <i className="rail-dot" />
                )}
              </button>
            ))}
          </div>
          <div className="rail-bottom">
            <button
              className="rail-button"
              aria-label="Restore workspace"
              title="Restore workspace"
              disabled={recording}
              onClick={() => backupInput.current?.click()}
            >
              <FileJson size={20} />
            </button>
            <button
              className="rail-button"
              aria-label="Methods and help"
              title="Methods and help"
              onClick={() => setHelp(true)}
            >
              <Info size={20} />
            </button>
            <span className="rail-version">v1.0</span>
          </div>
        </nav>

        {(page === "studio" || page === "editor") && (
          <main
            className={`workbench ${page === "editor" ? "editor-workbench" : ""} ${mobilePanel ? "show-settings" : ""}`}
          >
            <div className="workspace-title">
              <div>
                <div className="eyebrow">
                  <span className="green-dot" /> YOUR VIRTUAL WIND TUNNEL
                </div>
                <h1>
                  {page === "editor"
                    ? "Shape your next idea."
                    : "Make the invisible visible."}
                </h1>
              </div>
              <div className="workspace-title-actions">
                <button
                  className="secondary-button sweep-trigger"
                  disabled={recording}
                  onClick={() => setSweep(true)}
                >
                  <ChartNoAxesCombined size={13} /> Parameter sweep
                </button>
                <span
                  className="pill approximate"
                  onClick={() => setHelp(true)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && setHelp(true)}
                >
                  <Activity size={12} /> Approximate simulation
                </span>
                <button
                  className="icon-button mobile-settings"
                  aria-label="Toggle settings"
                  onClick={() => setMobilePanel((v) => !v)}
                >
                  <SlidersHorizontal size={18} />
                </button>
              </div>
            </div>
            <div className="lab-layout">
              <aside className="objects-panel panel">
                <div className="panel-title">
                  <span>
                    {page === "editor" ? "GEOMETRY EDITOR" : "OBJECT LIBRARY"}
                  </span>
                  <span className="count-badge">
                    {page === "editor"
                      ? (model.parts?.length ?? 1)
                      : allModels.length}
                  </span>
                </div>
                {page === "studio" ? (
                  <>
                    <label className="search-field">
                      <Search size={14} />
                      <input
                        placeholder="Find an object..."
                        aria-label="Search objects"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                      <kbd>⌕</kbd>
                    </label>
                    <div className="category-chips">
                      {[
                        "All",
                        "Vehicles",
                        "Aerospace",
                        "Primitives",
                        "My models",
                      ].map((c) => (
                        <button
                          key={c}
                          className={category === c ? "active" : ""}
                          onClick={() => setCategory(c)}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                    <div className="object-list">
                      {filtered.map((m) => (
                        <button
                          key={m.id}
                          disabled={recording}
                          className={`object-card ${model.id === m.id ? "selected" : ""}`}
                          onClick={() => chooseModel(m)}
                        >
                          <div className="object-preview">
                            <ModelArt model={m} />
                            {model.id === m.id && (
                              <span className="object-check">
                                <Check size={11} />
                              </span>
                            )}
                          </div>
                          <span className="object-card-title">{m.name}</span>
                          <span className="object-card-category">
                            {m.category}
                          </span>
                        </button>
                      ))}
                      {filtered.length === 0 && (
                        <p className="empty-small">No matching models.</p>
                      )}
                    </div>
                    <div className="library-actions">
                      <button
                        className="secondary-button"
                        onClick={() => fileInput.current?.click()}
                        disabled={recording || importing}
                      >
                        <Upload size={14} />
                        {importing ? "Importing…" : "Import 3D model"}
                      </button>
                      <button
                        className="text-button"
                        onClick={createAssembly}
                        disabled={recording}
                      >
                        <Plus size={14} /> Create custom object
                      </button>
                      <span>
                        GLB · glTF · OBJ · STL <i>25 MB max</i>
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="editor-name">
                      <label>
                        Assembly name
                        <input
                          value={model.name}
                          onChange={(e) =>
                            editModel({ ...model, name: e.target.value })
                          }
                          aria-label="Assembly name"
                          maxLength={80}
                        />
                      </label>
                      <div className="editor-history">
                        <IconButton
                          label="Undo geometry change"
                          disabled={!undo.length}
                          onClick={() => {
                            const prior = undo.at(-1)!;
                            setRedo((r) => [...r, clone(model)]);
                            setUndo((u) => u.slice(0, -1));
                            setModel(prior);
                          }}
                        >
                          <Undo2 size={15} />
                        </IconButton>
                        <IconButton
                          label="Redo geometry change"
                          disabled={!redo.length}
                          onClick={() => {
                            const next = redo.at(-1)!;
                            setUndo((u) => [...u, clone(model)]);
                            setRedo((r) => r.slice(0, -1));
                            setModel(next);
                          }}
                        >
                          <Redo2 size={15} />
                        </IconButton>
                        <button
                          className="text-button"
                          onClick={createAssembly}
                        >
                          <Plus size={13} /> New
                        </button>
                      </div>
                    </div>
                    <div className="section-caption">ADD A PRIMITIVE</div>
                    <div className="primitive-grid">
                      {primitiveNames.map((shape) => (
                        <button key={shape} onClick={() => addPart(shape)}>
                          <Box size={17} />
                          <span>{shape}</span>
                        </button>
                      ))}
                    </div>
                    <div className="section-caption">
                      SCENE HIERARCHY{" "}
                      <span>{model.parts?.length ?? 1} parts</span>
                    </div>
                    <div className="parts-list">
                      {model.parts?.map((p) => (
                        <button
                          className={selectedPart === p.id ? "selected" : ""}
                          key={p.id}
                          onClick={() => setSelectedPart(p.id)}
                        >
                          <Box size={14} />
                          <span>{p.name}</span>
                          <i style={{ background: p.color }} />
                        </button>
                      )) ?? (
                        <div className="empty-small">
                          <Box size={22} />
                          <p>
                            This is a complete mesh. Add a primitive to start an
                            assembly, or adjust the model envelope on the right.
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="library-actions">
                      <button
                        className="primary-button"
                        onClick={() => void saveCurrentModel()}
                      >
                        <Save size={14} /> Save to My models
                      </button>
                      <button
                        className="text-button"
                        onClick={() => navigate("studio")}
                      >
                        <Wind size={14} /> Test in wind tunnel{" "}
                        <ArrowRight size={13} />
                      </button>
                    </div>
                  </>
                )}
              </aside>

              <section className="center-workspace">
                <div className="viewport-shell panel">
                  <div className="viewport-top">
                    <div className="view-tabs">
                      {(
                        [
                          "streamlines",
                          "particles",
                          "pressure",
                          "velocity",
                        ] as ViewMode[]
                      ).map((v) => (
                        <button
                          key={v}
                          className={mode === v ? "active" : ""}
                          onClick={() => setMode(v)}
                        >
                          {v === "streamlines" ? (
                            <Wind size={14} />
                          ) : v === "particles" ? (
                            <Sparkles size={14} />
                          ) : v === "pressure" ? (
                            <Layers3 size={14} />
                          ) : (
                            <Activity size={14} />
                          )}
                          <span>{v.charAt(0).toUpperCase() + v.slice(1)}</span>
                        </button>
                      ))}
                    </div>
                    <IconButton
                      label="Save viewport image"
                      onClick={() => viewport.current?.screenshot()}
                    >
                      <Camera size={16} />
                    </IconButton>
                  </div>
                  <div className="viewport-area">
                    <Viewport
                      ref={viewport}
                      model={model}
                      settings={settings}
                      time={time}
                      playing={playing}
                      mode={mode}
                      showGrid={grid}
                      showTunnel={tunnel}
                      density={density}
                      editing={page === "editor"}
                      selectedPartId={selectedPart}
                      transformMode={transform}
                      onSelectPart={setSelectedPart}
                      onPartChange={updatePart}
                      onStats={setStats}
                    />
                    <div className="scene-label">
                      <span className="scene-kicker">
                        {page === "editor"
                          ? "GEOMETRY WORKSPACE"
                          : replay
                            ? "RECORDED REPLAY"
                            : "LIVE VIEWPORT"}
                      </span>
                      <strong>{model.name}</strong>
                      <span>
                        {fmt(dims[0] * settings.scale, 1)} ×{" "}
                        {fmt(dims[1] * settings.scale, 1)} ×{" "}
                        {fmt(dims[2] * settings.scale, 1)} m
                      </span>
                    </div>
                    <div className="live-badge">
                      <span className={playing ? "green-dot" : "gray-dot"} />
                      {recording ? "REC" : playing ? "LIVE" : "PAUSED"}
                    </div>
                    {page === "editor" && (
                      <div className="transform-toolbar">
                        {(
                          [
                            {
                              id: "translate",
                              icon: Move3D,
                              label: "Move part",
                            },
                            {
                              id: "rotate",
                              icon: Rotate3D,
                              label: "Rotate part",
                            },
                            { id: "scale", icon: Scaling, label: "Scale part" },
                          ] as const
                        ).map((t) => (
                          <IconButton
                            key={t.id}
                            label={t.label}
                            active={transform === t.id}
                            onClick={() => setTransform(t.id)}
                          >
                            <t.icon size={17} />
                          </IconButton>
                        ))}
                      </div>
                    )}
                    <div className="flow-indicator">
                      <span>FREESTREAM</span>
                      <strong>
                        <ArrowRight size={26} />
                        {fmt(metrics.speed, 1)} <small>m/s</small>
                      </strong>
                      <i>+X direction</i>
                    </div>
                    <div className="camera-controls">
                      <IconButton
                        label="Zoom in"
                        onClick={() => viewport.current?.zoom(0.84)}
                      >
                        <ZoomIn size={17} />
                      </IconButton>
                      <IconButton
                        label="Zoom out"
                        onClick={() => viewport.current?.zoom(1.19)}
                      >
                        <ZoomOut size={17} />
                      </IconButton>
                      <div />
                      <IconButton
                        label="Reset camera"
                        onClick={() => viewport.current?.resetCamera()}
                      >
                        <Maximize size={16} />
                      </IconButton>
                      <IconButton
                        label="Toggle grid"
                        active={grid}
                        onClick={() => setGrid((v) => !v)}
                      >
                        <Grid3X3 size={16} />
                      </IconButton>
                    </div>
                    <div className="viewport-legend">
                      <span>
                        {mode === "pressure"
                          ? "Surface pressure coefficient, approximate"
                          : "Flow speed, relative to freestream"}
                      </span>
                      <div
                        className={`legend-gradient ${mode === "pressure" ? "pressure" : ""}`}
                      />
                      <div>
                        <span>{mode === "pressure" ? "−1.0" : "0.0×"}</span>
                        <span>{mode === "pressure" ? "0.0" : "0.7×"}</span>
                        <span>{mode === "pressure" ? "+1.0" : "1.4×"}</span>
                      </div>
                    </div>
                    <div className="orientation-gizmo">
                      <span className="axis-y">Y</span>
                      <span className="axis-x">X</span>
                      <span className="axis-z">Z</span>
                      <i />
                      <b />
                      <em />
                    </div>
                  </div>
                  <div className="viewport-footer">
                    <span>
                      <MousePointer2 size={12} /> Drag to orbit <i>·</i> Scroll
                      to zoom
                    </span>
                    <div className="camera-views">
                      {(["perspective", "top", "side", "front"] as const).map(
                        (v) => (
                          <button
                            key={v}
                            onClick={() => viewport.current?.setCamera(v)}
                          >
                            {v === "perspective" ? "3D" : v}
                          </button>
                        ),
                      )}
                    </div>
                    <span className="fps">
                      <i />
                      {stats.fps} FPS
                    </span>
                  </div>
                </div>

                <div className="transport panel">
                  <div className="playback-buttons">
                    <IconButton
                      label="Restart simulation"
                      onClick={() => {
                        if (!recording) resetClock();
                      }}
                      disabled={recording}
                    >
                      <RotateCcw size={15} />
                    </IconButton>
                    <button
                      className="play-button"
                      onClick={togglePlay}
                      aria-label={
                        playing ? "Pause simulation" : "Play simulation"
                      }
                    >
                      {playing ? (
                        <Pause size={16} fill="currentColor" />
                      ) : (
                        <Play size={16} fill="currentColor" />
                      )}
                    </button>
                    <select
                      aria-label="Playback speed"
                      value={rate}
                      onChange={(e) => setRate(Number(e.target.value))}
                    >
                      {[0.25, 0.5, 1, 2, 4].map((v) => (
                        <option key={v} value={v}>
                          {v}×
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="timeline">
                    <div>
                      <span>
                        {replay
                          ? "RECORDED TIMELINE"
                          : recording
                            ? "RECORDING EXPERIMENT"
                            : "SIMULATION TIME"}
                      </span>
                      <strong>
                        {fmt(time, 1)}{" "}
                        <i>
                          /{" "}
                          {replay
                            ? fmt(replay.duration, 1)
                            : recording
                              ? settings.duration.toFixed(1)
                              : "∞"}{" "}
                          s
                        </i>
                      </strong>
                    </div>
                    <input
                      aria-label="Simulation timeline"
                      type="range"
                      min="0"
                      max={
                        replay?.duration || Math.max(settings.duration, time)
                      }
                      step=".1"
                      value={time}
                      disabled={recording}
                      onChange={(e) => {
                        setPlaying(false);
                        nowRef.current = Number(e.target.value);
                        setTime(Number(e.target.value));
                      }}
                    />
                  </div>
                  <button
                    className={`record-button ${recording ? "recording" : ""}`}
                    onClick={startRecording}
                  >
                    {recording ? (
                      <Square size={12} fill="currentColor" />
                    ) : (
                      <Circle size={11} fill="currentColor" />
                    )}
                    <span>{recording ? "Stop & save" : "Record run"}</span>
                  </button>
                </div>

                <div className="telemetry-heading">
                  <span>
                    LIVE TELEMETRY <i>ESTIMATED</i>
                  </span>
                  <button
                    className="text-button"
                    onClick={() => navigate("experiments")}
                  >
                    Compare experiments <ArrowUpRight size={12} />
                  </button>
                </div>
                <div className="metric-grid">
                  {[
                    {
                      label: "DRAG FORCE",
                      value: fmt(metrics.drag, 1),
                      unit: "N",
                      key: "drag",
                      color: COLORS[0],
                      foot: "Resistance to airflow",
                    },
                    {
                      label: "DRAG COEFFICIENT",
                      value: fmt(metrics.cd, 3),
                      unit: "Cd",
                      key: "cd",
                      color: COLORS[1],
                      foot: "Shape-dependent estimate",
                    },
                    {
                      label: "LIFT FORCE",
                      value: fmt(metrics.lift, 1),
                      unit: "N",
                      key: "lift",
                      color: COLORS[2],
                      foot: "Vertical aerodynamic force",
                    },
                    {
                      label: "DYNAMIC PRESSURE",
                      value: fmt(metrics.pressure, 0),
                      unit: "Pa",
                      key: "pressure",
                      color: COLORS[3],
                      foot: "½ρv² freestream pressure",
                    },
                  ].map((m) => (
                    <div className="metric-card panel" key={m.key}>
                      <span className="metric-label">
                        {m.label}
                        <i style={{ background: m.color }} />
                      </span>
                      <div className="metric-value">
                        {m.value}
                        <small>{m.unit}</small>
                      </div>
                      <LineChart
                        labels={false}
                        height={35}
                        series={[
                          {
                            values: graphData.map(
                              (s) => s[m.key as keyof Sample],
                            ),
                            color: m.color,
                          },
                        ]}
                      />
                      <span className="metric-foot">{m.foot}</span>
                    </div>
                  ))}
                </div>
              </section>

              <aside className="settings-panel panel">
                <div className="panel-title">
                  <span>
                    {page === "editor"
                      ? "OBJECT PROPERTIES"
                      : "SIMULATION SETUP"}
                  </span>
                  <SlidersHorizontal size={14} />
                </div>
                {page === "studio" ? (
                  <>
                    <div className="settings-tabs">
                      <button
                        className={rightTab === "conditions" ? "active" : ""}
                        onClick={() => setRightTab("conditions")}
                      >
                        <Wind size={13} /> Conditions
                      </button>
                      <button
                        className={rightTab === "display" ? "active" : ""}
                        onClick={() => setRightTab("display")}
                      >
                        <Settings2 size={13} /> Display
                      </button>
                    </div>
                    <div className="settings-scroll">
                      {rightTab === "conditions" ? (
                        <fieldset disabled={recording}>
                          <div className="control-section">
                            <label className="field-label">
                              SCENARIO PRESET
                            </label>
                            <div className="select-wrap">
                              <Wind size={15} />
                              <select
                                aria-label="Scenario preset"
                                value={scenario}
                                onChange={(e) => chooseScenario(e.target.value)}
                              >
                                {scenario === "custom" && (
                                  <option value="custom">
                                    Custom conditions
                                  </option>
                                )}
                                {SCENARIOS.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.name}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown size={13} />
                            </div>
                            <p className="field-hint">
                              {activeScenario?.description ||
                                "Your own combination of flow conditions."}
                            </p>
                          </div>
                          <div className="control-section">
                            <div className="section-heading">
                              <Wind size={14} />
                              <span>AIRFLOW</span>
                              <span className="unit-tag">SI units</span>
                            </div>
                            <Range
                              label="Wind speed"
                              value={settings.speed}
                              min={0}
                              max={120}
                              step={0.5}
                              unit=" m/s"
                              onChange={(v) => change("speed", v)}
                            />
                            <div className="speed-equivalent">
                              {fmt(settings.speed * 3.6, 0)} km/h <span>·</span>{" "}
                              Mach {fmt(metrics.mach, 3)}
                            </div>
                            <Range
                              label="Turbulence intensity"
                              value={settings.turbulence * 100}
                              min={0}
                              max={100}
                              step={1}
                              unit="%"
                              onChange={(v) => change("turbulence", v / 100)}
                            />
                          </div>
                          <div className="control-section">
                            <div className="section-heading">
                              <Rotate3D size={14} />
                              <span>OBJECT ORIENTATION</span>
                            </div>
                            <Range
                              label="Yaw angle"
                              value={settings.yaw}
                              min={-90}
                              max={90}
                              unit="°"
                              onChange={(v) => change("yaw", v)}
                            />
                            <Range
                              label="Angle of attack"
                              value={settings.pitch}
                              min={-30}
                              max={30}
                              unit="°"
                              onChange={(v) => change("pitch", v)}
                            />
                          </div>
                          <div className="control-section">
                            <button
                              className="disclosure"
                              aria-expanded={advanced}
                              onClick={() => setAdvanced((v) => !v)}
                            >
                              <span>
                                <Settings2 size={14} /> Environment & advanced
                              </span>
                              <ChevronDown
                                size={13}
                                className={advanced ? "rotated" : ""}
                              />
                            </button>
                            {advanced && (
                              <div className="advanced-controls">
                                <Range
                                  label="Temperature"
                                  value={settings.temperature}
                                  min={-40}
                                  max={60}
                                  unit="°C"
                                  onChange={(v) => change("temperature", v)}
                                />
                                <Range
                                  label="Altitude"
                                  value={settings.altitude}
                                  min={0}
                                  max={12000}
                                  step={100}
                                  unit=" m"
                                  onChange={(v) => change("altitude", v)}
                                />
                                <Range
                                  label="Gust amplitude"
                                  value={settings.gust}
                                  min={0}
                                  max={40}
                                  unit=" m/s"
                                  onChange={(v) => change("gust", v)}
                                />
                                <Range
                                  label="Gust frequency"
                                  value={settings.gustFrequency}
                                  min={0.1}
                                  max={3}
                                  step={0.1}
                                  unit=" Hz"
                                  onChange={(v) => change("gustFrequency", v)}
                                />
                                <Range
                                  label="Surface roughness"
                                  value={settings.roughness}
                                  min={0}
                                  max={1}
                                  step={0.05}
                                  onChange={(v) => change("roughness", v)}
                                />
                                <Range
                                  label="Object scale"
                                  value={settings.scale}
                                  min={0.2}
                                  max={3}
                                  step={0.1}
                                  unit="×"
                                  onChange={(v) => change("scale", v)}
                                />
                              </div>
                            )}
                          </div>
                          <div className="control-section duration-section">
                            <label className="field-label">
                              RECORDING DURATION
                            </label>
                            <div className="duration-options">
                              {[10, 20, 30, 60, 120].map((d) => (
                                <button
                                  key={d}
                                  className={
                                    settings.duration === d ? "active" : ""
                                  }
                                  onClick={() => change("duration", d)}
                                >
                                  {d}s
                                </button>
                              ))}
                            </div>
                          </div>
                        </fieldset>
                      ) : (
                        <>
                          <div className="control-section">
                            <div className="section-heading">
                              <Layers3 size={14} />
                              <span>VISUALIZATION</span>
                            </div>
                            <label className="field">
                              Flow display
                              <select
                                value={mode}
                                onChange={(e) =>
                                  setMode(e.target.value as ViewMode)
                                }
                              >
                                <option value="streamlines">
                                  Streamlines + tracers
                                </option>
                                <option value="particles">
                                  Particle tracers
                                </option>
                                <option value="pressure">
                                  Surface pressure estimate
                                </option>
                                <option value="velocity">
                                  Surface velocity estimate
                                </option>
                              </select>
                            </label>
                            <Range
                              label="Streamline density"
                              value={density}
                              min={1}
                              max={8}
                              onChange={setDensity}
                            />
                            <Toggle
                              label="Reference grid"
                              value={grid}
                              onChange={() => setGrid((v) => !v)}
                            />
                            <Toggle
                              label="Tunnel boundaries"
                              value={tunnel}
                              onChange={() => setTunnel((v) => !v)}
                            />
                          </div>
                          <div className="control-section">
                            <div className="section-heading">
                              <Camera size={14} />
                              <span>CAPTURE</span>
                            </div>
                            <button
                              className="secondary-button full-width"
                              onClick={() => viewport.current?.screenshot()}
                            >
                              <Camera size={14} /> Download viewport PNG
                            </button>
                            <button
                              className="text-button full-width"
                              onClick={exportGeometry}
                            >
                              <Download size={14} /> Export object as GLB
                            </button>
                          </div>
                          <div className="control-section">
                            <div className="section-heading">
                              <Gauge size={14} />
                              <span>RENDERER</span>
                            </div>
                            <div className="stat-row">
                              <span>Frame rate</span>
                              <strong>{stats.fps} fps</strong>
                            </div>
                            <div className="stat-row">
                              <span>Scene triangles</span>
                              <strong>
                                {stats.triangles.toLocaleString()}
                              </strong>
                            </div>
                            <div className="stat-row">
                              <span>Rendering</span>
                              <strong>WebGL 2</strong>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="settings-scroll editor-properties">
                    {part ? (
                      <>
                        <div className="control-section">
                          <div className="section-heading">
                            <Box size={14} />
                            <span>SELECTED PART</span>
                          </div>
                          <label className="field">
                            Part name
                            <input
                              value={part.name}
                              onChange={(e) =>
                                updatePart({ ...part, name: e.target.value })
                              }
                            />
                          </label>
                          <div className="part-actions">
                            <button
                              className="secondary-button"
                              onClick={() => {
                                const p = {
                                  ...clone(part),
                                  id: uid(),
                                  name: `${part.name} copy`,
                                  position: [
                                    part.position[0],
                                    part.position[1] + 1,
                                    part.position[2],
                                  ] as [number, number, number],
                                };
                                editModel({
                                  ...model,
                                  parts: [...model.parts!, p],
                                });
                                setSelectedPart(p.id);
                              }}
                            >
                              <Copy size={13} /> Duplicate
                            </button>
                            <IconButton
                              label="Delete selected part"
                              disabled={model.parts?.length === 1}
                              onClick={() => {
                                editModel({
                                  ...model,
                                  parts: model.parts?.filter(
                                    (p) => p.id !== part.id,
                                  ),
                                });
                                setSelectedPart(null);
                              }}
                            >
                              <Trash2 size={14} />
                            </IconButton>
                          </div>
                        </div>
                        {(["position", "rotation", "scale"] as const).map(
                          (prop) => (
                            <div className="control-section" key={prop}>
                              <div className="section-heading">
                                <span>{prop.toUpperCase()}</span>
                                <span className="unit-tag">
                                  {prop === "rotation"
                                    ? "degrees"
                                    : prop === "position"
                                      ? "meters"
                                      : "factor"}
                                </span>
                              </div>
                              <div className="vector-inputs">
                                {["X", "Y", "Z"].map((axis, i) => (
                                  <label key={axis}>
                                    <span
                                      className={`axis-${axis.toLowerCase()}`}
                                    >
                                      {axis}
                                    </span>
                                    <input
                                      type="number"
                                      aria-label={`${prop} ${axis}`}
                                      step={prop === "rotation" ? 5 : 0.1}
                                      min={prop === "scale" ? 0.05 : -100}
                                      max={100}
                                      value={Number(part[prop][i].toFixed(2))}
                                      onChange={(e) => {
                                        const value = Number(e.target.value);
                                        if (!Number.isFinite(value)) return;
                                        const vec = [...part[prop]] as [
                                          number,
                                          number,
                                          number,
                                        ];
                                        vec[i] =
                                          prop === "scale"
                                            ? Math.max(0.05, value)
                                            : value;
                                        updatePart({ ...part, [prop]: vec });
                                      }}
                                    />
                                  </label>
                                ))}
                              </div>
                            </div>
                          ),
                        )}
                        <div className="control-section">
                          <label className="color-field">
                            Surface color
                            <input
                              type="color"
                              aria-label="Part surface color"
                              value={part.color}
                              onChange={(e) =>
                                updatePart({ ...part, color: e.target.value })
                              }
                            />
                          </label>
                        </div>
                      </>
                    ) : (
                      <div className="control-section">
                        <p className="field-hint">
                          Select a part in the scene or hierarchy to edit its
                          position, rotation, dimensions, and material.
                        </p>
                      </div>
                    )}
                    <div className="control-section">
                      <div className="section-heading">
                        <Gauge size={14} />
                        <span>AERODYNAMIC ASSUMPTIONS</span>
                      </div>
                      <Range
                        label="Assumed drag coefficient"
                        min={0.02}
                        max={2}
                        step={0.01}
                        value={model.cd}
                        onChange={(v) => editModel({ ...model, cd: v })}
                      />
                      <Range
                        label="Assumed lift slope"
                        min={0}
                        max={6.5}
                        step={0.1}
                        value={model.liftSlope}
                        onChange={(v) => editModel({ ...model, liftSlope: v })}
                      />
                      <p className="field-hint">
                        Custom geometry uses its bounding envelope and these
                        coefficients. The mesh is not CFD-resolved.
                      </p>
                    </div>
                    <div className="control-section">
                      <Range
                        label="Object scale"
                        value={settings.scale}
                        min={0.2}
                        max={3}
                        step={0.1}
                        unit="×"
                        onChange={(v) => change("scale", v)}
                      />
                      <button
                        className="secondary-button full-width"
                        onClick={exportGeometry}
                      >
                        <Download size={14} /> Export GLB
                      </button>
                    </div>
                  </div>
                )}
                <div className="environment-summary">
                  <div>
                    <span>AIR DENSITY</span>
                    <strong>
                      {fmt(metrics.density, 3)}
                      <small>kg/m³</small>
                    </strong>
                  </div>
                  <div>
                    <span>REYNOLDS NO.</span>
                    <strong>
                      {metrics.reynolds > 1e6
                        ? `${fmt(metrics.reynolds / 1e6, 2)}M`
                        : `${fmt(metrics.reynolds / 1000, 1)}k`}
                    </strong>
                  </div>
                </div>
                <div className="local-note">
                  <Info size={13} />
                  <span>
                    Exploratory estimates.{" "}
                    <button onClick={() => setHelp(true)}>
                      Understand the model
                    </button>
                  </span>
                </div>
              </aside>
            </div>
            <footer className="workspace-footer">
              <span>
                <span className="green-dot" /> All systems ready <i>·</i> Runs
                saved in this browser
              </span>
              <span>
                A little curiosity. A lot of possibilities. <Wind size={13} />
              </span>
            </footer>
          </main>
        )}

        {page === "experiments" && (
          <Experiments
            runs={runs}
            onReplay={replayRun}
            onDelete={(id) => void removeRun(id)}
            onUpdate={(r) => void saveEditedRun(r)}
            onRecord={() => {
              setPage("studio");
              startRecording();
            }}
          />
        )}
        {page === "library" && (
          <main className="library-page">
            <div className="page-heading">
              <div className="eyebrow">
                THE STARTING POINT FOR YOUR NEXT EXPERIMENT
              </div>
              <div>
                <h1>A shape for every idea.</h1>
                <div className="button-row">
                  <button
                    className="secondary-button"
                    onClick={() => fileInput.current?.click()}
                    disabled={importing}
                  >
                    <Upload size={15} /> Import model
                  </button>
                  <button className="primary-button" onClick={createAssembly}>
                    <Plus size={15} /> Build an object
                  </button>
                </div>
              </div>
              <p>
                Explore {MODELS.length} reference objects, or bring something of
                your own.
              </p>
            </div>
            <div className="library-filter">
              <label className="search-field">
                <Search size={15} />
                <input
                  aria-label="Search model library"
                  placeholder="Search shapes, vehicles, structures..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <div className="category-chips">
                {categories.map((c) => (
                  <button
                    key={c}
                    className={category === c ? "active" : ""}
                    onClick={() => setCategory(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div className="full-library-grid">
              {filtered.map((m) => (
                <article className="library-model-card panel" key={m.id}>
                  <div className="large-model-art">
                    <ModelArt model={m} />
                    <span className="pill">{m.category}</span>
                  </div>
                  <div className="library-model-content">
                    <h3>{m.name}</h3>
                    <p>{m.description}</p>
                    <div className="library-model-info">
                      <span>
                        {m.dimensions.map((v) => fmt(v, 1)).join(" × ")} m
                      </span>
                      <span>Cd {fmt(m.cd, 2)}</span>
                    </div>
                    <button
                      className="secondary-button full-width"
                      onClick={() => {
                        chooseModel(m);
                        setPage("studio");
                      }}
                    >
                      <Wind size={14} /> Open in wind tunnel{" "}
                      <ArrowUpRight size={13} />
                    </button>
                    {m.custom && (
                      <button
                        className="text-button full-width"
                        onClick={() => {
                          chooseModel(m);
                          setPage("editor");
                        }}
                      >
                        Edit geometry
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
            <div className="scenario-library">
              <h2>One object. Different worlds.</h2>
              <p>Start with a scenario, then make every condition your own.</p>
              <div className="scenario-grid">
                {SCENARIOS.map((s) => (
                  <button
                    key={s.id}
                    className="scenario-card panel"
                    onClick={() => {
                      chooseScenario(s.id);
                      setPage("studio");
                    }}
                  >
                    <span className="scenario-icon">
                      <Wind size={20} />
                    </span>
                    <span className="eyebrow">{s.tag}</span>
                    <h3>{s.name}</h3>
                    <p>{s.description}</p>
                    <span className="text-button">
                      Explore scenario <ArrowRight size={13} />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </main>
        )}
      </div>
      {sweep && (
        <SweepDialog
          model={model}
          settings={settings}
          scenarioId={scenario}
          onClose={() => setSweep(false)}
          onComplete={async (generated) => {
            await restoreWorkspace({
              version: 1,
              models: [],
              runs: generated,
              settings,
              activeModelId: model.id,
            });
            setRuns((r) => [...generated, ...r]);
            setPage("experiments");
            notify(
              `${generated.length} estimated sweep runs saved. Select them to compare.`,
            );
          }}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <Info size={17} />
          <span>{toast}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {help && (
        <div
          className="modal-backdrop"
          onClick={(e) => e.target === e.currentTarget && setHelp(false)}
        >
          <section
            className="help-modal"
            role="dialog"
            aria-modal="true"
            aria-label="AeroLab guide"
          >
            <div className="modal-header">
              <span className="brand-symbol">
                <Wind size={20} />
              </span>
              <strong>AeroLab field guide</strong>
              <IconButton label="Close guide" onClick={() => setHelp(false)}>
                <X size={20} />
              </IconButton>
            </div>
            <Methodology />
          </section>
        </div>
      )}
    </div>
  );
}
