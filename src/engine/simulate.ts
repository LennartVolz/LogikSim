import {
  PART_DEFS,
  getPin,
  getPins,
  isSequential,
  mask,
  partName,
  pinKey,
} from './parts';
import type {
  Circuit,
  Part,
  PinValues,
  Runtime,
  SimResult,
  SimState,
  Warning,
} from './types';

const MAX_EVALS_PER_PART = 80;
const MAX_EVENTS = 30000;

export function makeRuntime(circuit: Circuit): Runtime {
  const runtime: Runtime = {};
  for (const part of circuit.parts) {
    if (part.kind === 'clock') runtime[part.id] = { clock: 0 };
    if (isSequential(part.kind)) runtime[part.id] = { q: 0, lastClk: 0 };
  }
  return runtime;
}

export function cloneRuntime(runtime: Runtime): Runtime {
  const copy: Runtime = {};
  for (const [id, value] of Object.entries(runtime)) copy[id] = { ...value };
  return copy;
}

function ensureRuntime(circuit: Circuit, runtime: Runtime): void {
  for (const part of circuit.parts) {
    if (!runtime[part.id]) runtime[part.id] = {};
    if (part.kind === 'clock') runtime[part.id].clock ??= 0;
    if (isSequential(part.kind)) {
      runtime[part.id].q ??= 0;
      runtime[part.id].lastClk ??= 0;
    }
  }
}

interface SettleResult {
  pins: PinValues;
  runtime: Runtime;
  unstable: boolean;
}

function buildConnections(circuit: Circuit): {
  inputSources: Map<string, string>;
  fanout: Map<string, string[]>;
} {
  const inputSources = new Map<string, string>();
  const fanout = new Map<string, string[]>();
  const partMap = new Map(circuit.parts.map((part) => [part.id, part]));

  for (const wire of circuit.wires) {
    const fromPart = partMap.get(wire.from.partId);
    const toPart = partMap.get(wire.to.partId);
    if (!fromPart || !toPart) continue;
    const fromPin = getPin(fromPart, wire.from.pin);
    const toPin = getPin(toPart, wire.to.pin);
    if (!fromPin || !toPin || fromPin.dir !== 'out' || toPin.dir !== 'in') continue;
    const sourceKey = pinKey(fromPart.id, fromPin.id);
    const destKey = pinKey(toPart.id, toPin.id);
    inputSources.set(destKey, sourceKey);
    const destinations = fanout.get(sourceKey) ?? [];
    if (!destinations.includes(toPart.id)) destinations.push(toPart.id);
    fanout.set(sourceKey, destinations);
  }

  return { inputSources, fanout };
}

/**
 * Event-driven propagation: only components whose inputs can change are
 * evaluated. The event queue settles feedback loops up to a fixed limit.
 */
function settle(
  circuit: Circuit,
  runtime: Runtime,
  startPins: PinValues,
  seeds: string[],
): SettleResult {
  const pins: PinValues = { ...startPins };
  const partMap = new Map(circuit.parts.map((part) => [part.id, part]));
  const { inputSources, fanout } = buildConnections(circuit);
  const queue: string[] = [];
  const queued = new Set<string>();
  const counts = new Map<string, number>();

  for (const seed of seeds) {
    if (partMap.has(seed) && !queued.has(seed)) {
      queue.push(seed);
      queued.add(seed);
    }
  }

  let unstable = false;
  let head = 0;
  let events = 0;

  while (head < queue.length) {
    const partId = queue[head];
    head += 1;
    queued.delete(partId);
    const part = partMap.get(partId);
    if (!part) continue;

    const count = (counts.get(partId) ?? 0) + 1;
    counts.set(partId, count);
    if (count > MAX_EVALS_PER_PART) {
      unstable = true;
      break;
    }
    events += 1;
    if (events > MAX_EVENTS) {
      unstable = true;
      break;
    }

    const pinDefs = getPins(part);
    const inputs: Record<string, number> = {};

    for (const pin of pinDefs) {
      if (pin.dir !== 'in') continue;
      const sourceKey = inputSources.get(pinKey(part.id, pin.id));
      const raw = sourceKey ? pins[sourceKey] ?? 0 : 0;
      const value = mask(raw, pin.width);
      inputs[pin.id] = value;
      pins[pinKey(part.id, pin.id)] = value;
    }

    const outputs = evaluatePart(part, inputs, runtime);

    for (const pin of pinDefs) {
      if (pin.dir !== 'out') continue;
      const key = pinKey(part.id, pin.id);
      const value = mask(outputs[pin.id] ?? 0, pin.width);
      const previous = pins[key] ?? 0;
      pins[key] = value;
      if (previous !== value) {
        for (const destination of fanout.get(key) ?? []) {
          if (!queued.has(destination)) {
            queue.push(destination);
            queued.add(destination);
          }
        }
      }
    }
  }

  return { pins, runtime, unstable };
}

