import { describe, expect, it } from 'vitest';
import { CircuitBuilder } from '../circuit/factory';
import { EXAMPLES } from '../circuit/examples';
import { CHALLENGES, checkCircuit } from '../learning/challenges';
import {
  buildTruthTable,
  evaluateCombination,
  inputParts,
  outputParts,
  readOutputPinValue,
} from './analysis';
import { initialState, simulate, stepClocks } from './simulate';
import { parseProject, serializeProject } from '../storage/project';
import type { Circuit, PinValues } from './types';

function valueOf(circuit: Circuit, pins: PinValues, label: string): number {
  const part = outputParts(circuit).find((entry) => entry.label === label);
  if (!part) throw new Error(`Ausgang ${label} fehlt`);
  return readOutputPinValue(circuit, pins, part);
}

function withInputValue(circuit: Circuit, partId: string, value: number): Circuit {
  return {
    ...circuit,
    parts: circuit.parts.map((part) => (part.id === partId ? { ...part, value } : part)),
  };
}

function buildCounterCircuit() {
  const builder = new CircuitBuilder('Counter-Test');
  const clock = builder.add('clock', 0, 0);
  const enable = builder.add('input', 0, 150, { label: 'EN', value: 1 });
  const clear = builder.add('input', 0, 260, { label: 'CLR', value: 0 });
  const load = builder.add('input', 0, 370, { label: 'LOAD', value: 0 });
  const data = builder.add('input', 0, 480, { label: 'D', bits: 4, value: 0 });
  const counter = builder.add('counter4', 260, 40);
  const q = builder.add('output', 520, 60, { label: 'Q', bits: 4 });
  const tc = builder.add('output', 520, 180, { label: 'TC' });
  builder.link(clock, 'out', counter, 'clk');
  builder.link(enable, 'out', counter, 'en');
  builder.link(clear, 'out', counter, 'clr');
  builder.link(load, 'out', counter, 'load');
  builder.link(data, 'out', counter, 'd');
  builder.link(counter, 'q', q, 'in');
  builder.link(counter, 'tc', tc, 'in');
  return { circuit: builder.build(), enable, clear, load, data };
}

describe('kombinatorische Simulation', () => {
  it('berechnet den Halbaddierer für alle Eingaben', () => {
    const circuit = structuredClone(EXAMPLES[0].circuit);
    const [a, b] = inputParts(circuit);
    for (const av of [0, 1]) {
      for (const bv of [0, 1]) {
        const result = evaluateCombination(
          circuit,
          new Map([
            [a.id, av],
            [b.id, bv],
          ]),
        );
        expect(valueOf(circuit, result.pins, 'Summe')).toBe(av ^ bv);
        expect(valueOf(circuit, result.pins, 'Carry')).toBe(av & bv);
        expect(result.unstable).toBe(false);
      }
    }
  });

  it('erzeugt die Wahrheitstabelle des Halbaddierers', () => {
    const circuit = structuredClone(EXAMPLES[0].circuit);
    const table = buildTruthTable(circuit);
    expect(table.inputColumns).toHaveLength(2);
    expect(table.outputColumns).toHaveLength(2);
    expect(table.rows).toEqual([
      { inputs: [0, 0], outputs: [0, 0] },
      { inputs: [0, 1], outputs: [1, 0] },
      { inputs: [1, 0], outputs: [1, 0] },
      { inputs: [1, 1], outputs: [0, 1] },
    ]);
  });

  it('verteilt Bus-Signale über Splitter und Merger', () => {
    const builder = new CircuitBuilder('Bus-Test');
    const input = builder.add('input', 0, 0, { label: 'D', bits: 4, value: 11 });
    const split = builder.add('split4', 200, 0);
    const merge = builder.add('merge4', 400, 0);
    const output = builder.add('output', 650, 0, { label: 'Q', bits: 4 });
    builder.link(input, 'out', split, 'd');
    for (let bit = 0; bit < 4; bit += 1) {
      builder.link(split, `b${bit}`, merge, `b${bit}`);
    }
    builder.link(merge, 'q', output, 'in');
    const circuit = builder.build();
    const state = initialState(circuit);
    expect(valueOf(circuit, state.pins, 'Q')).toBe(11);

    const changed: Circuit = {
      ...circuit,
      parts: circuit.parts.map((part) => (part.id === input.id ? { ...part, value: 5 } : part)),
    };
    const next = simulate(changed, { runtime: state.runtime, pins: state.pins }, [input.id]);
    expect(valueOf(changed, next.pins, 'Q')).toBe(5);
  });

  it('konvergiert bei rückgekoppelten NOR-Gattern', () => {
    const result = initialState(structuredClone(EXAMPLES[2].circuit));
    expect(result.unstable).toBe(false);
    const errors = result.warnings.filter((warning) => warning.level === 'error');
    expect(errors).toEqual([]);
  });

  it('erkennt eine schwingende Rückkopplung', () => {
    const builder = new CircuitBuilder('Oszillator');
    const not = builder.add('not', 200, 0);
    const output = builder.add('output', 400, 0);
    builder.link(not, 'out', not, 'in');
    builder.link(not, 'out', output, 'in');
    const result = initialState(builder.build());
    expect(result.unstable).toBe(true);
    expect(result.warnings.some((warning) => warning.id === 'unstable')).toBe(true);
  });
});

