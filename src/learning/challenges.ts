import type { Circuit, Part, PartKind } from '../engine/types';
import { inputParts, outputParts, evaluateCombination, readOutputPinValue, bitsOf } from '../engine/analysis';
import { simulate } from '../engine/simulate';
import { getPin } from '../engine/parts';
import { CircuitBuilder } from '../circuit/factory';

export type ChallengeDifficulty = 'Einsteiger' | 'Grundlagen' | 'Fortgeschritten';

export interface ChallengeResult {
  passed: boolean;
  summary: string;
  details: string[];
}

export interface Challenge {
  id: string;
  title: string;
  difficulty: ChallengeDifficulty;
  description: string;
  requirements: string[];
  hint: string;
  starter: () => Circuit;
  check: (circuit: Circuit) => ChallengeResult;
}

function xorStarter(): Circuit {
  const b = new CircuitBuilder('Aufgabe: XOR aus Grundgattern');
  b.add('input', 100, 120, { label: 'A' });
  b.add('input', 100, 260, { label: 'B' });
  b.add('output', 860, 190, { label: 'Y' });
  return b.build();
}

function halfAdderStarter(): Circuit {
  const b = new CircuitBuilder('Aufgabe: Halbaddierer');
  b.add('input', 100, 120, { label: 'A' });
  b.add('input', 100, 260, { label: 'B' });
  b.add('output', 880, 120, { label: 'S' });
  b.add('output', 880, 260, { label: 'CO' });
  return b.build();
}

function incrementerStarter(): Circuit {
  const b = new CircuitBuilder('Aufgabe: 4-Bit-Inkrementierer');
  for (let bit = 0; bit < 4; bit += 1) {
    b.add('input', 80, 80 + bit * 110, { label: `A${bit}` });
  }
  for (let bit = 0; bit < 4; bit += 1) {
    b.add('output', 980, 80 + bit * 110, { label: `S${bit}`, bits: 1 });
  }
  return b.build();
}

function formatInputs(labels: string[], values: number[]): string {
  return labels.map((label, index) => `${label}=${values[index]}`).join(', ');
}

function checkerError(circuit: Circuit): ChallengeResult | null {
  const duplicate = new Set<string>();
  for (const wire of circuit.wires) {
    const key = `${wire.to.partId}:${wire.to.pin}`;
    if (duplicate.has(key)) {
      return {
        passed: false,
        summary: 'Mehrere Leitungen liegen auf demselben Eingang.',
        details: ['Entferne die doppelte Verbindung und prüfe die Schaltung erneut.'],
      };
    }
    duplicate.add(key);
  }
  const badWidth = circuit.wires.find((wire) => {
    const from = circuit.parts.find((part) => part.id === wire.from.partId);
    const to = circuit.parts.find((part) => part.id === wire.to.partId);
    if (!from || !to) return true;
    const fromPin = fromPinWidth(from, wire.from.pin);
    const toPin = fromPinWidth(to, wire.to.pin);
    return fromPin !== null && toPin !== null && fromPin !== toPin;
  });
  if (badWidth) {
    return {
      passed: false,
      summary: 'Es gibt eine Verbindung mit unterschiedlicher Bitbreite.',
      details: ['Prüfe die markierten Bauteile und verbinde nur Anschlüsse gleicher Breite.'],
    };
  }
  return null;
}

function fromPinWidth(part: Part, pinId: string): number | null {
  return getPin(part, pinId)?.width ?? null;
}

const XOR_GATE_KINDS = new Set<PartKind>([
  'input',
  'output',
  'and',
  'or',
  'not',
  'nand',
  'nor',
]);

