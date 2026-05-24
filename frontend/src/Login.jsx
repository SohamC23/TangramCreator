import { useState } from "react";
import { Logo } from "./Constants";

export default function LoginModal({ onClose, onLogin }) {
  const [mode, setMode] = useState("signup");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = () => {
    if (!email.trim()) { setError("Please enter a valid email address"); return; }
    if (!pass.trim()) { setError("Please enter a password"); return; }
    onLogin({ email, initials: email.substring(0, 2).toUpperCase() });
  };

  const toggleMode = () => {
    setMode(mode === "signup" ? "login" : "signup");
    setError("");
  };

  return (
    <div className="login-overlay login-overlay--visible" onClick={onClose}>
      <div className="login-modal" onClick={e => e.stopPropagation()}>
        <div className="login-logo">
          <Logo size={32} />
        </div>

        <h3 className="login-title">
          {mode === "signup" ? "Save your progress" : "Welcome back"}
        </h3>

        <p className="login-desc">
          {mode === "signup"
            ? "Create a free account to save your custom piece sets and puzzle history across sessions."
            : "Log in to access your saved presets and puzzle history."}
        </p>

        <input
          type="email"
          className={`login-input ${error && !email.trim() ? "login-input--error" : ""}`}
          placeholder="Email address"
          value={email}
          onChange={e => { setEmail(e.target.value); setError(""); }}
        />

        {error && <p className="login-error-text">{error}</p>}

        <input
          type="password"
          className="login-input"
          placeholder="Password"
          value={pass}
          onChange={e => { setPass(e.target.value); setError(""); }}
        />

        <button className="login-submit" onClick={handleSubmit}>
          {mode === "signup" ? "Create free account" : "Log in"}
        </button>

        <p className="login-alt">
          {mode === "signup" ? "Already have an account? " : "Don't have an account? "}
          <a href="#" className="login-link" onClick={e => { e.preventDefault(); toggleMode(); }}>
            {mode === "signup" ? "Log in" : "Sign up"}
          </a>
        </p>

        <a href="#" className="login-skip" onClick={e => { e.preventDefault(); onClose(); }}>
          Skip for now
        </a>
      </div>
    </div>
  );
}