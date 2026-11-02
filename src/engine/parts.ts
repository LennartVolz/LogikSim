import type { Part, PartCategory, PartDef, PartKind, PinDef } from './types';

const GATE_WIDTH = 72;
const GATE_HEIGHT = 56;

function gatePins(twoInputs: boolean): PinDef[] {
  return twoInputs
    ? [
        { id: 'in1', name: 'A', dir: 'in', x: 0, y: 16, width: 1 },
        { id: 'in2', name: 'B', dir: 'in', x: 0, y: 40, width: 1 },
        { id: 'out', name: 'Y', dir: 'out', x: GATE_WIDTH, y: 28, width: 1 },
      ]
    : [{ id: 'in', name: 'A', dir: 'in', x: 0, y: 28, width: 1 }, { id: 'out', name: 'Y', dir: 'out', x: GATE_WIDTH, y: 28, width: 1 }];
}

const defs: PartDef[] = [
  {
    kind: 'and',
    name: 'AND-Gatter',
    symbol: '&',
    category: 'gates',
    description: 'Der Ausgang ist 1, wenn beide Eingänge 1 sind.',
    width: GATE_WIDTH,
    height: GATE_HEIGHT,
    pins: gatePins(true),
  },
  {
    kind: 'or',
    name: 'OR-Gatter',
    symbol: '≥1',
    category: 'gates',
    description: 'Der Ausgang ist 1, wenn mindestens ein Eingang 1 ist.',
    width: GATE_WIDTH,
    height: GATE_HEIGHT,
    pins: gatePins(true),
  },
  {
    kind: 'not',
    name: 'NOT-Gatter',
    symbol: '¬',
    category: 'gates',
    description: 'Invertiert den Eingang.',
    width: GATE_WIDTH,
    height: GATE_HEIGHT,
    pins: gatePins(false),
  },
  {
    kind: 'nand',
    name: 'NAND-Gatter',
    symbol: '⊼',
    category: 'gates',
    description: 'Negiertes AND – Ausgang 1, außer bei zwei Einsen.',
    width: GATE_WIDTH,
    height: GATE_HEIGHT,
    pins: gatePins(true),
  },
  {
    kind: 'nor',
    name: 'NOR-Gatter',
    symbol: '⊽',
    category: 'gates',
    description: 'Negiertes OR – Ausgang nur bei zwei Nullen 1.',
    width: GATE_WIDTH,
    height: GATE_HEIGHT,
    pins: gatePins(true),
  },
  {
    kind: 'xor',
    name: 'XOR-Gatter',
    symbol: '=1',
    category: 'gates',
    description: 'Antivalenz – Ausgang 1, wenn die Eingänge verschieden sind.',
    width: GATE_WIDTH,
    height: GATE_HEIGHT,
    pins: gatePins(true),
  },
  {
    kind: 'xnor',
    name: 'XNOR-Gatter',
    symbol: '=',
    category: 'gates',
    description: 'Äquivalenz – Ausgang 1, wenn beide Eingänge gleich sind.',
    width: GATE_WIDTH,
    height: GATE_HEIGHT,
    pins: gatePins(true),
  },
  {
    kind: 'input',
    name: 'Eingang',
    symbol: '0/1',
    category: 'io',
    description: 'Manuell schaltbarer Eingang. Als Bus mit 1, 4 oder 8 Bit konfigurierbar.',
    width: 96,
    height: 56,
    pins: [{ id: 'out', name: 'Q', dir: 'out', x: 96, y: 28, width: 1 }],
  },
  {
    kind: 'output',
    name: 'Ausgang',
    symbol: '◉',
    category: 'io',
    description: 'Anzeige für ein Signal oder einen Bus. Eignet sich als Messpunkt.',
    width: 96,
    height: 56,
    pins: [{ id: 'in', name: 'D', dir: 'in', x: 0, y: 28, width: 1 }],
  },
  {
    kind: 'const0',
    name: 'Konstante 0',
    symbol: '0',
    category: 'io',
    description: 'Liefert dauerhaft das Signal 0.',
    width: 72,
    height: 48,
    pins: [{ id: 'out', name: 'Q', dir: 'out', x: 72, y: 24, width: 1 }],
  },
  {
    kind: 'const1',
    name: 'Konstante 1',
    symbol: '1',
    category: 'io',
    description: 'Liefert dauerhaft das Signal 1.',
    width: 72,
    height: 48,
    pins: [{ id: 'out', name: 'Q', dir: 'out', x: 72, y: 24, width: 1 }],
  },
  {
    kind: 'clock',
    name: 'Taktgeber',
    symbol: '⎍',
    category: 'io',
    description: 'Erzeugt eine Taktflanke pro manuellem Schritt. Bei laufender Simulation schaltet er automatisch.',
    width: 96,
    height: 56,
    pins: [{ id: 'out', name: 'CLK', dir: 'out', x: 96, y: 28, width: 1 }],
  },
  {
    kind: 'dff',
    name: 'D-Flip-Flop',
    symbol: 'DFF',
    category: 'sequential',
    description: 'Übernimmt D bei einer steigenden Taktflanke. R setzt asynchron auf 0 zurück.',
    width: 120,
    height: 108,
    pins: [
      { id: 'd', name: 'D', dir: 'in', x: 0, y: 28, width: 1 },
      { id: 'clk', name: 'CLK', dir: 'in', x: 0, y: 56, width: 1 },
      { id: 'r', name: 'R', dir: 'in', x: 0, y: 84, width: 1, optional: true },
      { id: 'q', name: 'Q', dir: 'out', x: 120, y: 34, width: 1 },
      { id: 'qn', name: 'Q\u0305', dir: 'out', x: 120, y: 74, width: 1 },
    ],
  },
  {
    kind: 'register4',
    name: '4-Bit-Register',
    symbol: 'REG',
    category: 'sequential',
    description: 'Lädt einen 4-Bit-Wert bei steigender Taktflanke, wenn LOAD aktiv ist. CLR setzt asynchron zurück.',
    width: 180,
    height: 152,
    pins: [
      { id: 'd', name: 'D', dir: 'in', x: 0, y: 30, width: 4 },
      { id: 'load', name: 'LOAD', dir: 'in', x: 0, y: 66, width: 1 },
      { id: 'clk', name: 'CLK', dir: 'in', x: 0, y: 94, width: 1 },
      { id: 'clr', name: 'CLR', dir: 'in', x: 0, y: 122, width: 1, optional: true },
      { id: 'q', name: 'Q', dir: 'out', x: 180, y: 48, width: 4 },
    ],
  },
  {
    kind: 'counter4',
    name: '4-Bit-Binärzähler',
    symbol: 'CNT',
    category: 'sequential',
    description:
      'Zählt bei steigender Taktflanke modulo MOD, wenn EN aktiv ist. LOAD übernimmt D parallel; CLR setzt asynchron auf 0. TC meldet den letzten Wert.',
    width: 184,
    height: 184,
    pins: [
      { id: 'clk', name: 'CLK', dir: 'in', x: 0, y: 28, width: 1 },
      { id: 'd', name: 'D', dir: 'in', x: 0, y: 64, width: 4 },
      { id: 'load', name: 'LOAD', dir: 'in', x: 0, y: 96, width: 1 },
      { id: 'en', name: 'EN', dir: 'in', x: 0, y: 128, width: 1 },
      { id: 'clr', name: 'CLR', dir: 'in', x: 0, y: 160, width: 1, optional: true },
      { id: 'q', name: 'Q', dir: 'out', x: 184, y: 44, width: 4 },
      { id: 'tc', name: 'TC', dir: 'out', x: 184, y: 136, width: 1 },
    ],
  },
  {
    kind: 'inc4',
    name: '4-Bit-Inkrementer',
    symbol: '+1',
    category: 'arithmetic',
    description: 'Addiert 1 auf einen 4-Bit-Wert. COUT zeigt den Überlauf an.',
    width: 148,
    height: 108,
    pins: [
      { id: 'a', name: 'A', dir: 'in', x: 0, y: 38, width: 4 },
      { id: 's', name: 'S', dir: 'out', x: 148, y: 38, width: 4 },
      { id: 'cout', name: 'COUT', dir: 'out', x: 148, y: 78, width: 1 },
    ],
  },
  {
    kind: 'split4',
    name: '4-Bit-Splitter',
    symbol: 'SPLIT',
    category: 'arithmetic',
    description: 'Teilt einen 4-Bit-Bus in die einzelnen Bits b0 bis b3 auf.',
    width: 148,
    height: 160,
    pins: [
      { id: 'd', name: 'D', dir: 'in', x: 0, y: 64, width: 4 },
      { id: 'b0', name: 'b0', dir: 'out', x: 148, y: 26, width: 1 },
      { id: 'b1', name: 'b1', dir: 'out', x: 148, y: 64, width: 1 },
      { id: 'b2', name: 'b2', dir: 'out', x: 148, y: 102, width: 1 },
      { id: 'b3', name: 'b3', dir: 'out', x: 148, y: 140, width: 1 },
    ],
  },
  {
    kind: 'merge4',
    name: '4-Bit-Merger',
    symbol: 'MERGE',
    category: 'arithmetic',
    description: 'Fasst vier einzelne Bits zu einem 4-Bit-Bus zusammen.',
    width: 148,
    height: 160,
    pins: [
      { id: 'b0', name: 'b0', dir: 'in', x: 0, y: 26, width: 1 },
      { id: 'b1', name: 'b1', dir: 'in', x: 0, y: 64, width: 1 },
      { id: 'b2', name: 'b2', dir: 'in', x: 0, y: 102, width: 1 },
      { id: 'b3', name: 'b3', dir: 'in', x: 0, y: 140, width: 1 },
      { id: 'q', name: 'Q', dir: 'out', x: 148, y: 76, width: 4 },
    ],
  },
  {
    kind: 'mux2',
    name: '2:1-Multiplexer (1 Bit)',
    symbol: 'MUX',
    category: 'arithmetic',
    description: 'Wählt mit S zwischen A (S=0) und B (S=1).',
    width: 136,
    height: 112,
    pins: [
      { id: 'a', name: 'A', dir: 'in', x: 0, y: 24, width: 1 },
      { id: 'b', name: 'B', dir: 'in', x: 0, y: 64, width: 1 },
      { id: 's', name: 'S', dir: 'in', x: 0, y: 94, width: 1 },
      { id: 'y', name: 'Y', dir: 'out', x: 136, y: 42, width: 1 },
    ],
  },
  {
    kind: 'mux4',
    name: '2:1-Multiplexer (4 Bit)',
    symbol: 'MUX4',
    category: 'arithmetic',
    description: 'Schaltet einen 4-Bit-Bus: S=0 wählt A, S=1 wählt B.',
    width: 168,
    height: 136,
    pins: [
      { id: 'a', name: 'A', dir: 'in', x: 0, y: 32, width: 4 },
      { id: 'b', name: 'B', dir: 'in', x: 0, y: 72, width: 4 },
      { id: 's', name: 'S', dir: 'in', x: 0, y: 112, width: 1 },
      { id: 'y', name: 'Y', dir: 'out', x: 168, y: 52, width: 4 },
    ],
  },
  {
    kind: 'demux2',
    name: '1:2-Demultiplexer (1 Bit)',
    symbol: 'DEMUX',
    category: 'arithmetic',
    description: 'Leitet D mit S=0 auf Y0 und mit S=1 auf Y1. Der jeweils andere Ausgang ist 0.',
    width: 136,
    height: 112,
    pins: [
      { id: 'd', name: 'D', dir: 'in', x: 0, y: 24, width: 1 },
      { id: 's', name: 'S', dir: 'in', x: 0, y: 64, width: 1 },
      { id: 'y0', name: 'Y0', dir: 'out', x: 136, y: 34, width: 1 },
      { id: 'y1', name: 'Y1', dir: 'out', x: 136, y: 74, width: 1 },
    ],
  },
  {
    kind: 'demux4',
    name: '1:2-Demultiplexer (4 Bit)',
    symbol: 'DEMUX4',
    category: 'arithmetic',
    description: 'Leitet einen 4-Bit-Bus mit S=0 auf Y0 und mit S=1 auf Y1. Der jeweils andere Ausgang ist 0.',
    width: 168,
    height: 136,
    pins: [
      { id: 'd', name: 'D', dir: 'in', x: 0, y: 32, width: 4 },
      { id: 's', name: 'S', dir: 'in', x: 0, y: 76, width: 1 },
      { id: 'y0', name: 'Y0', dir: 'out', x: 168, y: 40, width: 4 },
      { id: 'y1', name: 'Y1', dir: 'out', x: 168, y: 96, width: 4 },
    ],
  },
  {
    kind: 'alu4',
    name: '4-Bit-ALU',
    symbol: 'ALU',
    category: 'arithmetic',
    description:
      '4-Bit-ALU: ADD, SUB, AND, OR, XOR, NOT A, SHL A, SHR A über OP=0…7. C meldet Carry/Überlauf, Z meldet Y=0.',
    width: 208,
    height: 168,
    pins: [
      { id: 'a', name: 'A', dir: 'in', x: 0, y: 32, width: 4 },
      { id: 'b', name: 'B', dir: 'in', x: 0, y: 72, width: 4 },
      { id: 'op', name: 'OP', dir: 'in', x: 0, y: 112, width: 4 },
      { id: 'y', name: 'Y', dir: 'out', x: 208, y: 48, width: 4 },
      { id: 'carry', name: 'C', dir: 'out', x: 208, y: 96, width: 1 },
      { id: 'zero', name: 'Z', dir: 'out', x: 208, y: 136, width: 1 },
    ],
  },
];

