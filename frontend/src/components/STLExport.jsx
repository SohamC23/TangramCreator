import { useMemo } from "react";
import { COLORS } from "./helpers/Constants";
import { getGraphBounds } from "./helpers/HelperFunctions";

export default function StlExport({ pieces }) {
  const preview = useMemo(() => {
    if (!pieces.length) return null;
    const b = getGraphBounds(pieces);
    const range = b.max - b.min || 1;
    return pieces.map((p, i) => {
      const pts = p.coords
        .map(c => `${5 + ((c[0] - b.min) / range) * 90},${95 - ((c[1] - b.min) / range) * 90}`)
        .join(" ");
      return (
        <polygon
          key={i}
          points={pts}
          fill={COLORS[p.colorIdx % COLORS.length].fill}
          stroke={COLORS[p.colorIdx % COLORS.length].stroke}
          strokeWidth="1"
          strokeLinejoin="round"
          opacity="0.8"
        />
      );
    });
  }, [pieces]);

  return (
    <section className="section" id="stl-section">
      <h2 className="section-title">Download STL for 3D printing</h2>
      <div className="stl-card">
        <div className={`stl-preview ${!pieces.length ? "stl-preview--empty" : ""}`}>
          {pieces.length ? (
            <svg viewBox="0 0 100 100" width="90" height="90">{preview}</svg>
          ) : (
            "No pieces"
          )}
        </div>
        <div className="stl-info">
          <h3 className="stl-heading">Export current piece set</h3>
          <p className="stl-desc">
            Generate an STL file of your <strong>{pieces.length}</strong> tangram pieces, ready for 3D printing.
          </p>
          <div className="stl-options">
            <label className="stl-option-label">
              Thickness
              <input type="number" className="stl-option-input" defaultValue="5" min="1" max="20" />
              mm
            </label>
            <label className="stl-option-label">
              Scale
              <input type="number" className="stl-option-input" defaultValue="100" min="50" max="300" step="10" />
              %
            </label>
          </div>
          <div className="btn-row">
            <button className="btn-primary" disabled={!pieces.length}>
              <i className="ti ti-download" /> Download STL
            </button>
            <button className="btn-outline" disabled={!pieces.length}>
              <i className="ti ti-file" /> Download SVG
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}