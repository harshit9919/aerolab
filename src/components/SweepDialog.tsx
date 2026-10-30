import { useState } from "react";
import { X } from "lucide-react";
import type { ModelDefinition, Settings, Run } from "../types";
import {
  createSweep,
  SWEEP_PARAMETERS,
  type SweepParameter,
} from "../lib/sweep";
type Props = {
  model: ModelDefinition;
  settings: Settings;
  scenarioId: string;
  onClose: () => void;
  onComplete: (runs: Run[]) => Promise<void>;
};
export default function SweepDialog({
  model,
  settings,
  scenarioId,
  onClose,
  onComplete,
}: Props) {
  const [parameter, setParameter] = useState<SweepParameter>("speed");
  const [start, setStart] = useState("0"),
    [end, setEnd] = useState("50"),
    [count, setCount] = useState("5");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const spec = SWEEP_PARAMETERS[parameter];
  const chooseParameter = (next: SweepParameter) => {
    setParameter(next);
    const value = settings[next];
    const nextSpec = SWEEP_PARAMETERS[next];
    setStart(
      String(
        Math.max(
          nextSpec.min,
          value - (next === "altitude" ? 1000 : next === "speed" ? 10 : 10),
        ),
      ),
    );
    setEnd(
      String(Math.min(nextSpec.max, value + (next === "altitude" ? 1000 : 10))),
    );
    setError("");
  };
  const submit = async () => {
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      if (!start.trim() || !end.trim() || !count.trim())
        throw new Error("Enter a start, end and run count.");
      const runs = createSweep(model, settings, scenarioId, {
        parameter,
        start: Number(start),
        end: Number(end),
        count: Number(count),
      });
      await onComplete(runs);
      onClose();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "The sweep could not be saved. Please try again.",
      );
      setBusy(false);
    }
  };
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <section
        className="help-modal sweep-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sweep-title"
      >
        <div className="modal-header">
          <strong id="sweep-title">Parameter sweep</strong>
          <button
            className="icon-button"
            aria-label="Close parameter sweep"
            disabled={busy}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        <div className="methodology">
          <p className="eyebrow">COMPARE ONE CHANGE AT A TIME</p>
          <h2>Find a useful trend.</h2>
          <p>
            Generate estimated runs for <strong>{model.name}</strong>, varying
            one condition while keeping the current geometry and other settings
            fixed.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <fieldset disabled={busy}>
              <label className="field">
                Parameter
                <select
                  value={parameter}
                  onChange={(e) =>
                    chooseParameter(e.target.value as SweepParameter)
                  }
                >
                  {Object.entries(SWEEP_PARAMETERS).map(([key, value]) => (
                    <option value={key} key={key}>
                      {value.label} ({value.unit})
                    </option>
                  ))}
                </select>
              </label>
              <div className="sweep-fields">
                <label className="field">
                  Start ({spec.unit})
                  <input
                    aria-label="Sweep start"
                    type="number"
                    required
                    min={spec.min}
                    max={spec.max}
                    step="any"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                  />
                </label>
                <label className="field">
                  End ({spec.unit})
                  <input
                    aria-label="Sweep end"
                    type="number"
                    required
                    min={spec.min}
                    max={spec.max}
                    step="any"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                  />
                </label>
                <label className="field">
                  Number of runs
                  <input
                    aria-label="Sweep run count"
                    type="number"
                    required
                    min="2"
                    max="10"
                    step="1"
                    value={count}
                    onChange={(e) => setCount(e.target.value)}
                  />
                </label>
              </div>
            </fieldset>
            <p>
              {Number.isInteger(Number(count)) &&
              Number(count) >= 2 &&
              Number(count) <= 10
                ? count
                : "2–10"}{" "}
              runs · {settings.duration} s per run · 0.1 s sample interval,
              including the exact endpoint. Current speed: {settings.speed} m/s;
              yaw: {settings.yaw}°; pitch: {settings.pitch}°.
            </p>
            <p className="field-hint">
              Computed parameter sweep; not a recorded viewport session. These
              use the same approximate metric engine as live telemetry, with
              illustrative coefficients. Results appear in Experiments for
              replay, comparison and export.
            </p>
            {error && (
              <p className="error-message" role="alert">
                {error}
              </p>
            )}
            <div className="button-row">
              <button
                className="secondary-button"
                type="button"
                disabled={busy}
                onClick={onClose}
              >
                Cancel
              </button>
              <button className="primary-button" type="submit" disabled={busy}>
                {busy ? "Generating and saving…" : "Generate estimated runs"}
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