export const PART_DEFS = Object.fromEntries(defs.map((def) => [def.kind, def])) as Record<PartKind, PartDef>;

export const PART_LIST = defs;

export const CATEGORY_LABELS: Record<PartCategory, string> = {
  gates: 'Logikgatter',
  io: 'Ein- und Ausgänge',
  sequential: 'Sequentielle Logik',
  arithmetic: 'Rechenbausteine',
};

export const CATEGORY_ORDER: PartCategory[] = ['gates', 'io', 'sequential', 'arithmetic'];

export const IO_BIT_OPTIONS = [1, 4, 8] as const;

const SEQUENTIAL_KINDS: PartKind[] = ['dff', 'register4', 'counter4'];

export function isSequential(kind: PartKind): boolean {
  return SEQUENTIAL_KINDS.includes(kind);
}

export function isInput(kind: PartKind): boolean {
  return kind === 'input';
}

export function isOutput(kind: PartKind): boolean {
  return kind === 'output';
}

export function getPins(part: Part): PinDef[] {
  const def = PART_DEFS[part.kind];
  if (!def) return [];
  if (part.kind === 'input' || part.kind === 'output') {
    const bits = part.bits ?? 1;
    return def.pins.map((pin) => ({ ...pin, width: bits }));
  }
  return def.pins;
}

