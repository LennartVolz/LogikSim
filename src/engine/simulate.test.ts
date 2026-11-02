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