describe('sequentielle Simulation', () => {
  it('übernimmt D nur bei steigender Taktflanke', () => {
    const builder = new CircuitBuilder('DFF-Test');
    const d = builder.add('input', 0, 0, { label: 'D', value: 1 });
    const clock = builder.add('clock', 0, 150);
    const dff = builder.add('dff', 250, 0);
    const output = builder.add('output', 500, 0, { label: 'Q' });
    builder.link(d, 'out', dff, 'd');
    builder.link(clock, 'out', dff, 'clk');
    builder.link(dff, 'q', output, 'in');
    const circuit = builder.build();
    let state = initialState(circuit);
    expect(valueOf(circuit, state.pins, 'Q')).toBe(0);

    state = stepClocks(circuit, state);
    expect(valueOf(circuit, state.pins, 'Q')).toBe(1);

    const changed: Circuit = {
      ...circuit,
      parts: circuit.parts.map((part) => (part.id === d.id ? { ...part, value: 0 } : part)),
    };
    state = simulate(changed, { runtime: state.runtime, pins: state.pins }, [d.id]);
    state = stepClocks(changed, state);
    expect(valueOf(changed, state.pins, 'Q')).toBe(1);

    state = stepClocks(changed, state);
    expect(valueOf(changed, state.pins, 'Q')).toBe(0);
  });

  it('übernimmt in einer Shift-Kette alle Stufen gleichzeitig', () => {
    const builder = new CircuitBuilder('Shift-Test');
    const d = builder.add('input', 0, 0, { label: 'D', value: 1 });
    const clock = builder.add('clock', 0, 200);
    const first = builder.add('dff', 220, 0);
    const second = builder.add('dff', 430, 0);
    const q1 = builder.add('output', 700, 0, { label: 'Q1' });
    const q2 = builder.add('output', 700, 130, { label: 'Q2' });
    builder.link(d, 'out', first, 'd');
    builder.link(clock, 'out', first, 'clk');
    builder.link(first, 'q', second, 'd');
    builder.link(clock, 'out', second, 'clk');
    builder.link(first, 'q', q1, 'in');
    builder.link(second, 'q', q2, 'in');
    const circuit = builder.build();
    let state = initialState(circuit);
    state = stepClocks(circuit, state);
    expect(valueOf(circuit, state.pins, 'Q1')).toBe(1);
    expect(valueOf(circuit, state.pins, 'Q2')).toBe(0);
    state = stepClocks(circuit, state);
    state = stepClocks(circuit, state);
    expect(valueOf(circuit, state.pins, 'Q1')).toBe(1);
    expect(valueOf(circuit, state.pins, 'Q2')).toBe(1);
  });
});

describe('MVP-3-Bausteine', () => {
  it('zählt modulo 10 und übernimmt D bei parallelem Load', () => {
    const { circuit, data, load } = buildCounterCircuit();
    const moduloCircuit: Circuit = {
      ...circuit,
      parts: circuit.parts.map((part) =>
        part.kind === 'counter4' ? { ...part, modulo: 10 } : part,
      ),
    };
    let state = initialState(moduloCircuit);
    for (let count = 0; count < 9; count += 1) {
      state = stepClocks(moduloCircuit, state);
      state = stepClocks(moduloCircuit, state);
    }
    expect(valueOf(moduloCircuit, state.pins, 'Q')).toBe(9);
    expect(valueOf(moduloCircuit, state.pins, 'TC')).toBe(1);

    state = stepClocks(moduloCircuit, state);
    state = stepClocks(moduloCircuit, state);
    expect(valueOf(moduloCircuit, state.pins, 'Q')).toBe(0);
    expect(valueOf(moduloCircuit, state.pins, 'TC')).toBe(0);

    const loaded = withInputValue(withInputValue(moduloCircuit, data.id, 7), load.id, 1);
    state = simulate(loaded, state, [data.id, load.id]);
    state = stepClocks(loaded, state);
    expect(valueOf(loaded, state.pins, 'Q')).toBe(7);
    expect(valueOf(loaded, state.pins, 'TC')).toBe(0);
  });
});

