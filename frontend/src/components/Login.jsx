import { useState } from "react";
import { Logo } from "../assets/Logo";
import { signIn, signUp, confirmSignUp } from "aws-amplify/auth";

export default function LoginModal({ onClose, onLogin }) {
  const [mode, setMode] = useState("signup");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [code, setCode] = useState("");          // for the confirmation step
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);        // prevent double-submits during network calls

  const handleSubmit = async () => {
    if (mode === "confirm") return handleConfirm();

    if (!email.trim()) { setError("Please enter a valid email address"); return; }
    if (!pass.trim()) { setError("Please enter a password"); return; }

    setBusy(true);
    try {
      if (mode === "signup") {
        await signUp({
          username: email,
          password: pass,
          options: { userAttributes: { email } },
        });
        // Cognito has emailed a code — move to the confirm step.
        setError("");
        setMode("confirm");
      } else {
        await signIn({ username: email, password: pass });
        // Auth succeeded — hand control back to your app exactly as before.
        onLogin({ email, initials: email.substring(0, 2).toUpperCase() });
      }
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const handleConfirm = async () => {
    if (!code.trim()) { setError("Please enter the confirmation code"); return; }
    setBusy(true);
    try {
      await confirmSignUp({ username: email, confirmationCode: code });
      // Account is now active — sign them straight in.
      await signIn({ username: email, password: pass });
      onLogin({ email, initials: email.substring(0, 2).toUpperCase() });
    } catch (err) {
      setError(err.message || "Invalid confirmation code");
    } finally {
      setBusy(false);
    }
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
          {mode === "signup" ? "Save your progress"
            : mode === "confirm" ? "Check your email"
            : "Welcome back"}
        </h3>

        <p className="login-desc">
          {mode === "signup"
            ? "Create a free account to save your custom piece sets and puzzle history across sessions."
            : mode === "confirm"
            ? `We sent a confirmation code to ${email}. Enter it below to activate your account.`
            : "Log in to access your saved presets and puzzle history."}
        </p>

        {mode === "confirm" ? (
          <input
            type="text"
            className={`login-input ${error && !code.trim() ? "login-input--error" : ""}`}
            placeholder="Confirmation code"
            value={code}
            onChange={e => { setCode(e.target.value); setError(""); }}
          />
        ) : (
          <>
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
          </>
        )}

        {/* error shows here for confirm mode (and as a fallback) */}
        {error && mode === "confirm" && <p className="login-error-text">{error}</p>}

        <button className="login-submit" onClick={handleSubmit} disabled={busy}>
          {busy ? "Please wait…"
            : mode === "signup" ? "Create free account"
            : mode === "confirm" ? "Confirm account"
            : "Log in"}
        </button>

        {mode !== "confirm" && (
          <p className="login-alt">
            {mode === "signup" ? "Already have an account? " : "Don't have an account? "}
            <a href="#" className="login-link" onClick={e => { e.preventDefault(); toggleMode(); }}>
              {mode === "signup" ? "Log in" : "Sign up"}
            </a>
          </p>
        )}

        <a href="#" className="login-skip" onClick={e => { e.preventDefault(); onClose(); }}>
          Skip for now
        </a>
      </div>
    </div>
  );
}