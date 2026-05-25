import { useMemo } from "react";
import { COLORS } from "./helpers/Constants";
import { polyArea, getGraphBounds, getGridTicks } from "./helpers/HelperFunctions";

export default function PieceCreator({
  pieces,
  selectedPieceIdx,
  pieceName,
  presetName,
  coords,
  presets,
  activePresetIdx,
  onSelectPiece,
  onPieceNameChange,
  onPresetNameChange,
  onCoordsChange,
  onAddVertex,
  onUpdateShape,
  onDeletePiece,
  onDuplicatePiece,
  onSavePreset,
  onDuplicatePreset,
  onSwitchPreset,
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
        {/* ── Graph column ─────────────────────── */}
        <div className="creator-graph-col">
          <div className="graph-wrap">
            <span className="graph-range-label">
              Graph range: {bounds.min} – {bounds.max}
            </span>
            <svg className="graph-svg" viewBox="0 0 400 400">
              <rect x="0" y="0" width="400" height="400" fill="var(--c-surface)" rx="6" />

              {/* Axes */}
              <line x1="40" y1="360" x2="380" y2="360" stroke="var(--c-border)" strokeWidth="0.5" />
              <line x1="40" y1="360" x2="40" y2="20" stroke="var(--c-border)" strokeWidth="0.5" />

              {/* Grid lines & labels */}
              {ticks.map(v => (
                <g key={v}>
                  <text className="graph-axis-label" x={gx(v)} y="376">{v}</text>
                  <text className="graph-axis-label" x="22" y={gy(v) + 4}>{v}</text>
                  <line x1="40" y1={gy(v)} x2="380" y2={gy(v)} stroke="var(--c-border-light)" strokeWidth="0.5" strokeDasharray="3 3" />
                  <line x1={gx(v)} y1="20" x2={gx(v)} y2="360" stroke="var(--c-border-light)" strokeWidth="0.5" strokeDasharray="3 3" />
                </g>
              ))}

              {/* Pieces */}
              {pieces.map((p, i) => {
                const isSel = i === selectedPieceIdx;
                const c = COLORS[p.colorIdx % COLORS.length];
                const pts = p.coords.map(coord => `${gx(coord[0])},${gy(coord[1])}`).join(" ");
                return (
                  <polygon
                    key={i}
                    points={pts}
                    fill={isSel ? "var(--c-blue-soft)" : c.fill}
                    stroke={isSel ? "var(--c-blue)" : c.stroke}
                    strokeWidth={isSel ? 2.5 : 1}
                    opacity={isSel ? 0.6 : 0.7}
                    strokeLinejoin="round"
                    style={{ cursor: "pointer" }}
                    onClick={() => onSelectPiece(i)}
                  />
                );
              })}
            </svg>

            {!pieces.length && (
              <div className="graph-empty" style={{ display: "flex" }}>
                <i className="ti ti-shape" />
                No pieces yet
              </div>
            )}
          </div>
        </div>

        {/* ── Side panel column ────────────────── */}
        <div className="creator-side-col">
          {/* Name this preset */}
          <div className="field-group">
            <label className="field-label">Name this preset</label>
            <input
              type="text"
              className="field-input"
              placeholder="e.g. My custom set"
              value={presetName}
              onChange={e => onPresetNameChange(e.target.value)}
            />
          </div>

          {/* Name this piece */}
          <div className="field-group">
            <label className="field-label">Name this piece</label>
            <input
              type="text"
              className="field-input"
              placeholder="e.g. Large triangle"
              value={pieceName}
              onChange={e => onPieceNameChange(e.target.value)}
            />
          </div>

          {/* Vertices */}
          <div className="field-group">
            <label className="field-label">Vertices (x, y)</label>
            <div className="coord-input-list">
              {coords.map(([x, y], i) => (
                <div className="coord-row" key={i}>
                  <input
                    type="number"
                    className="coord-field"
                    placeholder={`x${i + 1}`}
                    value={x}
                    onChange={e => {
                      const c = [...coords];
                      c[i] = [e.target.value, c[i][1]];
                      onCoordsChange(c);
                    }}
                  />
                  <input
                    type="number"
                    className="coord-field"
                    placeholder={`y${i + 1}`}
                    value={y}
                    onChange={e => {
                      const c = [...coords];
                      c[i] = [c[i][0], e.target.value];
                      onCoordsChange(c);
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="btn-row">
              <button className="btn-sm" onClick={onAddVertex}>
                <i className="ti ti-plus" /> Vertex
              </button>
              <button className="btn-primary btn-primary--sm" onClick={onUpdateShape}>
                <i className="ti ti-check" /> Update shape
              </button>
            </div>
          </div>

          <hr className="panel-divider" />

          {/* Pieces in this set */}
          <div className="field-group">
            <label className="field-label">Pieces in this set ({pieces.length})</label>
            <select
              className="field-select"
              value={selectedPieceIdx}
              onChange={e => onSelectPiece(Number(e.target.value))}
            >
              <option value={-1}>Select a piece...</option>
              {pieces.map((p, i) => (
                <option key={i} value={i}>{p.name}</option>
              ))}
            </select>
            <div className="btn-row">
              <button className="btn-sm" disabled={selectedPieceIdx < 0} onClick={onDuplicatePiece}>
                <i className="ti ti-copy" /> Duplicate
              </button>
              <button className="btn-sm btn-sm--danger" disabled={selectedPieceIdx < 0} onClick={onDeletePiece}>
                <i className="ti ti-trash" /> Delete
              </button>
            </div>
            <div className="piece-list">
              {pieces.map((p, i) => {
                const isSel = i === selectedPieceIdx;
                return (
                  <div
                    key={i}
                    className={`piece-item ${isSel ? "piece-item--selected" : ""}`}
                    onClick={() => onSelectPiece(i)}
                  >
                    <span className="piece-swatch" style={{ background: COLORS[p.colorIdx % COLORS.length].fill }} />
                    <span className="piece-name">{p.name}</span>
                    <span className="piece-area">{Math.round(polyArea(p.coords))}</span>
                  </div>
                );
              })}
              {!pieces.length && (
                <div style={{ padding: "16px 0", textAlign: "center", fontSize: 12, color: "var(--c-text-3)" }}>
                  No pieces added
                </div>
              )}
            </div>
          </div>

          <hr className="panel-divider" />

          {/* Presets */}
          <div className="field-group">
            <label className="field-label">Presets</label>
            <div className="btn-row">
              <button className="btn-sm" onClick={onSavePreset}>
                <i className="ti ti-device-floppy" /> Save preset
              </button>
            </div>
            <div className="preset-list">
              {presets.map((p, i) => (
                <div
                  key={i}
                  className={`preset-item ${i === activePresetIdx ? "preset-item--active" : ""}`}
                  onClick={() => onSwitchPreset(i)}
                >
                  <span className="preset-name">
                    {p.name}
                    {p.builtIn && <span className="preset-badge">built-in</span>}
                  </span>
                  <span className="preset-count">{p.pieces.length}</span>
                  <button
                    className="preset-dup-btn"
                    title="Duplicate preset"
                    onClick={e => { e.stopPropagation(); onDuplicatePreset(i); }}
                  >
                    <i className="ti ti-copy" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="section-nav">
        <button
          className="btn-outline"
          onClick={() => document.getElementById("stl-section")?.scrollIntoView({ behavior: "smooth" })}
        >
          <i className="ti ti-3d-cube-sphere" /> Download STL file <i className="ti ti-arrow-down" />
        </button>
      </div>
    </section>
  );
}