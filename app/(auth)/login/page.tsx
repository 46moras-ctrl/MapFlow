"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/app/icon";
import { getSupabaseClient } from "@/lib/supabase/client";

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"
      />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  // Caso especial: la cuenta existe pero el correo no está confirmado
  const [noConfirmado, setNoConfirmado] = useState(false);
  const [reenviando, setReenviando] = useState(false);
  const [reenviado, setReenviado] = useState(false);

  async function iniciarSesion(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNoConfirmado(false);
    setReenviado(false);
    setCargando(true);

    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setCargando(false);
      // Supabase distingue este caso con su propio código de error
      if (
        error.code === "email_not_confirmed" ||
        error.message === "Email not confirmed"
      ) {
        setNoConfirmado(true);
        return;
      }
      setError(
        error.message === "Invalid login credentials"
          ? "Correo o contraseña incorrectos."
          : "No se pudo iniciar sesión. Intenta de nuevo."
      );
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  async function reenviarConfirmacion() {
    setError(null);
    setReenviando(true);

    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.resend({ type: "signup", email });

    setReenviando(false);
    if (error) {
      setError(
        error.code === "over_email_send_rate_limit"
          ? "Espera un momento antes de volver a reenviar el correo."
          : "No se pudo reenviar el correo. Intenta de nuevo en unos minutos."
      );
      return;
    }
    setReenviado(true);
  }

  async function iniciarConGoogle() {
    setError(null);
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setError("No se pudo conectar con Google. Intenta de nuevo.");
  }

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-surface px-6 py-12"
      style={{
        backgroundImage:
          "radial-gradient(circle at 20% 30%, rgba(183, 209, 169, 0.35), transparent 45%), radial-gradient(circle at 80% 70%, rgba(194, 239, 167, 0.3), transparent 45%), radial-gradient(#B7D1A9 1.5px, transparent 1.5px)",
        backgroundSize: "auto, auto, 26px 26px",
      }}
    >
      <div className="grid w-full max-w-5xl items-center gap-12 lg:grid-cols-5">
        {/* Panel de marca (40%) */}
        <div className="lg:col-span-2">
          <div className="flex items-center gap-3">
            <Icon name="explore" filled className="text-[40px] text-primary" />
            <span className="text-4xl font-bold tracking-tight text-primary">
              MapFlow
            </span>
          </div>
          <h1 className="mt-6 text-3xl font-bold leading-tight tracking-tight text-on-surface">
            Tu copiloto financiero: cobra, controla y crece.
          </h1>
          <p className="mt-4 text-lg font-light leading-relaxed text-on-surface-variant">
            El norte financiero de tu PYME: cuentas por cobrar, gastos y
            proyecciones en un solo lugar, con un asistente que trabaja por ti.
          </p>
        </div>

        {/* Form card (60%) */}
        <div className="lg:col-span-3">
          <div className="login-float mx-auto w-full max-w-md rounded-2xl border border-outline-variant/60 bg-white/60 p-8 shadow-level-2 backdrop-blur-md">
            <h2 className="text-2xl font-bold text-on-surface">
              Iniciar sesión
            </h2>
            <p className="mt-1 text-sm font-light text-on-surface-variant">
              Bienvenida de vuelta. Tus finanzas te esperan.
            </p>

            <form onSubmit={iniciarSesion} className="mt-6 flex flex-col gap-4">
              <div className="transition-transform duration-200 focus-within:scale-[1.01]">
                <label
                  htmlFor="email"
                  className="text-xs font-bold uppercase tracking-wider text-on-surface-variant"
                >
                  Correo electrónico
                </label>
                <div className="mt-1 flex items-center gap-2 rounded-lg border border-primary-container bg-surface/80 p-3 transition-shadow focus-within:border-transparent focus-within:ring-2 focus-within:ring-primary">
                  <Icon
                    name="mail"
                    className="text-[20px] text-on-surface-variant"
                  />
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@negocio.mx"
                    className="w-full bg-transparent text-sm font-light text-on-surface outline-none placeholder:text-on-surface-variant/50"
                  />
                </div>
              </div>

              <div className="transition-transform duration-200 focus-within:scale-[1.01]">
                <label
                  htmlFor="password"
                  className="text-xs font-bold uppercase tracking-wider text-on-surface-variant"
                >
                  Contraseña
                </label>
                <div className="mt-1 flex items-center gap-2 rounded-lg border border-primary-container bg-surface/80 p-3 transition-shadow focus-within:border-transparent focus-within:ring-2 focus-within:ring-primary">
                  <Icon
                    name="lock"
                    className="text-[20px] text-on-surface-variant"
                  />
                  <input
                    id="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-transparent text-sm font-light text-on-surface outline-none placeholder:text-on-surface-variant/50"
                  />
                </div>
              </div>

              {noConfirmado && (
                <div className="rounded-lg border border-tertiary-container bg-tertiary-container/40 px-4 py-3">
                  <div className="flex items-start gap-2 text-sm font-light leading-relaxed text-on-tertiary-container">
                    <Icon
                      name="mark_email_unread"
                      className="mt-0.5 shrink-0 text-[18px]"
                    />
                    <span>
                      Tu cuenta aún no está confirmada. Revisa tu correo{" "}
                      <strong className="font-semibold">{email}</strong> y haz
                      clic en el enlace (o ingresa el código) para activarla
                      antes de iniciar sesión.
                    </span>
                  </div>
                  {reenviado ? (
                    <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-secondary">
                      <Icon name="check_circle" className="text-[18px]" />
                      Correo reenviado. Revisa tu bandeja de entrada y spam.
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={reenviarConfirmacion}
                      disabled={reenviando}
                      className="mt-3 flex items-center gap-2 rounded-xl border border-secondary px-4 py-2 text-xs font-bold uppercase tracking-wider text-secondary transition-colors hover:bg-secondary/5 active:scale-[0.98] disabled:opacity-60"
                    >
                      {reenviando ? (
                        <>
                          <Icon
                            name="progress_activity"
                            className="animate-spin text-[16px]"
                          />
                          Reenviando…
                        </>
                      ) : (
                        <>
                          <Icon name="forward_to_inbox" className="text-[16px]" />
                          Reenviar correo de confirmación
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 rounded-lg bg-error-container px-4 py-3 text-sm font-light text-on-error-container">
                  <Icon name="error" className="text-[18px]" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={cargando}
                className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-on-primary transition-opacity hover:opacity-90 active:scale-[0.98] disabled:opacity-60"
              >
                {cargando ? (
                  <>
                    <Icon
                      name="progress_activity"
                      className="animate-spin text-[18px]"
                    />
                    Entrando…
                  </>
                ) : (
                  <>
                    Iniciar sesión
                    <Icon name="arrow_forward" className="text-[18px]" />
                  </>
                )}
              </button>
            </form>

            <div className="my-5 flex items-center gap-3 text-xs font-light text-on-surface-variant">
              <div className="h-px flex-1 bg-outline-variant" />
              o continuar con
              <div className="h-px flex-1 bg-outline-variant" />
            </div>

            <button
              type="button"
              onClick={iniciarConGoogle}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-outline-variant bg-white px-6 py-3 text-sm font-light text-on-surface transition-colors hover:bg-surface-container-low"
            >
              <GoogleLogo />
              Continuar con Google
            </button>

            <p className="mt-5 text-center text-sm font-light text-on-surface-variant">
              ¿Aún no tienes cuenta?{" "}
              <Link
                href="/registro"
                className="font-semibold text-primary hover:underline"
              >
                Crear cuenta
              </Link>
            </p>
          </div>

          {/* Badge de seguridad */}
          <div className="mx-auto mt-6 flex w-fit items-center gap-2 rounded-full bg-surface-container-high/80 px-4 py-2 text-xs font-light text-on-surface-variant backdrop-blur-sm">
            <Icon name="verified_user" className="text-[16px] text-secondary" />
            Acceso Seguro &amp; Encriptado
          </div>
        </div>
      </div>
    </div>
  );
}
