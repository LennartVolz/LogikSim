import {
  IO_BIT_OPTIONS,
  PART_DEFS,
  counterModulo,
  getPin,
  mask,
  normalizeCounterModulo,
} from '../engine/parts';
import type { Circuit, Part, PartKind, Wire } from '../engine/types';

export const STORAGE_KEY = 'logiksim.project.v1';
export const PROJECT_FORMAT = 'logiksim';
export const PROJECT_VERSION = 1;
const MAX_PARTS = 400;
const MAX_WIRES = 800;

export interface ProjectFile {
  format: typeof PROJECT_FORMAT;
  version: number;
  name: string;
  parts: Part[];
  wires: Wire[];
}

export interface ParseSuccess {
  ok: true;
  circuit: Circuit;
  skippedWires: number;
}

export interface ParseFailure {
  ok: false;
  error: string;
}

export type ParseResult = ParseSuccess | ParseFailure;

const RESERVED_IDS = new Set(['__proto__', 'prototype', 'constructor']);

function isSafeId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 120 &&
    /^[A-Za-z0-9_-]+$/.test(value) &&
    !RESERVED_IDS.has(value)
  );
}

function cleanPart(value: unknown): Part | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (!isSafeId(raw.id)) return null;
  if (typeof raw.kind !== 'string' || !Object.hasOwn(PART_DEFS, raw.kind)) return null;
  if (typeof raw.x !== 'number' || !Number.isFinite(raw.x)) return null;
  if (typeof raw.y !== 'number' || !Number.isFinite(raw.y)) return null;

  const kind = raw.kind as PartKind;
  const part: Part = {
    id: raw.id,
    kind,
    x: Math.max(-100000, Math.min(100000, Math.round(raw.x))),
    y: Math.max(-100000, Math.min(100000, Math.round(raw.y))),
  };

  if (typeof raw.label === 'string') {
    const label = raw.label.trim().slice(0, 80);
    if (label) part.label = label;
  }

  if (kind === 'input' || kind === 'output') {
    const bits = [1, 4, 8].includes(Number(raw.bits)) ? Number(raw.bits) : 1;
    part.bits = bits;
  }

  if (kind === 'input') {
    const value = typeof raw.value === 'number' && Number.isFinite(raw.value) ? raw.value : 0;
    part.value = mask(value, part.bits ?? 1);
  }

  if (kind === 'counter4') {
    part.modulo = normalizeCounterModulo(
      typeof raw.modulo === 'number' && Number.isFinite(raw.modulo) ? raw.modulo : undefined,
    );
  }

  return part;
}

export function serializeProject(circuit: Circuit): string {
  const project: ProjectFile = {
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    name: circuit.name.trim().slice(0, 80) || 'Unbenannte Schaltung',
    parts: circuit.parts.map((part) => {
      const clean: Part = { id: part.id, kind: part.kind, x: part.x, y: part.y };
      if (part.label?.trim()) clean.label = part.label.trim();
      if (part.kind === 'input' || part.kind === 'output') clean.bits = part.bits ?? 1;
      if (part.kind === 'input') clean.value = mask(part.value ?? 0, part.bits ?? 1);
      if (part.kind === 'counter4') clean.modulo = counterModulo(part);
      return clean;
    }),
    wires: circuit.wires.map((wire) => ({
      id: wire.id,
      from: { ...wire.from },
      to: { ...wire.to },
    })),
  };
  return `${JSON.stringify(project, null, 2)}\n`;
}

