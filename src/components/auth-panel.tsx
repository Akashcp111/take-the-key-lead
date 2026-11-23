import { useEffect, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { KeyRound, ShieldCheck } from "lucide-react";

export function AuthPanel({ supabase }: { supabase: SupabaseClient }) {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const errorCode = params.get("error_code");
    if (errorCode === "otp_expired") {
      setCanResend(true);
      setMessage("That confirmation link has expired. Enter your email and request a new one below.");
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, []);

  async function resendConfirmation() {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setMessage("Enter your email address first, then request a new confirmation email.");
      return;
    }

    setMessage("");
    setBusy(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: normalizedEmail,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      setCanResend(true);
      setMessage("A new confirmation email was sent. Open the latest email to confirm your account.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not resend the confirmation email.");
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setBusy(true);

    try {
      if (mode === "sign-in") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (!data.session) {
          setCanResend(true);
          setMessage("Check your email to confirm your account. Use the latest confirmation email.");
        }
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Authentication failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="kg-auth-shell">
      <section className="kg-auth-card" aria-labelledby="kg-auth-title">
        <aside className="kg-auth-visual" aria-label="KEYGUARD private key register">
          <div className="kg-auth-brand">
            <span className="kg-auth-brand-mark"><KeyRound size={20} aria-hidden="true" /></span>
            <span className="kg-auth-brand-name">KEYGUARD<span>KEY CONTROL SYSTEM</span></span>
            <span className="kg-auth-secure"><span aria-hidden="true" /> PRIVATE</span>
          </div>
          <div className="kg-auth-visual-copy">
            <p className="kg-auth-kicker">SECURE THE HANDOFF</p>
            <h2>Every key.<br />Always <span>accounted for.</span></h2>
            <p>Keep your room key inventory and handover history clear, organized, and in one place.</p>
          </div>
          <div className="kg-auth-orbit" aria-hidden="true">
            <span className="kg-auth-orbit-ring kg-auth-orbit-ring-one" />
            <span className="kg-auth-orbit-ring kg-auth-orbit-ring-two" />
            <span className="kg-auth-orbit-core"><KeyRound size={38} /></span>
            <span className="kg-auth-orbit-dot kg-auth-orbit-dot-one" />
            <span className="kg-auth-orbit-dot kg-auth-orbit-dot-two" />
          </div>
          <div className="kg-auth-privacy"><ShieldCheck size={18} aria-hidden="true" /><span>Private by design<small>Your register belongs to your account.</small></span></div>
        </aside>

        <div className="kg-auth-content">
          <span className="kg-auth-kicker">PRIVATE REGISTER</span>
          <h1 id="kg-auth-title">{mode === "sign-in" ? "Welcome back" : "Create your register"}</h1>
          <p className="kg-auth-intro">{mode === "sign-in" ? "Sign in to continue managing your room keys." : "Set up a private space for your key records."}</p>
          <form className="kg-auth-form" onSubmit={submit}>
            <label htmlFor="kg-auth-email">Email address</label>
            <input
              id="kg-auth-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.currentTarget.value)}
            />
            <label htmlFor="kg-auth-password">Password</label>
            <input
              id="kg-auth-password"
              type="password"
              autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
              minLength={6}
              required
              value={password}
              onChange={(event) => setPassword(event.currentTarget.value)}
            />
            {message && <p className="kg-auth-message" role="status">{message}</p>}
            <button className="kg-auth-submit" type="submit" disabled={busy} aria-busy={busy}>
              {busy && <span className="kg-button-spinner" aria-hidden="true" />}
              {busy ? "Please wait…" : mode === "sign-in" ? "Sign in" : "Create account"}
              {!busy && <span className="kg-auth-submit-arrow" aria-hidden="true">→</span>}
            </button>
          </form>
          {(mode === "sign-up" || canResend) && (
            <button
              className="kg-auth-toggle"
              type="button"
              onClick={() => void resendConfirmation()}
              disabled={busy}
            >
              Resend confirmation email
            </button>
          )}
          <div className="kg-auth-divider"><span />or<span /></div>
          <button
            className="kg-auth-toggle kg-auth-mode-toggle"
            type="button"
            onClick={() => {
              setMessage("");
              setMode((current) => current === "sign-in" ? "sign-up" : "sign-in");
            }}
          >
            {mode === "sign-in" ? "New to KEYGUARD? Create an account" : "Already registered? Sign in"}
          </button>
          <p className="kg-auth-footnote"><ShieldCheck size={14} aria-hidden="true" /> Your account keeps its register private.</p>
        </div>
      </section>
    </main>
  );
}
