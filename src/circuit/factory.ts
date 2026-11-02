import type { Circuit, Part, PartKind, Wire } from '../engine/types';

export interface PartOptions {
  label?: string;
  value?: number;
  bits?: number;
  modulo?: number;
}

let uidCounter = 0;

export function makeId(prefix: string): string {
  uidCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${uidCounter.toString(36)}`;
}

/** Small builder that keeps hand-written example circuits readable. */
export class CircuitBuilder {
  private parts: Part[] = [];
  private wires: Wire[] = [];
  private partCounter = 0;
  private wireCounter = 0;

  constructor(private readonly circuitName: string) {}

  add(kind: PartKind, x: number, y: number, options: PartOptions = {}): Part {
    this.partCounter += 1;
    const part: Part = {
      id: `p${this.partCounter}`,
      kind,
      x,
      y,
    };
    if (options.label !== undefined) part.label = options.label;
    if (options.value !== undefined) part.value = options.value;
    if (options.bits !== undefined) part.bits = options.bits;
    if (options.modulo !== undefined) part.modulo = options.modulo;
    this.parts.push(part);
    return part;
  }

  link(from: Part, fromPin: string, to: Part, toPin: string): void {
    this.wireCounter += 1;
    this.wires.push({
      id: `w${this.wireCounter}`,
      from: { partId: from.id, pin: fromPin },
      to: { partId: to.id, pin: toPin },
    });
  }

  build(name = this.circuitName): Circuit {
    return {
      name,
      parts: this.parts.map((part) => ({ ...part })),
      wires: this.wires.map((wire) => ({
        ...wire,
        from: { ...wire.from },
        to: { ...wire.to },
      })),
    };
  }
}
