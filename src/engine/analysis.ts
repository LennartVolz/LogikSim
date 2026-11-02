import {
  PART_DEFS,
  formatBinary,
  getPin,
  getPins,
  isSequential,
  mask,
  pinKey,
  sortByPosition,
} from './parts';
import { simulate } from './simulate';
import type { Circuit, Part, PinValues } from './types';

export interface TruthTableColumn {
  id: string;
  label: string;
  width: number;
}

export interface TruthTableRow {
  inputs: number[];
  outputs: number[];
}

export interface TruthTableData {
  inputColumns: TruthTableColumn[];
  outputColumns: TruthTableColumn[];
  rows: TruthTableRow[];
  totalBits: number;
  limited: boolean;
  sequential: boolean;
  unstable: boolean;
}

export function inputParts(circuit: Circuit): Part[] {
  return sortByPosition(circuit.parts.filter((part) => part.kind === 'input'));
}

export function outputParts(circuit: Circuit): Part[] {
  return sortByPosition(circuit.parts.filter((part) => part.kind === 'output'));
}

export function bitsOf(part: Part): number {
  return part.bits ?? 1;
}

export function readOutputPinValue(circuit: Circuit, pins: PinValues, part: Part): number {
  const source = circuit.wires.find((wire) => wire.to.partId === part.id && wire.to.pin === 'in');
  if (source) {
    const value = pins[pinKey(source.from.partId, source.from.pin)];
    if (value !== undefined) return mask(value, bitsOf(part));
  }
  return mask(pins[pinKey(part.id, 'in')] ?? 0, bitsOf(part));
}

export function buildTruthTable(circuit: Circuit): TruthTableData {
  const inputs = inputParts(circuit);
  const outputs = outputParts(circuit);
  const inputColumns = inputs.map((part) => ({
    id: part.id,
    label: part.label?.trim() || 'Eingang',
    width: bitsOf(part),
  }));
  const outputColumns = outputs.map((part) => ({
    id: part.id,
    label: part.label?.trim() || 'Ausgang',
    width: bitsOf(part),
  }));
  const totalBits = inputs.reduce((sum, part) => sum + bitsOf(part), 0);
  const limited = totalBits > 8;
  const sequential = circuit.parts.some((part) => isSequential(part.kind) || part.kind === 'clock');

  if (limited) {
    return {
      inputColumns,
      outputColumns,
      rows: [],
      totalBits,
      limited,
      sequential,
      unstable: false,
    };
  }

  const rows: TruthTableRow[] = [];
  let unstable = false;
  const rowCount = inputs.length === 0 ? 1 : 2 ** totalBits;

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    let remaining = rowIndex;
    const values = new Array(inputs.length).fill(0);
    for (let index = inputs.length - 1; index >= 0; index -= 1) {
      const width = bitsOf(inputs[index]);
      values[index] = remaining & ((1 << width) - 1);
      remaining >>>= width;
    }

    const partValues = new Map<string, number>();
    inputs.forEach((part, index) => partValues.set(part.id, values[index]));
    const testCircuit: Circuit = {
      ...circuit,
      parts: circuit.parts.map((part) =>
        partValues.has(part.id) ? { ...part, value: partValues.get(part.id) } : part,
      ),
    };
    const result = simulate(testCircuit);
    if (result.unstable) unstable = true;
    rows.push({
      inputs: values,
      outputs: outputs.map((part) => readOutputPinValue(testCircuit, result.pins, part)),
    });
  }

  return {
    inputColumns,
    outputColumns,
    rows,
    totalBits,
    limited,
    sequential,
    unstable,
  };
}

export interface CombinationResult {
  outputs: { part: Part; value: number }[];
  pins: PinValues;
  unstable: boolean;
  errorMessages: string[];
}

export function evaluateCombination(
  circuit: Circuit,
  inputValues: Map<string, number>,
): CombinationResult {
  const testCircuit: Circuit = {
    ...circuit,
    parts: circuit.parts.map((part) =>
      inputValues.has(part.id)
        ? { ...part, value: mask(inputValues.get(part.id) ?? 0, bitsOf(part)) }
        : part,
    ),
  };
  const result = simulate(testCircuit);
  return {
    outputs: outputParts(testCircuit).map((part) => ({
      part,
      value: readOutputPinValue(testCircuit, result.pins, part),
    })),
    pins: result.pins,
    unstable: result.unstable,
    errorMessages: result.warnings.filter((warning) => warning.level === 'error').map((warning) => warning.message),
  };
}

export interface TimingSignal {
  key: string;
  partId: string;
  pinId: string;
  label: string;
  width: number;
  kindLabel: string;
}

/** Chooses a compact, readable set of signals for the timing diagram. */
export function collectTimingSignals(circuit: Circuit): TimingSignal[] {
  const signals: TimingSignal[] = [];
  const seen = new Set<string>();
  const add = (part: Part, pinId: string, label: string, kindLabel: string) => {
    const pin = getPin(part, pinId);
    if (!pin) return;
    const key = pinKey(part.id, pinId);
    if (seen.has(key) || signals.length >= 12) return;
    seen.add(key);
    signals.push({ key, partId: part.id, pinId, label, width: pin.width, kindLabel });
  };

  const ordered = sortByPosition(circuit.parts);
  for (const part of ordered) {
    if (part.kind === 'input') add(part, 'out', part.label?.trim() || 'Eingang', 'IN');
    if (part.kind === 'clock') add(part, 'out', part.label?.trim() || 'CLK', 'CLK');
  }
  for (const part of ordered) {
    if (part.kind === 'dff') add(part, 'q', part.label?.trim() ? `${part.label.trim()} Q` : 'DFF Q', 'FF');
    if (part.kind === 'register4') add(part, 'q', part.label?.trim() ? `${part.label.trim()} Q` : 'REG Q', 'REG');
  }
  for (const part of ordered) {
    if (part.kind === 'output') add(part, 'in', part.label?.trim() || 'Ausgang', 'OUT');
  }

  return signals;
}

export function truthCell(value: number, width: number): string {
  return width === 1 ? String(value & 1) : formatBinary(value, width);
}

export function pinOptionsOf(part: Part): string {
  const def = PART_DEFS[part.kind];
  return def ? def.name : part.kind;
}

export function sourcePinOf(circuit: Circuit, targetPartId: string, targetPinId: string) {
  const wire = circuit.wires.find(
    (entry) => entry.to.partId === targetPartId && entry.to.pin === targetPinId,
  );
  if (!wire) return null;
  const part = circuit.parts.find((entry) => entry.id === wire.from.partId);
  if (!part) return null;
  const pin = getPin(part, wire.from.pin);
  if (!pin) return null;
  return { part, pin, wire };
}

export function allPins(part: Part) {
  return getPins(part);
}