export function getPin(part: Part, pinId: string): PinDef | undefined {
  return getPins(part).find((pin) => pin.id === pinId);
}

export function partName(part: Part): string {
  return part.label?.trim() || PART_DEFS[part.kind]?.name || part.kind;
}

export function pinPos(part: Part, pin: PinDef): { x: number; y: number } {
  return { x: part.x + pin.x, y: part.y + pin.y };
}

export function pinKey(partId: string, pinId: string): string {
  return `${partId}:${pinId}`;
}

export function mask(value: number, bits: number): number {
  if (bits <= 0) return 0;
  if (bits >= 31) return value >>> 0;
  return value & ((1 << bits) - 1);
}

export const COUNTER_DEFAULT_MODULO = 16;
export const COUNTER_MODULO_OPTIONS = Array.from({ length: 15 }, (_, index) => index + 2);

export function normalizeCounterModulo(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return COUNTER_DEFAULT_MODULO;
  return Math.max(2, Math.min(COUNTER_DEFAULT_MODULO, Math.round(value)));
}

export function counterModulo(part: Part): number {
  return normalizeCounterModulo(part.modulo);
}

export const ALU_OPERATION_NAMES = [
  'ADD',
  'SUB',
  'AND',
  'OR',
  'XOR',
  'NOT A',
  'SHL A',
  'SHR A',
] as const;

