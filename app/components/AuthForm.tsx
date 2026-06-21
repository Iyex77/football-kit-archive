"use client";

import { FormEvent, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase-auth";

export function AuthForm() {
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    let data;
    let error;

    if (mode === "signIn") {
        ({ data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        }));
    } else {
        ({ data, error } = await supabase.auth.signUp({
            email,
            password,
        }));
    }

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setEmail("");
    setPassword("");

    if (mode === "signUp") {
      setMessage(
        data.session
          ? "Registro completado. Ya puedes iniciar sesión."
          : "Registro iniciado. Revisa tu correo para continuar.",
      );
    } else {
      setMessage("Inicio de sesión exitoso. Bienvenido de nuevo.");
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#142f2d_0,#090d13_36rem,#05070b_100%)] px-4 py-7 text-slate-100 sm:px-6 lg:px-10">
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center rounded-3xl border border-slate-700/70 bg-slate-950/80 p-8 shadow-2xl shadow-slate-950/40 backdrop-blur-xl">
        <div className="mb-8 text-center">
          <p className="eyebrow">Acceso privado</p>
          <h1 className="mt-4 text-3xl font-semibold text-white">Inicia sesión o regístrate</h1>
          <p className="mt-3 text-sm text-slate-400">
            Gestiona tu colección de camisetas con seguridad. Usa tu correo electrónico y contraseña para entrar.
          </p>
        </div>

        <div className="mb-6 flex items-center justify-center gap-2 rounded-2xl bg-slate-900/70 p-1">
          {(["signIn", "signUp"] as const).map((option) => (
            <button
              key={option}
              type="button"
              className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                mode === option
                  ? "bg-slate-100 text-slate-950"
                  : "text-slate-300 hover:bg-slate-800 hover:text-slate-50"
              }`}
              onClick={() => setMode(option)}
            >
              {option === "signIn" ? "Iniciar sesión" : "Registrarse"}
            </button>
          ))}
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-slate-200">
            Correo electrónico
            <input
              className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-500/40"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </label>

          <label className="block text-sm font-medium text-slate-200">
            Contraseña
            <input
              className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-500/40"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
              minLength={6}
            />
          </label>

          {error ? <p className="rounded-2xl bg-red-500/15 px-4 py-3 text-sm text-red-200">{error}</p> : null}
          {message ? <p className="rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{message}</p> : null}

          <button
            className="w-full rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
            type="submit"
            disabled={loading}
          >
            {loading ? "Procesando..." : mode === "signIn" ? "Entrar" : "Crear cuenta"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          {mode === "signIn"
            ? "¿No tienes cuenta?"
            : "¿Ya tienes cuenta?"}{" "}
          <button
            type="button"
            className="font-semibold text-slate-100 underline underline-offset-4 transition hover:text-white"
            onClick={() => setMode(mode === "signIn" ? "signUp" : "signIn")}
          >
            {mode === "signIn" ? "Regístrate" : "Inicia sesión"}
          </button>
        </p>
      </div>
    </main>
  );
}
