import { useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

export function AuthPanel({ supabase }: { supabase: SupabaseClient }) {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setBusy(true);

    try {
      if (mode === "sign-in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (!data.session) setMessage("Check your email to confirm your account, then sign in.");
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
        <span className="kg-auth-kicker">KEYGUARD / PRIVATE REGISTER</span>
        <h1 id="kg-auth-title">{mode === "sign-in" ? "Sign in to your register" : "Create your register"}</h1>
        <p>Each account has its own private key records and activity history.</p>
        <form className="kg-auth-form" onSubmit={submit}>
          <label htmlFor="kg-auth-email">Email</label>
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
          <button className="kg-auth-submit" type="submit" disabled={busy}>
            {busy ? "Please wait…" : mode === "sign-in" ? "Sign in" : "Create account"}
          </button>
        </form>
        <button
          className="kg-auth-toggle"
          type="button"
          onClick={() => {
            setMessage("");
            setMode((current) => current === "sign-in" ? "sign-up" : "sign-in");
          }}
        >
          {mode === "sign-in" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
      </section>
    </main>
  );
}
