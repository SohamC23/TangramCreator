import { COLORS } from "./helpers/Constants";

export default function Dashboard({
  pieces,
  presetName,
  puzzlesForPreset,
  hasAnyPuzzles,
  onGenerate,
  onOpenSolver,
}) {

  function getShapeRings(shape) {
    if (!shape) return [];
    if (Array.isArray(shape)) return [shape];
    if (Array.isArray(shape.exteriors)) return shape.exteriors;
    if (Array.isArray(shape.coordinates)) return [shape.coordinates];
    return [];
  }

  function getShapeHoles(shape) {
    if (!shape) return [];
    if (Array.isArray(shape.holes)) return shape.holes;
    if (Array.isArray(shape.hole_coordinates)) return shape.hole_coordinates;
    return [];
  }

  function getShapeVertices(shape) {
    return [...getShapeRings(shape).flat(), ...getShapeHoles(shape).flat()];
  }

  function buildShapePath(shape) {
    const rings = [...getShapeRings(shape), ...getShapeHoles(shape)];
    if (!rings.length) return "";

    return rings
      .filter(ring => Array.isArray(ring) && ring.length)
      .map((ring) => {
        const [first, ...rest] = ring;
        const moved = `M ${first[0]} ${first[1]}`;
        const lines = rest.map(([x, y]) => `L ${x} ${y}`);
        return [moved, ...lines, "Z"].join(" ");
      })
      .join(" ");
  }

  function getPuzzleBounds(p) {
    const coords = getShapeVertices(p?.shape);
    if (!coords.length) {
      return { minX: 0, minY: 0, maxX: 100, maxY: 100, pad: 0 };
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    coords.forEach(([x, y]) => {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    });

    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);
    const pad = Math.max(width, height) * 0.08;

    return {
      minX,
      minY,
      maxX,
      maxY,
      pad,
    };
  };

  // Only consider puzzles explicitly marked `solved: true` as solved.
  // Generator may include `solvedShapes` (the expected arrangement) but that
  // should not mark a puzzle as solved until the user actually solves it.
  const solvedCount = puzzlesForPreset.filter(p => p.solved === true).length;

  return (
    <section className="section">
      <h2 className="section-title">Dashboard</h2>
      <p className="section-sub">
        {pieces.length
          ? `Using ${pieces.length} pieces from ${presetName}`
          : "No pieces — add some below"}
      </p>

      <button
        className="gen-btn"
        onClick={onGenerate}
        disabled={!pieces.length}
        style={!pieces.length ? { opacity: 0.4, cursor: "not-allowed" } : undefined}
      >
        <i className="ti ti-puzzle" /> Generate puzzle
      </button>

      <div className="stats-row">
        <div className="stat-card">
          <span className="stat-label">Puzzles generated</span>
          <span className="stat-value">{puzzlesForPreset.length}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Puzzles solved</span>
          <span className="stat-value">{solvedCount}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Current pieces</span>
          <span className="stat-value">{pieces.length}</span>
        </div>
      </div>

      {puzzlesForPreset.length === 0 ? (
        <div className="empty-state">
          <i className="ti ti-puzzle" />
          <span>
            {hasAnyPuzzles
              ? "No puzzles generated with this piece set yet. Hit generate to create one."
              : "Hit the generate button to create your first puzzle."}
          </span>
        </div>
      ) : (
        <div className="puzzle-scroll">
          <div className="puzzle-grid">
            {puzzlesForPreset.map((p) => {
              const bounds = getPuzzleBounds(p);
              const viewMinX = bounds.minX - bounds.pad;
              const viewMinY = bounds.minY - bounds.pad;
              const viewWidth = (bounds.maxX - bounds.minX) + bounds.pad * 2;
              const viewHeight = (bounds.maxY - bounds.minY) + bounds.pad * 2;
              return (
                <div
                  key={p.id}
                  className="puzzle-tile"
                  onClick={() => onOpenSolver(p)}
                >
                  {p.solved === true && (
                    <span className="puzzle-solved-badge">
                      <i className="ti ti-circle-check" /> Solved
                    </span>
                  )}
                  <svg
                    viewBox={`${viewMinX} ${viewMinY} ${viewWidth} ${viewHeight}`}
                    preserveAspectRatio="xMidYMid meet"
                  >
                    <g transform={`translate(0, ${viewMinY * 2 + viewHeight}) scale(1, -1)`}>
                      <path
                        d={buildShapePath(p.shape)}
                        fill={COLORS[p.num % COLORS.length].fill}
                        stroke={COLORS[p.num % COLORS.length].stroke}
                        strokeWidth="1"
                        strokeLinejoin="round"
                        fillRule="evenodd"
                      />
                    </g>
                  </svg>
                  <span className="puzzle-tile-label">Puzzle #{p.num}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="section-nav">
        <button
          className="btn-outline"
          onClick={() => document.getElementById("creator-section")?.scrollIntoView({ behavior: "smooth" })}
        >
          <i className="ti ti-puzzle" /> Create custom pieces <i className="ti ti-arrow-down" />
        </button>
      </div>
    </section>
  );
}