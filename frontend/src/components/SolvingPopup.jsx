import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { COLORS } from "./helpers/Constants";
import { fmtTime } from "./helpers/HelperFunctions";
import { getCenter, translateCoords, findSnap, rotateCoords, flipCoords } from "./helpers/GeometryHelperFunctions"

export default function SolverOverlay({ puzzle, pieces, onClose }) {
  const [seconds, setSeconds] = useState(0);
  const [showSolution, setShowSolution] = useState(false);
  const [complete, setComplete] = useState(false);
  const timerRef = useRef(null);
  const svgRef = useRef(null);

  // Each placed piece: { idx, coords (in SVG space), zOrder }
  const [placedPieces, setPlacedPieces] = useState([]);
  const [nextZ, setNextZ] = useState(1);

  // Track which piece index is "active" (last summoned or last moved)
  const [activePieceIdx, setActivePieceIdx] = useState(null);

  // Drag state
  const [dragging, setDragging] = useState(null); // { idx, startMouse, startCoords }

  // Snap threshold in SVG units (approx 3mm — we'll scale relative to puzzle size)
  const SNAP_THRESHOLD = useMemo(() => {
    const coords = puzzle?.shape || [];
    if (!coords.length) return 3;
    const xs = coords.map(c => c[0]);
    const ys = coords.map(c => c[1]);
    const size = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    // 3mm relative to puzzle — assume puzzle prints at ~100mm, so 3% of size
    return size * 0.03;
  }, [puzzle]);

  // Puzzle bounds for viewBox
  const puzzleBounds = useMemo(() => {
    const coords = puzzle?.shape || [];
    if (!coords.length) return { minX: 0, minY: 0, width: 100, height: 100 };
    const xs = coords.map(c => c[0]);
    const ys = coords.map(c => c[1]);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    const w = Math.max(1, maxX - minX);
    const h = Math.max(1, maxY - minY);
    // Add 20% padding so pieces can be dragged outside the outline
    const padX = w * 0.2;
    const padY = h * 0.2;
    return {
      minX: minX - padX,
      minY: minY - padY,
      width: w + padX * 2,
      height: h + padY * 2,
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2,
    };
  }, [puzzle]);

  // Convert SVG coords to viewBox-flipped coords (Y is flipped for screen)
  // In our SVG, y=0 is top. Puzzle coords use math convention (y up).
  // We flip: screenY = (puzzleBounds.minY + puzzleBounds.height) - mathY + puzzleBounds.minY
  // Simplification: screenY = topOfViewBox + height - (mathY - minY) = we just negate
  const toScreenSimple = useCallback(([x, y]) => {
    return [x, 2 * puzzleBounds.minY + puzzleBounds.height - y];
  }, [puzzleBounds]);

  // Which sidebar pieces have been placed
  const placedIdxSet = useMemo(() => new Set(placedPieces.map(p => p.idx)), [placedPieces]);

  /* ── Timer ───────────────────────────────────────── */
  useEffect(() => {
    if (!complete && !showSolution) {
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [complete, showSolution]);

  /* ── Mouse → SVG coordinate conversion ───────────── */
  const clientToSVG = useCallback((clientX, clientY) => {
    const svg = svgRef.current;
    if (!svg) return [0, 0];
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const svgPt = pt.matrixTransform(svg.getScreenCTM().inverse());
    return [svgPt.x, svgPt.y];
  }, []);

  /* ── Summon piece to center of puzzle ────────────── */
  const summonPiece = useCallback((pieceIdx) => {
    if (complete) return;

    // If already placed, remove it (un-place)
    if (placedIdxSet.has(pieceIdx)) {
      setPlacedPieces(prev => prev.filter(p => p.idx !== pieceIdx));
      if (activePieceIdx === pieceIdx) setActivePieceIdx(null);
      return;
    }

    const piece = pieces[pieceIdx];
    if (!piece) return;

    // Center the piece at the puzzle center (in math coords)
    const [pcx, pcy] = getCenter(piece.coords);
    const dx = puzzleBounds.centerX - pcx;
    const dy = puzzleBounds.centerY - pcy;
    const centeredCoords = translateCoords(piece.coords, dx, dy);

    const z = nextZ;
    setNextZ(z + 1);

    setPlacedPieces(prev => [...prev, { idx: pieceIdx, coords: centeredCoords, zOrder: z }]);
    setActivePieceIdx(pieceIdx);
  }, [complete, pieces, placedIdxSet, puzzleBounds, nextZ, activePieceIdx]);

  /* ── Drag handlers ───────────────────────────────── */
  const onPieceMouseDown = useCallback((e, pieceIdx) => {
    if (complete) return;
    e.stopPropagation();
    e.preventDefault();

    const [mx, my] = clientToSVG(e.clientX, e.clientY);
    const placed = placedPieces.find(p => p.idx === pieceIdx);
    if (!placed) return;

    // Bring to top
    const z = nextZ;
    setNextZ(z + 1);
    setPlacedPieces(prev =>
      prev.map(p => p.idx === pieceIdx ? { ...p, zOrder: z } : p)
    );
    setActivePieceIdx(pieceIdx);

    setDragging({
      idx: pieceIdx,
      startMouse: [mx, my],
      startCoords: placed.coords.map(c => [...c]),
    });
  }, [complete, clientToSVG, placedPieces, nextZ]);

  const onMouseMove = useCallback((e) => {
    if (!dragging) return;

    const [mx, my] = clientToSVG(e.clientX, e.clientY);
    // In screen-space SVG: moving down = increasing screenY.
    // Our coords are in math space, but we store them in math space and
    // convert to screen only for rendering. So drag delta in screen space
    // needs to be converted: dx is same, dy is negated (screen down = math down in our flip).
    const dxScreen = mx - dragging.startMouse[0];
    const dyScreen = my - dragging.startMouse[1];
    // Since toScreen flips Y, a screen-space downward movement (positive dy)
    // corresponds to a negative math-Y movement. But since we're working
    // purely in screen coords for the drag (startMouse is in screen SVG coords),
    // we translate in screen space and store screen coords... 
    // Actually, let's keep it simple: store coords in MATH space, convert on render.
    // Drag delta in screen SVG: dxScreen, dyScreen.
    // In math space: dx = dxScreen, dy = -dyScreen (because Y is flipped).
    const dxMath = dxScreen;
    const dyMath = -dyScreen;

    let newCoords = translateCoords(dragging.startCoords, dxMath, dyMath);

    // Snap check
    const snap = findSnap(
      dragging.idx,
      newCoords,
      placedPieces.filter(p => p.idx !== dragging.idx),
      SNAP_THRESHOLD
    );
    if (snap) {
      newCoords = translateCoords(newCoords, snap.dx, snap.dy);
    }

    setPlacedPieces(prev =>
      prev.map(p => p.idx === dragging.idx ? { ...p, coords: newCoords } : p)
    );
  }, [dragging, clientToSVG, placedPieces, SNAP_THRESHOLD]);

  const onMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  // Attach move/up to window so drag works outside SVG
  useEffect(() => {
    if (dragging) {
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
      return () => {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };
    }
  }, [dragging, onMouseMove, onMouseUp]);

  /* ── Rotate active piece 45° CW ──────────────────── */
  const rotateActive = useCallback(() => {
    if (activePieceIdx == null || complete) return;
    setPlacedPieces(prev =>
      prev.map(p => {
        if (p.idx !== activePieceIdx) return p;
        return { ...p, coords: rotateCoords(p.coords, 45) };
      })
    );
  }, [activePieceIdx, complete]);

  /* ── Flip active piece across vertical center ────── */
  const flipActive = useCallback(() => {
    if (activePieceIdx == null || complete) return;
    setPlacedPieces(prev =>
      prev.map(p => {
        if (p.idx !== activePieceIdx) return p;
        return { ...p, coords: flipCoords(p.coords) };
      })
    );
  }, [activePieceIdx, complete]);

  /* ── Reset ───────────────────────────────────────── */
  const reset = () => {
    setPlacedPieces([]);
    setNextZ(1);
    setActivePieceIdx(null);
    setShowSolution(false);
    setComplete(false);
    setSeconds(0);
    setDragging(null);
  };

  /* ── Completion check ────────────────────────────── */
  const isComplete =
    pieces.length > 0 && placedPieces.length === pieces.length;

  useEffect(() => {
    if (isComplete) {
      clearInterval(timerRef.current);
    }
  }, [isComplete]);

  const timerLabel = isComplete
    ? "Solve time — complete!"
    : showSolution
    ? "Solve time (paused)"
    : "Solve time";

  // Sort placed pieces by zOrder for rendering
  const sortedPlaced = useMemo(
    () => [...placedPieces].sort((a, b) => a.zOrder - b.zOrder),
    [placedPieces]
  );

  /* ── Render ──────────────────────────────────────── */
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
            <svg
              ref={svgRef}
              className="solver-svg"
              viewBox={`${puzzleBounds.minX} ${puzzleBounds.minY} ${puzzleBounds.width} ${puzzleBounds.height}`}
              style={{ cursor: dragging ? "grabbing" : "default" }}
            >
              {showSolution ? (
                // Show solution: render all pieces at their original positions, centered
                pieces.map((p, i) => {
                  const [pcx, pcy] = getCenter(p.coords);
                  const dx = puzzleBounds.centerX - pcx;
                  const dy = puzzleBounds.centerY - pcy;
                  const centered = translateCoords(p.coords, dx, dy);
                  const pts = centered.map(c => toScreenSimple(c).join(",")).join(" ");
                  return (
                    <polygon
                      key={`sol-${i}`}
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
                  {/* Puzzle outline — solid, 4px thick */}
                  <polygon
                    points={puzzle.shape.map(c => toScreenSimple(c).join(",")).join(" ")}
                    fill="none"
                    stroke="var(--c-text)"
                    strokeWidth="4"
                    strokeLinejoin="round"
                    opacity="0.6"
                  />

                  {/* Placed pieces sorted by z-order */}
                  {sortedPlaced.map(({ idx, coords: pCoords }) => {
                    const piece = pieces[idx];
                    if (!piece) return null;
                    const isActive = idx === activePieceIdx;
                    const pts = pCoords.map(c => toScreenSimple(c).join(",")).join(" ");
                    return (
                      <polygon
                        key={`placed-${idx}`}
                        points={pts}
                        fill={COLORS[piece.colorIdx % COLORS.length].fill}
                        stroke={isActive ? "var(--c-accent)" : COLORS[piece.colorIdx % COLORS.length].stroke}
                        strokeWidth={isActive ? 2 : 0.8}
                        opacity="0.85"
                        strokeLinejoin="round"
                        style={{ cursor: complete ? "default" : "grab" }}
                        onMouseDown={e => onPieceMouseDown(e, idx)}
                      />
                    );
                  })}
                </>
              )}
            </svg>

            {!complete && !showSolution && placedPieces.length === 0 && (
              <span className="solver-canvas-hint">
                Click pieces on the right to place them, then drag to position
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
                const isPlaced = placedIdxSet.has(i);
                const isActive = i === activePieceIdx;
                let cls = "solver-piece";
                if (isPlaced) cls += " solver-piece--placed";
                if (isActive && isPlaced) cls += " solver-piece--dragging";
                return (
                  <div key={i} className={cls} onClick={() => summonPiece(i)}>
                    <span
                      className="solver-swatch"
                      style={{ background: COLORS[p.colorIdx % COLORS.length].fill }}
                    />
                    {p.name}
                  </div>
                );
              })}
            </div>

            <div className="solver-controls">
              <span className="solver-controls-label">Controls</span>
              <div className="solver-controls-row">
                <button
                  className="btn-sm"
                  onClick={rotateActive}
                  disabled={activePieceIdx == null || complete}
                >
                  <i className="ti ti-rotate" /> Rotate
                </button>
                <button
                  className="btn-sm"
                  onClick={flipActive}
                  disabled={activePieceIdx == null || complete}
                >
                  <i className="ti ti-flip-horizontal" /> Flip
                </button>
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
