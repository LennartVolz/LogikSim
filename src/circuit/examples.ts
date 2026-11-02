import type { Circuit } from '../engine/types';
import { CircuitBuilder } from '../circuit/factory';

export interface Example {
  id: string;
  name: string;
  description: string;
  hint?: string;
  circuit: Circuit;
}

function halfAdder(): Circuit {
  const b = new CircuitBuilder('Halbaddierer');
  const a = b.add('input', 80, 120, { label: 'A', value: 1 });
  const bb = b.add('input', 80, 260, { label: 'B', value: 0 });
  const xor = b.add('xor', 340, 120);
  const and = b.add('and', 340, 260);
  const sum = b.add('output', 650, 120, { label: 'Summe' });
  const carry = b.add('output', 650, 260, { label: 'Carry' });
  b.link(a, 'out', xor, 'in1');
  b.link(bb, 'out', xor, 'in2');
  b.link(a, 'out', and, 'in1');
  b.link(bb, 'out', and, 'in2');
  b.link(xor, 'out', sum, 'in');
  b.link(and, 'out', carry, 'in');
  return b.build();
}

function fullAdder(): Circuit {
  const b = new CircuitBuilder('Volladdierer');
  const a = b.add('input', 60, 100, { label: 'A', value: 1 });
  const bb = b.add('input', 60, 240, { label: 'B', value: 0 });
  const cin = b.add('input', 60, 380, { label: 'Cin', value: 1 });
  const xor1 = b.add('xor', 290, 140);
  const xor2 = b.add('xor', 530, 250);
  const and1 = b.add('and', 290, 350);
  const and2 = b.add('and', 540, 420);
  const or = b.add('or', 760, 350);
  const sum = b.add('output', 840, 250, { label: 'Summe' });
  const cout = b.add('output', 980, 350, { label: 'Cout' });
  b.link(a, 'out', xor1, 'in1');
  b.link(bb, 'out', xor1, 'in2');
  b.link(xor1, 'out', xor2, 'in1');
  b.link(cin, 'out', xor2, 'in2');
  b.link(a, 'out', and1, 'in1');
  b.link(bb, 'out', and1, 'in2');
  b.link(xor1, 'out', and2, 'in1');
  b.link(cin, 'out', and2, 'in2');
  b.link(and1, 'out', or, 'in1');
  b.link(and2, 'out', or, 'in2');
  b.link(xor2, 'out', sum, 'in');
  b.link(or, 'out', cout, 'in');
  return b.build();
}

function srLatch(): Circuit {
  const b = new CircuitBuilder('SR-Latch (NOR)');
  const s = b.add('input', 80, 130, { label: 'S', value: 1 });
  const r = b.add('input', 80, 330, { label: 'R', value: 0 });
  const nor1 = b.add('nor', 380, 110);
  const nor2 = b.add('nor', 380, 310);
  const qn = b.add('output', 700, 110, { label: 'Q\u0305' });
  const q = b.add('output', 700, 310, { label: 'Q' });
  b.link(s, 'out', nor1, 'in1');
  b.link(nor1, 'out', nor2, 'in1');
  b.link(nor2, 'out', nor1, 'in2');
  b.link(r, 'out', nor2, 'in2');
  b.link(nor1, 'out', qn, 'in');
  b.link(nor2, 'out', q, 'in');
  return b.build();
}

function dFlipFlop(): Circuit {
  const b = new CircuitBuilder('D-Flip-Flop');
  const d = b.add('input', 80, 110, { label: 'D', value: 1 });
  const clk = b.add('clock', 80, 270);
  const reset = b.add('input', 80, 410, { label: 'Reset', value: 0 });
  const dff = b.add('dff', 380, 120);
  const q = b.add('output', 640, 140, { label: 'Q' });
  const qn = b.add('output', 640, 270, { label: 'Q\u0305' });
  b.link(d, 'out', dff, 'd');
  b.link(clk, 'out', dff, 'clk');
  b.link(reset, 'out', dff, 'r');
  b.link(dff, 'q', q, 'in');
  b.link(dff, 'qn', qn, 'in');
  return b.build();
}

