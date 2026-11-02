import { useMemo, useState } from 'react';
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  PART_LIST,
} from '../engine/parts';
import type { PartCategory, PartKind } from '../engine/types';
import { useCircuitStore } from '../store/useCircuitStore';

export function Palette() {
  const pendingKind = useCircuitStore((state) => state.pendingKind);
  const setPendingKind = useCircuitStore((state) => state.setPendingKind);
  const setBottomTab = useCircuitStore((state) => state.setBottomTab);
  const [query, setQuery] = useState('');

  const grouped = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const result: Record<PartCategory, typeof PART_LIST> = {
      gates: [],
      io: [],
      sequential: [],
      arithmetic: [],
    };
    for (const def of PART_LIST) {
      if (
        normalized &&
        !`${def.name} ${def.description} ${def.symbol}`.toLowerCase().includes(normalized)
      ) {
        continue;
      }
      result[def.category].push(def);
    }
    return result;
  }, [query]);

  return (
    <aside className="palette">
      <div className="panel-head palette-head">
        <span>Bauteile</span>
        <span className="count-badge">{PART_LIST.length}</span>
      </div>
      <div className="palette-search">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Bauteile filtern …"
          aria-label="Bauteile filtern"
          spellCheck={false}
        />
        {query && (
          <button className="search-clear" onClick={() => setQuery('')} title="Suche löschen">
            ×
          </button>
        )}
      </div>

      <div className="palette-scroll">
        {CATEGORY_ORDER.map((category) => {
          const items = grouped[category];
          if (items.length === 0) return null;
          return (
            <section className="palette-section" key={category}>
              <h3>
                {CATEGORY_LABELS[category]}
                <span>{items.length}</span>
              </h3>
              <div className="palette-items">
                {items.map((def) => (
                  <button
                    key={def.kind}
                    className={`palette-item ${pendingKind === def.kind ? 'active' : ''}`}
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData('application/x-logiksim-part', def.kind);
                      event.dataTransfer.effectAllowed = 'copy';
                      setPendingKind(null);
                    }}
                    onClick={() => {
                      setPendingKind(pendingKind === def.kind ? null : (def.kind as PartKind));
                    }}
                    title={`${def.name} – ${def.description}`}
                  >
                    <span className={`palette-symbol cat-${def.category}`}>{def.symbol}</span>
                    <span className="palette-name">{def.name}</span>
                    <span className="drag-dots" aria-hidden>
                      ⠿
                    </span>
                  </button>
                ))}
              </div>
            </section>
          );
        })}
        {Object.values(grouped).every((items) => items.length === 0) && (
          <div className="palette-empty">Kein Bauteil passt zu „{query}“.</div>
        )}
      </div>

      <div className="palette-footer">
        <div className="palette-tip">
          <span className="tip-icon">i</span>
          <p>
            Bauteil ziehen oder anklicken und im Editor platzieren. Anschlüsse verbindest du per
            Klick.
          </p>
        </div>
        <button className="learn-cta" onClick={() => setBottomTab('learn')}>
          <span className="learn-cta-icon">◎</span>
          <span>
            <strong>Lernmodus</strong>
            <small>Aufgaben selbst aufbauen</small>
          </span>
          <span className="learn-arrow">→</span>
        </button>
      </div>
    </aside>
  );
}