export function parseProject(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Die Datei enthält kein gültiges JSON.' };
  }
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Das Projektformat ist ungültig.' };
  }
  const data = raw as Record<string, unknown>;
  if (data.format !== PROJECT_FORMAT) {
    return { ok: false, error: 'Das ist keine LogikSim-Projektdatei.' };
  }
  if (data.version !== PROJECT_VERSION) {
    return { ok: false, error: `Nicht unterstützte Projektversion: ${String(data.version)}.` };
  }
  if (!Array.isArray(data.parts) || !Array.isArray(data.wires)) {
    return { ok: false, error: 'Bauteile oder Leitungen fehlen im Projekt.' };
  }
  if (data.parts.length > MAX_PARTS) {
    return { ok: false, error: `Das Projekt enthält mehr als ${MAX_PARTS} Bauteile.` };
  }
  if (data.wires.length > MAX_WIRES) {
    return { ok: false, error: `Das Projekt enthält mehr als ${MAX_WIRES} Leitungen.` };
  }

  const parts: Part[] = [];
  const ids = new Set<string>();
  for (const entry of data.parts) {
    const part = cleanPart(entry);
    if (!part) {
      return { ok: false, error: 'Mindestens ein Bauteil hat ungültige Daten.' };
    }
    if (ids.has(part.id)) {
      return { ok: false, error: `Doppelte Bauteil-ID: ${part.id}.` };
    }
    ids.add(part.id);
    parts.push(part);
  }

  const partMap = new Map(parts.map((part) => [part.id, part]));
  const occupiedInputs = new Set<string>();
  const wireIds = new Set<string>();
  const wires: Wire[] = [];
  let skippedWires = 0;

  for (const entry of data.wires) {
    if (!entry || typeof entry !== 'object') {
      skippedWires += 1;
      continue;
    }
    const rawWire = entry as Record<string, unknown>;
    const from = rawWire.from as Record<string, unknown> | undefined;
    const to = rawWire.to as Record<string, unknown> | undefined;
    if (
      !isSafeId(rawWire.id) ||
      wireIds.has(rawWire.id) ||
      !from ||
      !to ||
      !isSafeId(from.partId) ||
      typeof from.pin !== 'string' ||
      !isSafeId(to.partId) ||
      typeof to.pin !== 'string'
    ) {
      skippedWires += 1;
      continue;
    }
    const fromPart = partMap.get(from.partId);
    const toPart = partMap.get(to.partId);
    if (!fromPart || !toPart || fromPart.id === toPart.id) {
      skippedWires += 1;
      continue;
    }
    const fromPin = getPin(fromPart, from.pin);
    const toPin = getPin(toPart, to.pin);
    if (!fromPin || !toPin || fromPin.dir !== 'out' || toPin.dir !== 'in') {
      skippedWires += 1;
      continue;
    }
    const destKey = `${toPart.id}:${to.pin}`;
    if (occupiedInputs.has(destKey)) {
      skippedWires += 1;
      continue;
    }
    occupiedInputs.add(destKey);
    wireIds.add(rawWire.id);
    wires.push({
      id: rawWire.id,
      from: { partId: from.partId, pin: from.pin },
      to: { partId: to.partId, pin: to.pin },
    });
  }

  const name =
    typeof data.name === 'string' && data.name.trim()
      ? data.name.trim().slice(0, 80)
      : 'Importierte Schaltung';

  return {
    ok: true,
    circuit: { name, parts, wires },
    skippedWires,
  };
}

export function saveLocalCircuit(circuit: Circuit): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, serializeProject(circuit));
  } catch {
    // Storage can be unavailable or full. The editor still works in memory.
  }
}

export function loadLocalCircuit(): Circuit | null {
  try {
    const text = window.localStorage.getItem(STORAGE_KEY);
    if (!text) return null;
    const parsed = parseProject(text);
    return parsed.ok ? parsed.circuit : null;
  } catch {
    return null;
  }
}

export function slugifyName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/ä/g, 'ae')
      .replace(/ö/g, 'oe')
      .replace(/ü/g, 'ue')
      .replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'logiksim'
  );
}

export function downloadProject(circuit: Circuit): void {
  const blob = new Blob([serializeProject(circuit)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${slugifyName(circuit.name)}.logiksim.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export { IO_BIT_OPTIONS };
