import { useState, useEffect, useRef } from "react";
import { COLORS, fmtTime } from "./constants";

export default function SolverOverlay({ puzzle, pieces, onClose }) {
  const [seconds, setSeconds] = useState(0);
  const [placed, setPlaced] = useState(new Set());
  const [showSolution, setShowSolution] = useState(false);
  const [complete, setComplete] = useState(false);
  const timerRef = useRef(null);

  // Timer
  useEffect(() => {
    if (!complete && !showSolution) {
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [complete, showSolution]);

  const togglePlace = (idx) => {
    if (complete) return;
    const next = new Set(placed);
    if (next.has(idx)) next.delete(idx); else next.add(idx);
    setPlaced(next);
    if (next.size === pieces.length) {
      setComplete(true);
      clearInterval(timerRef.current);
    }
  };

  const reset = () => {
    setPlaced(new Set());
    setShowSolution(false);
    setComplete(false);
    setSeconds(0);
  };

  const timerLabel = complete
    ? "Solve time — complete!"
    : showSolution
    ? "Solve time (paused)"
    : "Solve time";

  return (
    <div className="solver-overlay solver-overlay--visible" onClick={onClose}>
      <div className="solver-modal" onClick={e => e.stopPropagation()}>
        {/* Top bar */}
        <div className="solver-topbar">
          <h3 className="solver-title">Puzzle #{puzzle.num}</h3>
          <button className="solver-close" onClick={onClose} aria-label="Close puzzle">
            <i className="ti ti-x" />
          </button>
        </div>

        {/* Body */}
        <div className="solver-body">
          {/* Canvas */}
          <div className="solver-canvas">
            <svg className="solver-svg" viewBox="0 0 100 100">
              {showSolution || complete ? (
                pieces.map((p, i) => {
                  const pts = p.coords.map(c => `${c[0]},${100 - c[1]}`).join(" ");
                  return (
                    <polygon
                      key={i}
                      points={pts}
                      fill={COLORS[p.colorIdx % COLORS.length].fill}
                      stroke={COLORS[p.colorIdx % COLORS.length].stroke}
                      strokeWidth="0.8"
                      opacity="0.85"
                      strokeLinejoin="round"
                    />
                  );
                })
              ) : (
                <>
                  <polygon
                    points={puzzle.shape.map(c => c.join(",")).join(" ")}
                    fill="none"
                    stroke="var(--c-text)"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                    strokeDasharray="4 3"
                    opacity="0.35"
                  />
                  {[...placed].map(idx => {
                    const p = pieces[idx];
                    if (!p) return null;
                    const pts = p.coords.map(c => `${c[0]},${100 - c[1]}`).join(" ");
                    return (
                      <polygon
                        key={idx}
                        points={pts}
                        fill={COLORS[p.colorIdx % COLORS.length].fill}
                        stroke={COLORS[p.colorIdx % COLORS.length].stroke}
                        strokeWidth="0.6"
                        opacity="0.8"
                        strokeLinejoin="round"
                      />
                    );
                  })}
                </>
              )}
            </svg>

            {!complete && !showSolution && (
              <span className="solver-canvas-hint">
                Click pieces on the right to place them on the canvas
              </span>
            )}

            {complete && (
              <div className="solver-complete-badge">
                <span className="solver-complete-icon">
                  <i className="ti ti-check" />
                </span>
                <span className="solver-complete-text">Puzzle complete!</span>
                <span className="solver-complete-time">Solved in {fmtTime(seconds)}</span>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="solver-sidebar">
            <h4 className="solver-sidebar-title">Pieces</h4>
            <div className="solver-piece-list">
              {pieces.map((p, i) => {
                const isPlaced = placed.has(i);
                let cls = "solver-piece";
                if (isPlaced) cls += " solver-piece--placed";
                return (
                  <div key={i} className={cls} onClick={() => togglePlace(i)}>
                    <span className="solver-swatch" style={{ background: COLORS[p.colorIdx % COLORS.length].fill }} />
                    {p.name}
                  </div>
                );
              })}
            </div>

            <div className="solver-controls">
              <span className="solver-controls-label">Controls</span>
              <div className="solver-controls-row">
                <button className="btn-sm"><i className="ti ti-rotate" /> Rotate</button>
                <button className="btn-sm"><i className="ti ti-flip-horizontal" /> Flip</button>
              </div>
              <button className="btn-sm btn-sm--full" onClick={reset}>
                <i className="ti ti-refresh" /> Reset all pieces
              </button>
            </div>

            <div className="solver-solution-section">
              <button
                className="btn-sm btn-sm--full"
                onClick={() => setShowSolution(!showSolution)}
                disabled={complete}
              >
                <i className={`ti ti-${showSolution ? "eye-off" : "eye"}`} />
                {showSolution ? " Hide solution" : " Show solution"}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="solver-footer">
          <div className="solver-timer-group">
            <span className="solver-timer">{fmtTime(seconds)}</span>
            <span className="solver-timer-label">{timerLabel}</span>
          </div>
          <div className="solver-actions">
            <button className="btn-sm">
              <i className="ti ti-download" /> Export SVG
            </button>
            <button className="btn-primary btn-primary--sm" onClick={onClose}>
              <i className="ti ti-check" /> Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}