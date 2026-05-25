export function polyArea(coords) {
  let a = 0;
  for (let i = 0; i < coords.length; i++) {
    const j = (i + 1) % coords.length;
    a += coords[i][0] * coords[j][1] - coords[j][0] * coords[i][1];
  }
  return Math.abs(a / 2);
}

export function cloneDeep(obj) { return JSON.parse(JSON.stringify(obj)); }

export function fmtTime(s) { return `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`; }

export function getGraphBounds(pieces) {
  if (!pieces.length) return { min: 0, max: 100 };
  let mn = Infinity, mx = -Infinity;
  pieces.forEach(p => p.coords.forEach(c => { mn = Math.min(mn, c[0], c[1]); mx = Math.max(mx, c[0], c[1]); }));
  const pad = (mx - mn) * 0.1 || 10;
  return { min: Math.floor(mn - pad), max: Math.ceil(mx + pad) };
}

export function getGridTicks(bounds) {
  const range = bounds.max - bounds.min || 1;
  const step = range <= 20 ? 5 : range <= 60 ? 10 : range <= 150 ? 25 : 50;
  const ticks = [];
  for (let v = Math.ceil(bounds.min / step) * step; v <= bounds.max; v += step) ticks.push(v);
  return ticks;
}
