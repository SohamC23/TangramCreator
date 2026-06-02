/* ── Geometry helpers ──────────────────────────────── */
 
// Center = midpoint between min and max of X, and min and max of Y
export function getCenter(coords) {
  const xs = coords.map(c => c[0]);
  const ys = coords.map(c => c[1]);
  return [
    (Math.min(...xs) + Math.max(...xs)) / 2,
    (Math.min(...ys) + Math.max(...ys)) / 2,
  ];
}
 
// Rotate coords 45° clockwise around center
export function rotateCoords(coords, angleDeg = 45) {
  const [cx, cy] = getCenter(coords);
  const rad = (-angleDeg * Math.PI) / 180; // negative because clockwise
  return coords.map(([x, y]) => {
    const dx = x - cx;
    const dy = y - cy;
    return [
      cx + dx * Math.cos(rad) - dy * Math.sin(rad),
      cy + dx * Math.sin(rad) + dy * Math.cos(rad),
    ];
  });
}
 
// Flip coords across vertical axis through center
export function flipCoords(coords) {
  const [cx] = getCenter(coords);
  return coords.map(([x, y]) => [2 * cx - x, y]);
}
 
// Translate all coords by dx, dy
export function translateCoords(coords, dx, dy) {
  return coords.map(([x, y]) => [x + dx, y + dy]);
}
 
// Distance between two points
export function dist(a, b) {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2);
}
 
// Find the closest snap: checks every vertex of `movingCoords` against every
// vertex of every other placed piece. Returns { dx, dy } to apply, or null.
export function findSnap(movingIdx, movingCoords, allPlacedPieces, snapThreshold) {
  let bestDist = Infinity;
  let bestDx = 0;
  let bestDy = 0;
 
  for (const other of allPlacedPieces) {
    if (other.idx === movingIdx) continue;
    for (const mp of movingCoords) {
      for (const op of other.coords) {
        const d = dist(mp, op);
        if (d < snapThreshold && d < bestDist) {
          bestDist = d;
          bestDx = op[0] - mp[0];
          bestDy = op[1] - mp[1];
        }
      }
    }
  }
 
  return bestDist < snapThreshold ? { dx: bestDx, dy: bestDy } : null;
}

export function parsePuzzleShapeVertices(puzzleShape) {
  if (!puzzleShape) return [];
  if (Array.isArray(puzzleShape)) return puzzleShape;
  if (Array.isArray(puzzleShape.coordinates)) return puzzleShape.coordinates;
  if (Array.isArray(puzzleShape.exteriors)) return puzzleShape.exteriors.flat();
  if (Array.isArray(puzzleShape.holes)) return puzzleShape.holes.flat();
  return [];
}

export function findPuzzleSnap(pieceCoords, puzzleShape, threshold) {
  const puzzleCoords = parsePuzzleShapeVertices(puzzleShape);
  // Check if any piece vertex is close to any puzzle vertex
  for (let pCoord of pieceCoords) {
    for (let qCoord of puzzleCoords) {
      const dist = Math.hypot(pCoord[0] - qCoord[0], pCoord[1] - qCoord[1]);
      if (dist < threshold) {
        // Snap to puzzle vertex
        return {
          dx: qCoord[0] - pCoord[0],
          dy: qCoord[1] - pCoord[1],
        };
      }
    }
  }
  return null;
}