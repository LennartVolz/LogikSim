/** Shared data model for circuits, parts, pins and simulation state. */

export type PartKind =
  | 'and'
  | 'or'
  | 'not'
  | 'nand'
  | 'nor'
  | 'xor'
  | 'xnor'
  | 'input'
  | 'output'
  | 'const0'
  | 'const1'
  | 'clock'
  | 'dff'
  | 'register4'
  | 'inc4'
  | 'split4'
  | 'merge4';

export type PartCategory = 'gates' | 'io' | 'sequential' | 'arithmetic';

export type PinDirection = 'in' | 'out';

export interface PinDef {
  id: string;
  name: string;
  dir: PinDirection;
  /** Position relative to the part's top-left corner. */
  x: number;
  y: number;
  width: number;
  /** Optional pins may stay disconnected without producing a warning. */
  optional?: boolean;
}

export interface PartDef {
  kind: PartKind;
  name: string;
  symbol: string;
  category: PartCategory;
  description: string;
  width: number;
  height: number;
  pins: PinDef[];
}

export interface Part {
  id: string;
  kind: PartKind;
  x: number;
  y: number;
  label?: string;
  /** Value of a constant, an input switch or an input bus. */
  value?: number;
  /** Bit width for input/output components. */
  bits?: number;
}

export interface WireEnd {
  partId: string;
  pin: string;
}

export interface Wire {
  id: string;
  from: WireEnd;
  to: WireEnd;
}

export interface Circuit {
  name: string;
  parts: Part[];
  wires: Wire[];
}

export type PinValues = Record<string, number>;

export interface PartRuntime {
  /** Stored value of sequential components. */
  q?: number;
  /** Clock level observed during the last clock tick. */
  lastClk?: number;
  /** Output level of a clock generator. */
  clock?: number;
}

export type Runtime = Record<string, PartRuntime>;

export type WarningLevel = 'warning' | 'error';

export interface Warning {
  id: string;
  level: WarningLevel;
  message: string;
  partId?: string;
  wireId?: string;
}

export interface SimState {
  runtime: Runtime;
  pins: PinValues;
}

export interface SimResult extends SimState {
  warnings: Warning[];
  unstable: boolean;
}

export interface Selection {
  type: 'part' | 'wire';
  id: string;
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export interface TimingSample {
  t: number;
  values: PinValues;
}