describe('Beispiele und Projektformat', () => {
  it('simuliert alle Beispiele ohne Strukturfehler', () => {
    for (const example of EXAMPLES) {
      const result = initialState(structuredClone(example.circuit));
      expect(
        result.warnings.filter((warning) => warning.level === 'error'),
        example.id,
      ).toEqual([]);
    }
  });

  it('serialisiert und liest ein Projekt verlustfrei zurück', () => {
    const original = structuredClone(EXAMPLES[4].circuit);
    const parsed = parseProject(serializeProject(original));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.circuit.name).toBe(original.name);
    expect(parsed.circuit.parts).toHaveLength(original.parts.length);
    expect(parsed.circuit.wires).toHaveLength(original.wires.length);
    expect(parsed.skippedWires).toBe(0);
  });

  it('speichert die Modulo-Konfiguration eines Zählers', () => {
    const example = EXAMPLES.find((entry) => entry.id === 'counter-modulo');
    expect(example).toBeDefined();
    if (!example) return;
    const parsed = parseProject(serializeProject(structuredClone(example.circuit)));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const counter = parsed.circuit.parts.find((part) => part.kind === 'counter4');
    expect(counter?.modulo).toBe(10);
  });

  it('weist fremde Dateien zurück', () => {
    const parsed = parseProject('{"foo":"bar"}');
    expect(parsed.ok).toBe(false);
  });
});

describe('Lernmodus-Prüfungen', () => {
  it('akzeptiert einen funktionierenden Halbaddierer', () => {
    const result = checkCircuit(structuredClone(EXAMPLES[0].circuit), CHALLENGES[1]);
    expect(result.passed).toBe(true);
  });

  it('akzeptiert ein XOR aus NAND-Gattern', () => {
    const builder = new CircuitBuilder('NAND-XOR');
    const a = builder.add('input', 0, 0, { label: 'A' });
    const b = builder.add('input', 0, 140, { label: 'B' });
    const n1 = builder.add('nand', 250, 20);
    const n2 = builder.add('nand', 430, -60);
    const n3 = builder.add('nand', 430, 120);
    const out = builder.add('nand', 620, 30);
    const output = builder.add('output', 820, 30, { label: 'Y' });
    builder.link(a, 'out', n1, 'in1');
    builder.link(b, 'out', n1, 'in2');
    builder.link(a, 'out', n2, 'in1');
    builder.link(n1, 'out', n2, 'in2');
    builder.link(b, 'out', n3, 'in1');
    builder.link(n1, 'out', n3, 'in2');
    builder.link(n2, 'out', out, 'in1');
    builder.link(n3, 'out', out, 'in2');
    builder.link(out, 'out', output, 'in');
    const result = checkCircuit(builder.build(), CHALLENGES[0]);
    expect(result.passed).toBe(true);
  });

  it('lehnt XOR/XNOR in der XOR-Aufgabe ab', () => {
    const builder = new CircuitBuilder('Verbotenes XOR');
    const a = builder.add('input', 0, 0, { label: 'A' });
    const b = builder.add('input', 0, 140, { label: 'B' });
    const xor = builder.add('xor', 300, 30);
    const output = builder.add('output', 500, 30, { label: 'Y' });
    builder.link(a, 'out', xor, 'in1');
    builder.link(b, 'out', xor, 'in2');
    builder.link(xor, 'out', output, 'in');
    const result = checkCircuit(builder.build(), CHALLENGES[0]);
    expect(result.passed).toBe(false);
    expect(result.summary).toContain('gesperrt');
  });

  it('meldet die leere Inkrementer-Aufgabe als unvollständig', () => {
    const starter = CHALLENGES[2].starter();
    expect(starter.parts).toHaveLength(8);
    const result = checkCircuit(starter, CHALLENGES[2]);
    expect(result.passed).toBe(false);
  });
});

