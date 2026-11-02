import type { PointerEvent, ReactElement } from 'react';
import type { Part, PartDef, PinDef, PinValues } from '../../engine/types';
import { aluOperationName, formatBinary, getPins, mask, pinKey } from '../../engine/parts';

export interface DraftInfo {
  partId: string;
  dir: 'in' | 'out';
  width: number;
}

interface PartViewProps {
  part: Part;
  def: PartDef;
  selected: boolean;
  values: PinValues;
  draft: DraftInfo | null;
  onPointerDown: (event: PointerEvent<SVGGElement>, part: Part) => void;
  onPinPointerDown: (event: PointerEvent<SVGGElement>, part: Part, pin: PinDef) => void;
  onToggle: (part: Part) => void;
}

interface PinViewProps {
  part: Part;
  pin: PinDef;
  value: number;
  draft: DraftInfo | null;
  onPinPointerDown: PartViewProps['onPinPointerDown'];
}

function PinView({ part, pin, value, draft, onPinPointerDown }: PinViewProps) {
  const compatible =
    !!draft &&
    draft.dir !== pin.dir &&
    draft.width === pin.width &&
    draft.partId !== part.id;
  const active = value !== 0;
  const bus = pin.width > 1;
  const direction = pin.dir;
  return (
    <g
      className={`pin ${direction} ${active ? (bus ? 'on-bus' : 'on') : 'off'} ${
        compatible ? 'compatible' : ''
      }`}
      onPointerDown={(event) => {
        event.stopPropagation();
        onPinPointerDown(event, part, pin);
      }}
    >
      <line
        className="pin-lead"
        x1={direction === 'in' ? 0 : pin.x - 8}
        y1={pin.y}
        x2={direction === 'in' ? 8 : pin.x}
        y2={pin.y}
      />
      <circle className="pin-hit" cx={pin.x} cy={pin.y} r={12.5} />
      <circle className="pin-dot" cx={pin.x} cy={pin.y} r={4.4} />
      {bus && (
        <text
          className="pin-width"
          x={direction === 'in' ? pin.x + 9 : pin.x - 9}
          y={pin.y - 7}
          textAnchor={direction === 'in' ? 'start' : 'end'}
        >
          {pin.width}
        </text>
      )}
      <title>
        {pin.name} · {pin.dir === 'in' ? 'Eingang' : 'Ausgang'} · {pin.width} Bit
      </title>
    </g>
  );
}

function GateShape({ kind }: { kind: Part['kind'] }) {
  const withBubble = kind === 'nand' || kind === 'nor';
  const isNot = kind === 'not';
  const isOrFamily = kind === 'or' || kind === 'nor' || kind === 'xor' || kind === 'xnor';
  const isXor = kind === 'xor' || kind === 'xnor';
  const bodyLeft = isXor ? 14 : 12;
  const paths: ReactElement[] = [];

  if (isNot) {
    paths.push(
      <path key="shape" className="gate-face" d="M12 8 L50 28 L12 48 Z" />,
      <line key="lead" className="gate-lead" x1="56" y1="28" x2="72" y2="28" />,
      <circle key="bubble" className="gate-bubble" cx="55.5" cy="28" r="5.5" />,
    );
  } else if (isOrFamily) {
    paths.push(
      <path
        key="shape"
        className="gate-face"
        d={`M${bodyLeft} 8 Q34 8 58 28 Q34 48 ${bodyLeft} 48 Q${bodyLeft + 12} 28 ${bodyLeft} 8 Z`}
      />,
      <line key="lead" className="gate-lead" x1="58" y1="28" x2="72" y2="28" />,
    );
    if (isXor) {
      paths.push(
        <path key="xor" className="gate-extra" d="M6 8 Q18 28 6 48" />,
      );
    }
    if (withBubble) {
      paths.push(<circle key="bubble" className="gate-bubble" cx="63.5" cy="28" r="5.5" />);
    }
  } else {
    paths.push(
      <path
        key="shape"
        className="gate-face"
        d={`M12 8 H36 A20 20 0 0 1 36 48 H12 Z`}
      />,
      <line key="lead" className="gate-lead" x1="56" y1="28" x2="72" y2="28" />,
    );
    if (withBubble) {
      paths.push(<circle key="bubble" className="gate-bubble" cx="61.5" cy="28" r="5.5" />);
    }
  }

  return (
    <g className="gate-shape">
      {paths}
      <text className="gate-symbol" x={isNot ? 29 : isOrFamily ? 32 : 34} y="32" textAnchor="middle">
        {kind === 'and' || kind === 'nand' ? '&' : kind === 'not' ? '1' : kind === 'or' || kind === 'nor' ? '≥1' : '=1'}
      </text>
    </g>
  );
}

