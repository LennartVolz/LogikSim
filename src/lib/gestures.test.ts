import { describe, expect, it } from 'vitest';
import { MAX_ZOOM, MIN_ZOOM } from '../editor/constants';
import { distance, midpoint, pinchViewport, zoomAtPoint } from './gestures';

describe('touch gesture math', () => {
  it('calculates distance and midpoint for two pointers', () => {
    expect(distance({ x: 0, y: 0 }, { x: 30, y: 40 })).toBe(50);
    expect(midpoint({ x: 10, y: 20 }, { x: 30, y: 60 })).toEqual({ x: 20, y: 40 });
  });

  it('zooms around a fixed world point', () => {
    const viewport = { x: 100, y: 50, zoom: 2 };
    const point = { x: 200, y: 150 };
    const next = zoomAtPoint(viewport, point, 1.2);

    expect(next.zoom).toBeCloseTo(2.4);
    expect((point.x - next.x) / next.zoom).toBeCloseTo(50);
    expect((point.y - next.y) / next.zoom).toBeCloseTo(50);
  });

  it('clamps zoom while keeping the anchor fixed', () => {
    const viewport = { x: 20, y: 30, zoom: MAX_ZOOM };
    const next = zoomAtPoint(viewport, { x: 120, y: 130 }, 3);

    expect(next.zoom).toBe(MAX_ZOOM);
    expect((120 - next.x) / next.zoom).toBeCloseTo((120 - 20) / MAX_ZOOM);
  });

  it('keeps the pinch midpoint anchored and follows the fingers', () => {
    const start = {
      startDistance: 100,
      startZoom: 1,
      anchor: { x: 40, y: 20 },
    };
    const next = pinchViewport(start, { x: 140, y: 120 }, 200);

    expect(next.zoom).toBe(2);
    expect((140 - next.x) / next.zoom).toBeCloseTo(40);
    expect((120 - next.y) / next.zoom).toBeCloseTo(20);
  });

  it('honors the minimum and maximum pinch zoom', () => {
    const start = {
      startDistance: 100,
      startZoom: 1,
      anchor: { x: 0, y: 0 },
    };

    expect(pinchViewport(start, { x: 0, y: 0 }, 1).zoom).toBe(MIN_ZOOM);
    expect(pinchViewport(start, { x: 0, y: 0 }, 10_000).zoom).toBe(MAX_ZOOM);
  });
});