export function aluOperationName(op: number): string {
  return ALU_OPERATION_NAMES[mask(op, 3)] ?? 'ADD';
}

export function formatBinary(value: number, bits: number): string {
  const safe = mask(Math.round(value) || 0, bits);
  return safe.toString(2).padStart(bits, '0');
}

export function formatValue(value: number, bits: number): string {
  return bits === 1 ? String(value & 1) : formatBinary(value, bits);
}

export function formatBusCompact(value: number, bits: number): string {
  if (bits <= 1) return String(value & 1);
  return `${formatBinary(value, bits)} · ${value}`;
}

export function nextInputLabel(parts: Part[]): string {
  const used = new Set(parts.filter((part) => part.kind === 'input').map((part) => part.label?.toUpperCase()));
  for (let i = 0; i < 26; i += 1) {
    const label = String.fromCharCode(65 + i);
    if (!used.has(label)) return label;
  }
  return `E${parts.filter((part) => part.kind === 'input').length + 1}`;
}

export function nextOutputLabel(parts: Part[]): string {
  const count = parts.filter((part) => part.kind === 'output').length;
  return `Y${count + 1}`;
}

export function sortByPosition(parts: Part[]): Part[] {
  return [...parts].sort((a, b) => (Math.abs(a.x - b.x) > 1 ? a.x - b.x : a.y - b.y));
}

export function isInputPart(part: Part): boolean {
  return part.kind === 'input';
}

export function isOutputPart(part: Part): boolean {
  return part.kind === 'output';
}