function evaluatePart(
  part: Part,
  inputs: Record<string, number>,
  runtime: Runtime,
): Record<string, number> {
  const rt = (runtime[part.id] ??= {});
  const a = inputs.in1 ?? inputs.a ?? inputs.in ?? 0;
  const b = inputs.in2 ?? 0;

  switch (part.kind) {
    case 'and':
      return { out: a & b };
    case 'or':
      return { out: a | b };
    case 'not':
      return { out: a ? 0 : 1 };
    case 'nand':
      return { out: a & b ? 0 : 1 };
    case 'nor':
      return { out: a | b ? 0 : 1 };
    case 'xor':
      return { out: (a ^ b) & 1 };
    case 'xnor':
      return { out: a === b ? 1 : 0 };
    case 'input':
      return { out: part.value ?? 0 };
    case 'const0':
      return { out: 0 };
    case 'const1':
      return { out: 1 };
    case 'clock':
      return { out: rt.clock ?? 0 };
    case 'output':
      return {};
    case 'dff': {
      if (inputs.r) rt.q = 0;
      rt.q ??= 0;
      return { q: rt.q, qn: rt.q ? 0 : 1 };
    }
    case 'register4': {
      if (inputs.clr) rt.q = 0;
      rt.q ??= 0;
      return { q: mask(rt.q, 4) };
    }
    case 'counter4': {
      if (inputs.clr) rt.q = 0;
      rt.q ??= 0;
      const q = mask(rt.q, 4);
      return { q, tc: q === 0xf ? 1 : 0 };
    }
    case 'inc4': {
      const input = mask(inputs.a ?? 0, 4);
      return { s: mask(input + 1, 4), cout: input === 0xf ? 1 : 0 };
    }
    case 'mux2': {
      const select = inputs.s ?? 0;
      return { y: ((select ? inputs.b : inputs.a) ?? 0) & 1 };
    }
    case 'mux4': {
      const select = inputs.s ?? 0;
      return { y: mask(select ? inputs.b ?? 0 : inputs.a ?? 0, 4) };
    }
    case 'alu4': {
      const a4 = mask(inputs.a ?? 0, 4);
      const b4 = mask(inputs.b ?? 0, 4);
      const op = mask(inputs.op ?? 0, 3);
      let y = 0;
      let carry = 0;
      switch (op) {
        case 0: {
          const sum = a4 + b4;
          y = mask(sum, 4);
          carry = sum > 0xf ? 1 : 0;
          break;
        }
        case 1:
          y = mask(a4 - b4, 4);
          carry = a4 >= b4 ? 1 : 0;
          break;
        case 2:
          y = a4 & b4;
          break;
        case 3:
          y = a4 | b4;
          break;
        case 4:
          y = a4 ^ b4;
          break;
        case 5:
          y = mask(~a4, 4);
          break;
        case 6:
          y = mask(a4 << 1, 4);
          carry = (a4 >> 3) & 1;
          break;
        case 7:
          y = a4 >> 1;
          carry = a4 & 1;
          break;
      }
      return { y: mask(y, 4), carry, zero: y === 0 ? 1 : 0 };
    }
    case 'split4': {
      const input = mask(inputs.d ?? 0, 4);
      return {
        b0: input & 1,
        b1: (input >> 1) & 1,
        b2: (input >> 2) & 1,
        b3: (input >> 3) & 1,
      };
    }
    case 'merge4':
      return {
        q: (inputs.b0 ?? 0) | ((inputs.b1 ?? 0) << 1) | ((inputs.b2 ?? 0) << 2) | ((inputs.b3 ?? 0) << 3),
      };
    default:
      return {};
  }
}

