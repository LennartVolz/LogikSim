import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  PART_LIST,
} from '../engine/parts';
import type { PartCategory, PartDef, PartKind } from '../engine/types';
import { dispatchPaletteDrop, isPointOverCanvas } from '../lib/paletteDrop';
import { useCircuitStore } from '../store/useCircuitStore';

interface PaletteProps {
  onPick?: () => void;
}

interface TouchDrag {
  def: PartDef;
  pointerId: number;
  clientX: number;
  clientY: number;
  startX: number;
  startY: number;
  moved: boolean;
}

export function Palette({ onPick }: PaletteProps) {
  const pendingKind = useCircuitStore((state) => state.pendingKind);
  const setPendingKind = useCircuitStore((state) => state.setPendingKind);
  const setBottomTab = useCircuitStore((state) => state.setBottomTab);
  const [query, setQuery] = useState('');
  const [touchDrag, setTouchDrag] = useState<TouchDrag | null>(null);
  const touchDragRef = useRef<TouchDrag | null>(null);
  const onPickRef = useRef(onPick);
  const suppressHandleClickRef = useRef(false);
  const suppressTimerRef = useRef<number | null>(null);

  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);

  useEffect(
    () => () => {
      if (suppressTimerRef.current !== null) window.clearTimeout(suppressTimerRef.current);
    },
    [],
  );

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

  const suppressHandleClick = () => {
    suppressHandleClickRef.current = true;
    if (suppressTimerRef.current !== null) window.clearTimeout(suppressTimerRef.current);
    suppressTimerRef.current = window.setTimeout(() => {
      suppressHandleClickRef.current = false;
      suppressTimerRef.current = null;
    }, 600);
  };

  const startTouchDrag = (event: ReactPointerEvent<HTMLSpanElement>, def: PartDef) => {
    if (event.pointerType === 'mouse' || event.button !== 0) return;
    if (touchDragRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const drag: TouchDrag = {
      def,
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
    touchDragRef.current = drag;
    setTouchDrag(drag);
  };

  useEffect(() => {
    if (!touchDrag) return;
    const activePointerId = touchDrag.pointerId;

    const clearDrag = () => {
      touchDragRef.current = null;
      setTouchDrag(null);
    };

    const finish = (cancelled: boolean) => {
      const current = touchDragRef.current;
      if (!current || current.pointerId !== activePointerId) return;
      suppressHandleClick();
      clearDrag();
      if (cancelled) return;

      if (current.moved) {
        if (isPointOverCanvas(current.clientX, current.clientY)) {
          dispatchPaletteDrop({
            kind: current.def.kind,
            clientX: current.clientX,
            clientY: current.clientY,
          });
          onPickRef.current?.();
        }
        return;
      }

      const state = useCircuitStore.getState();
      state.setPendingKind(
        state.pendingKind === current.def.kind ? null : (current.def.kind as PartKind),
      );
      onPickRef.current?.();
    };

    const handleMove = (event: PointerEvent) => {
      const current = touchDragRef.current;
      if (!current || event.pointerId !== activePointerId) return;
      event.preventDefault();
      const moved =
        current.moved ||
        Math.hypot(event.clientX - current.startX, event.clientY - current.startY) > 8;
      const next: TouchDrag = {
        ...current,
        clientX: event.clientX,
        clientY: event.clientY,
        moved,
      };
      touchDragRef.current = next;
      setTouchDrag(next);
      if (!current.moved && moved) onPickRef.current?.();
    };

    const handleUp = (event: PointerEvent) => {
      if (event.pointerId !== activePointerId) return;
      event.preventDefault();
      finish(false);
    };

    const handleCancel = (event: PointerEvent) => {
      if (event.pointerId !== activePointerId) return;
      finish(true);
    };

    window.addEventListener('pointermove', handleMove, { passive: false });
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleCancel);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleCancel);
    };
  }, [touchDrag?.pointerId]);

  return (
    <aside className="palette" id="palette-panel">
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
                    onClick={(event) => {
                      if (
                        suppressHandleClickRef.current &&
                        event.target instanceof Element &&
                        event.target.closest('.drag-handle')
                      ) {
                        suppressHandleClickRef.current = false;
                        return;
                      }
                      setPendingKind(
                        pendingKind === def.kind ? null : (def.kind as PartKind),
                      );
                      onPick?.();
                    }}
                    title={`${def.name} – ${def.description}. Auf Touch-Geräten am Griff ziehen.`}
                  >
                    <span className={`palette-symbol cat-${def.category}`}>{def.symbol}</span>
                    <span className="palette-name">{def.name}</span>
                    <span
                      className="drag-handle"
                      title="Ziehen"
                      aria-hidden="true"
                      draggable={false}
                      onPointerDown={(event) => startTouchDrag(event, def)}
                      onDragStart={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                      }}
                    >
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

      {touchDrag?.moved &&
        createPortal(
          <div
            className="touch-drag-ghost"
            style={{ left: touchDrag.clientX, top: touchDrag.clientY }}
            aria-hidden="true"
          >
            <span className={`palette-symbol cat-${touchDrag.def.category}`}>
              {touchDrag.def.symbol}
            </span>
            <span>{touchDrag.def.name}</span>
          </div>,
          document.body,
        )}
    </aside>
  );
}
