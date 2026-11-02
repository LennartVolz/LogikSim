import type { PointerEvent } from 'react';
import type { PinValues, Wire } from '../../engine/types';
import { formatBinary, pinKey } from '../../engine/parts';
import { roundedPath, wireMidpoint, wireRoute } from '../../lib/wireRouting';
import type { Point } from '../../lib/wireRouting';

interface WireViewProps {
  wire: Wire;
  from: Point;
  to: Point;
  width: number;
  values: PinValues;
  selected: boolean;
  onPointerDown: (event: PointerEvent<SVGGElement>, wire: Wire) => void;
}

export function WireView({
  wire,
  from,
  to,
  width,
  values,
  selected,
  onPointerDown,
}: WireViewProps) {
  const value = values[pinKey(wire.from.partId, wire.from.pin)] ?? 0;
  const points = wireRoute(from, to);
  const path = roundedPath(points);
  const active = value !== 0;
  const bus = width > 1;
  const midpoint = wireMidpoint(points);
  const busLabel = formatBinary(value, width);
  const stateClass = bus ? (active ? 'bus-active' : 'bus-zero') : active ? 'active' : 'zero';

  return (
    <g
      className={`wire-group ${stateClass} ${selected ? 'selected' : ''}`}
      onPointerDown={(event) => {
        event.stopPropagation();
        onPointerDown(event, wire);
      }}
    >
      <path className="wire-hit" d={path} />
      <path className={`wire ${stateClass}`} d={path} />
      {bus && (
        <g className="wire-bus-label" transform={`translate(${midpoint.x} ${midpoint.y - 11})`}>
          <rect x={-(busLabel.length * 6.2 + 12) / 2} y="-11" width={busLabel.length * 6.2 + 12} height="17" rx="5" />
          <text x="0" y="1.5" textAnchor="middle">
            {busLabel}
          </text>
        </g>
      )}
      <title>
        {selected ? 'Leitung ausgewählt' : `Leitung · ${width} Bit · Wert ${value}`}
      </title>
    </g>
  );
}
