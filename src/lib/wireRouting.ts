export interface Point {
  x: number;
  y: number;
}

/**
 * Orthogonal wire routing. Backward connections (feedback) are routed around
 * the parts instead of cutting straight through them.
 */
export function wireRoute(from: Point, to: Point): Point[] {
  if (to.x - from.x >= 40) {
    const midX = from.x + (to.x - from.x) / 2;
    return [from, { x: midX, y: from.y }, { x: midX, y: to.y }, to];
  }

  const offset = to.y >= from.y ? 30 : -30;
  const bendY = to.y >= from.y ? Math.max(from.y, to.y) + offset : Math.min(from.y, to.y) + offset;
  const outX = from.x + 26;
  const inX = to.x - 26;
  return [
    from,
    { x: outX, y: from.y },
    { x: outX, y: bendY },
    { x: inX, y: bendY },
    { x: inX, y: to.y },
    to,
  ];
}

export function roundedPath(points: Point[], radius = 9): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const next = points[index + 1];
    const inLength = Math.hypot(current.x - previous.x, current.y - previous.y);
    const outLength = Math.hypot(next.x - current.x, next.y - current.y);
    const r = Math.min(radius, inLength / 2, outLength / 2);
    if (r < 1) {
      path += ` L ${current.x} ${current.y}`;
      continue;
    }
    const inDirX = (current.x - previous.x) / (inLength || 1);
    const inDirY = (current.y - previous.y) / (inLength || 1);
    const outDirX = (next.x - current.x) / (outLength || 1);
    const outDirY = (next.y - current.y) / (outLength || 1);
    const start = { x: current.x - inDirX * r, y: current.y - inDirY * r };
    const end = { x: current.x + outDirX * r, y: current.y + outDirY * r };
    path += ` L ${start.x} ${start.y} Q ${current.x} ${current.y} ${end.x} ${end.y}`;
  }
  const last = points[points.length - 1];
  path += ` L ${last.x} ${last.y}`;
  return path;
}

export function wireMidpoint(points: Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  let bestIndex = 0;
  let bestLength = -1;
  for (let index = 0; index < points.length - 1; index += 1) {
    const length = Math.hypot(
      points[index + 1].x - points[index].x,
      points[index + 1].y - points[index].y,
    );
    if (length > bestLength) {
      bestLength = length;
      bestIndex = index;
    }
  }
  const a = points[bestIndex];
  const b = points[bestIndex + 1];
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
