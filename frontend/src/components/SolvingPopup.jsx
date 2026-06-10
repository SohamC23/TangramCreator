import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { COLORS } from "./helpers/Constants";
import { fmtTime } from "./helpers/HelperFunctions";
import { getCenter, translateCoords, findSnap, findPuzzleSnap, rotateCoords, flipCoords } from "./helpers/GeometryHelperFunctions"

export default function SolverOverlay({ puzzle, pieces, solvedShapes = [], isComplete, onCheckSolved, feedbackMessage = "", onClose }) {
  const [seconds, setSeconds] = useState(0);
  const [showSolution, setShowSolution] = useState(false);
  const timerRef = useRef(null);
  const svgRef = useRef(null);

  // Each placed piece: { idx, coords (in math space), zOrder }
  const [placedPieces, setPlacedPieces] = useState([]);
  const [nextZ, setNextZ] = useState(1);

  // Track which piece index is "active" (last summoned or last moved)
  const [activePieceIdx, setActivePieceIdx] = useState(null);

  // Drag state
  const [dragging, setDragging] = useState(null);

  const getShapeRings = useCallback((shape) => {
    if (!shape) return [];
    if (Array.isArray(shape)) return [shape];
    if (Array.isArray(shape.exteriors)) return shape.exteriors;
    if (Array.isArray(shape.coordinates)) return [shape.coordinates];
    return [];
  }, []);

  const getShapeHoles = useCallback((shape) => {
    if (!shape) return [];
    return shape.holes || shape.hole_coordinates || [];
  }, []);

  const getShapeVertices = useCallback((shape) => {
    const rings = getShapeRings(shape);
    const holes = getShapeHoles(shape);
    return [...rings.flat(), ...holes.flat()];
  }, [getShapeRings, getShapeHoles]);

  const buildShapePath = useCallback((shape) => {
    const rings = [...getShapeRings(shape), ...getShapeHoles(shape)];
    return rings
      .filter(ring => Array.isArray(ring) && ring.length)
      .map((ring) => {
        const [first, ...rest] = ring;
        const path = [`M ${first[0]} ${first[1]}`];
        rest.forEach(([x, y]) => path.push(`L ${x} ${y}`));
        path.push("Z");
        return path.join(" ");
      })
      .join(" ");
  }, [getShapeRings, getShapeHoles]);

  // Snap threshold in SVG units (approx 3mm — scale relative to puzzle size)
  const SNAP_THRESHOLD = useMemo(() => {
    const coords = getShapeVertices(puzzle?.shape);
    if (!coords.length) return 3;
    const xs = coords.map(c => c[0]);
    const ys = coords.map(c => c[1]);
    const size = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    return size * 0.04;
  }, [puzzle, getShapeVertices]);

  // Puzzle bounds for viewBox
  const puzzleBounds = useMemo(() => {
    const coords = getShapeVertices(puzzle?.shape);
    if (!coords.length) return { minX: 0, minY: 0, width: 100, height: 100 };
    const xs = coords.map(c => c[0]);
    const ys = coords.map(c => c[1]);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    const w = Math.max(1, maxX - minX);
    const h = Math.max(1, maxY - minY);
    const paddingFactor = 0.25;
    const padX = w * paddingFactor;
    const padY = h * paddingFactor;
    return {
      minX: minX - padX,
      minY: minY - padY,
      width: w + padX * 2,
      height: h + padY * 2,
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2,
    };
  }, [puzzle, getShapeVertices]);

  // Convert math coords to screen SVG coords (flip Y)
  const toScreenSimple = useCallback(([x, y]) => {
    return [x, 2 * puzzleBounds.minY + puzzleBounds.height - y];
  }, [puzzleBounds]);

  // Which sidebar pieces have been placed
  const placedIdxSet = useMemo(() => new Set(placedPieces.map(p => p.idx)), [placedPieces]);

  /* ── Timer ───────────────────────────────────────── */
  useEffect(() => {
    if (!isComplete && !showSolution) {
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [isComplete, showSolution]);

  // Stop timer when complete
  useEffect(() => {
    if (isComplete) {
      clearInterval(timerRef.current);
    }
  }, [isComplete]);

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
    if (isComplete) return;

    // If already placed, remove it (un-place)
    if (placedIdxSet.has(pieceIdx)) {
      setPlacedPieces(prev => prev.filter(p => p.idx !== pieceIdx));
      if (activePieceIdx === pieceIdx) setActivePieceIdx(null);
      return;
    }

    const piece = pieces[pieceIdx];
    if (!piece) return;

    const [pcx, pcy] = getCenter(piece.coords);
    const dx = puzzleBounds.centerX - pcx;
    const dy = puzzleBounds.centerY - pcy;
    const centeredCoords = translateCoords(piece.coords, dx, dy);

    const z = nextZ;
    setNextZ(z + 1);

    setPlacedPieces(prev => [...prev, { idx: pieceIdx, coords: centeredCoords, zOrder: z }]);
    setActivePieceIdx(pieceIdx);
  }, [isComplete, pieces, placedIdxSet, puzzleBounds, nextZ, activePieceIdx]);

  /* ── Drag handlers ───────────────────────────────── */
  const onPieceMouseDown = useCallback((e, pieceIdx) => {
    if (isComplete) return;
    e.stopPropagation();
    e.preventDefault();

    const [mx, my] = clientToSVG(e.clientX, e.clientY);
    const placed = placedPieces.find(p => p.idx === pieceIdx);
    if (!placed) return;

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
  }, [isComplete, clientToSVG, placedPieces, nextZ]);

  /* ── Touch handlers ───────────────────────────────── */
  const onPieceTouchStart = useCallback((e, pieceIdx) => {
    if (isComplete) return;
    e.stopPropagation();
    e.preventDefault();

    const touch = e.touches[0];
    if (!touch) return;
    const [mx, my] = clientToSVG(touch.clientX, touch.clientY);
    const placed = placedPieces.find(p => p.idx === pieceIdx);
    if (!placed) return;

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
  }, [isComplete, clientToSVG, placedPieces, nextZ]);

  const onMouseMove = useCallback((e) => {
    if (!dragging) return;

    const [mx, my] = clientToSVG(e.clientX, e.clientY);
    const dxScreen = mx - dragging.startMouse[0];
    const dyScreen = my - dragging.startMouse[1];
    const dxMath = dxScreen;
    const dyMath = -dyScreen;

    let newCoords = translateCoords(dragging.startCoords, dxMath, dyMath);

    let snap = findPuzzleSnap(newCoords, puzzle.shape, SNAP_THRESHOLD);
    if (!snap) {
      snap = findSnap(
        dragging.idx,
        newCoords,
        placedPieces.filter(p => p.idx !== dragging.idx),
        SNAP_THRESHOLD
      );
    }
    if (snap) {
      newCoords = translateCoords(newCoords, snap.dx, snap.dy);
    }

    setPlacedPieces(prev =>
      prev.map(p => p.idx === dragging.idx ? { ...p, coords: newCoords } : p)
    );
  }, [dragging, clientToSVG, puzzle.shape, SNAP_THRESHOLD, placedPieces]);

  const onMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  const onTouchMove = useCallback((e) => {
    if (!dragging) return;
    e.preventDefault();

    const touch = e.touches[0];
    if (!touch) return;
    const [mx, my] = clientToSVG(touch.clientX, touch.clientY);
    const dxScreen = mx - dragging.startMouse[0];
    const dyScreen = my - dragging.startMouse[1];
    const dxMath = dxScreen;
    const dyMath = -dyScreen;

    let newCoords = translateCoords(dragging.startCoords, dxMath, dyMath);

    let snap = findPuzzleSnap(newCoords, puzzle.shape, SNAP_THRESHOLD);
    if (!snap) {
      snap = findSnap(
        dragging.idx,
        newCoords,
        placedPieces.filter(p => p.idx !== dragging.idx),
        SNAP_THRESHOLD
      );
    }
    if (snap) {
      newCoords = translateCoords(newCoords, snap.dx, snap.dy);
    }

    setPlacedPieces(prev =>
      prev.map(p => p.idx === dragging.idx ? { ...p, coords: newCoords } : p)
    );
  }, [dragging, clientToSVG, puzzle.shape, SNAP_THRESHOLD, placedPieces]);

  const onTouchEnd = useCallback(() => {
    setDragging(null);
  }, []);

  useEffect(() => {
    if (dragging) {
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
      window.addEventListener("touchmove", onTouchMove, { passive: false });
      window.addEventListener("touchend", onTouchEnd);
      return () => {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
        window.removeEventListener("touchmove", onTouchMove);
        window.removeEventListener("touchend", onTouchEnd);
      };
    }
  }, [dragging, onMouseMove, onMouseUp, onTouchMove, onTouchEnd]);

  /* ── Rotate active piece 45° CW ──────────────────── */
  const rotateActive = useCallback(() => {
    if (activePieceIdx == null || isComplete) return;
    setPlacedPieces(prev =>
      prev.map(p => {
        if (p.idx !== activePieceIdx) return p;
        return { ...p, coords: rotateCoords(p.coords, 45) };
      })
    );
  }, [activePieceIdx, isComplete]);

  /* ── Flip active piece across vertical center ────── */
  const flipActive = useCallback(() => {
    if (activePieceIdx == null || isComplete) return;
    setPlacedPieces(prev =>
      prev.map(p => {
        if (p.idx !== activePieceIdx) return p;
        return { ...p, coords: flipCoords(p.coords) };
      })
    );
  }, [activePieceIdx, isComplete]);

  /* ── Reset ───────────────────────────────────────── */
  const reset = () => {
    setPlacedPieces([]);
    setNextZ(1);
    setActivePieceIdx(null);
    setShowSolution(false);
    setDragging(null);
  };

  /* ── Build SVG strings and trigger check ─────────── */
  const handleCheckSolved = useCallback(() => {

    if (placedPieces.length === 0 || !onCheckSolved) return;

    const vb = `${puzzleBounds.minX} ${puzzleBounds.minY} ${puzzleBounds.width} ${puzzleBounds.height}`;

    // Build placed pieces SVG
    const placedPolygons = [...placedPieces]
      .sort((a, b) => a.zOrder - b.zOrder)
      .map(({ coords: pCoords }) => {
        const pts = pCoords.map(c => toScreenSimple(c).join(",")).join(" ");
        return `<polygon points="${pts}" />`;
      })
      .join("");
    const placedSvg = `<svg viewBox="${vb}">${placedPolygons}</svg>`;

    const expectedPath = buildShapePath({
      exteriors: getShapeRings(puzzle.shape).map(ring => ring.map(toScreenSimple)),
      holes: getShapeHoles(puzzle.shape).map(ring => ring.map(toScreenSimple)),
    });
    const expectedSvg = `<svg viewBox="${vb}"><path d="${expectedPath}" fill-rule="evenodd" /></svg>`;

    onCheckSolved(placedSvg, expectedSvg);
  }, [placedPieces, puzzleBounds, puzzle.shape, toScreenSimple, onCheckSolved, getShapeRings, getShapeHoles, buildShapePath]);

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
                (solvedShapes.length ? solvedShapes : pieces).map((shape, i) => {
                  const coords = shape.coordinates || shape.coords || [];
                  if (!coords || coords.length === 0) return null;
                  const pts = coords.map(c => toScreenSimple(c).join(",")).join(" ");
                  return (
                    <polygon
                      key={`sol-${i}`}
                      points={pts}
                      fill={COLORS[i % COLORS.length].fill}
                      stroke={COLORS[i % COLORS.length].stroke}
                      strokeWidth="0.8"
                      opacity="0.85"
                      strokeLinejoin="round"
                    />
                  );
                })
              ) : (
                <>
                  {/* Puzzle outline — solid, 4px thick */}
                  {getShapeRings(puzzle.shape).map((ring, outerIndex) => {
                    const pts = ring.map(c => toScreenSimple(c).join(",")).join(" ");
                    return (
                      <polygon
                        key={`puzzle-outer-${outerIndex}`}
                        points={pts}
                        fill="none"
                        stroke="var(--c-text)"
                        strokeWidth="4"
                        strokeLinejoin="round"
                        opacity="0.6"
                      />
                    );
                  })}
                  {getShapeHoles(puzzle.shape).map((ring, holeIndex) => {
                    const pts = ring.map(c => toScreenSimple(c).join(",")).join(" ");
                    return (
                      <polygon
                        key={`puzzle-hole-${holeIndex}`}
                        points={pts}
                        fill="none"
                        stroke="var(--c-text)"
                        strokeWidth="2"
                        strokeLinejoin="round"
                        opacity="0.8"
                      />
                    );
                  })}

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
                        style={{ cursor: isComplete ? "default" : "grab" }}
                        onMouseDown={e => onPieceMouseDown(e, idx)}
                        onTouchStart={e => onPieceTouchStart(e, idx)}
                      />
                    );
                  })}
                </>
              )}
            </svg>

            {!isComplete && !showSolution && placedPieces.length === 0 && (
              <span className="solver-canvas-hint">
                Click pieces on the right to place them, then drag to position
              </span>
            )}

            {isComplete && (
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
                  disabled={activePieceIdx == null || isComplete}
                >
                  <i className="ti ti-rotate" style={{ transform: "scaleX(-1)" }} /> Rotate
                </button>
                <button
                  className="btn-sm"
                  onClick={flipActive}
                  disabled={activePieceIdx == null || isComplete}
                >
                  <i className="ti ti-flip-horizontal" style={{ transform: "rotate(-90deg)" }} /> Flip
                </button>
              </div>
              <button className="btn-sm btn-sm--full" onClick={reset} disabled={isComplete}>
                <i className="ti ti-refresh" /> Reset all pieces
              </button>
            </div>

            <div className="solver-solution-section">
              <button
                className="btn-sm btn-sm--full"
                onClick={() => setShowSolution(!showSolution)}
                disabled={isComplete}
              >
                <i className={`ti ti-${showSolution ? "eye-off" : "eye"}`} />
                {showSolution ? " Hide solution" : " Show solution"}
              </button>
              <button
                className="btn-sm btn-sm--full"
                onClick={() => { handleCheckSolved(); }}
                disabled={placedPieces.length !== pieces.length || isComplete}
                style={{ marginTop: "6px" }}
              >
                <i className="ti ti-circle-check" /> Check Solved
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="solver-footer">
          <div className="solver-timer-group">
            <span className="solver-timer">{fmtTime(seconds)}</span>
            <span className="solver-timer-label">{timerLabel}</span>
            {feedbackMessage && (
              <span className="solver-feedback">{feedbackMessage}</span>
            )}
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