function PartBody({
  part,
  values,
  onToggle,
}: {
  part: Part;
  values: PinValues;
  onToggle: (part: Part) => void;
}) {
  const bits = part.bits ?? 1;
  const outValue = values[pinKey(part.id, 'out')] ?? 0;
  const qValue = values[pinKey(part.id, 'q')] ?? 0;
  const busValue = mask(
    values[pinKey(part.id, 'out')] ?? values[pinKey(part.id, 'q')] ?? values[pinKey(part.id, 'in')] ?? 0,
    bits,
  );

  switch (part.kind) {
    case 'and':
    case 'or':
    case 'not':
    case 'nand':
    case 'nor':
    case 'xor':
    case 'xnor':
      return (
        <g>
          <line className="gate-lead" x1="0" y1="16" x2="12" y2="16" />
          {part.kind !== 'not' && (
            <line className="gate-lead" x1="0" y1="40" x2="12" y2="40" />
          )}
          {part.kind === 'not' && <line className="gate-lead" x1="0" y1="28" x2="12" y2="28" />}
          <GateShape kind={part.kind} />
        </g>
      );
    case 'input':
      return (
        <g>
          <rect className="part-body io-body input-body" x="4" y="8" width="88" height="40" rx="10" />
          <text className="micro-label" x="13" y="20">
            {bits === 1 ? '1 BIT' : `${bits} BIT`}
          </text>
          {bits === 1 ? (
            <text className="io-value" x="14" y="41">
              {outValue ? '1' : '0'}
            </text>
          ) : (
            <>
              <text className="io-bus-value" x="13" y="37">
                {formatBinary(busValue, bits)}
              </text>
              <text className="io-bus-decimal" x="13" y="45">
                = {busValue}
              </text>
            </>
          )}
          <g
            className="input-switch"
            onPointerDown={(event) => {
              event.stopPropagation();
              event.preventDefault();
              onToggle(part);
            }}
            onDoubleClick={(event) => event.stopPropagation()}
          >
            <rect className="switch-hit" x="54" y="16" width="36" height="24" rx="8" fill="transparent" />
            {bits === 1 ? (
              <>
                <rect
                  className={`switch-track ${outValue ? 'on' : ''}`}
                  x="60"
                  y="22"
                  width="24"
                  height="13"
                  rx="6.5"
                />
                <circle className={`switch-knob ${outValue ? 'on' : ''}`} cx={outValue ? 77 : 67} cy="28.5" r="4.5" />
              </>
            ) : (
              <>
                <rect className="mini-button" x="58" y="20" width="28" height="17" rx="5" />
                <text className="mini-button-text" x="72" y="32" textAnchor="middle">
                  +1
                </text>
              </>
            )}
          </g>
        </g>
      );
    case 'output':
      return (
        <g>
          <rect className="part-body io-body output-body" x="4" y="8" width="88" height="40" rx="10" />
          <circle className={`output-led ${qValue || busValue ? 'on' : ''}`} cx="22" cy="28" r="6.5" />
          {bits === 1 ? (
            <text className="io-value" x="36" y="41">
              {qValue || busValue ? '1' : '0'}
            </text>
          ) : (
            <>
              <text className="io-bus-value" x="36" y="34">
                {formatBinary(busValue, bits)}
              </text>
              <text className="io-bus-decimal" x="36" y="44">
                = {busValue}
              </text>
            </>
          )}
          <text className="micro-label" x="88" y="45" textAnchor="end">
            OUT
          </text>
        </g>
      );
    case 'const0':
    case 'const1':
      return (
        <g>
          <rect className="part-body const-body" x="8" y="8" width="56" height="32" rx="9" />
          <text className="const-value" x="36" y="32" textAnchor="middle">
            {part.kind === 'const1' ? '1' : '0'}
          </text>
          <line className="gate-lead" x1="64" y1="24" x2="72" y2="24" />
        </g>
      );
    case 'clock':
      return (
        <g>
          <rect className="part-body clock-body" x="4" y="8" width="88" height="40" rx="10" />
          <text className="micro-label" x="12" y="21">
            CLOCK
          </text>
          <path className="clock-wave" d="M13 35 H25 V22 H39 V35 H53 V22 H67 V35 H77" />
          <circle className={`clock-led ${outValue ? 'on' : ''}`} cx="83" cy="18" r="3" />
          <text className="clock-state" x="77" y="44" textAnchor="end">
            {outValue ? '1' : '0'}
          </text>
        </g>
      );
    case 'dff': {
      const q = values[pinKey(part.id, 'q')] ?? 0;
      const qn = values[pinKey(part.id, 'qn')] ?? 0;
      return (
        <g>
          <rect className="part-body seq-body" x="8" y="8" width="104" height="92" rx="10" />
          <text className="part-title" x="60" y="22" textAnchor="middle">
            D-FLIP-FLOP
          </text>
          <text className="pin-label" x="17" y="31">
            D
          </text>
          <text className="pin-label" x="17" y="59">
            CLK
          </text>
          <text className="pin-label" x="17" y="87">
            R
          </text>
          <path className="clock-notch" d="M10 50 L17 56 L10 62" />
          <text className="pin-label right" x="103" y="31" textAnchor="end">
            Q
          </text>
          <text className="pin-label right" x="103" y="79" textAnchor="end">
            Q̄
          </text>
          <rect className="value-chip" x="34" y="42" width="54" height="30" rx="7" />
          <text className="chip-value" x="61" y="62" textAnchor="middle">
            {q ? '1' : '0'}
          </text>
          <text className="micro-label" x="61" y="79" textAnchor="middle">
            Q / Q̄ {qn}
          </text>
          <line className="gate-lead" x1="112" y1="34" x2="120" y2="34" />
          <line className="gate-lead" x1="112" y1="74" x2="120" y2="74" />
        </g>
      );
    }
    case 'register4': {
      const q = values[pinKey(part.id, 'q')] ?? 0;
      return (
        <g>
          <rect className="part-body seq-body" x="8" y="8" width="164" height="136" rx="10" />
          <text className="part-title" x="90" y="22" textAnchor="middle">
            4-BIT-REGISTER
          </text>
          <text className="pin-label" x="17" y="33">
            D
          </text>
          <text className="pin-width-inline" x="27" y="33">
            4
          </text>
          <text className="pin-label" x="17" y="70">
            LOAD
          </text>
          <text className="pin-label" x="17" y="98">
            CLK
          </text>
          <text className="pin-label" x="17" y="126">
            CLR
          </text>
          <path className="clock-notch" d="M10 88 L17 94 L10 100" />
          <text className="pin-label right" x="163" y="52" textAnchor="end">
            Q
          </text>
          <text className="pin-width-inline" x="151" y="52" textAnchor="end">
            4
          </text>
          <rect className="value-chip wide" x="48" y="64" width="84" height="46" rx="8" />
          <text className="chip-value bus" x="90" y="87" textAnchor="middle">
            {formatBinary(q, 4)}
          </text>
          <text className="chip-decimal" x="90" y="102" textAnchor="middle">
            = {q}
          </text>
          <line className="gate-lead" x1="172" y1="48" x2="180" y2="48" />
        </g>
      );
    }
    case 'counter4': {
      const q = values[pinKey(part.id, 'q')] ?? 0;
      const tc = values[pinKey(part.id, 'tc')] ?? 0;
      return (
        <g>
          <rect className="part-body seq-body" x="8" y="8" width="160" height="128" rx="10" />
          <text className="part-title" x="88" y="24" textAnchor="middle">
            4-BIT-COUNTER
          </text>
          <text className="pin-label" x="18" y="36">
            CLK
          </text>
          <text className="pin-label" x="18" y="76">
            EN
          </text>
          <text className="pin-label" x="18" y="116">
            CLR
          </text>
          <path className="clock-notch" d="M10 26 L17 32 L10 38" />
          <text className="pin-label right" x="162" y="52" textAnchor="end">
            Q
          </text>
          <text className="pin-label right" x="162" y="108" textAnchor="end">
            TC={tc}
          </text>
          <rect className="value-chip wide" x="48" y="52" width="84" height="44" rx="8" />
          <text className="chip-value bus" x="90" y="73" textAnchor="middle">
            {formatBinary(q, 4)}
          </text>
          <text className="chip-decimal" x="90" y="88" textAnchor="middle">
            = {q}
          </text>
          <line className="gate-lead" x1="168" y1="48" x2="176" y2="48" />
          <line className="gate-lead" x1="168" y1="104" x2="176" y2="104" />
        </g>
      );
    }
    case 'inc4': {
      const s = values[pinKey(part.id, 's')] ?? 0;
      const cout = values[pinKey(part.id, 'cout')] ?? 0;
      return (
        <g>
          <rect className="part-body arith-body" x="8" y="8" width="132" height="92" rx="10" />
          <text className="part-title" x="74" y="22" textAnchor="middle">
            4-BIT-INCREMENTER
          </text>
          <text className="arith-symbol" x="74" y="56" textAnchor="middle">
            +1
          </text>
          <text className="micro-label" x="16" y="42">
            A
          </text>
          <text className="pin-width-inline" x="27" y="42">
            4
          </text>
          <text className="micro-label" x="132" y="42" textAnchor="end">
            S
          </text>
          <text className="pin-width-inline" x="115" y="42" textAnchor="end">
            4
          </text>
          <text className="micro-label" x="132" y="82" textAnchor="end">
            COUT
          </text>
          <text className="result-chip" x="74" y="84" textAnchor="middle">
            S={formatBinary(s, 4)} · C={cout}
          </text>
          <line className="gate-lead" x1="140" y1="38" x2="148" y2="38" />
          <line className="gate-lead" x1="140" y1="78" x2="148" y2="78" />
        </g>
      );
    }
    case 'mux2': {
      const select = values[pinKey(part.id, 's')] ?? 0;
      const y = values[pinKey(part.id, 'y')] ?? 0;
      return (
        <g>
          <path className="part-body arith-body" d="M8 8 H88 L120 34 V78 L88 104 H8 Z" />
          <text className="part-title" x="64" y="24" textAnchor="middle">
            2:1 MUX
          </text>
          <text className="micro-label" x="16" y="28">
            A
          </text>
          <text className="micro-label" x="16" y="68">
            B
          </text>
          <text className="micro-label" x="16" y="98">
            S
          </text>
          <text className="micro-label" x="70" y="52" textAnchor="middle">
            {select ? 'B' : 'A'} → Y
          </text>
          <text className="arith-symbol" x="70" y="82" textAnchor="middle">
            {y}
          </text>
          <line className="gate-lead" x1="120" y1="42" x2="136" y2="42" />
        </g>
      );
    }
    case 'mux4': {
      const select = values[pinKey(part.id, 's')] ?? 0;
      const y = values[pinKey(part.id, 'y')] ?? 0;
      return (
        <g>
          <rect className="part-body arith-body" x="8" y="8" width="140" height="120" rx="10" />
          <text className="part-title" x="78" y="24" textAnchor="middle">
            4-BIT MUX
          </text>
          <text className="micro-label" x="18" y="36">
            A
          </text>
          <text className="pin-width-inline" x="29" y="36">
            4
          </text>
          <text className="micro-label" x="18" y="76">
            B
          </text>
          <text className="pin-width-inline" x="29" y="76">
            4
          </text>
          <text className="micro-label" x="18" y="116">
            S
          </text>
          <text className="micro-label" x="132" y="116" textAnchor="end">
            S={select}
          </text>
          <text className="micro-label" x="132" y="56" textAnchor="end">
            Y
          </text>
          <text className="pin-width-inline" x="115" y="56" textAnchor="end">
            4
          </text>
          <rect className="value-chip wide" x="46" y="56" width="66" height="38" rx="8" />
          <text className="chip-value bus" x="79" y="74" textAnchor="middle">
            {formatBinary(y, 4)}
          </text>
          <text className="chip-decimal" x="79" y="88" textAnchor="middle">
            = {y}
          </text>
          <line className="gate-lead" x1="148" y1="52" x2="168" y2="52" />
        </g>
      );
    }
    case 'alu4': {
      const op = values[pinKey(part.id, 'op')] ?? 0;
      const y = values[pinKey(part.id, 'y')] ?? 0;
      const carry = values[pinKey(part.id, 'carry')] ?? 0;
      const zero = values[pinKey(part.id, 'zero')] ?? 0;
      return (
        <g>
          <rect className="part-body arith-body" x="8" y="8" width="184" height="152" rx="10" />
          <text className="part-title" x="100" y="24" textAnchor="middle">
            4-BIT ALU
          </text>
          <text className="micro-label" x="18" y="36">
            A
          </text>
          <text className="pin-width-inline" x="29" y="36">
            4
          </text>
          <text className="micro-label" x="18" y="76">
            B
          </text>
          <text className="pin-width-inline" x="29" y="76">
            4
          </text>
          <text className="micro-label" x="18" y="116">
            OP
          </text>
          <text className="pin-width-inline" x="40" y="116">
            4
          </text>
          <text className="micro-label" x="100" y="48" textAnchor="middle">
            {aluOperationName(op)}
          </text>
          <rect className="value-chip wide" x="52" y="62" width="96" height="42" rx="8" />
          <text className="chip-value bus" x="100" y="82" textAnchor="middle">
            {formatBinary(y, 4)}
          </text>
          <text className="chip-decimal" x="100" y="96" textAnchor="middle">
            = {y}
          </text>
          <text className="micro-label" x="184" y="100" textAnchor="end">
            C={carry}
          </text>
          <text className="micro-label" x="184" y="140" textAnchor="end">
            Z={zero}
          </text>
          <line className="gate-lead" x1="192" y1="48" x2="208" y2="48" />
          <line className="gate-lead" x1="192" y1="96" x2="208" y2="96" />
          <line className="gate-lead" x1="192" y1="136" x2="208" y2="136" />
        </g>
      );
    }
    case 'split4': {
      const input = values[pinKey(part.id, 'd')] ?? 0;
      return (
        <g>
          <rect className="part-body arith-body" x="8" y="8" width="132" height="144" rx="10" />
          <text className="part-title" x="74" y="24" textAnchor="middle">
            4-BIT-SPLITTER
          </text>
          <text className="pin-label" x="17" y="68">
            D
          </text>
          <text className="pin-width-inline" x="27" y="68">
            4
          </text>
          <text className="split-value" x="70" y="69" textAnchor="middle">
            {formatBinary(input, 4)}
          </text>
          {[0, 1, 2, 3].map((bit) => (
            <g key={bit}>
              <text className="split-label" x="128" y={30 + bit * 38} textAnchor="end">
                b{bit}
              </text>
              <text className="split-bit" x="98" y={30 + bit * 38} textAnchor="end">
                {(input >> bit) & 1}
              </text>
              <line
                className="gate-lead"
                x1="140"
                y1={26 + bit * 38}
                x2="148"
                y2={26 + bit * 38}
              />
            </g>
          ))}
        </g>
      );
    }
    case 'merge4': {
      const merged =
        (values[pinKey(part.id, 'b0')] ?? 0) |
        ((values[pinKey(part.id, 'b1')] ?? 0) << 1) |
        ((values[pinKey(part.id, 'b2')] ?? 0) << 2) |
        ((values[pinKey(part.id, 'b3')] ?? 0) << 3);
      return (
        <g>
          <rect className="part-body arith-body" x="8" y="8" width="132" height="144" rx="10" />
          <text className="part-title" x="74" y="24" textAnchor="middle">
            4-BIT-MERGER
          </text>
          {[0, 1, 2, 3].map((bit) => (
            <g key={bit}>
              <text className="split-label" x="18" y={30 + bit * 38}>
                b{bit} = {values[pinKey(part.id, `b${bit}`)] ?? 0}
              </text>
              <line
                className="gate-lead"
                x1="0"
                y1={26 + bit * 38}
                x2="8"
                y2={26 + bit * 38}
              />
            </g>
          ))}
          <text className="pin-label right" x="128" y="80" textAnchor="end">
            Q
          </text>
          <text className="split-value" x="78" y="104" textAnchor="middle">
            {formatBinary(merged, 4)}
          </text>
          <line className="gate-lead" x1="140" y1="76" x2="148" y2="76" />
        </g>
      );
    }
    default:
      return null;
  }
}

