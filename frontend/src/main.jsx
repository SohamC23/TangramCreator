import { useState, useEffect, useRef, useMemo, useCallback } from "react";

/* ═══════════════════════════════════════════════════════
   FILE: constants.jsx
   Shared data, utilities, and the Logo component
   ═══════════════════════════════════════════════════════ */

const COLORS = [
  { fill: "#C8B6FF", stroke: "#6C5CE7" },
  { fill: "#A78BFA", stroke: "#6C5CE7" },
  { fill: "#6EE7B7", stroke: "#059669" },
  { fill: "#FCA5A5", stroke: "#DC2626" },
  { fill: "#FCD34D", stroke: "#D97706" },
  { fill: "#93C5FD", stroke: "#2563EB" },
  { fill: "#F9A8D4", stroke: "#DB2777" },
  { fill: "#C0DD97", stroke: "#3B6D11" },
  { fill: "#F7C1C1", stroke: "#A32D2D" },
  { fill: "#FDE68A", stroke: "#92400E" },
];

const DEFAULT_PIECES = [
  { name: "Large tri A", coords: [[0,0],[50,0],[25,50]], colorIdx: 0 },
  { name: "Large tri B", coords: [[50,0],[100,0],[75,50]], colorIdx: 1 },
  { name: "Medium tri", coords: [[25,50],[75,50],[50,100]], colorIdx: 2 },
  { name: "Small tri A", coords: [[0,0],[25,50],[12,25]], colorIdx: 3 },
  { name: "Small tri B", coords: [[100,0],[75,50],[88,25]], colorIdx: 4 },
  { name: "Square", coords: [[40,40],[60,40],[60,60],[40,60]], colorIdx: 5 },
  { name: "Parallelogram", coords: [[12,25],[25,50],[50,50],[38,25]], colorIdx: 6 },
];

const PUZZLE_SHAPES = [
  [[10,90],[50,10],[90,90]],
  [[10,10],[50,10],[50,50],[10,50]],
  [[50,10],[90,50],[50,90],[10,50]],
  [[10,10],[90,10],[50,90]],
  [[10,50],[50,10],[90,50],[50,90]],
];

function polyArea(coords) {
  let a = 0;
  for (let i = 0; i < coords.length; i++) {
    const j = (i + 1) % coords.length;
    a += coords[i][0] * coords[j][1] - coords[j][0] * coords[i][1];
  }
  return Math.abs(a / 2);
}

function cloneDeep(obj) { return JSON.parse(JSON.stringify(obj)); }
function fmtTime(s) { return `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`; }

function getGraphBounds(pieces) {
  if (!pieces.length) return { min: 0, max: 100 };
  let mn = Infinity, mx = -Infinity;
  pieces.forEach(p => p.coords.forEach(c => { mn = Math.min(mn, c[0], c[1]); mx = Math.max(mx, c[0], c[1]); }));
  const pad = (mx - mn) * 0.1 || 10;
  return { min: Math.floor(mn - pad), max: Math.ceil(mx + pad) };
}

function getGridTicks(bounds) {
  const range = bounds.max - bounds.min || 1;
  const step = range <= 20 ? 5 : range <= 60 ? 10 : range <= 150 ? 25 : 50;
  const ticks = [];
  for (let v = Math.ceil(bounds.min / step) * step; v <= bounds.max; v += step) ticks.push(v);
  return ticks;
}

function Logo({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <polygon points="2,2 12,2 2,12" fill="#6C5CE7" />
      <polygon points="12,2 22,2 22,12" fill="#00B894" />
      <polygon points="2,12 2,22 12,22" fill="#E17055" />
      <polygon points="12,12 22,12 12,22" fill="#0984E3" />
    </svg>
  );
}


/* ═══════════════════════════════════════════════════════
   FILE: Header.jsx
   ═══════════════════════════════════════════════════════ */

function Header({ presets, activePresetIdx, onSwitchPreset, user, onLoginClick }) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="logo">
          <Logo />
          <span className="logo-text">TangramCreator</span>
        </div>
        <span className="logo-credit">Designed by Soham Chouhan</span>
      </div>
      <div className="topbar-right">
        <div className="preset-selector">
          <label className="preset-selector-label">Piece set:</label>
          <select className="preset-selector-dropdown" value={activePresetIdx}
            onChange={e => onSwitchPreset(Number(e.target.value))}>
            {presets.map((p, i) => <option key={i} value={i}>{p.name} ({p.pieces.length})</option>)}
          </select>
        </div>
        {user ? (
          <div className="user-avatar-btn">
            <span className="user-avatar-circle">{user.initials}</span>
            {user.email.split("@")[0]}
          </div>
        ) : (
          <button className="btn-primary" onClick={onLoginClick}>
            <i className="ti ti-user" /> Sign up / Log in
          </button>
        )}
      </div>
    </header>
  );
}


/* ═══════════════════════════════════════════════════════
   FILE: LoginModal.jsx
   ═══════════════════════════════════════════════════════ */

