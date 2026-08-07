import { useState } from "react";
import ramsLogo from "./assets/rams-logo.png";
import { checkPassword, setStoredPassword } from "./auth";
import Blobs from "./Blobs";

export default function Login({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setChecking(true);
    setError(null);
    try {
      const ok = await checkPassword(password);
      if (ok) {
        setStoredPassword(password);
        onSuccess();
      } else {
        setError("That password isn't right - try again.");
      }
    } catch {
      setError("Couldn't reach the server - check your connection and try again.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="app">
      <Blobs />
      <header className="hero">
        <img src={ramsLogo} alt="Rams Mining Technologies" className="hero-logo" />
        <h1>Clocking Report Parser</h1>
        <p>Enter the shared password to continue.</p>
      </header>

      <main className="panel login-panel">
        <form onSubmit={submit}>
          <input
            type="password"
            className="login-input"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
          {error && <p className="login-error">{error}</p>}
          <button
            type="submit"
            className="btn btn-primary login-btn"
            disabled={checking || !password}
          >
            {checking ? "Checking…" : "Continue"}
          </button>
        </form>
      </main>

      <footer className="footer">
        Uploaded PDFs are parsed and discarded — nothing is stored afterward.
      </footer>
    </div>
  );
}