function checkBinaryTruthTable(circuit: Circuit): ChallengeResult {
  const inputs = inputParts(circuit);
  const outputs = outputParts(circuit);
  if (inputs.length !== 2 || outputs.length !== 1) {
    return {
      passed: false,
      summary: 'Die Schaltung braucht genau zwei Eingänge und genau einen Ausgang.',
      details: [`Gefunden: ${inputs.length} Eingänge, ${outputs.length} Ausgänge.`],
    };
  }
  if (bitsOf(inputs[0]) !== 1 || bitsOf(inputs[1]) !== 1 || bitsOf(outputs[0]) !== 1) {
    return {
      passed: false,
      summary: 'Alle Ein- und Ausgänge müssen 1 Bit breit sein.',
      details: [],
    };
  }
  const forbidden = circuit.parts.filter((part) => part.kind === 'xor' || part.kind === 'xnor');
  if (forbidden.length > 0) {
    return {
      passed: false,
      summary: 'XOR und XNOR sind in dieser Aufgabe gesperrt.',
      details: ['Baue die Funktion ausschließlich aus AND, OR, NOT, NAND oder NOR.'],
    };
  }
  const advanced = circuit.parts.find((part) => !XOR_GATE_KINDS.has(part.kind));
  if (advanced) {
    return {
      passed: false,
      summary: 'Für diese Aufgabe sind nur Grundgatter erlaubt.',
      details: ['Verwende ausschließlich AND, OR, NOT, NAND oder NOR.'],
    };
  }
  const labels = inputs.map((part) => part.label?.trim() || 'Eingang');
  const failures: string[] = [];
  for (let a = 0; a < 2; a += 1) {
    for (let b = 0; b < 2; b += 1) {
      const result = evaluateCombination(
        circuit,
        new Map([
          [inputs[0].id, a],
          [inputs[1].id, b],
        ]),
      );
      if (result.unstable) {
        return {
          passed: false,
          summary: 'Die Schaltung findet keinen stabilen Zustand.',
          details: ['Prüfe, ob eine Rückkopplung unbeabsichtigt ist.'],
        };
      }
      const actual = readOutputPinValue(circuit, result.pins, outputs[0]);
      const expected = a ^ b;
      if (actual !== expected) {
        failures.push(`${formatInputs(labels, [a, b])} → ${actual} (erwartet ${expected})`);
      }
    }
  }
  if (failures.length > 0) {
    return {
      passed: false,
      summary: `${failures.length} von 4 Eingabekombinationen sind falsch.`,
      details: failures,
    };
  }
  return {
    passed: true,
    summary: 'Alle vier Eingabekombinationen liefern die XOR-Funktion.',
    details: ['Die Schaltung verhält sich für jede Eingabe korrekt.'],
  };
}

function checkHalfAdder(circuit: Circuit): ChallengeResult {
  const inputs = inputParts(circuit);
  const outputs = outputParts(circuit);
  if (inputs.length !== 2 || outputs.length !== 2) {
    return {
      passed: false,
      summary: 'Ein Halbaddierer braucht genau zwei Eingänge und zwei Ausgänge.',
      details: [`Gefunden: ${inputs.length} Eingänge, ${outputs.length} Ausgänge.`],
    };
  }
  if ([...inputs, ...outputs].some((part) => bitsOf(part) !== 1)) {
    return {
      passed: false,
      summary: 'Alle Ein- und Ausgänge müssen 1 Bit breit sein.',
      details: [],
    };
  }
  const labels = inputs.map((part) => part.label?.trim() || 'Eingang');
  const mismatchesA: string[] = [];
  const mismatchesB: string[] = [];
  for (let a = 0; a < 2; a += 1) {
    for (let b = 0; b < 2; b += 1) {
      const result = evaluateCombination(
        circuit,
        new Map([
          [inputs[0].id, a],
          [inputs[1].id, b],
        ]),
      );
      const sum = a ^ b;
      const carry = a & b;
      const out0 = readOutputPinValue(circuit, result.pins, outputs[0]);
      const out1 = readOutputPinValue(circuit, result.pins, outputs[1]);
      if (out0 !== sum || out1 !== carry) {
        mismatchesA.push(
          `${formatInputs(labels, [a, b])} → ${out0}/${out1} (erwartet Summe=${sum}, Carry=${carry})`,
        );
      }
      if (out0 !== carry || out1 !== sum) {
        mismatchesB.push(
          `${formatInputs(labels, [a, b])} → ${out0}/${out1} (erwartet Carry=${carry}, Summe=${sum})`,
        );
      }
    }
  }
  if (mismatchesB.length === 0) {
    return {
      passed: true,
      summary: 'Alle vier Kombinationen sind korrekt (Summe und Carry erkannt).',
      details: [],
    };
  }
  if (mismatchesA.length === 0) {
    return {
      passed: true,
      summary: 'Alle vier Kombinationen sind korrekt.',
      details: [],
    };
  }
  return {
    passed: false,
    summary: 'Die Wahrheitstabelle stimmt noch nicht mit einem Halbaddierer überein.',
    details: mismatchesA.slice(0, 4),
  };
}