function registerIncrementer(): Circuit {
  const b = new CircuitBuilder('4-Bit-Register mit Inkrementer');
  const data = b.add('input', 60, 140, { label: 'Daten', bits: 4, value: 5 });
  const load = b.add('const1', 60, 300, { label: 'LOAD' });
  const clk = b.add('clock', 60, 460);
  const clear = b.add('const0', 60, 600, { label: 'CLR' });
  const reg = b.add('register4', 360, 200);
  const inc = b.add('inc4', 650, 280);
  const out = b.add('output', 940, 280, { label: 'Q+1', bits: 4 });
  b.link(data, 'out', reg, 'd');
  b.link(load, 'out', reg, 'load');
  b.link(clk, 'out', reg, 'clk');
  b.link(clear, 'out', reg, 'clr');
  b.link(reg, 'q', inc, 'a');
  b.link(inc, 's', out, 'in');
  return b.build();
}

function multiplexer(): Circuit {
  const b = new CircuitBuilder('2:1-Multiplexer');
  const a = b.add('input', 70, 100, { label: 'A', value: 0 });
  const bb = b.add('input', 70, 240, { label: 'B', value: 1 });
  const s = b.add('input', 70, 420, { label: 'S', value: 1 });
  const not = b.add('not', 280, 380);
  const and1 = b.add('and', 470, 120);
  const and2 = b.add('and', 470, 260);
  const or = b.add('or', 690, 190);
  const y = b.add('output', 870, 190, { label: 'Y' });
  b.link(s, 'out', not, 'in');
  b.link(a, 'out', and1, 'in1');
  b.link(not, 'out', and1, 'in2');
  b.link(bb, 'out', and2, 'in1');
  b.link(s, 'out', and2, 'in2');
  b.link(and1, 'out', or, 'in1');
  b.link(and2, 'out', or, 'in2');
  b.link(or, 'out', y, 'in');
  return b.build();
}

export const EXAMPLES: Example[] = [
  {
    id: 'half-adder',
    name: 'Halbaddierer',
    description: 'XOR bildet die Summe, AND den Übertrag. Schalte A und B und beobachte die Leitungen.',
    circuit: halfAdder(),
  },
  {
    id: 'full-adder',
    name: 'Volladdierer',
    description: 'Ein Volladdierer aus zwei XOR-, zwei AND- und einem OR-Gatter.',
    hint: '1 + 0 + 1 ergibt Summe 0 bei Übertrag 1.',
    circuit: fullAdder(),
  },
  {
    id: 'sr-latch',
    name: 'SR-Latch',
    description: 'Zwei rückgekoppelte NOR-Gatter speichern ein Bit. S setzt, R löscht.',
    hint: 'S = R = 1 ist der verbotene Zustand.',
    circuit: srLatch(),
  },
  {
    id: 'd-flipflop',
    name: 'D-Flip-Flop',
    description: 'Das D-Flip-Flop übernimmt D bei jeder steigenden Taktflanke.',
    hint: 'Auf »Takt« drücken: Q übernimmt den Wert von D.',
    circuit: dFlipFlop(),
  },
  {
    id: 'register-incrementer',
    name: 'Register + Inkrementer',
    description: '4-Bit-Register mit Load und asynchronem Clear, dahinter ein 4-Bit-Inkrementer.',
    hint: 'Ein Taktschritt lädt den Wert und zeigt Q+1.',
    circuit: registerIncrementer(),
  },
  {
    id: 'multiplexer',
    name: '2:1-Multiplexer',
    description: 'Der Steuereingang S wählt, ob A oder B auf den Ausgang geschaltet wird.',
    circuit: multiplexer(),
  },
];

export function getExample(id: string): Example | undefined {
  return EXAMPLES.find((example) => example.id === id);
}

export function cloneExample(id: string): Example | null {
  const example = getExample(id);
  if (!example) return null;
  return {
    ...example,
    circuit: structuredClone(example.circuit),
  };
}
