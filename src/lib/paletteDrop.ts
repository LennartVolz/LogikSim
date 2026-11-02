import type { PartKind } from '../engine/types';

export const PALETTE_DROP_EVENT = 'logiksim:palette-drop';

export interface PaletteDropDetail {
  kind: PartKind;
  clientX: number;
  clientY: number;
}

export function isPointOverCanvas(clientX: number, clientY: number): boolean {
  const element = document.elementFromPoint(clientX, clientY);
  return element instanceof Element && !!element.closest('[data-logiksim-canvas]');
}

export function dispatchPaletteDrop(detail: PaletteDropDetail): void {
  window.dispatchEvent(new CustomEvent<PaletteDropDetail>(PALETTE_DROP_EVENT, { detail }));
}
