import type { Viewport } from '../engine/types';
import { MAX_ZOOM, MIN_ZOOM } from '../editor/constants';
import type { Point } from './wireRouting';

export function clampZoom(zoom: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Zooms around a point in SVG-local coordinates while keeping it stationary. */
export function zoomAtPoint(viewport: Viewport, point: Point, factor: number): Viewport {
  const zoom = clampZoom(viewport.zoom * factor);
  const worldX = (point.x - viewport.x) / viewport.zoom;
  const worldY = (point.y - viewport.y) / viewport.zoom;
  return {
    x: point.x - worldX * zoom,
    y: point.y - worldY * zoom,
    zoom,
  };
}

export interface PinchStart {
  startDistance: number;
  startZoom: number;
  anchor: Point;
}

/**
 * Maps a two-finger gesture to the viewport. The world point below the
 * midpoint stays under the fingers while they zoom and move together.
 */
export function pinchViewport(
  start: PinchStart,
  center: Point,
  currentDistance: number,
): Viewport {
  const ratio = start.startDistance > 0 ? currentDistance / start.startDistance : 1;
  const zoom = clampZoom(start.startZoom * ratio);
  return {
    x: center.x - start.anchor.x * zoom,
    y: center.y - start.anchor.y * zoom,
    zoom,
  };
}