function LoginModal({ onClose, onLogin }) {
  const [mode, setMode] = useState("signup");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = () => {
    if (!email.trim()) { setError("Please enter a valid email address"); return; }
    if (!pass.trim()) { setError("Please enter a password"); return; }
    onLogin({ email, initials: email.substring(0, 2).toUpperCase() });
  };

  return (
    <div className="login-overlay login-overlay--visible" onClick={onClose}>
      <div className="login-modal" onClick={e => e.stopPropagation()}>
        <div className="login-logo"><Logo size={32} /></div>
        <h3 className="login-title">{mode === "signup" ? "Save your progress" : "Welcome back"}</h3>
        <p className="login-desc">
          {mode === "signup"
            ? "Create a free account to save your custom piece sets and puzzle history across sessions."
            : "Log in to access your saved presets and puzzle history."}
        </p>
        <input type="email" className={`login-input ${error && !email.trim() ? "login-input--error" : ""}`}
          placeholder="Email address" value={email}
          onChange={e => { setEmail(e.target.value); setError(""); }} />
        {error && <p className="login-error-text">{error}</p>}
        <input type="password" className="login-input" placeholder="Password" value={pass}
          onChange={e => { setPass(e.target.value); setError(""); }} />
        <button className="login-submit" onClick={handleSubmit}>
          {mode === "signup" ? "Create free account" : "Log in"}
        </button>
        <p className="login-alt">
          {mode === "signup" ? "Already have an account? " : "Don't have an account? "}
          <a href="#" className="login-link" onClick={e => { e.preventDefault(); setMode(mode === "signup" ? "login" : "signup"); setError(""); }}>
            {mode === "signup" ? "Log in" : "Sign up"}
          </a>
        </p>
        <a href="#" className="login-skip" onClick={e => { e.preventDefault(); onClose(); }}>Skip for now</a>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════
   FILE: Dashboard.jsx
   ═══════════════════════════════════════════════════════ */

function Dashboard({ pieces, presetName, puzzlesForPreset, hasAnyPuzzles, onGenerate, onOpenSolver }) {
  return (
    <section className="section">
      <h2 className="section-title">Dashboard</h2>
      <p className="section-sub">
        {pieces.length ? `Using ${pieces.length} pieces from ${presetName}` : "No pieces — add some below"}
      </p>

      <button className="gen-btn" onClick={onGenerate} disabled={!pieces.length}
        style={!pieces.length ? { opacity: 0.4, cursor: "not-allowed" } : undefined}>
        <i className="ti ti-puzzle" /> Generate puzzle
      </button>

      <div className="stats-row">
        <div className="stat-card"><span className="stat-label">Puzzles generated</span><span className="stat-value">{puzzlesForPreset.length}</span></div>
        <div className="stat-card"><span className="stat-label">Puzzles solved</span><span className="stat-value">0</span></div>
        <div className="stat-card"><span className="stat-label">Current pieces</span><span className="stat-value">{pieces.length}</span></div>
      </div>

      {puzzlesForPreset.length === 0 ? (
        <div className="empty-state">
          <i className="ti ti-puzzle" />
          <span>{hasAnyPuzzles ? "No puzzles generated with this piece set yet. Hit generate to create one." : "Hit the generate button to create your first puzzle."}</span>
        </div>
      ) : (
        <div className="puzzle-scroll">
          <div className="puzzle-grid">
            {puzzlesForPreset.map(p => (
              <div key={p.id} className="puzzle-tile" onClick={() => onOpenSolver(p)}>
                <svg viewBox="0 0 100 100">
                  <polygon points={p.shape.map(c => c.join(",")).join(" ")}
                    fill={COLORS[p.num % COLORS.length].fill} stroke={COLORS[p.num % COLORS.length].stroke}
                    strokeWidth="1" strokeLinejoin="round" />
                </svg>
                <span className="puzzle-tile-label">Puzzle #{p.num}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="section-nav">
        <button className="btn-outline" onClick={() => document.getElementById("creator-section")?.scrollIntoView({ behavior: "smooth" })}>
          <i className="ti ti-puzzle" /> Create custom pieces <i className="ti ti-arrow-down" />
        </button>
      </div>
    </section>
  );
}


/* ═══════════════════════════════════════════════════════
   FILE: SolverOverlay.jsx
   ═══════════════════════════════════════════════════════ */

function SolverOverlay({ puzzle, pieces, onClose }) {
  const [seconds, setSeconds] = useState(0);
  const [placed, setPlaced] = useState(new Set());
  const [showSolution, setShowSolution] = useState(false);
  const [complete, setComplete] = useState(false);
  const timerRef = useRef(null);

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
    if (next.size === pieces.length) { setComplete(true); clearInterval(timerRef.current); }
  };

  const reset = () => { setPlaced(new Set()); setShowSolution(false); setComplete(false); setSeconds(0); };

  return (
    <div className="solver-overlay solver-overlay--visible" onClick={onClose}>
      <div className="solver-modal" onClick={e => e.stopPropagation()}>
        <div className="solver-topbar">
          <h3 className="solver-title">Puzzle #{puzzle.num}</h3>
          <button className="solver-close" onClick={onClose} aria-label="Close"><i className="ti ti-x" /></button>
        </div>
        <div className="solver-body">
          <div className="solver-canvas">
            <svg className="solver-svg" viewBox="0 0 100 100">
              {showSolution || complete ? (
                pieces.map((p, i) => (
                  <polygon key={i} points={p.coords.map(c => `${c[0]},${100-c[1]}`).join(" ")}
                    fill={COLORS[p.colorIdx % COLORS.length].fill} stroke={COLORS[p.colorIdx % COLORS.length].stroke}
                    strokeWidth="0.8" opacity="0.85" strokeLinejoin="round" />
                ))
              ) : (
                <>
                  <polygon points={puzzle.shape.map(c => c.join(",")).join(" ")} fill="none" stroke="var(--c-text)"
                    strokeWidth="1.5" strokeLinejoin="round" strokeDasharray="4 3" opacity="0.35" />
                  {[...placed].map(idx => {
                    const p = pieces[idx]; if (!p) return null;
                    return <polygon key={idx} points={p.coords.map(c => `${c[0]},${100-c[1]}`).join(" ")}
                      fill={COLORS[p.colorIdx % COLORS.length].fill} stroke={COLORS[p.colorIdx % COLORS.length].stroke}
                      strokeWidth="0.6" opacity="0.8" strokeLinejoin="round" />;
                  })}
                </>
              )}
            </svg>
            {!complete && !showSolution && <span className="solver-canvas-hint">Click pieces on the right to place them on the canvas</span>}
            {complete && (
              <div className="solver-complete-badge">
                <span className="solver-complete-icon"><i className="ti ti-check" /></span>
                <span className="solver-complete-text">Puzzle complete!</span>
                <span className="solver-complete-time">Solved in {fmtTime(seconds)}</span>
              </div>
            )}
          </div>
          <div>
            <h4 className="solver-sidebar-title">Pieces</h4>
            <div className="solver-piece-list">
              {pieces.map((p, i) => (
                <div key={i} className={`solver-piece ${placed.has(i) ? "solver-piece--placed" : ""}`} onClick={() => togglePlace(i)}>
                  <span className="solver-swatch" style={{ background: COLORS[p.colorIdx % COLORS.length].fill }} />{p.name}
                </div>
              ))}
            </div>
            <div className="solver-controls">
              <span className="solver-controls-label">Controls</span>
              <div className="solver-controls-row">
                <button className="btn-sm"><i className="ti ti-rotate" /> Rotate</button>
                <button className="btn-sm"><i className="ti ti-flip-horizontal" /> Flip</button>
              </div>
              <button className="btn-sm btn-sm--full" onClick={reset}><i className="ti ti-refresh" /> Reset all pieces</button>
            </div>
            <div className="solver-solution-section">
              <button className="btn-sm btn-sm--full" onClick={() => setShowSolution(!showSolution)} disabled={complete}>
                <i className={`ti ti-${showSolution ? "eye-off" : "eye"}`} /> {showSolution ? "Hide solution" : "Show solution"}
              </button>
            </div>
          </div>
        </div>
        <div className="solver-footer">
          <div className="solver-timer-group">
            <span className="solver-timer">{fmtTime(seconds)}</span>
            <span className="solver-timer-label">{complete ? "Solve time — complete!" : showSolution ? "Solve time (paused)" : "Solve time"}</span>
          </div>
          <div className="solver-actions">
            <button className="btn-sm"><i className="ti ti-download" /> Export SVG</button>
            <button className="btn-primary btn-primary--sm" onClick={onClose}><i className="ti ti-check" /> Done</button>
          </div>
        </div>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════
   FILE: PieceCreator.jsx
   ═══════════════════════════════════════════════════════ */

function PieceCreator({
  pieces, selectedPieceIdx, pieceName, presetName, coords,
  presets, activePresetIdx,
  onSelectPiece, onPieceNameChange, onPresetNameChange, onCoordsChange,
  onAddVertex, onUpdateShape, onDeletePiece, onDuplicatePiece,
  onSavePreset, onDuplicatePreset, onSwitchPreset,
}) {
  const bounds = useMemo(() => getGraphBounds(pieces), [pieces]);
  const ticks = useMemo(() => getGridTicks(bounds), [bounds]);
  const range = bounds.max - bounds.min || 1;
  const gx = (x) => 40 + ((x - bounds.min) / range) * 340;
  const gy = (y) => 360 - ((y - bounds.min) / range) * 340;

  return (
    <section className="section" id="creator-section">
      <h2 className="section-title">Create custom tangram pieces</h2>
      <p className="section-sub">Define piece shapes by entering polygon vertex coordinates.</p>
      <div className="creator-layout">
        {/* Graph */}
        <div className="creator-graph-col">
          <div className="graph-wrap">
            <span className="graph-range-label">Graph range: {bounds.min} – {bounds.max}</span>
            <svg className="graph-svg" viewBox="0 0 400 400">
              <rect x="0" y="0" width="400" height="400" fill="var(--c-surface)" rx="6" />
              <line x1="40" y1="360" x2="380" y2="360" stroke="var(--c-border)" strokeWidth="0.5" />
              <line x1="40" y1="360" x2="40" y2="20" stroke="var(--c-border)" strokeWidth="0.5" />
              {ticks.map(v => (
                <g key={v}>
                  <text className="graph-axis-label" x={gx(v)} y="376">{v}</text>
                  <text className="graph-axis-label" x="22" y={gy(v)+4}>{v}</text>
                  <line x1="40" y1={gy(v)} x2="380" y2={gy(v)} stroke="var(--c-border-light)" strokeWidth="0.5" strokeDasharray="3 3" />
                  <line x1={gx(v)} y1="20" x2={gx(v)} y2="360" stroke="var(--c-border-light)" strokeWidth="0.5" strokeDasharray="3 3" />
                </g>
              ))}
              {pieces.map((p, i) => {
                const isSel = i === selectedPieceIdx;
                const c = COLORS[p.colorIdx % COLORS.length];
                const pts = p.coords.map(coord => `${gx(coord[0])},${gy(coord[1])}`).join(" ");
                return <polygon key={i} points={pts} fill={isSel ? "var(--c-blue-soft)" : c.fill}
                  stroke={isSel ? "var(--c-blue)" : c.stroke} strokeWidth={isSel ? 2.5 : 1}
                  opacity={isSel ? 0.6 : 0.7} strokeLinejoin="round" style={{ cursor: "pointer" }}
                  onClick={() => onSelectPiece(i)} />;
              })}
            </svg>
            {!pieces.length && <div className="graph-empty" style={{ display: "flex" }}><i className="ti ti-shape" />No pieces yet</div>}
          </div>
        </div>

        {/* Side panel */}
        <div className="creator-side-col">
          <div className="field-group">
            <label className="field-label">Name this preset</label>
            <input type="text" className="field-input" placeholder="e.g. My custom set" value={presetName} onChange={e => onPresetNameChange(e.target.value)} />
          </div>
          <div className="field-group">
            <label className="field-label">Name this piece</label>
            <input type="text" className="field-input" placeholder="e.g. Large triangle" value={pieceName} onChange={e => onPieceNameChange(e.target.value)} />
          </div>
          <div className="field-group">
            <label className="field-label">Vertices (x, y)</label>
            <div className="coord-input-list">
              {coords.map(([x,y], i) => (
                <div className="coord-row" key={i}>
                  <input type="number" className="coord-field" placeholder={`x${i+1}`} value={x}
                    onChange={e => { const c = [...coords]; c[i]=[e.target.value,c[i][1]]; onCoordsChange(c); }} />
                  <input type="number" className="coord-field" placeholder={`y${i+1}`} value={y}
                    onChange={e => { const c = [...coords]; c[i]=[c[i][0],e.target.value]; onCoordsChange(c); }} />
                </div>
              ))}
            </div>
            <div className="btn-row">
              <button className="btn-sm" onClick={onAddVertex}><i className="ti ti-plus" /> Vertex</button>
              <button className="btn-primary btn-primary--sm" onClick={onUpdateShape}><i className="ti ti-check" /> Update shape</button>
            </div>
          </div>

          <hr className="panel-divider" />

          <div className="field-group">
            <label className="field-label">Pieces in this set ({pieces.length})</label>
            <select className="field-select" value={selectedPieceIdx} onChange={e => onSelectPiece(Number(e.target.value))}>
              <option value={-1}>Select a piece...</option>
              {pieces.map((p,i) => <option key={i} value={i}>{p.name}</option>)}
            </select>
            <div className="btn-row">
              <button className="btn-sm" disabled={selectedPieceIdx < 0} onClick={onDuplicatePiece}><i className="ti ti-copy" /> Duplicate</button>
              <button className="btn-sm btn-sm--danger" disabled={selectedPieceIdx < 0} onClick={onDeletePiece}><i className="ti ti-trash" /> Delete</button>
            </div>
            <div className="piece-list">
              {pieces.map((p,i) => (
                <div key={i} className={`piece-item ${i === selectedPieceIdx ? "piece-item--selected" : ""}`} onClick={() => onSelectPiece(i)}>
                  <span className="piece-swatch" style={{ background: COLORS[p.colorIdx % COLORS.length].fill }} />
                  <span className="piece-name">{p.name}</span>
                  <span className="piece-area">{Math.round(polyArea(p.coords))}</span>
                </div>
              ))}
              {!pieces.length && <div style={{ padding: "16px 0", textAlign: "center", fontSize: 12, color: "var(--c-text-3)" }}>No pieces added</div>}
            </div>
          </div>

          <hr className="panel-divider" />

          <div className="field-group">
            <label className="field-label">Presets</label>
            <div className="btn-row"><button className="btn-sm" onClick={onSavePreset}><i className="ti ti-device-floppy" /> Save preset</button></div>
            <div className="preset-list">
              {presets.map((p,i) => (
                <div key={i} className={`preset-item ${i === activePresetIdx ? "preset-item--active" : ""}`} onClick={() => onSwitchPreset(i)}>
                  <span className="preset-name">{p.name}{p.builtIn && <span className="preset-badge">built-in</span>}</span>
                  <span className="preset-count">{p.pieces.length}</span>
                  <button className="preset-dup-btn" title="Duplicate preset" onClick={e => { e.stopPropagation(); onDuplicatePreset(i); }}>
                    <i className="ti ti-copy" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="section-nav">
        <button className="btn-outline" onClick={() => document.getElementById("stl-section")?.scrollIntoView({ behavior: "smooth" })}>
          <i className="ti ti-3d-cube-sphere" /> Download STL file <i className="ti ti-arrow-down" />
        </button>
      </div>
    </section>
  );
}


/* ═══════════════════════════════════════════════════════
   FILE: StlExport.jsx
   ═══════════════════════════════════════════════════════ */

function StlExport({ pieces }) {
  const preview = useMemo(() => {
    if (!pieces.length) return null;
    const b = getGraphBounds(pieces), range = b.max - b.min || 1;
    return pieces.map((p, i) => {
      const pts = p.coords.map(c => `${5+((c[0]-b.min)/range)*90},${95-((c[1]-b.min)/range)*90}`).join(" ");
      return <polygon key={i} points={pts} fill={COLORS[p.colorIdx % COLORS.length].fill}
        stroke={COLORS[p.colorIdx % COLORS.length].stroke} strokeWidth="1" strokeLinejoin="round" opacity="0.8" />;
    });
  }, [pieces]);

  return (
    <section className="section" id="stl-section">
      <h2 className="section-title">Download STL for 3D printing</h2>
      <div className="stl-card">
        <div className={`stl-preview ${!pieces.length ? "stl-preview--empty" : ""}`}>
          {pieces.length ? <svg viewBox="0 0 100 100" width="90" height="90">{preview}</svg> : "No pieces"}
        </div>
        <div className="stl-info">
          <h3 className="stl-heading">Export current piece set</h3>
          <p className="stl-desc">Generate an STL file of your <strong>{pieces.length}</strong> tangram pieces, ready for 3D printing.</p>
          <div className="stl-options">
            <label className="stl-option-label">Thickness <input type="number" className="stl-option-input" defaultValue="5" min="1" max="20" /> mm</label>
            <label className="stl-option-label">Scale <input type="number" className="stl-option-input" defaultValue="100" min="50" max="300" step="10" /> %</label>
          </div>
          <div className="btn-row">
            <button className="btn-primary" disabled={!pieces.length}><i className="ti ti-download" /> Download STL</button>
            <button className="btn-outline" disabled={!pieces.length}><i className="ti ti-file" /> Download SVG</button>
          </div>
        </div>
      </div>
    </section>
  );
}


/* ═══════════════════════════════════════════════════════
   FILE: App.jsx — Main entry, imports and composes all
   ═══════════════════════════════════════════════════════ */

export default function App() {
  const [user, setUser] = useState(null);
  const [loginOpen, setLoginOpen] = useState(false);

  const [presets, setPresets] = useState([{ name: "Default tangram", pieces: cloneDeep(DEFAULT_PIECES), builtIn: true }]);
  const [activePresetIdx, setActivePresetIdx] = useState(0);
  const [presetCounter, setPresetCounter] = useState(0);

  const pieces = useMemo(
    () => presets[activePresetIdx]?.pieces || [],
    [activePresetIdx, presets]
  );

  const setPieces = useCallback((np) => {
    setPresets(prev => { const n = [...prev]; n[activePresetIdx] = { ...n[activePresetIdx], pieces: cloneDeep(np) }; return n; });
  }, [activePresetIdx]);

  const [selectedPieceIdx, setSelectedPieceIdx] = useState(-1);
  const [pieceName, setPieceName] = useState("");
  const [presetName, setPresetName] = useState("");
  const [coords, setCoords] = useState([["",""],["",""],["",""]]);

  const [allPuzzles, setAllPuzzles] = useState([]);
  const puzzlesForPreset = useMemo(() => allPuzzles.filter(p => p.presetIdx === activePresetIdx), [allPuzzles, activePresetIdx]);

  const [solverOpen, setSolverOpen] = useState(false);
  const [solverPuzzle, setSolverPuzzle] = useState(null);

  const selectPiece = useCallback((idx) => {
    const n = idx === selectedPieceIdx ? -1 : idx;
    setSelectedPieceIdx(n);
    if (n >= 0 && pieces[n]) { setPieceName(pieces[n].name); setCoords(pieces[n].coords.map(c => [String(c[0]), String(c[1])])); }
    else { setPieceName(""); setCoords([["",""],["",""],["",""]]); }
  }, [selectedPieceIdx, pieces]);

  const handlePieceNameChange = useCallback((val) => {
    setPieceName(val);
    if (selectedPieceIdx >= 0 && pieces[selectedPieceIdx]) { const np = cloneDeep(pieces); np[selectedPieceIdx].name = val || np[selectedPieceIdx].name; setPieces(np); }
  }, [selectedPieceIdx, pieces, setPieces]);

  const updateShape = useCallback(() => {
    const parsed = coords.map(([x,y]) => [parseFloat(x), parseFloat(y)]).filter(([x,y]) => !isNaN(x) && !isNaN(y));
    if (parsed.length < 3) return;
    const name = pieceName.trim() || `Piece ${pieces.length + 1}`;
    const np = cloneDeep(pieces);
    if (selectedPieceIdx >= 0 && np[selectedPieceIdx]) { np[selectedPieceIdx].name = name; np[selectedPieceIdx].coords = parsed; }
    else { np.push({ name, coords: parsed, colorIdx: np.length % 10 }); }
    setPieces(np); setSelectedPieceIdx(-1); setPieceName(""); setCoords([["",""],["",""],["",""]]);
  }, [coords, pieceName, pieces, selectedPieceIdx, setPieces]);

  const deletePiece = useCallback(() => {
    if (selectedPieceIdx < 0) return;
    const np = cloneDeep(pieces); np.splice(selectedPieceIdx, 1); setPieces(np);
    setSelectedPieceIdx(-1); setPieceName(""); setCoords([["",""],["",""],["",""]]);
  }, [selectedPieceIdx, pieces, setPieces]);

  const duplicatePiece = useCallback(() => {
    if (selectedPieceIdx < 0) return;
    const o = pieces[selectedPieceIdx]; const np = cloneDeep(pieces);
    np.push({ name: o.name + " copy", coords: o.coords.map(c => [c[0]+5,c[1]+5]), colorIdx: np.length % 10 });
    setPieces(np); setSelectedPieceIdx(np.length - 1);
  }, [selectedPieceIdx, pieces, setPieces]);

  const savePreset = useCallback(() => {
    if (!pieces.length) return;
    let name = presetName.trim();
    if (!name) { const c = presetCounter + 1; setPresetCounter(c); name = `Preset ${c}`; }
    setPresets(prev => [...prev, { name, pieces: cloneDeep(pieces), builtIn: false }]);
    setActivePresetIdx(presets.length); setPresetName(""); setSelectedPieceIdx(-1);
  }, [pieces, presetName, presetCounter, presets.length]);

  const duplicatePreset = useCallback((idx) => {
    const s = presets[idx];
    setPresets(prev => [...prev, { name: s.name + " copy", pieces: cloneDeep(s.pieces), builtIn: false }]);
    setActivePresetIdx(presets.length); setSelectedPieceIdx(-1);
  }, [presets]);

  const switchPreset = useCallback((idx) => {
    setActivePresetIdx(idx); setSelectedPieceIdx(-1); setPieceName(""); setCoords([["",""],["",""],["",""]]);
    setPresetName(presets[idx]?.builtIn ? "" : presets[idx]?.name || "");
  }, [presets]);

  const generatePuzzle = useCallback(() => {
    if (!pieces.length) return;
    const shape = PUZZLE_SHAPES[Math.floor(Math.random() * PUZZLE_SHAPES.length)];
    const puzzle = { shape, presetIdx: activePresetIdx, num: allPuzzles.length + 1, id: Date.now() };
    setAllPuzzles(prev => [puzzle, ...prev]); setSolverPuzzle(puzzle); setSolverOpen(true);
  }, [pieces, activePresetIdx, allPuzzles.length]);

  const openSolver = useCallback((p) => { setSolverPuzzle(p); setSolverOpen(true); }, []);
  const closeSolver = useCallback(() => setSolverOpen(false), []);
  const solverPieces = solverPuzzle ? (presets[solverPuzzle.presetIdx]?.pieces || pieces) : pieces;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300..700&family=JetBrains+Mono:wght@400;500&display=swap');
        :root{--c-bg:#FAFAF8;--c-surface:#F2F1ED;--c-surface-alt:#E8E7E3;--c-text:#1A1A19;--c-text-2:#5C5B57;--c-text-3:#8A8983;--c-border:#D4D3CF;--c-border-light:#E8E7E3;--c-accent:#6C5CE7;--c-accent-soft:#EDE9FE;--c-green:#00B894;--c-green-soft:#D1FAE5;--c-red:#E17055;--c-red-soft:#FEE2E2;--c-blue:#0984E3;--c-blue-soft:#DBEAFE;--c-amber:#FDCB6E;--font-body:'DM Sans',system-ui,sans-serif;--font-mono:'JetBrains Mono',ui-monospace,monospace;--r-sm:6px;--r-md:8px;--r-lg:12px;--r-xl:16px;--space-xs:4px;--space-sm:8px;--space-md:12px;--space-lg:16px;--space-xl:24px;--space-2xl:32px;--shadow-overlay:0 20px 60px rgba(0,0,0,0.2);--shadow-sm:0 1px 2px rgba(0,0,0,0.05)}
        *,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
        html{scroll-behavior:smooth}
        input,select,button{font-family:inherit;font-size:inherit}
        main{max-width:740px;margin:0 auto;padding:0 var(--space-xl);padding-bottom:48px}

        .topbar{max-width:740px;margin:0 auto;display:flex;justify-content:space-between;align-items:center;padding:var(--space-lg) var(--space-xl);border-bottom:1px solid var(--c-border-light);margin-bottom:var(--space-xl)}
        .topbar-left{display:flex;flex-direction:column}
        .logo{display:flex;align-items:center;gap:8px}
        .logo-text{font-size:17px;font-weight:600;letter-spacing:-0.02em}
        .logo-credit{font-size:11px;color:var(--c-text-3);margin-left:30px;margin-top:1px}
        .topbar-right{display:flex;align-items:center;gap:var(--space-md)}
        .preset-selector{display:flex;align-items:center;gap:6px}
        .preset-selector-label{font-size:12px;color:var(--c-text-3);white-space:nowrap}
        .preset-selector-dropdown{font-size:12px;padding:4px 8px;border:1px solid var(--c-border);border-radius:var(--r-sm);background:var(--c-bg);color:var(--c-text)}

        .btn-primary{display:inline-flex;align-items:center;gap:6px;padding:8px 18px;font-size:13px;font-weight:500;color:#FFF;background:var(--c-text);border:none;border-radius:var(--r-md);cursor:pointer;transition:opacity .15s}
        .btn-primary:hover{opacity:0.85}
        .btn-primary--sm{padding:6px 14px;font-size:12px}
        .btn-primary:disabled{opacity:0.35;cursor:not-allowed}
        .btn-outline{display:inline-flex;align-items:center;gap:6px;padding:8px 18px;font-size:13px;color:var(--c-text);background:transparent;border:1px solid var(--c-border);border-radius:var(--r-md);cursor:pointer;transition:border-color .15s,background .15s}
        .btn-outline:hover{border-color:var(--c-text-3);background:var(--c-surface)}
        .btn-outline:disabled{opacity:0.35;cursor:not-allowed}
        .btn-sm{display:inline-flex;align-items:center;gap:4px;padding:5px 10px;font-size:12px;color:var(--c-text);background:transparent;border:1px solid var(--c-border);border-radius:var(--r-sm);cursor:pointer;transition:border-color .15s,background .15s}
        .btn-sm:hover{border-color:var(--c-text-3);background:var(--c-surface)}
        .btn-sm:disabled{opacity:0.35;cursor:not-allowed}
        .btn-sm--full{width:100%;justify-content:center}
        .btn-sm--danger{color:var(--c-red)}
        .btn-row{display:flex;gap:var(--space-sm);flex-wrap:wrap}

        .section{margin-bottom:var(--space-2xl)}
        .section-title{font-size:20px;font-weight:600;letter-spacing:-0.02em;margin-bottom:var(--space-md)}
        .section-sub{font-size:13px;color:var(--c-text-2);margin-bottom:var(--space-lg)}
        .section-nav{margin-top:var(--space-lg)}
        .divider{border:none;height:1px;background:var(--c-border-light);margin:var(--space-2xl) 0}
        .panel-divider{border:none;height:1px;background:var(--c-border-light);margin:var(--space-md) 0}

        .gen-btn{width:100%;padding:22px 28px;font-size:20px;font-weight:600;letter-spacing:-0.01em;color:#FFF;background:var(--c-text);border:none;border-radius:var(--r-lg);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:var(--space-xl);transition:opacity .12s,transform .08s}
        .gen-btn:hover{opacity:0.88}
        .gen-btn:active{transform:scale(0.995)}
        .gen-btn .ti{font-size:26px}
        .gen-btn:disabled{opacity:0.4;cursor:not-allowed}

        .stats-row{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:var(--space-lg)}
        .stat-card{background:var(--c-surface);border-radius:var(--r-md);padding:10px 12px;display:flex;flex-direction:column}
        .stat-label{font-size:12px;color:var(--c-text-3)}
        .stat-value{font-size:22px;font-weight:600;margin-top:2px}

        .empty-state{border:1px dashed var(--c-border);border-radius:var(--r-lg);padding:var(--space-2xl) var(--space-xl);text-align:center;color:var(--c-text-3);font-size:13px;line-height:1.6;margin-bottom:var(--space-lg);display:flex;flex-direction:column;align-items:center;gap:var(--space-sm)}
        .empty-state .ti{font-size:32px;opacity:0.4}

        .puzzle-scroll{max-height:240px;overflow-y:auto;margin-bottom:var(--space-lg);padding-right:4px}
        .puzzle-scroll::-webkit-scrollbar{width:5px}
        .puzzle-scroll::-webkit-scrollbar-thumb{background:var(--c-border);border-radius:3px}
        .puzzle-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
        .puzzle-tile{border:1px solid var(--c-border-light);border-radius:var(--r-lg);background:#FFF;padding:8px;cursor:pointer;transition:border-color .15s,box-shadow .15s}
        .puzzle-tile:hover{border-color:var(--c-border);box-shadow:var(--shadow-sm)}
        .puzzle-tile svg{width:100%;aspect-ratio:1;display:block;margin-bottom:6px}
        .puzzle-tile-label{font-size:11px;color:var(--c-text-3)}

        .creator-layout{display:grid;grid-template-columns:1fr 230px;gap:var(--space-lg)}
        .creator-side-col{display:flex;flex-direction:column}
        .graph-wrap{border:1px solid var(--c-border-light);border-radius:var(--r-lg);background:#FFF;padding:var(--space-md);position:relative}
        .graph-range-label{position:absolute;top:8px;left:14px;font-size:11px;color:var(--c-text-3)}
        .graph-svg{width:100%;display:block}
        .graph-axis-label{font-family:var(--font-mono);font-size:10px;fill:var(--c-text-3);text-anchor:middle}
        .graph-empty{position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;color:var(--c-text-3);font-size:13px;text-align:center;pointer-events:none}
        .graph-empty .ti{font-size:24px;opacity:0.4;margin-bottom:6px}

        .field-group{margin-bottom:var(--space-md)}
        .field-label{display:block;font-size:12px;color:var(--c-text-3);margin-bottom:var(--space-xs);font-weight:400}
        .field-input{width:100%;padding:7px 10px;font-size:12px;color:var(--c-text);background:var(--c-bg);border:1px solid var(--c-border);border-radius:var(--r-sm);transition:border-color .15s}
        .field-input::placeholder{color:var(--c-text-3)}
        .field-input:focus{outline:2px solid var(--c-accent);outline-offset:-1px;border-color:var(--c-accent)}
        .field-select{width:100%;padding:6px 8px;font-size:12px;color:var(--c-text);background:var(--c-bg);border:1px solid var(--c-border);border-radius:var(--r-sm);margin-bottom:6px}

        .coord-input-list{display:flex;flex-direction:column;gap:4px;margin-bottom:6px}
        .coord-row{display:grid;grid-template-columns:1fr 1fr;gap:6px}
        .coord-field{width:100%;padding:6px 8px;font-size:12px;font-family:var(--font-mono);color:var(--c-text);background:var(--c-bg);border:1px solid var(--c-border);border-radius:var(--r-sm)}
        .coord-field:focus{outline:2px solid var(--c-accent);outline-offset:-1px;border-color:var(--c-accent)}
        .coord-field::placeholder{color:var(--c-text-3);font-family:var(--font-body)}

        .piece-list{display:flex;flex-direction:column;gap:3px;max-height:168px;overflow-y:auto;padding:4px 0}
        .piece-item{display:flex;align-items:center;gap:6px;padding:6px 8px;background:var(--c-surface);border-radius:var(--r-sm);font-size:12px;cursor:pointer;transition:background .1s}
        .piece-item:hover{background:var(--c-surface-alt)}
        .piece-item--selected{outline:1.5px solid var(--c-accent);background:var(--c-accent-soft)}
        .piece-swatch{width:10px;height:10px;border-radius:3px;flex-shrink:0}
        .piece-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .piece-area{font-size:11px;color:var(--c-text-3);font-family:var(--font-mono);flex-shrink:0}

        .preset-list{display:flex;flex-direction:column;gap:3px;margin-top:6px}
        .preset-item{display:flex;align-items:center;gap:6px;padding:8px 10px;border-radius:var(--r-sm);font-size:13px;cursor:pointer;transition:background .1s}
        .preset-item:hover{background:var(--c-surface)}
        .preset-item--active{background:var(--c-accent-soft);color:var(--c-accent)}
        .preset-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .preset-badge{font-size:10px;padding:1px 6px;border-radius:6px;background:var(--c-surface);color:var(--c-text-3);margin-left:4px}
        .preset-count{font-size:11px;color:var(--c-text-3)}
        .preset-dup-btn{width:22px;height:22px;padding:0;display:flex;align-items:center;justify-content:center;font-size:12px;border-radius:4px;flex-shrink:0;opacity:0;transition:opacity .12s;background:transparent;border:1px solid var(--c-border);cursor:pointer;color:var(--c-text)}
        .preset-item:hover .preset-dup-btn{opacity:1}

        .stl-card{display:flex;gap:var(--space-xl);align-items:center;border:1px solid var(--c-border-light);border-radius:var(--r-lg);padding:var(--space-xl);background:#FFF}
        .stl-preview{width:120px;height:120px;background:var(--c-surface);border-radius:var(--r-md);display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .stl-preview--empty{color:var(--c-text-3);font-size:12px}
        .stl-info{flex:1}
        .stl-heading{font-size:16px;font-weight:600;margin-bottom:4px}
        .stl-desc{font-size:13px;color:var(--c-text-2);line-height:1.5;margin-bottom:var(--space-md)}
        .stl-options{display:flex;gap:var(--space-md);flex-wrap:wrap;margin-bottom:var(--space-md)}
        .stl-option-label{font-size:12px;color:var(--c-text-2);display:flex;align-items:center;gap:4px}
        .stl-option-input{width:60px;font-size:12px;font-family:var(--font-mono);padding:4px 6px;border:1px solid var(--c-border);border-radius:var(--r-sm);background:var(--c-bg);color:var(--c-text)}

        .user-avatar-btn{display:inline-flex;align-items:center;gap:8px;padding:5px 14px 5px 5px;font-size:13px;color:var(--c-text);background:transparent;border:1px solid var(--c-border);border-radius:var(--r-md);cursor:default}
        .user-avatar-circle{width:26px;height:26px;border-radius:50%;background:var(--c-accent-soft);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;color:var(--c-accent)}

        .login-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:200;align-items:center;justify-content:center}
        .login-overlay--visible{display:flex}
        .login-modal{background:#FFF;border-radius:var(--r-xl);padding:32px 36px;width:360px;text-align:center;box-shadow:var(--shadow-overlay)}
        .login-logo{margin-bottom:var(--space-lg)}
        .login-title{font-size:20px;font-weight:600;margin-bottom:6px}
        .login-desc{font-size:13px;color:var(--c-text-2);line-height:1.5;margin-bottom:var(--space-xl)}
        .login-input{width:100%;padding:10px 12px;font-size:13px;border:1px solid var(--c-border);border-radius:var(--r-md);margin-bottom:10px;background:var(--c-bg);color:var(--c-text);transition:border-color .15s}
        .login-input:focus{outline:2px solid var(--c-accent);outline-offset:-1px;border-color:var(--c-accent)}
        .login-input::placeholder{color:var(--c-text-3)}
        .login-input--error{border-color:var(--c-red)!important;outline:2px solid var(--c-red)!important;outline-offset:-1px}
        .login-error-text{font-size:12px;color:var(--c-red);margin-top:-6px;margin-bottom:10px;text-align:left}
        .login-submit{width:100%;padding:12px;font-size:14px;font-weight:600;color:#FFF;background:var(--c-text);border:none;border-radius:var(--r-md);cursor:pointer;margin-bottom:12px;transition:opacity .15s}
        .login-submit:hover{opacity:0.85}
        .login-alt{font-size:12px;color:var(--c-text-3);margin-bottom:10px}
        .login-link{color:var(--c-accent);cursor:pointer;text-decoration:none}
        .login-link:hover{text-decoration:underline}
        .login-skip{font-size:12px;color:var(--c-text-3);text-decoration:underline;cursor:pointer}

        .solver-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:100;align-items:center;justify-content:center}
        .solver-overlay--visible{display:flex}
        .solver-modal{background:#FFF;border-radius:var(--r-xl);width:90%;max-width:660px;max-height:90vh;overflow:hidden;display:flex;flex-direction:column;box-shadow:var(--shadow-overlay)}
        .solver-topbar{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid var(--c-border-light)}
        .solver-title{font-size:16px;font-weight:600}
        .solver-close{width:32px;height:32px;border-radius:var(--r-md);border:1px solid var(--c-border);background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--c-text);transition:background .12s}
        .solver-close:hover{background:var(--c-surface)}
        .solver-body{display:grid;grid-template-columns:1fr 190px;gap:var(--space-lg);padding:18px;flex:1;overflow:auto}
        .solver-canvas{border:1px solid var(--c-border-light);border-radius:var(--r-lg);background:var(--c-surface);padding:14px;display:flex;align-items:center;justify-content:center;aspect-ratio:1;position:relative}
        .solver-svg{width:100%;display:block}
        .solver-canvas-hint{position:absolute;bottom:10px;left:0;right:0;text-align:center;font-size:11px;color:var(--c-text-3)}
        .solver-sidebar-title{font-size:13px;font-weight:600;margin-bottom:8px}
        .solver-piece-list{display:flex;flex-direction:column;gap:3px}
        .solver-piece{display:flex;align-items:center;gap:6px;padding:6px 8px;border-radius:var(--r-sm);font-size:12px;background:var(--c-surface);cursor:pointer;transition:background .1s}
        .solver-piece:hover{background:var(--c-surface-alt)}
        .solver-swatch{width:12px;height:12px;border-radius:3px;flex-shrink:0}
        .solver-piece--placed{opacity:0.4;cursor:default;text-decoration:line-through;color:var(--c-text-3)}
        .solver-controls{margin-top:var(--space-md);padding-top:var(--space-md);border-top:1px solid var(--c-border-light)}
        .solver-controls-label{display:block;font-size:12px;color:var(--c-text-3);margin-bottom:6px}
        .solver-controls-row{display:flex;gap:6px;margin-bottom:6px}
        .solver-controls-row .btn-sm{flex:1;justify-content:center}
        .solver-solution-section{margin-top:var(--space-md);padding-top:var(--space-md);border-top:1px solid var(--c-border-light)}
        .solver-footer{padding:12px 18px;border-top:1px solid var(--c-border-light);display:flex;justify-content:space-between;align-items:center}
        .solver-timer-group{display:flex;flex-direction:column}
        .solver-timer{font-size:20px;font-weight:600;font-variant-numeric:tabular-nums;font-family:var(--font-mono)}
        .solver-timer-label{font-size:11px;color:var(--c-text-3)}
        .solver-actions{display:flex;gap:8px}
        .solver-complete-badge{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;position:absolute;inset:0;background:rgba(255,255,255,0.92);border-radius:var(--r-lg);z-index:2}
        .solver-complete-icon{width:48px;height:48px;border-radius:50%;background:var(--c-green-soft);display:flex;align-items:center;justify-content:center;color:var(--c-green);font-size:24px}
        .solver-complete-text{font-size:16px;font-weight:600;color:var(--c-text)}
        .solver-complete-time{font-size:13px;color:var(--c-text-2)}
      `}</style>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css" />

      {loginOpen && <LoginModal onClose={() => setLoginOpen(false)} onLogin={u => { setUser(u); setLoginOpen(false); }} />}
      {solverOpen && solverPuzzle && <SolverOverlay puzzle={solverPuzzle} pieces={solverPieces} onClose={closeSolver} />}

      <Header presets={presets} activePresetIdx={activePresetIdx} onSwitchPreset={switchPreset} user={user} onLoginClick={() => setLoginOpen(true)} />

      <main>
        <Dashboard pieces={pieces} presetName={presets[activePresetIdx]?.name || ""} puzzlesForPreset={puzzlesForPreset}
          hasAnyPuzzles={allPuzzles.length > 0} onGenerate={generatePuzzle} onOpenSolver={openSolver} />
        <hr className="divider" />
        <PieceCreator pieces={pieces} selectedPieceIdx={selectedPieceIdx} pieceName={pieceName} presetName={presetName}
          coords={coords} presets={presets} activePresetIdx={activePresetIdx}
          onSelectPiece={selectPiece} onPieceNameChange={handlePieceNameChange} onPresetNameChange={setPresetName}
          onCoordsChange={setCoords} onAddVertex={() => setCoords(c => [...c, ["",""]])} onUpdateShape={updateShape}
          onDeletePiece={deletePiece} onDuplicatePiece={duplicatePiece} onSavePreset={savePreset}
          onDuplicatePreset={duplicatePreset} onSwitchPreset={switchPreset} />
        <hr className="divider" />
        <StlExport pieces={pieces} />
      </main>
    </>
  );
}