describe('MVP-2-Bausteine', () => {
  it('zählt bei steigender Flanke, respektiert EN und setzt asynchron zurück', () => {
    const { circuit, enable, clear } = buildCounterCircuit();
    let state = initialState(circuit);
    expect(valueOf(circuit, state.pins, 'Q')).toBe(0);
    expect(valueOf(circuit, state.pins, 'TC')).toBe(0);

    state = stepClocks(circuit, state);
    expect(valueOf(circuit, state.pins, 'Q')).toBe(1);
    state = stepClocks(circuit, state);
    expect(valueOf(circuit, state.pins, 'Q')).toBe(1);
    state = stepClocks(circuit, state);
    expect(valueOf(circuit, state.pins, 'Q')).toBe(2);

    const disabled = withInputValue(circuit, enable.id, 0);
    state = simulate(disabled, state, [enable.id]);
    state = stepClocks(disabled, state);
    expect(valueOf(disabled, state.pins, 'Q')).toBe(2);

    const enabledAgain = withInputValue(disabled, enable.id, 1);
    state = simulate(enabledAgain, state, [enable.id]);
    state = stepClocks(enabledAgain, state);
    expect(valueOf(enabledAgain, state.pins, 'Q')).toBe(3);

    const cleared = withInputValue(enabledAgain, clear.id, 1);
    state = simulate(cleared, state, [clear.id]);
    expect(valueOf(cleared, state.pins, 'Q')).toBe(0);
  });

  it('läuft bis 15, meldet TC und läuft anschließend über', () => {
    const { circuit } = buildCounterCircuit();
    let state = initialState(circuit);
    for (let count = 0; count < 15; count += 1) {
      state = stepClocks(circuit, state);
      state = stepClocks(circuit, state);
    }
    expect(valueOf(circuit, state.pins, 'Q')).toBe(15);
    expect(valueOf(circuit, state.pins, 'TC')).toBe(1);

    state = stepClocks(circuit, state);
    state = stepClocks(circuit, state);
    expect(valueOf(circuit, state.pins, 'Q')).toBe(0);
    expect(valueOf(circuit, state.pins, 'TC')).toBe(0);
  });

  it('multiplexer wählen zwischen A und B', () => {
    const single = new CircuitBuilder('MUX2-Test');
    const a1 = single.add('input', 0, 0, { label: 'A', value: 0 });
    const b1 = single.add('input', 0, 100, { label: 'B', value: 1 });
    const s1 = single.add('input', 0, 200, { label: 'S', value: 0 });
    const mux2 = single.add('mux2', 250, 40);
    const y1 = single.add('output', 450, 40, { label: 'Y' });
    single.link(a1, 'out', mux2, 'a');
    single.link(b1, 'out', mux2, 'b');
    single.link(s1, 'out', mux2, 's');
    single.link(mux2, 'y', y1, 'in');
    const circuit1 = single.build();
    for (const select of [0, 1]) {
      const result = evaluateCombination(circuit1, new Map([[s1.id, select]]));
      expect(valueOf(circuit1, result.pins, 'Y')).toBe(select);
    }

    const wide = new CircuitBuilder('MUX4-Test');
    const a4 = wide.add('input', 0, 0, { label: 'A', bits: 4, value: 10 });
    const b4 = wide.add('input', 0, 120, { label: 'B', bits: 4, value: 5 });
    const s4 = wide.add('input', 0, 240, { label: 'S', value: 0 });
    const mux4 = wide.add('mux4', 260, 40);
    const y4 = wide.add('output', 500, 40, { label: 'Y', bits: 4 });
    wide.link(a4, 'out', mux4, 'a');
    wide.link(b4, 'out', mux4, 'b');
    wide.link(s4, 'out', mux4, 's');
    wide.link(mux4, 'y', y4, 'in');
    const circuit4 = wide.build();
    expect(valueOf(circuit4, evaluateCombination(circuit4, new Map([[s4.id, 0]])).pins, 'Y')).toBe(10);
    expect(valueOf(circuit4, evaluateCombination(circuit4, new Map([[s4.id, 1]])).pins, 'Y')).toBe(5);
  });

  it('demultiplexer leiten D auf Y0 oder Y1', () => {
    const single = new CircuitBuilder('DEMUX2-Test');
    const d1 = single.add('input', 0, 0, { label: 'D', value: 1 });
    const s1 = single.add('input', 0, 100, { label: 'S', value: 0 });
    const demux2 = single.add('demux2', 250, 40);
    const y01 = single.add('output', 450, 30, { label: 'Y0' });
    const y11 = single.add('output', 450, 150, { label: 'Y1' });
    single.link(d1, 'out', demux2, 'd');
    single.link(s1, 'out', demux2, 's');
    single.link(demux2, 'y0', y01, 'in');
    single.link(demux2, 'y1', y11, 'in');
    const circuit1 = single.build();
    const run1 = (select: number) => {
      const result = evaluateCombination(circuit1, new Map([[s1.id, select]]));
      return [valueOf(circuit1, result.pins, 'Y0'), valueOf(circuit1, result.pins, 'Y1')];
    };
    expect(run1(0)).toEqual([1, 0]);
    expect(run1(1)).toEqual([0, 1]);

    const wide = new CircuitBuilder('DEMUX4-Test');
    const d4 = wide.add('input', 0, 0, { label: 'D', bits: 4, value: 10 });
    const s4 = wide.add('input', 0, 120, { label: 'S', value: 0 });
    const demux4 = wide.add('demux4', 280, 40);
    const y04 = wide.add('output', 520, 30, { label: 'Y0', bits: 4 });
    const y14 = wide.add('output', 520, 150, { label: 'Y1', bits: 4 });
    wide.link(d4, 'out', demux4, 'd');
    wide.link(s4, 'out', demux4, 's');
    wide.link(demux4, 'y0', y04, 'in');
    wide.link(demux4, 'y1', y14, 'in');
    const circuit4 = wide.build();
    expect(valueOf(circuit4, evaluateCombination(circuit4, new Map([[s4.id, 0]])).pins, 'Y0')).toBe(10);
    expect(valueOf(circuit4, evaluateCombination(circuit4, new Map([[s4.id, 0]])).pins, 'Y1')).toBe(0);
    expect(valueOf(circuit4, evaluateCombination(circuit4, new Map([[s4.id, 1]])).pins, 'Y0')).toBe(0);
    expect(valueOf(circuit4, evaluateCombination(circuit4, new Map([[s4.id, 1]])).pins, 'Y1')).toBe(10);
  });

  it('ALU rechnet alle acht Operationen und setzt Carry sowie Zero', () => {
    const builder = new CircuitBuilder('ALU-Test');
    const a = builder.add('input', 0, 0, { label: 'A', bits: 4, value: 0 });
    const b = builder.add('input', 0, 120, { label: 'B', bits: 4, value: 0 });
    const op = builder.add('input', 0, 240, { label: 'OP', bits: 4, value: 0 });
    const alu = builder.add('alu4', 280, 40);
    const y = builder.add('output', 560, 40, { label: 'Y', bits: 4 });
    const carry = builder.add('output', 560, 140, { label: 'C' });
    const zero = builder.add('output', 560, 240, { label: 'Z' });
    builder.link(a, 'out', alu, 'a');
    builder.link(b, 'out', alu, 'b');
    builder.link(op, 'out', alu, 'op');
    builder.link(alu, 'y', y, 'in');
    builder.link(alu, 'carry', carry, 'in');
    builder.link(alu, 'zero', zero, 'in');
    const circuit = builder.build();
    const run = (av: number, bv: number, ov: number) => {
      const result = evaluateCombination(
        circuit,
        new Map([
          [a.id, av],
          [b.id, bv],
          [op.id, ov],
        ]),
      );
      return {
        y: valueOf(circuit, result.pins, 'Y'),
        c: valueOf(circuit, result.pins, 'C'),
        z: valueOf(circuit, result.pins, 'Z'),
      };
    };

    expect(run(9, 3, 0)).toEqual({ y: 12, c: 0, z: 0 });
    expect(run(15, 1, 0)).toEqual({ y: 0, c: 1, z: 1 });
    expect(run(3, 5, 1)).toEqual({ y: 14, c: 0, z: 0 });
    expect(run(5, 3, 1)).toEqual({ y: 2, c: 1, z: 0 });
    expect(run(10, 6, 2)).toEqual({ y: 2, c: 0, z: 0 });
    expect(run(10, 6, 3)).toEqual({ y: 14, c: 0, z: 0 });
    expect(run(10, 6, 4)).toEqual({ y: 12, c: 0, z: 0 });
    expect(run(9, 0, 5)).toEqual({ y: 6, c: 0, z: 0 });
    expect(run(9, 0, 6)).toEqual({ y: 2, c: 1, z: 0 });
    expect(run(9, 0, 7)).toEqual({ y: 4, c: 1, z: 0 });
    expect(run(0, 0, 0)).toEqual({ y: 0, c: 0, z: 1 });
  });
});