export function buildWarnings(circuit: Circuit): Warning[] {
  const warnings: Warning[] = [];
  const partMap = new Map(circuit.parts.map((part) => [part.id, part]));
  const inputWires = new Map<string, string[]>();

  for (const wire of circuit.wires) {
    const fromPart = partMap.get(wire.from.partId);
    const toPart = partMap.get(wire.to.partId);
    if (!fromPart || !toPart) {
      warnings.push({
        id: `wire-missing-part:${wire.id}`,
        level: 'error',
        message: 'Eine Leitung verweist auf ein Bauteil, das nicht mehr existiert.',
        wireId: wire.id,
      });
      continue;
    }
    const fromPin = getPin(fromPart, wire.from.pin);
    const toPin = getPin(toPart, wire.to.pin);
    if (!fromPin || !toPin) {
      warnings.push({
        id: `wire-missing-pin:${wire.id}`,
        level: 'error',
        message: 'Eine Leitung verweist auf einen unbekannten Anschluss.',
        wireId: wire.id,
      });
      continue;
    }
    if (fromPin.dir !== 'out' || toPin.dir !== 'in') {
      warnings.push({
        id: `wire-direction:${wire.id}`,
        level: 'error',
        message: 'Leitungen müssen von einem Ausgang zu einem Eingang führen.',
        wireId: wire.id,
      });
      continue;
    }
    if (fromPart.id === toPart.id) {
      warnings.push({
        id: `wire-self:${wire.id}`,
        level: 'error',
        message: 'Ein Bauteil kann nicht direkt mit sich selbst verbunden werden.',
        wireId: wire.id,
        partId: toPart.id,
      });
    }
    if (fromPin.width !== toPin.width) {
      warnings.push({
        id: `wire-width:${wire.id}`,
        level: 'error',
        message: `Breitenkonflikt: ${fromPin.width} Bit → ${toPin.width} Bit bei der Verbindung ${partName(fromPart)} → ${partName(toPart)}.`,
        wireId: wire.id,
        partId: toPart.id,
      });
    }
    const destKey = pinKey(toPart.id, toPin.id);
    const list = inputWires.get(destKey) ?? [];
    list.push(wire.id);
    inputWires.set(destKey, list);
  }

  for (const [destKey, wires] of inputWires) {
    if (wires.length > 1) {
      const [partId, pinId] = destKey.split(':');
      const part = partMap.get(partId);
      const pin = part ? getPin(part, pinId) : undefined;
      warnings.push({
        id: `multi-driver:${destKey}`,
        level: 'error',
        message: `Mehrere Leitungen treffen auf „${pin?.name ?? pinId}“ von ${part ? partName(part) : 'einem Bauteil'}. Ein Eingang darf nur eine Quelle haben.`,
        partId,
        wireId: wires[0],
      });
    }
  }

  for (const part of circuit.parts) {
    const def = PART_DEFS[part.kind];
    if (!def) continue;
    for (const pin of getPins(part)) {
      if (pin.dir !== 'in' || pin.optional) continue;
      if ((inputWires.get(pinKey(part.id, pin.id))?.length ?? 0) === 0) {
        warnings.push({
          id: `unconnected:${part.id}:${pin.id}`,
          level: 'warning',
          message: `Eingang „${pin.name}“ von ${part.label?.trim() ? part.label.trim() : def.name} ist nicht verbunden und liest 0.`,
          partId: part.id,
        });
      }
    }
  }

  return warnings;
}

