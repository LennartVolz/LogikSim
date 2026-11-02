import { create } from 'zustand';
import type {
  Circuit,
  Part,
  PartKind,
  PinValues,
  Runtime,
  Selection,
  TimingSample,
  Viewport,
  Warning,
  WireEnd,
} from '../engine/types';
import {
  PART_DEFS,
  counterModulo,
  getPin,
  getPins,
  mask,
  nextInputLabel,
  nextOutputLabel,
  normalizeCounterModulo,
} from '../engine/parts';
import { initialState, makeRuntime, simulate, stepClocks } from '../engine/simulate';
import { cloneExample } from '../circuit/examples';
import { makeId } from '../circuit/factory';
import { GRID_SIZE, MAX_TIMING_SAMPLES, MAX_UNDO } from '../editor/constants';
import { loadLocalCircuit, saveLocalCircuit } from '../storage/project';

export type BottomTab = 'truth' | 'timing' | 'warnings' | 'learn';
export type NoticeTone = 'info' | 'success' | 'error';

export interface Notice {
  id: number;
  message: string;
  tone: NoticeTone;
}

interface CircuitStore {
  circuit: Circuit;
  runtime: Runtime;
  pins: PinValues;
  warnings: Warning[];
  unstable: boolean;
  selection: Selection | null;
  pendingKind: PartKind | null;
  viewport: Viewport;
  fitSignal: number;
  simRunning: boolean;
  speed: number;
  history: TimingSample[];
  bottomTab: BottomTab;
  bottomOpen: boolean;
  notice: Notice | null;
  past: Circuit[];
  future: Circuit[];

  notify: (message: string, tone?: NoticeTone) => void;
  clearNotice: () => void;
  select: (selection: Selection | null) => void;
  setPendingKind: (kind: PartKind | null) => void;
  setViewport: (viewport: Viewport) => void;
  requestFit: () => void;
  setName: (name: string) => void;

  placePart: (kind: PartKind, x: number, y: number) => void;
  beginDragSnapshot: () => void;
  movePart: (id: string, x: number, y: number) => void;
  updateLabel: (id: string, label: string) => void;
  updateBits: (id: string, bits: number) => void;
  updateCounterModulo: (id: string, modulo: number) => void;
  setPartValue: (id: string, value: number) => void;
  toggleInput: (id: string) => void;
  addWire: (from: WireEnd, to: WireEnd) => boolean;
  deleteSelection: () => void;

  undo: () => void;
  redo: () => void;
  newCircuit: () => void;
  loadExample: (id: string) => void;
  loadCircuit: (circuit: Circuit, message?: string) => void;
  resetSimulation: () => void;

  tickClock: () => void;
  setRunning: (running: boolean) => void;
  setSpeed: (speed: number) => void;
  setBottomTab: (tab: BottomTab) => void;
  toggleBottom: () => void;
  clearHistory: () => void;
}

let noticeCounter = 0;

