import { Logo } from "../assets/Logo";

export default function Header({ presets, activePresetIdx, onSwitchPreset, user, onLoginClick }) {
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
          <select
            className="preset-selector-dropdown"
            value={activePresetIdx}
            onChange={e => onSwitchPreset(Number(e.target.value))}
          >
            {presets.map((p, i) => (
              <option key={i} value={i}>
                {p.name} ({p.pieces.length})
              </option>
            ))}
          </select>
        </div>

        {user ? (
          <div
            className="user-avatar-btn"
            role="button"
            tabIndex={0}
            onClick={onLoginClick}
            onKeyDown={e => { if (e.key === "Enter" || e.key === " ") onLoginClick(); }}
          >
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