import { useCallback, useEffect, useRef, useState } from 'react';
import type { DragEvent, PointerEvent } from 'react';
import type { Part, PinDef, Viewport, Wire } from '../../engine/types';
import { PART_DEFS, getPin, pinPos } from '../../engine/parts';
import { useCircuitStore } from '../../store/useCircuitStore';
import { GRID_SIZE, MAX_ZOOM, MIN_ZOOM } from '../../editor/constants';
import { roundedPath, wireRoute } from '../../lib/wireRouting';
import type { Point } from '../../lib/wireRouting';
import { PartView } from './PartView';
import type { DraftInfo } from './PartView';
import { WireView } from './WireView';

interface Draft {
  fromPart: Part;
  fromPin: PinDef;
  cursor: Point;
}

type DragState =
  | {
      mode: 'part';
      pointerId: number;
      partId: string;
      startClient: Point;
      startWorld: Point;
      origin: Point;
      moved: boolean;
    }
  | {
      mode: 'pan';
      pointerId: number;
      startClient: Point;
      viewport: Viewport;
    }
  | null;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function snap(value: number): number {
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

export function CircuitCanvas() {
  const circuit = useCircuitStore((state) => state.circuit);
  const pins = useCircuitStore((state) => state.pins);
  const viewport = useCircuitStore((state) => state.viewport);
  const selection = useCircuitStore((state) => state.selection);
  const pendingKind = useCircuitStore((state) => state.pendingKind);
  const fitSignal = useCircuitStore((state) => state.fitSignal);
  const setViewport = useCircuitStore((state) => state.setViewport);
  const select = useCircuitStore((state) => state.select);
  const setPendingKind = useCircuitStore((state) => state.setPendingKind);
  const placePart = useCircuitStore((state) => state.placePart);
  const movePart = useCircuitStore((state) => state.movePart);
  const beginDragSnapshot = useCircuitStore((state) => state.beginDragSnapshot);
  const addWire = useCircuitStore((state) => state.addWire);
  const toggleInput = useCircuitStore((state) => state.toggleInput);
  const tickClock = useCircuitStore((state) => state.tickClock);
  const notify = useCircuitStore((state) => state.notify);
  const loadExample = useCircuitStore((state) => state.loadExample);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<DragState>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [panning, setPanning] = useState(false);
  const [ghost, setGhost] = useState<Point | null>(null);

  const worldPoint = useCallback((clientX: number, clientY: number): Point => {
    const svg = svgRef.current;
    const vp = useCircuitStore.getState().viewport;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: (clientX - rect.left - vp.x) / vp.zoom,
      y: (clientY - rect.top - vp.y) / vp.zoom,
    };
  }, []);

  const fitToCircuit = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const parts = useCircuitStore.getState().circuit.parts;
    if (rect.width < 10 || rect.height < 10) return;
    if (parts.length === 0) {
      setViewport({ x: rect.width / 2, y: rect.height / 2, zoom: 1 });
      return;
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const part of parts) {
      const def = PART_DEFS[part.kind];
      if (!def) continue;
      minX = Math.min(minX, part.x);
      minY = Math.min(minY, part.y);
      maxX = Math.max(maxX, part.x + def.width);
      maxY = Math.max(maxY, part.y + def.height);
    }
    const padding = 70;
    const width = Math.max(1, maxX - minX + padding * 2);
    const height = Math.max(1, maxY - minY + padding * 2);
    const zoom = clamp(Math.min((rect.width - 60) / width, (rect.height - 60) / height), MIN_ZOOM, 1.25);
    setViewport({
      x: (rect.width - width * zoom) / 2 - (minX - padding) * zoom,
      y: (rect.height - height * zoom) / 2 - (minY - padding) * zoom,
      zoom,
    });
  }, [setViewport]);

  useEffect(() => {
    const frame = requestAnimationFrame(fitToCircuit);
    return () => cancelAnimationFrame(frame);
  }, [fitSignal, fitToCircuit]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = svg.getBoundingClientRect();
      const pointerX = event.clientX - rect.left;
      const pointerY = event.clientY - rect.top;
      const current = useCircuitStore.getState().viewport;
      const factor = Math.exp(-event.deltaY * 0.0014);
      const zoom = clamp(current.zoom * factor, MIN_ZOOM, MAX_ZOOM);
      const worldX = (pointerX - current.x) / current.zoom;
      const worldY = (pointerY - current.y) / current.zoom;
      setViewport({
        x: pointerX - worldX * zoom,
        y: pointerY - worldY * zoom,
        zoom,
      });
    };
    svg.addEventListener('wheel', handleWheel, { passive: false });
    return () => svg.removeEventListener('wheel', handleWheel);
  }, [setViewport]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setDraft(null);
      setPendingKind(null);
      setGhost(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setPendingKind]);

  const handleBackgroundPointerDown = (event: PointerEvent<SVGRectElement>) => {
    if (event.button !== 0) return;
    const world = worldPoint(event.clientX, event.clientY);
    if (pendingKind) {
      const def = PART_DEFS[pendingKind];
      placePart(pendingKind, world.x - def.width / 2, world.y - def.height / 2);
      setGhost(null);
      return;
    }
    setDraft(null);
    select(null);
    const svg = svgRef.current;
    if (!svg) return;
    dragRef.current = {
      mode: 'pan',
      pointerId: event.pointerId,
      startClient: { x: event.clientX, y: event.clientY },
      viewport,
    };
    setPanning(true);
    svg.setPointerCapture(event.pointerId);
  };

  const handlePartPointerDown = (event: PointerEvent<SVGGElement>, part: Part) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    setDraft(null);
    select({ type: 'part', id: part.id });
    const svg = svgRef.current;
    const world = worldPoint(event.clientX, event.clientY);
    dragRef.current = {
      mode: 'part',
      pointerId: event.pointerId,
      partId: part.id,
      startClient: { x: event.clientX, y: event.clientY },
      startWorld: world,
      origin: { x: part.x, y: part.y },
      moved: false,
    };
    svg?.setPointerCapture(event.pointerId);
  };

  const handlePinPointerDown = (
    event: PointerEvent<SVGGElement>,
    part: Part,
    pin: PinDef,
  ) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    const world = worldPoint(event.clientX, event.clientY);

    if (!draft) {
      setDraft({ fromPart: part, fromPin: pin, cursor: world });
      return;
    }

    if (draft.fromPart.id === part.id && draft.fromPin.id === pin.id) {
      setDraft(null);
      return;
    }

    let source: { part: Part; pin: PinDef } | null = null;
    let target: { part: Part; pin: PinDef } | null = null;
    if (draft.fromPin.dir === 'out' && pin.dir === 'in') {
      source = { part: draft.fromPart, pin: draft.fromPin };
      target = { part, pin };
    } else if (draft.fromPin.dir === 'in' && pin.dir === 'out') {
      source = { part, pin };
      target = { part: draft.fromPart, pin: draft.fromPin };
    }

    if (!source || !target) {
      notify('Verbinde einen Ausgang mit einem Eingang.', 'error');
      return;
    }

    const success = addWire(
      { partId: source.part.id, pin: source.pin.id },
      { partId: target.part.id, pin: target.pin.id },
    );
    if (success) setDraft(null);
  };

  const handleWirePointerDown = (event: PointerEvent<SVGGElement>, wire: Wire) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    select({ type: 'wire', id: wire.id });
  };

  const handleToggle = (part: Part) => {
    if (part.kind === 'clock') tickClock();
    else if (part.kind === 'input') toggleInput(part.id);
  };

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (draft) {
      setDraft({ ...draft, cursor: worldPoint(event.clientX, event.clientY) });
    }
    if (pendingKind) {
      setGhost(worldPoint(event.clientX, event.clientY));
    }
    if (!drag) return;

    if (drag.mode === 'pan') {
      setViewport({
        x: drag.viewport.x + (event.clientX - drag.startClient.x),
        y: drag.viewport.y + (event.clientY - drag.startClient.y),
        zoom: drag.viewport.zoom,
      });
      return;
    }

    const distance = Math.hypot(
      event.clientX - drag.startClient.x,
      event.clientY - drag.startClient.y,
    );
    if (!drag.moved && distance < 3) return;
    if (!drag.moved) {
      drag.moved = true;
      beginDragSnapshot();
    }
    const world = worldPoint(event.clientX, event.clientY);
    movePart(
      drag.partId,
      drag.origin.x + (world.x - drag.startWorld.x),
      drag.origin.y + (world.y - drag.startWorld.y),
    );
  };

  const endDrag = (event: PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (drag && svgRef.current?.hasPointerCapture(event.pointerId)) {
      svgRef.current.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
    setPanning(false);
  };

  const handleDrop = (event: DragEvent<SVGSVGElement>) => {
    event.preventDefault();
    const kind = event.dataTransfer.getData('application/x-logiksim-part') as keyof typeof PART_DEFS;
    if (!kind || !Object.hasOwn(PART_DEFS, kind)) return;
    const def = PART_DEFS[kind];
    const world = worldPoint(event.clientX, event.clientY);
    placePart(kind, world.x - def.width / 2, world.y - def.height / 2);
    setGhost(null);
  };

  const zoomBy = (factor: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const worldX = (centerX - viewport.x) / viewport.zoom;
    const worldY = (centerY - viewport.y) / viewport.zoom;
    const zoom = clamp(viewport.zoom * factor, MIN_ZOOM, MAX_ZOOM);
    setViewport({
      x: centerX - worldX * zoom,
      y: centerY - worldY * zoom,
      zoom,
    });
  };

  const draftPart = draft
    ? circuit.parts.find((part) => part.id === draft.fromPart.id) ?? null
    : null;
  const draftPin = draft && draftPart ? getPin(draftPart, draft.fromPin.id) ?? null : null;
  let draftPath = '';
  if (draft && draftPart && draftPin) {
    const start = pinPos(draftPart, draftPin);
    const points =
      draftPin.dir === 'out' ? wireRoute(start, draft.cursor) : wireRoute(draft.cursor, start);
    draftPath = roundedPath(points);
  }
  const draftInfo: DraftInfo | null = draft
    ? { partId: draft.fromPart.id, dir: draft.fromPin.dir, width: draft.fromPin.width }
    : null;
  const pendingDef = pendingKind ? PART_DEFS[pendingKind] : null;

  return (
    <div className="canvas-wrap">
      <svg
        ref={svgRef}
        className={`canvas-svg ${panning ? 'panning' : ''}`}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={() => setGhost(null)}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        <defs>
          <pattern id="grid-minor" width={GRID_SIZE} height={GRID_SIZE} patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.9" className="grid-dot" />
          </pattern>
          <pattern id="grid-major" width={GRID_SIZE * 5} height={GRID_SIZE * 5} patternUnits="userSpaceOnUse">
            <path
              d={`M ${GRID_SIZE * 5} 0 H 0 V ${GRID_SIZE * 5}`}
              className="grid-major-line"
              fill="none"
            />
          </pattern>
        </defs>
        <g transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.zoom})`}>
          <rect
            className="canvas-bg"
            x="-20000"
            y="-20000"
            width="40000"
            height="40000"
            fill="url(#grid-minor)"
            onPointerDown={handleBackgroundPointerDown}
          />
          <rect
            className="canvas-major"
            x="-20000"
            y="-20000"
            width="40000"
            height="40000"
            fill="url(#grid-major)"
            pointerEvents="none"
          />

          {circuit.wires.map((wire) => {
            const fromPart = circuit.parts.find((part) => part.id === wire.from.partId);
            const toPart = circuit.parts.find((part) => part.id === wire.to.partId);
            if (!fromPart || !toPart) return null;
            const fromPin = getPin(fromPart, wire.from.pin);
            const toPin = getPin(toPart, wire.to.pin);
            if (!fromPin || !toPin) return null;
            return (
              <WireView
                key={wire.id}
                wire={wire}
                from={pinPos(fromPart, fromPin)}
                to={pinPos(toPart, toPin)}
                width={fromPin.width}
                values={pins}
                selected={selection?.type === 'wire' && selection.id === wire.id}
                onPointerDown={handleWirePointerDown}
              />
            );
          })}

          {draft && draftPath && (
            <g className="wire-draft-group">
              <path className="wire draft" d={draftPath} />
              <circle className="draft-cursor" cx={draft.cursor.x} cy={draft.cursor.y} r="4" />
            </g>
          )}

          {circuit.parts.map((part) => (
            <PartView
              key={part.id}
              part={part}
              def={PART_DEFS[part.kind]}
              selected={selection?.type === 'part' && selection.id === part.id}
              values={pins}
              draft={draftInfo}
              onPointerDown={handlePartPointerDown}
              onPinPointerDown={handlePinPointerDown}
              onToggle={handleToggle}
            />
          ))}

          {pendingDef && ghost && (
            <g
              className="placement-ghost"
              transform={`translate(${snap(ghost.x - pendingDef.width / 2)} ${snap(
                ghost.y - pendingDef.height / 2,
              )})`}
              pointerEvents="none"
            >
              <rect width={pendingDef.width} height={pendingDef.height} rx="10" />
              <text x={pendingDef.width / 2} y={pendingDef.height / 2 + 4} textAnchor="middle">
                {pendingDef.name}
              </text>
            </g>
          )}
        </g>
      </svg>

      <div className="canvas-topline">
        <span className="canvas-chip">
          <span className="status-dot" /> Schaltbild
        </span>
        {pendingKind && pendingDef && (
          <button
            className="placement-hint"
            onClick={() => {
              setPendingKind(null);
              setGhost(null);
            }}
          >
            {pendingDef.name} platzieren · Klick in den Editor <span>Esc</span>
          </button>
        )}
      </div>

      {circuit.parts.length === 0 && (
        <div className="canvas-empty">
          <div className="canvas-empty-icon">
            <svg viewBox="0 0 64 64" width="48" height="48" aria-hidden>
              <path
                d="M10 16 H30 A16 16 0 0 1 30 48 H10 Z M10 24 H20 M10 40 H20 M46 32 H58"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <h2>Noch keine Schaltung</h2>
          <p>Bauteile links auswählen und hier platzieren – oder mit einem Beispiel starten.</p>
          <div className="canvas-empty-actions">
            <button className="btn primary small" onClick={() => loadExample('half-adder')}>
              Halbaddierer laden
            </button>
            <button className="btn ghost small" onClick={() => setPendingKind('and')}>
              AND platzieren
            </button>
          </div>
        </div>
      )}

      <div className="canvas-hint">
        <span><b>Ziehen</b> verschieben</span>
        <span><b>Anschluss</b> Leitung</span>
        <span><b>Entf</b> löschen</span>
        <span><b>Scrollen</b> zoomen</span>
      </div>

      <div className="zoom-controls">
        <button className="icon-btn" title="Verkleinern" onClick={() => zoomBy(1 / 1.2)}>
          −
        </button>
        <button className="zoom-value" title="Ansicht einpassen" onClick={fitToCircuit}>
          {Math.round(viewport.zoom * 100)}%
        </button>
        <button className="icon-btn" title="Vergrößern" onClick={() => zoomBy(1.2)}>
          +
        </button>
        <button className="icon-btn fit" title="Alles einpassen" onClick={fitToCircuit}>
          ⤢
        </button>
      </div>
    </div>
  );
}