export function PartView({
  part,
  def,
  selected,
  values,
  draft,
  onPointerDown,
  onPinPointerDown,
  onToggle,
}: PartViewProps) {
  const pins = getPins(part);
  return (
    <g
      className={`part part-${part.kind} ${selected ? 'selected' : ''}`}
      transform={`translate(${part.x} ${part.y})`}
      onPointerDown={(event) => onPointerDown(event, part)}
      onDoubleClick={(event) => {
        event.stopPropagation();
        if (part.kind === 'input' || part.kind === 'clock') onToggle(part);
      }}
    >
      <title>
        {def.name}
        {part.label ? ` · ${part.label}` : ''}
      </title>
      {selected && (
        <rect
          className="selection-ring"
          x="-5"
          y="-17"
          width={def.width + 10}
          height={def.height + 27}
          rx="12"
        />
      )}
      {part.label && (
        <text className="part-user-label" x="4" y="-7">
          {part.label}
        </text>
      )}
      <PartBody part={part} values={values} onToggle={onToggle} />
      {pins.map((pin) => (
        <PinView
          key={pin.id}
          part={part}
          pin={pin}
          value={values[pinKey(part.id, pin.id)] ?? 0}
          draft={draft}
          onPinPointerDown={onPinPointerDown}
        />
      ))}
    </g>
  );
}