export function simulate(
  circuit: Circuit,
  state?: SimState,
  seeds: string[] | 'all' = 'all',
): SimResult {
  const runtime = cloneRuntime(state?.runtime ?? makeRuntime(circuit));
  ensureRuntime(circuit, runtime);
  const startPins = seeds === 'all' ? {} : { ...(state?.pins ?? {}) };
  const seedIds = seeds === 'all' ? circuit.parts.map((part) => part.id) : seeds;
  const result = settle(circuit, runtime, startPins, seedIds);
  const warnings = buildWarnings(circuit);
  if (result.unstable) {
    warnings.push({
      id: 'unstable',
      level: 'error',
      message: 'Die Schaltung schwingt: Eine Rückkopplung findet keinen stabilen Zustand.',
    });
  }
  return {
    pins: result.pins,
    runtime: result.runtime,
    warnings,
    unstable: result.unstable,
  };
}

/**
 * Advances every clock generator by one half period. All sequential
 * components capture their next state simultaneously, based on the values
 * that were stable before the edge. This avoids races in shift registers.
 */
export function stepClocks(circuit: Circuit, state: SimState): SimResult {
  const runtime = cloneRuntime(state.runtime);
  ensureRuntime(circuit, runtime);
  for (const part of circuit.parts) {
    if (part.kind !== 'clock') continue;
    runtime[part.id].clock = runtime[part.id].clock ? 0 : 1;
  }

  const allIds = circuit.parts.map((part) => part.id);
  const phase1 = settle(circuit, runtime, { ...state.pins }, allIds);
  const pins = phase1.pins;

  for (const part of circuit.parts) {
    if (!isSequential(part.kind)) continue;
    const rt = (runtime[part.id] ??= {});
    const clock = pins[pinKey(part.id, 'clk')] ?? 0;
    const previousClock = rt.lastClk ?? 0;

    if (part.kind === 'dff') {
      const reset = pins[pinKey(part.id, 'r')] ?? 0;
      if (reset) {
        rt.q = 0;
      } else if (clock && !previousClock) {
        rt.q = mask(pins[pinKey(part.id, 'd')] ?? 0, 1);
      }
    } else if (part.kind === 'register4') {
      const clear = pins[pinKey(part.id, 'clr')] ?? 0;
      const load = pins[pinKey(part.id, 'load')] ?? 0;
      if (clear) {
        rt.q = 0;
      } else if (clock && !previousClock && load) {
        rt.q = mask(pins[pinKey(part.id, 'd')] ?? 0, 4);
      }
    } else if (part.kind === 'counter4') {
      const clear = pins[pinKey(part.id, 'clr')] ?? 0;
      const enable = pins[pinKey(part.id, 'en')] ?? 0;
      if (clear) {
        rt.q = 0;
      } else if (clock && !previousClock && enable) {
        rt.q = mask((rt.q ?? 0) + 1, 4);
      }
    }
    rt.lastClk = clock;
  }

  const sequentialIds = circuit.parts.filter((part) => isSequential(part.kind)).map((part) => part.id);
  const phase2 = settle(circuit, runtime, pins, sequentialIds);
  const unstable = phase1.unstable || phase2.unstable;
  const warnings = buildWarnings(circuit);
  if (unstable) {
    warnings.push({
      id: 'unstable',
      level: 'error',
      message: 'Die Schaltung schwingt: Eine Rückkopplung findet keinen stabilen Zustand.',
    });
  }
  return {
    pins: phase2.pins,
    runtime: phase2.runtime,
    warnings,
    unstable,
  };
}

export function initialState(circuit: Circuit): SimResult {
  return simulate(circuit, { runtime: makeRuntime(circuit), pins: {} }, 'all');
}
