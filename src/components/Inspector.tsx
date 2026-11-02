import type { Part, PinValues } from '../engine/types';
import {
  IO_BIT_OPTIONS,
  PART_DEFS,
  formatBinary,
  getPins,
  mask,
  partName,
  pinKey,
} from '../engine/parts';
import { useCircuitStore } from '../store/useCircuitStore';
import { Icon } from './Icon';

function categoryLabel(category: string): string {
  switch (category) {
    case 'gates':
      return 'Logikgatter';
    case 'io':
      return 'Ein-/Ausgang';
    case 'sequential':
      return 'Sequentiell';
    case 'arithmetic':
      return 'Rechenbaustein';
    default:
      return category;
  }
}

function SignalTable({ part, pins }: { part: Part; pins: PinValues }) {
  return (
    <table className="signal-table">
      <thead>
        <tr>
          <th>Anschluss</th>
          <th>Richtung</th>
          <th>Wert</th>
        </tr>
      </thead>
      <tbody>
        {getPins(part).map((pin) => {
          const value = pins[pinKey(part.id, pin.id)] ?? 0;
          return (
            <tr key={pin.id}>
              <td>
                {pin.name}
                {pin.width > 1 && <span className="pin-bit-badge">{pin.width}b</span>}
              </td>
              <td>
                <span className={`direction-badge ${pin.dir}`}>
                  {pin.dir === 'in' ? 'IN' : 'OUT'}
                </span>
              </td>
              <td className={`signal-value ${value ? 'high' : ''}`}>
                {formatBinary(value, pin.width)}
                {pin.width > 1 && <small>{value}</small>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function BitEditor({ part }: { part: Part }) {
  const setPartValue = useCircuitStore((state) => state.setPartValue);
  const bits = part.bits ?? 1;
  const value = mask(part.value ?? 0, bits);
  const bitPositions = Array.from({ length: bits }, (_, index) => bits - 1 - index);

  return (
    <div className="bit-editor">
      <div className="value-readout">
        <span className="value-binary">{formatBinary(value, bits)}</span>
        <span className="value-decimal">= {value}</span>
      </div>
      <div className="bit-grid" style={{ gridTemplateColumns: `repeat(${bits}, minmax(0, 1fr))` }}>
        {bitPositions.map((bit) => {
          const active = (value >> bit) & 1;
          return (
            <button
              key={bit}
              className={`bit-button ${active ? 'on' : ''}`}
              onClick={() => setPartValue(part.id, value ^ (1 << bit))}
              title={`Bit ${bit} umschalten`}
            >
              <span className="bit-index">b{bit}</span>
              <span className="bit-value">{active}</span>
            </button>
          );
        })}
      </div>
      <div className="value-actions">
        <button className="btn ghost small" onClick={() => setPartValue(part.id, value - 1)}>
          −1
        </button>
        <button className="btn ghost small" onClick={() => setPartValue(part.id, value + 1)}>
          +1
        </button>
        <button className="btn ghost small" onClick={() => setPartValue(part.id, 0)}>
          0
        </button>
        <button
          className="btn ghost small"
          onClick={() => setPartValue(part.id, mask(0xffffffff, bits))}
        >
          Max
        </button>
      </div>
      <p className="field-hint">Klick auf den Schalter am Bauteil schaltet ebenfalls.</p>
    </div>
  );
}

function PartInspector({ part, pins }: { part: Part; pins: PinValues }) {
  const def = PART_DEFS[part.kind];
  const updateLabel = useCircuitStore((state) => state.updateLabel);
  const updateBits = useCircuitStore((state) => state.updateBits);
  const deleteSelection = useCircuitStore((state) => state.deleteSelection);
  const beginDragSnapshot = useCircuitStore((state) => state.beginDragSnapshot);
  const tickClock = useCircuitStore((state) => state.tickClock);
  const runtime = useCircuitStore((state) => state.runtime);
  const isIO = part.kind === 'input' || part.kind === 'output';
  const bits = part.bits ?? 1;
  const clockValue = pins[pinKey(part.id, 'out')] ?? 0;
  const qValue = pins[pinKey(part.id, 'q')] ?? 0;

  return (
    <div className="inspector-content">
      <div className="selected-heading">
        <span className={`big-symbol cat-${def.category}`}>{def.symbol}</span>
        <div className="selected-title">
          <h2>{def.name}</h2>
          <span>{categoryLabel(def.category)}</span>
        </div>
        <button
          className="icon-btn danger"
          title="Bauteil löschen (Entf)"
          onClick={deleteSelection}
        >
          <Icon name="trash" size={15} />
        </button>
      </div>
      <p className="part-description">{def.description}</p>

      <section className="inspector-section">
        <label className="field-label">
          Bezeichnung
          <input
            value={part.label ?? ''}
            maxLength={80}
            placeholder={def.name}
            onFocus={beginDragSnapshot}
            onChange={(event) => updateLabel(part.id, event.target.value)}
            spellCheck={false}
          />
        </label>
      </section>

      {isIO && (
        <section className="inspector-section">
          <span className="field-label">Bitbreite</span>
          <div className="segmented">
            {IO_BIT_OPTIONS.map((option) => (
              <button
                key={option}
                className={bits === option ? 'active' : ''}
                onClick={() => updateBits(part.id, option)}
              >
                {option} Bit
              </button>
            ))}
          </div>
          {bits > 1 && (
            <p className="field-hint">
              Bus-Anschlüsse lassen sich mit Splitter und Merger in einzelne Bits zerlegen.
            </p>
          )}
        </section>
      )}

      {part.kind === 'input' && (
        <section className="inspector-section">
          <span className="field-label">Wert</span>
          <BitEditor part={part} />
        </section>
      )}

      {part.kind === 'output' && (
        <section className="inspector-section">
          <span className="field-label">Anzeige</span>
          <div className="live-display">
            <span className="live-dot-large" data-active={qValue !== 0} />
            <strong>{formatBinary(qValue, bits)}</strong>
            <span>= {qValue}</span>
          </div>
        </section>
      )}

      {part.kind === 'clock' && (
        <section className="inspector-section">
          <span className="field-label">Taktzustand</span>
          <div className="live-display">
            <span className="live-dot-large" data-active={clockValue !== 0} />
            <strong>{clockValue}</strong>
            <span>manueller Pegel</span>
          </div>
          <button className="btn primary small full" onClick={tickClock}>
            <Icon name="step" size={14} /> Takt schrittweise schalten
          </button>
        </section>
      )}

      {(part.kind === 'dff' || part.kind === 'register4') && (
        <section className="inspector-section">
          <span className="field-label">Gespeicherter Zustand</span>
          <div className="live-display">
            <span className="live-dot-large" data-active={qValue !== 0} />
            <strong>{formatBinary(qValue, part.kind === 'dff' ? 1 : 4)}</strong>
            <span>Q = {qValue}</span>
          </div>
          <div className="tiny-grid">
            <span>Letzter Takt</span>
            <code>{runtime[part.id]?.lastClk ?? 0}</code>
            <span>Taktflanken</span>
            <code>steigend</code>
          </div>
        </section>
      )}

      <section className="inspector-section">
        <span className="field-label">Signale</span>
        <SignalTable part={part} pins={pins} />
      </section>

      <section className="inspector-section meta-section">
        <div>
          <span>Position</span>
          <code>
            {part.x} / {part.y}
          </code>
        </div>
        <div>
          <span>Bauteil-ID</span>
          <code>{part.id.slice(0, 16)}</code>
        </div>
      </section>
    </div>
  );
}

function WireInspector({ wireId }: { wireId: string }) {
  const circuit = useCircuitStore((state) => state.circuit);
  const pins = useCircuitStore((state) => state.pins);
  const deleteSelection = useCircuitStore((state) => state.deleteSelection);
  const wire = circuit.wires.find((entry) => entry.id === wireId);
  if (!wire) return null;
  const fromPart = circuit.parts.find((part) => part.id === wire.from.partId);
  const toPart = circuit.parts.find((part) => part.id === wire.to.partId);
  if (!fromPart || !toPart) return null;
  const fromPin = getPins(fromPart).find((pin) => pin.id === wire.from.pin);
  const toPin = getPins(toPart).find((pin) => pin.id === wire.to.pin);
  if (!fromPin || !toPin) return null;
  const value = pins[pinKey(fromPart.id, fromPin.id)] ?? 0;

  return (
    <div className="inspector-content">
      <div className="selected-heading">
        <span className="big-symbol cat-wire">↝</span>
        <div className="selected-title">
          <h2>Leitung</h2>
          <span>{fromPin.width} Bit</span>
        </div>
        <button className="icon-btn danger" title="Leitung löschen" onClick={deleteSelection}>
          <Icon name="trash" size={15} />
        </button>
      </div>

      <div className="wire-endpoint">
        <span className="endpoint-tag">Quelle</span>
        <strong>{partName(fromPart)}</strong>
        <span>
          {fromPin.name} · {fromPin.dir === 'out' ? 'Ausgang' : 'Eingang'}
        </span>
      </div>
      <div className="wire-line-visual">
        <span />
        <em>{formatBinary(value, fromPin.width)}</em>
        <span />
      </div>
      <div className="wire-endpoint">
        <span className="endpoint-tag target">Ziel</span>
        <strong>{partName(toPart)}</strong>
        <span>
          {toPin.name} · {toPin.dir === 'in' ? 'Eingang' : 'Ausgang'}
        </span>
      </div>

      <section className="inspector-section">
        <span className="field-label">Signal</span>
        <div className="live-display">
          <span className="live-dot-large" data-active={value !== 0} />
          <strong>{formatBinary(value, fromPin.width)}</strong>
          <span>= {value}</span>
        </div>
        {fromPin.width === toPin.width ? (
          <p className="field-hint">Die Bitbreiten von Quelle und Ziel passen zusammen.</p>
        ) : (
          <p className="field-hint error-text">Die Bitbreiten passen nicht zusammen.</p>
        )}
      </section>

      <section className="inspector-section meta-section">
        <div>
          <span>Leitungs-ID</span>
          <code>{wire.id.slice(0, 16)}</code>
        </div>
      </section>
    </div>
  );
}

function DefaultInspector() {
  const circuit = useCircuitStore((state) => state.circuit);
  const warnings = useCircuitStore((state) => state.warnings);
  const simRunning = useCircuitStore((state) => state.simRunning);
  const setRunning = useCircuitStore((state) => state.setRunning);
  const tickClock = useCircuitStore((state) => state.tickClock);
  const resetSimulation = useCircuitStore((state) => state.resetSimulation);
  const requestFit = useCircuitStore((state) => state.requestFit);
  const errors = warnings.filter((warning) => warning.level === 'error').length;

  return (
    <div className="inspector-content">
      <div className="inspector-empty-head">
        <span className="empty-orb">⌁</span>
        <h2>Nichts ausgewählt</h2>
        <p>Klicke ein Bauteil oder eine Leitung, um Details und Live-Werte zu sehen.</p>
      </div>

      <section className="inspector-section">
        <span className="field-label">Projekt</span>
        <div className="stat-grid">
          <div>
            <span>Bauteile</span>
            <strong>{circuit.parts.length}</strong>
          </div>
          <div>
            <span>Leitungen</span>
            <strong>{circuit.wires.length}</strong>
          </div>
          <div>
            <span>Fehler</span>
            <strong className={errors ? 'text-danger' : ''}>{errors}</strong>
          </div>
          <div>
            <span>Warnungen</span>
            <strong>{warnings.length - errors}</strong>
          </div>
        </div>
        <button className="btn ghost small full" onClick={requestFit}>
          <Icon name="fit" size={14} /> Ansicht einpassen
        </button>
      </section>

      <section className="inspector-section">
        <span className="field-label">Simulation</span>
        <div className={`sim-status-card ${simRunning ? 'running' : ''}`}>
          <div className="sim-status-line">
            <span className="status-dot" />
            <strong>{simRunning ? 'Simulation läuft' : 'Simulation bereit'}</strong>
          </div>
          <p>
            {circuit.parts.some((part) => part.kind === 'clock')
              ? 'Taktgeber vorhanden. Starte den Lauf oder schalte einzelne Flanken.'
              : 'Eingänge reagieren sofort. Für zeitgesteuerte Schaltungen einen Taktgeber hinzufügen.'}
          </p>
          <div className="inline-actions">
            <button className="btn primary small" onClick={() => setRunning(!simRunning)}>
              <Icon name={simRunning ? 'pause' : 'play'} size={13} />
              {simRunning ? 'Pause' : 'Start'}
            </button>
            <button className="btn ghost small" onClick={tickClock}>
              <Icon name="step" size={13} /> Takt
            </button>
            <button className="btn ghost small" onClick={resetSimulation}>
              <Icon name="reset" size={13} /> Reset
            </button>
          </div>
        </div>
      </section>

      <section className="inspector-section">
        <span className="field-label">Tastenkürzel</span>
        <div className="shortcut-list">
          <div><span>Taktschritt</span><kbd>T</kbd></div>
          <div><span>Start / Pause</span><kbd>Leertaste</kbd></div>
          <div><span>Löschen</span><kbd>Entf</kbd></div>
          <div><span>Rückgängig</span><kbd>Strg Z</kbd></div>
          <div><span>Einpassen</span><kbd>F</kbd></div>
        </div>
      </section>

      <div className="inspector-footer">
        <span>LogikSim</span>
        <span>SN74 · MVP</span>
      </div>
    </div>
  );
}

export function Inspector() {
  const selection = useCircuitStore((state) => state.selection);
  const circuit = useCircuitStore((state) => state.circuit);
  const pins = useCircuitStore((state) => state.pins);
  const selectedPart =
    selection?.type === 'part'
      ? circuit.parts.find((part) => part.id === selection.id)
      : undefined;

  return (
    <aside className="inspector" id="inspector-panel">
      <div className="panel-head">
        <span>Eigenschaften</span>
        <span className="panel-status">LIVE</span>
      </div>
      <div className="inspector-scroll">
        {selectedPart ? (
          <PartInspector part={selectedPart} pins={pins} />
        ) : selection?.type === 'wire' ? (
          <WireInspector wireId={selection.id} />
        ) : (
          <DefaultInspector />
        )}
      </div>
    </aside>
  );
}