function checkIncrementer(circuit: Circuit): ChallengeResult {
  const inputs = inputParts(circuit);
  const outputs = outputParts(circuit);
  if (inputs.length !== 4 || outputs.length !== 4) {
    return {
      passed: false,
      summary: 'Die Aufgabe braucht genau vier Eingänge (A0–A3) und vier Ausgänge (S0–S3).',
      details: [`Gefunden: ${inputs.length} Eingänge, ${outputs.length} Ausgänge.`],
    };
  }
  if ([...inputs, ...outputs].some((part) => bitsOf(part) !== 1)) {
    return {
      passed: false,
      summary: 'Verwende für diese Aufgabe ausschließlich 1-Bit-Ein- und -Ausgänge.',
      details: [],
    };
  }
  if (circuit.parts.some((part) => part.kind === 'inc4' || part.kind === 'alu4')) {
    return {
      passed: false,
      summary: 'Fertige Additions- und Inkrementierbausteine sind hier gesperrt.',
      details: ['Baue die Funktion aus Gattern, Splittern und Mergern selbst auf.'],
    };
  }
  const failures: string[] = [];
  for (let value = 0; value < 16; value += 1) {
    const overrides = new Map<string, number>();
    inputs.forEach((part, bit) => overrides.set(part.id, (value >> bit) & 1));
    const result = evaluateCombination(circuit, overrides);
    if (result.unstable) {
      return {
        passed: false,
        summary: 'Die Schaltung findet keinen stabilen Zustand.',
        details: ['Prüfe Rückkopplungen und nicht verbundene Eingänge.'],
      };
    }
    let actual = 0;
    outputs.forEach((part, bit) => {
      actual |= readOutputPinValue(circuit, result.pins, part) << bit;
    });
    const expected = (value + 1) & 0xf;
    if (actual !== expected) {
      failures.push(
        `Eingang ${value.toString(2).padStart(4, '0')} → Ausgang ${actual.toString(2).padStart(4, '0')} (erwartet ${expected.toString(2).padStart(4, '0')})`,
      );
    }
  }
  if (failures.length > 0) {
    return {
      passed: false,
      summary: `${16 - failures.length} von 16 Eingabewerten sind korrekt.`,
      details: failures.slice(0, 6),
    };
  }
  return {
    passed: true,
    summary: 'Der 4-Bit-Inkrementierer arbeitet für alle 16 Eingabewerte korrekt.',
    details: ['Bit 0 ist der oberste bzw. linkeste Ein-/Ausgang, Bit 3 der unterste bzw. rechteste.'],
  };
}

export const CHALLENGES: Challenge[] = [
  {
    id: 'xor-from-gates',
    title: 'XOR aus Grundgattern',
    difficulty: 'Einsteiger',
    description:
      'Baue einen XOR-Ausgang ausschließlich aus AND, OR, NOT, NAND oder NOR. XOR und XNOR sind gesperrt.',
    requirements: ['2 Eingänge · 1 Ausgang', 'XOR/XNOR nicht erlaubt', '4 von 4 Fällen korrekt'],
    hint: 'XOR = (A OR B) AND NOT (A AND B).',
    starter: xorStarter,
    check: checkBinaryTruthTable,
  },
  {
    id: 'half-adder',
    title: 'Halbaddierer',
    difficulty: 'Grundlagen',
    description:
      'Addiere zwei Bits. Die Schaltung muss Summe und Übertrag liefern; die Ausgangsreihenfolge ist frei.',
    requirements: ['2 Eingänge · 2 Ausgänge', 'Summe und Carry', '4 von 4 Fällen korrekt'],
    hint: 'Die Summe ist XOR, der Übertrag ist AND.',
    starter: halfAdderStarter,
    check: checkHalfAdder,
  },
  {
    id: 'incrementer-4bit',
    title: '4-Bit-Inkrementierer',
    difficulty: 'Fortgeschritten',
    description:
      'Baue einen Inkrementierer, der zu jedem 4-Bit-Wert den nächsten Wert erzeugt. Der fertige Inkrementer ist gesperrt.',
    requirements: ['4 Eingänge A0–A3 · 4 Ausgänge S0–S3', 'aus Gattern aufgebaut', '16 von 16 Fällen korrekt'],
    hint: 'Beginne mit Bit 0: S0 = NOT A0. Der Übertrag in das nächste Bit ist A0.',
    starter: incrementerStarter,
    check: checkIncrementer,
  },
];

export function getChallenge(id: string): Challenge | undefined {
  return CHALLENGES.find((challenge) => challenge.id === id);
}

export function checkCircuit(circuit: Circuit, challenge: Challenge): ChallengeResult {
  const base = checkerError(circuit);
  if (base) return base;
  try {
    return challenge.check(circuit);
  } catch (error) {
    return {
      passed: false,
      summary: 'Die Prüfung konnte nicht ausgeführt werden.',
      details: [error instanceof Error ? error.message : 'Unbekannter Fehler'],
    };
  }
}

/** Used by tests to validate that a starter is usable as-is. */
export function simulateChallengeCircuit(circuit: Circuit) {
  return simulate(circuit);
}
