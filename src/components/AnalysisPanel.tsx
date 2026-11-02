import { useEffect, useMemo, useState } from 'react';
import { buildTruthTable, collectTimingSignals, truthCell } from '../engine/analysis';
import { useCircuitStore } from '../store/useCircuitStore';
import type { BottomTab } from '../store/useCircuitStore';
import type { Warning } from '../engine/types';
import type { ChallengeResult } from '../learning/challenges';
import { Icon } from './Icon';
import { LearningPanel } from './LearningPanel';

const TABS: { id: BottomTab; label: string }[] = [
  { id: 'truth', label: 'Wahrheitstabelle' },
  { id: 'timing', label: 'Timing' },
  { id: 'warnings', label: 'Prüfung' },
  { id: 'learn', label: 'Lernen' },
];

function TruthTablePanel() {
  const circuit = useCircuitStore((state) => state.circuit);
  const data = useMemo(() => buildTruthTable(circuit), [circuit]);
  const errorCount = data.outputColumns.length === 0 ? 1 : 0;

  if (data.limited) {
    return (
      <div className="analysis-empty">
        <span className="analysis-empty-icon">Σ</span>
        <h3>Zu viele Eingangsbits</h3>
        <p>
          Die Wahrheitstabelle wird bis {8} Eingangsbits erzeugt. Diese Schaltung hat{' '}
          {data.totalBits} Bits. Reduziere die Eingangsbreite für eine vollständige Tabelle.
        </p>
      </div>
    );
  }

  if (errorCount > 0) {
    return (
      <div className="analysis-empty">
        <span className="analysis-empty-icon">→</span>
        <h3>Kein Ausgang vorhanden</h3>
        <p>Füge einen Ausgang hinzu, um die Wahrheitstabelle zu erzeugen.</p>
      </div>
    );
  }

  return (
    <div className="truth-panel">
      <div className="analysis-toolbar">
        <div className="analysis-summary">
          <span className="summary-pill">{data.inputColumns.length} Eingänge</span>
          <span className="summary-pill">{data.outputColumns.length} Ausgänge</span>
          <span className="summary-pill">{data.rows.length} Zeilen</span>
          <span className="live-label"><span className="status-dot" /> live erzeugt</span>
        </div>
        <div className="analysis-toolbar-note">
          {data.sequential
            ? 'Sequentiell: jeweils nach Reset, Takt = 0'
            : 'Rein kombinatorische Logik'}
        </div>
      </div>
      <div className="truth-scroll">
        <table className="truth-table">
          <thead>
            <tr>
              <th className="row-index">#</th>
              {data.inputColumns.map((column) => (
                <th key={column.id}>
                  <span className="truth-head-label">{column.label}</span>
                  <small>{column.width}b</small>
                </th>
              ))}
              {data.outputColumns.map((column, index) => (
                <th key={column.id} className={`output-head ${index === 0 ? 'group-start' : ''}`}>
                  <span className="truth-head-label">{column.label}</span>
                  <small>{column.width}b</small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <td className="row-index">{rowIndex.toString(2).padStart(data.totalBits, '0')}</td>
                {row.inputs.map((value, index) => (
                  <td
                    key={`in-${data.inputColumns[index].id}`}
                    className={`truth-value ${value ? 'high' : ''}`}
                  >
                    {truthCell(value, data.inputColumns[index].width)}
                  </td>
                ))}
                {row.outputs.map((value, index) => (
                  <td
                    key={`out-${data.outputColumns[index].id}`}
                    className={`truth-value output-value ${value ? 'high' : ''} ${
                      index === 0 ? 'group-start' : ''
                    }`}
                  >
                    {truthCell(value, data.outputColumns[index].width)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.unstable && (
        <div className="analysis-alert">
          <Icon name="alert" size={14} /> Mindestens eine Zeile liefert keinen stabilen Zustand.
        </div>
      )}
    </div>
  );
}

interface TimingLane {
  key: string;
  label: string;
  kindLabel: string;
  bit: number | null;
}

const TIMING_STEP = 18;
const TIMING_START = 12;

function timingPath(values: number[]): string {
  if (values.length === 0) return '';
  const yHigh = 6;
  const yLow = 18;
  let previousY = values[0] ? yHigh : yLow;
  let path = `M ${TIMING_START} ${previousY}`;
  for (let index = 1; index < values.length; index += 1) {
    const x = TIMING_START + index * TIMING_STEP;
    const y = values[index] ? yHigh : yLow;
    if (y !== previousY) {
      path += ` L ${x} ${previousY} L ${x} ${y}`;
      previousY = y;
    }
  }
  const endX = TIMING_START + Math.max(1, values.length) * TIMING_STEP;
  path += ` L ${endX} ${previousY}`;
  return path;
}

function TimingPanel() {
  const circuit = useCircuitStore((state) => state.circuit);
  const history = useCircuitStore((state) => state.history);
  const tickClock = useCircuitStore((state) => state.tickClock);
  const clearHistory = useCircuitStore((state) => state.clearHistory);
  const setRunning = useCircuitStore((state) => state.setRunning);
  const simRunning = useCircuitStore((state) => state.simRunning);
  const signals = useMemo(() => collectTimingSignals(circuit), [circuit]);
  const allLanes = useMemo(() => {
    const result: TimingLane[] = [];
    for (const signal of signals) {
      if (signal.width > 1) {
        for (let bit = signal.width - 1; bit >= 0; bit -= 1) {
          result.push({
            key: signal.key,
            label: `${signal.label}[${bit}]`,
            kindLabel: signal.kindLabel,
            bit,
          });
        }
      } else {
        result.push({ key: signal.key, label: signal.label, kindLabel: signal.kindLabel, bit: null });
      }
    }
    return result;
  }, [signals]);
  const lanes = allLanes.slice(0, 16);
  const width = Math.max(360, TIMING_START + history.length * TIMING_STEP + 12);
  const hasClock = circuit.parts.some((part) => part.kind === 'clock');

  if (signals.length === 0) {
    return (
      <div className="analysis-empty">
        <span className="analysis-empty-icon">∿</span>
        <h3>Noch keine Messpunkte</h3>
        <p>
          Füge Eingänge, Ausgänge oder einen Taktgeber hinzu. Jeder Schalt- und Taktschritt wird
          automatisch im Verlauf aufgezeichnet.
        </p>
      </div>
    );
  }

  return (
    <div className="timing-panel">
      <div className="analysis-toolbar">
        <div className="analysis-summary">
          <span className="summary-pill">{history.length} Messpunkte</span>
          <span className="summary-pill">{lanes.length} Signale</span>
          <span className="live-label">
            <span className={`status-dot ${simRunning ? 'pulsing' : ''}`} />
            {simRunning ? 'Aufzeichnung läuft' : 'Bereit'}
          </span>
        </div>
        <div className="timing-actions">
          <button className="btn primary small" onClick={() => setRunning(!simRunning)}>
            <Icon name={simRunning ? 'pause' : 'play'} size={13} />
            {simRunning ? 'Pause' : 'Start'}
          </button>
          <button className="btn ghost small" onClick={tickClock} disabled={!hasClock}>
            <Icon name="step" size={13} /> Takt
          </button>
          <button className="btn ghost small" onClick={clearHistory}>
            Leeren
          </button>
        </div>
      </div>
      {history.length === 0 ? (
        <div className="timing-empty">
          <p>Der Verlauf ist leer. Schalte einen Eingang oder führe einen Taktschritt aus.</p>
        </div>
      ) : (
        <div className="timing-scroll">
          <div className="timing-table">
            <div className="timing-row timing-axis-row">
              <div className="timing-label axis-label">Signal</div>
              <div className="timing-track" style={{ width }}>
                <span className="axis-caption">Schritt</span>
                {history.map((sample, index) =>
                  index % 5 === 0 ? (
                    <span
                      key={`tick-${sample.t}`}
                      className="tick-label"
                      style={{ left: TIMING_START + index * TIMING_STEP }}
                    >
                      {sample.t}
                    </span>
                  ) : null,
                )}
              </div>
            </div>
            {lanes.map((lane) => {
              const values = history.map((sample) => {
                const raw = sample.values[lane.key] ?? 0;
                return lane.bit === null ? (raw ? 1 : 0) : (raw >> lane.bit) & 1;
              });
              return (
                <div className="timing-row" key={`${lane.key}:${lane.bit ?? 'bit'}`}>
                  <div className="timing-label">
                    <span className={`signal-kind kind-${lane.kindLabel.toLowerCase()}`}>
                      {lane.kindLabel}
                    </span>
                    <span className="signal-name">{lane.label}</span>
                  </div>
                  <div className="timing-track" style={{ width }}>
                    <svg width={width} height="24" className="timing-svg">
                      <line x1="0" y1="18" x2={width} y2="18" className="lane-baseline" />
                      {history.map((sample, index) =>
                        index % 5 === 0 ? (
                          <line
                            key={`grid-${sample.t}`}
                            x1={TIMING_START + index * TIMING_STEP}
                            y1="0"
                            x2={TIMING_START + index * TIMING_STEP}
                            y2="24"
                            className="lane-grid"
                          />
                        ) : null,
                      )}
                      <path d={timingPath(values)} className="timing-path" />
                      {values.map((value, index) =>
                        value && index > 0 && values[index - 1] === 0 ? (
                          <circle
                            key={`edge-${index}`}
                            cx={TIMING_START + index * TIMING_STEP}
                            cy="6"
                            r="2"
                            className="timing-edge"
                          />
                        ) : null,
                      )}
                    </svg>
                  </div>
                </div>
              );
            })}
          </div>
          {allLanes.length > 16 && (
            <p className="timing-more-note">Es werden maximal 16 Signalzeilen angezeigt.</p>
          )}
        </div>
      )}
    </div>
  );
}

function WarningRow({ warning }: { warning: Warning }) {
  const select = useCircuitStore((state) => state.select);
  return (
    <button
      className={`warning-row ${warning.level}`}
      onClick={() => {
        if (warning.partId) select({ type: 'part', id: warning.partId });
        else if (warning.wireId) select({ type: 'wire', id: warning.wireId });
      }}
      title={warning.partId || warning.wireId ? 'Betroffenes Bauteil auswählen' : undefined}
    >
      <span className={`warning-icon ${warning.level}`}>
        <Icon name={warning.level === 'error' ? 'alert' : 'info'} size={15} />
      </span>
      <span className="warning-text">
        <strong>{warning.level === 'error' ? 'Fehler' : 'Hinweis'}</strong>
        <span>{warning.message}</span>
      </span>
      {(warning.partId || warning.wireId) && <span className="warning-jump">Auswählen →</span>}
    </button>
  );
}

function WarningsPanel() {
  const warnings = useCircuitStore((state) => state.warnings);
  const sorted = useMemo(
    () =>
      [...warnings].sort((a, b) => {
        if (a.level === b.level) return 0;
        return a.level === 'error' ? -1 : 1;
      }),
    [warnings],
  );
  const errors = warnings.filter((warning) => warning.level === 'error').length;

  if (warnings.length === 0) {
    return (
      <div className="analysis-empty success-empty">
        <span className="analysis-empty-icon success">✓</span>
        <h3>Keine Probleme erkannt</h3>
        <p>
          Alle erforderlichen Eingänge sind verbunden und die Schaltung liefert einen stabilen
          Zustand.
        </p>
      </div>
    );
  }

  return (
    <div className="warnings-panel">
      <div className="analysis-toolbar">
        <div className="analysis-summary">
          <span className={`summary-pill ${errors ? 'error-pill' : ''}`}>{errors} Fehler</span>
          <span className="summary-pill">{warnings.length - errors} Hinweise</span>
        </div>
        <div className="analysis-toolbar-note">
          Klicke einen Eintrag, um das betroffene Bauteil auszuwählen.
        </div>
      </div>
      <div className="warning-list">
        {sorted.map((warning) => (
          <WarningRow key={warning.id} warning={warning} />
        ))}
      </div>
    </div>
  );
}

export function AnalysisPanel() {
  const tab = useCircuitStore((state) => state.bottomTab);
  const open = useCircuitStore((state) => state.bottomOpen);
  const setBottomTab = useCircuitStore((state) => state.setBottomTab);
  const toggleBottom = useCircuitStore((state) => state.toggleBottom);
  const warnings = useCircuitStore((state) => state.warnings);
  const circuit = useCircuitStore((state) => state.circuit);
  const errorCount = warnings.filter((warning) => warning.level === 'error').length;
  const [learningResults, setLearningResults] = useState<Record<string, ChallengeResult | undefined>>(
    {},
  );

  useEffect(() => {
    setLearningResults({});
  }, [circuit]);

  return (
    <section className={`analysis-panel ${open ? 'open' : 'collapsed'}`}>
      <div className="analysis-head">
        <div className="analysis-tabs" role="tablist">
          {TABS.map((entry) => (
            <button
              key={entry.id}
              role="tab"
              aria-selected={tab === entry.id}
              className={`analysis-tab ${tab === entry.id ? 'active' : ''}`}
              onClick={() => setBottomTab(entry.id)}
            >
              {entry.label}
              {entry.id === 'warnings' && warnings.length > 0 && (
                <span className={`tab-badge ${errorCount ? 'error' : ''}`}>{warnings.length}</span>
              )}
              {entry.id === 'learn' && <span className="tab-star">✦</span>}
            </button>
          ))}
        </div>
        <div className="analysis-head-actions">
          <span className="analysis-live">
            <span className="status-dot" /> Echtzeit
          </span>
          <button
            className={`icon-btn collapse-btn ${open ? '' : 'closed'}`}
            onClick={toggleBottom}
            title={open ? 'Analysebereich einklappen' : 'Analysebereich öffnen'}
          >
            <Icon name="chevron" size={16} />
          </button>
        </div>
      </div>
      {open && (
        <div className="analysis-body">
          {tab === 'truth' && <TruthTablePanel />}
          {tab === 'timing' && <TimingPanel />}
          {tab === 'warnings' && <WarningsPanel />}
          {tab === 'learn' && (
            <LearningPanel
              results={learningResults}
              onResult={(id, result) =>
                setLearningResults((previous) => ({ ...previous, [id]: result }))
              }
            />
          )}
        </div>
      )}
    </section>
  );
}