function snap(value: number): number {
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

function cloneCircuit(circuit: Circuit): Circuit {
  return structuredClone(circuit);
}

function appendSample(history: TimingSample[], pins: PinValues): TimingSample[] {
  const last = history[history.length - 1];
  const sample: TimingSample = {
    t: last ? last.t + 1 : 0,
    values: { ...pins },
  };
  return [...history.slice(-(MAX_TIMING_SAMPLES - 1)), sample];
}

function initialHistory(pins: PinValues): TimingSample[] {
  return [{ t: 0, values: { ...pins } }];
}

function simWarnings(result: { warnings: Warning[] }): Warning[] {
  return result.warnings;
}

function pushPast(past: Circuit[], circuit: Circuit): Circuit[] {
  return [...past.slice(-(MAX_UNDO - 1)), cloneCircuit(circuit)];
}

function emptyCircuit(): Circuit {
  return { name: 'Neue Schaltung', parts: [], wires: [] };
}

function bootstrap(): { circuit: Circuit; result: ReturnType<typeof initialState> } {
  const saved = loadLocalCircuit();
  const fallback = cloneExample('half-adder');
  const circuit = saved ?? fallback?.circuit ?? emptyCircuit();
  return { circuit, result: initialState(circuit) };
}

const boot = bootstrap();

export const useCircuitStore = create<CircuitStore>()((set, get) => ({
  circuit: boot.circuit,
  runtime: boot.result.runtime,
  pins: boot.result.pins,
  warnings: boot.result.warnings,
  unstable: boot.result.unstable,
  selection: null,
  pendingKind: null,
  viewport: { x: 0, y: 0, zoom: 1 },
  fitSignal: 0,
  simRunning: false,
  speed: 2,
  history: initialHistory(boot.result.pins),
  bottomTab: 'truth',
  bottomOpen: true,
  notice: null,
  past: [],
  future: [],

  notify: (message, tone = 'info') => {
    noticeCounter += 1;
    set({ notice: { id: noticeCounter, message, tone } });
  },
  clearNotice: () => set({ notice: null }),
  select: (selection) => set({ selection }),
  setPendingKind: (pendingKind) => set({ pendingKind }),
  setViewport: (viewport) => set({ viewport }),
  requestFit: () => set((state) => ({ fitSignal: state.fitSignal + 1 })),
  setName: (name) => {
    const trimmed = name.slice(0, 80);
    set((state) => ({ circuit: { ...state.circuit, name: trimmed } }));
  },

  placePart: (kind, x, y) => {
    const def = PART_DEFS[kind];
    if (!def) return;
    const state = get();
    const id = makeId('part');
    const part: Part = { id, kind, x: snap(x), y: snap(y) };
    if (kind === 'input') {
      part.bits = 1;
      part.value = 0;
      part.label = nextInputLabel(state.circuit.parts);
    } else if (kind === 'output') {
      part.bits = 1;
      part.label = nextOutputLabel(state.circuit.parts);
    }
    const circuit: Circuit = {
      ...state.circuit,
      parts: [...state.circuit.parts, part],
    };
    const result = simulate(circuit, { runtime: state.runtime, pins: {} }, 'all');
    set({
      circuit,
      pins: result.pins,
      runtime: result.runtime,
      warnings: result.warnings,
      unstable: result.unstable,
      selection: { type: 'part', id },
      pendingKind: null,
      past: pushPast(state.past, state.circuit),
      future: [],
    });
  },

  beginDragSnapshot: () => {
    const state = get();
    set({ past: pushPast(state.past, state.circuit), future: [] });
  },

  movePart: (id, x, y) => {
    set((state) => ({
      circuit: {
        ...state.circuit,
        parts: state.circuit.parts.map((part) =>
          part.id === id ? { ...part, x: snap(x), y: snap(y) } : part,
        ),
      },
    }));
  },

  updateLabel: (id, label) => {
    set((state) => ({
      circuit: {
        ...state.circuit,
        parts: state.circuit.parts.map((part) =>
          part.id === id ? { ...part, label: label.slice(0, 80) } : part,
        ),
      },
    }));
  },

  updateBits: (id, bits) => {
    const state = get();
    const part = state.circuit.parts.find((entry) => entry.id === id);
    if (!part || (part.kind !== 'input' && part.kind !== 'output')) return;
    if (![1, 4, 8].includes(bits)) return;
    if ((part.bits ?? 1) === bits) return;
    const nextPart: Part = {
      ...part,
      bits,
      value: part.kind === 'input' ? mask(part.value ?? 0, bits) : undefined,
    };
    const circuit: Circuit = {
      ...state.circuit,
      parts: state.circuit.parts.map((entry) => (entry.id === id ? nextPart : entry)),
    };
    const result = simulate(circuit, { runtime: state.runtime, pins: {} }, 'all');
    set({
      circuit,
      pins: result.pins,
      runtime: result.runtime,
      warnings: result.warnings,
      unstable: result.unstable,
      past: pushPast(state.past, state.circuit),
      future: [],
    });
  },

  updateCounterModulo: (id, modulo) => {
    const state = get();
    const part = state.circuit.parts.find((entry) => entry.id === id);
    if (!part || part.kind !== 'counter4') return;
    const nextModulo = normalizeCounterModulo(modulo);
    if (counterModulo(part) === nextModulo) return;
    const circuit: Circuit = {
      ...state.circuit,
      parts: state.circuit.parts.map((entry) =>
        entry.id === id ? { ...entry, modulo: nextModulo } : entry,
      ),
    };
    const result = simulate(circuit, { runtime: state.runtime, pins: state.pins }, [id]);
    set({
      circuit,
      pins: result.pins,
      runtime: result.runtime,
      warnings: result.warnings,
      unstable: result.unstable,
      past: pushPast(state.past, state.circuit),
      future: [],
    });
  },

  setPartValue: (id, value) => {
    const state = get();
    const part = state.circuit.parts.find((entry) => entry.id === id);
    if (!part || part.kind !== 'input') return;
    const nextValue = mask(value, part.bits ?? 1);
    if ((part.value ?? 0) === nextValue) return;
    const circuit: Circuit = {
      ...state.circuit,
      parts: state.circuit.parts.map((entry) =>
        entry.id === id ? { ...entry, value: nextValue } : entry,
      ),
    };
    const result = simulate(circuit, { runtime: state.runtime, pins: state.pins }, [id]);
    set({
      circuit,
      pins: result.pins,
      runtime: result.runtime,
      warnings: simWarnings(result),
      unstable: result.unstable,
      history: appendSample(state.history, result.pins),
    });
  },

  toggleInput: (id) => {
    const state = get();
    const part = state.circuit.parts.find((entry) => entry.id === id);
    if (!part || part.kind !== 'input') return;
    const bits = part.bits ?? 1;
    const value = part.value ?? 0;
    const nextValue = bits === 1 ? (value ? 0 : 1) : mask(value + 1, bits);
    get().setPartValue(id, nextValue);
  },

  addWire: (from, to) => {
    const state = get();
    const fromPart = state.circuit.parts.find((part) => part.id === from.partId);
    const toPart = state.circuit.parts.find((part) => part.id === to.partId);
    if (!fromPart || !toPart) return false;
    let sourcePart = fromPart;
    let sourcePinId = from.pin;
    let destPart = toPart;
    let destPinId = to.pin;
    let sourcePin = getPin(sourcePart, sourcePinId);
    let destPin = getPin(destPart, destPinId);
    if (sourcePin?.dir === 'in' && destPin?.dir === 'out') {
      sourcePart = toPart;
      sourcePinId = to.pin;
      destPart = fromPart;
      destPinId = from.pin;
      sourcePin = getPin(sourcePart, sourcePinId);
      destPin = getPin(destPart, destPinId);
    }
    if (!sourcePin || !destPin || sourcePin.dir !== 'out' || destPin.dir !== 'in') {
      get().notify('Eine Leitung muss von einem Ausgang zu einem Eingang führen.', 'error');
      return false;
    }
    if (sourcePart.id === destPart.id) {
      get().notify('Ein Bauteil kann nicht mit sich selbst verbunden werden.', 'error');
      return false;
    }
    if (sourcePin.width !== destPin.width) {
      get().notify(
        `Die Anschlüsse haben unterschiedliche Breiten (${sourcePin.width} Bit → ${destPin.width} Bit).`,
        'error',
      );
      return false;
    }
    if (
      state.circuit.wires.some(
        (wire) => wire.to.partId === destPart.id && wire.to.pin === destPinId,
      )
    ) {
      get().notify(`Der Eingang „${destPin.name}“ ist bereits verbunden.`, 'error');
      return false;
    }

    const wireId = makeId('wire');
    const circuit: Circuit = {
      ...state.circuit,
      wires: [
        ...state.circuit.wires,
        {
          id: wireId,
          from: { partId: sourcePart.id, pin: sourcePinId },
          to: { partId: destPart.id, pin: destPinId },
        },
      ],
    };
    const result = simulate(circuit, { runtime: state.runtime, pins: {} }, 'all');
    set({
      circuit,
      pins: result.pins,
      runtime: result.runtime,
      warnings: result.warnings,
      unstable: result.unstable,
      selection: { type: 'wire', id: wireId },
      past: pushPast(state.past, state.circuit),
      future: [],
    });
    return true;
  },

  deleteSelection: () => {
    const state = get();
    if (!state.selection) return;
    let circuit: Circuit;
    if (state.selection.type === 'wire') {
      circuit = {
        ...state.circuit,
        wires: state.circuit.wires.filter((wire) => wire.id !== state.selection?.id),
      };
    } else {
      const id = state.selection.id;
      circuit = {
        ...state.circuit,
        parts: state.circuit.parts.filter((part) => part.id !== id),
        wires: state.circuit.wires.filter(
          (wire) => wire.from.partId !== id && wire.to.partId !== id,
        ),
      };
    }
    const result = simulate(circuit, { runtime: state.runtime, pins: {} }, 'all');
    set({
      circuit,
      pins: result.pins,
      runtime: result.runtime,
      warnings: result.warnings,
      unstable: result.unstable,
      selection: null,
      past: pushPast(state.past, state.circuit),
      future: [],
    });
  },

  undo: () => {
    const state = get();
    if (state.past.length === 0) return;
    const previous = state.past[state.past.length - 1];
    const result = simulate(previous, { runtime: state.runtime, pins: {} }, 'all');
    set({
      circuit: previous,
      pins: result.pins,
      runtime: result.runtime,
      warnings: result.warnings,
      unstable: result.unstable,
      past: state.past.slice(0, -1),
      future: [cloneCircuit(state.circuit), ...state.future].slice(0, MAX_UNDO),
      selection: null,
      pendingKind: null,
    });
  },

  redo: () => {
    const state = get();
    if (state.future.length === 0) return;
    const next = state.future[0];
    const result = simulate(next, { runtime: state.runtime, pins: {} }, 'all');
    set({
      circuit: next,
      pins: result.pins,
      runtime: result.runtime,
      warnings: result.warnings,
      unstable: result.unstable,
      past: pushPast(state.past, state.circuit),
      future: state.future.slice(1),
      selection: null,
      pendingKind: null,
    });
  },

  loadCircuit: (circuit, message) => {
    const state = get();
    const next = cloneCircuit(circuit);
    const result = initialState(next);
    set({
      circuit: next,
      pins: result.pins,
      runtime: result.runtime,
      warnings: result.warnings,
      unstable: result.unstable,
      history: initialHistory(result.pins),
      selection: null,
      pendingKind: null,
      past: pushPast(state.past, state.circuit),
      future: [],
      fitSignal: state.fitSignal + 1,
      simRunning: false,
      notice: message
        ? { id: (noticeCounter += 1), message, tone: 'success' }
        : state.notice,
    });
  },

  newCircuit: () => {
    get().loadCircuit(emptyCircuit(), 'Neue Schaltung angelegt.');
  },

  loadExample: (id) => {
    const example = cloneExample(id);
    if (!example) return;
    get().loadCircuit(example.circuit, `Beispiel »${example.name}« geladen.`);
  },

  resetSimulation: () => {
    const state = get();
    const result = initialState(state.circuit);
    set({
      runtime: result.runtime,
      pins: result.pins,
      warnings: result.warnings,
      unstable: result.unstable,
      history: initialHistory(result.pins),
      simRunning: false,
    });
    get().notify('Simulation zurückgesetzt.', 'success');
  },

  tickClock: () => {
    const state = get();
    if (!state.circuit.parts.some((part) => part.kind === 'clock')) return;
    const result = stepClocks(state.circuit, { runtime: state.runtime, pins: state.pins });
    set({
      pins: result.pins,
      runtime: result.runtime,
      warnings: result.warnings,
      unstable: result.unstable,
      history: appendSample(state.history, result.pins),
    });
  },

  setRunning: (running) => {
    const state = get();
    if (running && !state.circuit.parts.some((part) => part.kind === 'clock')) {
      get().notify('Für den automatischen Lauf wird ein Taktgeber benötigt.', 'info');
      set({ simRunning: false });
      return;
    }
    set({ simRunning: running });
  },

  setSpeed: (speed) => set({ speed: Math.max(1, Math.min(16, Math.round(speed))) }),
  setBottomTab: (bottomTab) => set({ bottomTab, bottomOpen: true }),
  toggleBottom: () => set((state) => ({ bottomOpen: !state.bottomOpen })),
  clearHistory: () => set({ history: [] }),
}));

/** Autosave must only contain serializable circuit state, never runtime values. */
export function persistCircuit(circuit: Circuit): void {
  saveLocalCircuit(circuit);
}

export function freshRuntime(circuit: Circuit): Runtime {
  return makeRuntime(circuit);
}

export function allPinDefs(part: Part) {
  return getPins(part);
}
