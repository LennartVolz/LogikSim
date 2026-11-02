import { useRef } from 'react';
import { useCircuitStore } from '../store/useCircuitStore';
import { EXAMPLES } from '../circuit/examples';
import { downloadProject, parseProject } from '../storage/project';
import { Icon } from './Icon';

export function Toolbar() {
  const circuit = useCircuitStore((state) => state.circuit);
  const setName = useCircuitStore((state) => state.setName);
  const newCircuit = useCircuitStore((state) => state.newCircuit);
  const loadExample = useCircuitStore((state) => state.loadExample);
  const loadCircuit = useCircuitStore((state) => state.loadCircuit);
  const undo = useCircuitStore((state) => state.undo);
  const redo = useCircuitStore((state) => state.redo);
  const pastLength = useCircuitStore((state) => state.past.length);
  const futureLength = useCircuitStore((state) => state.future.length);
  const simRunning = useCircuitStore((state) => state.simRunning);
  const speed = useCircuitStore((state) => state.speed);
  const setRunning = useCircuitStore((state) => state.setRunning);
  const setSpeed = useCircuitStore((state) => state.setSpeed);
  const tickClock = useCircuitStore((state) => state.tickClock);
  const resetSimulation = useCircuitStore((state) => state.resetSimulation);
  const warnings = useCircuitStore((state) => state.warnings);
  const setBottomTab = useCircuitStore((state) => state.setBottomTab);
  const bottomTab = useCircuitStore((state) => state.bottomTab);
  const bottomOpen = useCircuitStore((state) => state.bottomOpen);
  const notify = useCircuitStore((state) => state.notify);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const errorCount = warnings.filter((warning) => warning.level === 'error').length;

  const handleSave = () => {
    downloadProject(circuit);
    notify('Projekt als JSON heruntergeladen.', 'success');
  };

  const handleOpen = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    const parsed = parseProject(text);
    if (!parsed.ok) {
      notify(parsed.error, 'error');
      return;
    }
    loadCircuit(
      parsed.circuit,
      parsed.skippedWires > 0
        ? `Projekt importiert – ${parsed.skippedWires} ungültige Leitung(en) übersprungen.`
        : 'Projekt importiert.',
    );
  };

  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark" aria-hidden>
          <svg viewBox="0 0 40 40" width="30" height="30">
            <path
              d="M7 10h8a10 10 0 0 1 0 20H7z"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.6"
            />
            <path d="M20 20h10" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            <circle cx="32" cy="20" r="3" fill="currentColor" />
            <path d="M7 15h4M7 25h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity=".55" />
          </svg>
        </div>
        <div className="brand-text">
          <strong>LogikSim</strong>
          <span>Digital Lab</span>
        </div>
      </div>

      <div className="project-title">
        <span className="project-kicker">Projekt</span>
        <input
          aria-label="Projektname"
          value={circuit.name}
          maxLength={80}
          onChange={(event) => setName(event.target.value)}
          spellCheck={false}
        />
      </div>

      <div className="toolbar-group file-tools">
        <button
          className="icon-btn"
          title="Rückgängig (Strg+Z)"
          onClick={undo}
          disabled={pastLength === 0}
        >
          <Icon name="undo" />
        </button>
        <button
          className="icon-btn"
          title="Wiederholen (Strg+Shift+Z)"
          onClick={redo}
          disabled={futureLength === 0}
        >
          <Icon name="redo" />
        </button>
        <span className="toolbar-divider" />
        <button className="toolbar-btn" title="Neue Schaltung" onClick={newCircuit}>
          <Icon name="plus" />
          <span>Neu</span>
        </button>
        <button className="toolbar-btn" title="JSON-Projekt öffnen" onClick={() => fileInput.current?.click()}>
          <Icon name="folder" />
          <span>Öffnen</span>
        </button>
        <button className="toolbar-btn" title="Projekt als JSON speichern" onClick={handleSave}>
          <Icon name="save" />
          <span>Speichern</span>
        </button>
        <div className="example-select">
          <select
            value=""
            aria-label="Beispielschaltung laden"
            onChange={(event) => {
              if (event.target.value) loadExample(event.target.value);
            }}
          >
            <option value="">Beispiele …</option>
            {EXAMPLES.map((example) => (
              <option key={example.id} value={example.id}>
                {example.name}
              </option>
            ))}
          </select>
          <Icon name="chevron" size={13} />
        </div>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(event) => {
            void handleOpen(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
      </div>

      <span className="toolbar-divider" />

      <div className="sim-tools">
        <button
          className={`sim-button ${simRunning ? 'running' : ''}`}
          onClick={() => setRunning(!simRunning)}
          title={simRunning ? 'Simulation pausieren (Leertaste)' : 'Simulation starten (Leertaste)'}
        >
          <Icon name={simRunning ? 'pause' : 'play'} size={15} />
          <span>{simRunning ? 'Pause' : 'Start'}</span>
          {simRunning && <i className="live-dot" />}
        </button>
        <button className="toolbar-btn" title="Einen Taktschritt ausführen (T)" onClick={tickClock}>
          <Icon name="step" />
          <span>Takt</span>
        </button>
        <label className="speed-select" title="Taktfrequenz">
          <select
            value={speed}
            aria-label="Taktfrequenz"
            onChange={(event) => setSpeed(Number(event.target.value))}
          >
            {[1, 2, 4, 8, 16].map((value) => (
              <option key={value} value={value}>
                {value} Hz
              </option>
            ))}
          </select>
        </label>
        <button
          className="icon-btn"
          title="Simulation zurücksetzen"
          onClick={resetSimulation}
        >
          <Icon name="reset" />
        </button>
      </div>

      <div className="toolbar-spacer" />

      <button
        className={`warn-pill ${errorCount > 0 ? 'has-errors' : ''}`}
        onClick={() => setBottomTab('warnings')}
        title="Warnungen und Fehler anzeigen"
      >
        <Icon name="alert" size={14} />
        <span>{warnings.length}</span>
      </button>

      <button
        className={`learn-button ${bottomTab === 'learn' && bottomOpen ? 'active' : ''}`}
        onClick={() => setBottomTab('learn')}
        title="Lernmodus mit überprüfbaren Aufgaben"
      >
        <Icon name="learn" size={17} />
        <span>Lernmodus</span>
      </button>
    </header>
  );
}
