"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/app/icon";
import { getSupabaseClient } from "@/lib/supabase/client";

interface CampoProps {
  id: string;
  label: string;
  icono: string;
  tipo?: string;
  placeholder: string;
  valor: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  minLength?: number;
}

function Campo({
  id,
  label,
  icono,
  tipo = "text",
  placeholder,
  valor,
  onChange,
  autoComplete,
  minLength,
}: CampoProps) {
  return (
    <div className="transition-transform duration-200 focus-within:scale-[1.01]">
      <label
        htmlFor={id}
        className="text-xs font-bold uppercase tracking-wider text-on-surface-variant"
      >
        {label}
      </label>
      <div className="mt-1 flex items-center gap-2 rounded-lg border border-primary-container bg-surface/80 p-3 transition-shadow focus-within:border-transparent focus-within:ring-2 focus-within:ring-primary">
        <Icon name={icono} className="text-[20px] text-on-surface-variant" />
        <input
          id={id}
          type={tipo}
          required
          value={valor}
          minLength={minLength}
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent text-sm font-light text-on-surface outline-none placeholder:text-on-surface-variant/50"
        />
      </div>
    </div>
  );
}

export default function RegistroPage() {
  const router = useRouter();
  const [negocio, setNegocio] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmarCorreo, setConfirmarCorreo] = useState(false);
  const [cargando, setCargando] = useState(false);

  async function crearCuenta(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);

    const supabase = getSupabaseClient();

    // Crear el usuario. La empresa NO se crea aquí: la crea un
    // trigger en la base de datos (una sola vez por usuario),
    // leyendo nombre_negocio de estos metadatos.
    const { data, error: errorAuth } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nombre_negocio: negocio },
        // El enlace de confirmación debe volver a MapFlow (no al
        // "Site URL" global de Supabase, que puede apuntar a otro
        // proyecto). Así tras confirmar el correo se cae en nuestro
        // /auth/callback → dashboard, y nunca en otro sitio.
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (errorAuth || !data.user) {
      setCargando(false);
      setError(
        errorAuth?.message === "User already registered"
          ? "Ya existe una cuenta con este correo. Inicia sesión."
          : "No se pudo crear la cuenta. Revisa los datos e intenta de nuevo."
      );
      return;
    }

    // Si el correo ya estaba registrado, Supabase devuelve un usuario
    // "ofuscado" sin identidades (para no revelar qué correos existen).
    // Detectarlo evita crear cuentas o empresas paralelas.
    if (data.user.identities && data.user.identities.length === 0) {
      setCargando(false);
      setError(
        "Ya existe una cuenta con este correo. Inicia sesión con tu contraseña o con Google."
      );
      return;
    }

    // Si Supabase exige confirmar el correo, no hay sesión todavía
    if (!data.session) {
      setCargando(false);
      setConfirmarCorreo(true);
      return;
    }

    router.push("/dashboard");
    router.refresh();
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
        {/* Panel de marca */}
        <div className="lg:col-span-2">
          <div className="flex items-center gap-3">
            <Icon name="explore" filled className="text-[40px] text-primary" />
            <span className="text-4xl font-bold tracking-tight text-primary">
              MapFlow
            </span>
          </div>
          <h1 className="mt-6 text-3xl font-bold leading-tight tracking-tight text-on-surface">
            Empieza a cobrar a tiempo desde hoy.
          </h1>
          <p className="mt-4 text-lg font-light leading-relaxed text-on-surface-variant">
            Crea tu cuenta gratis, registra tu negocio y deja que tu copiloto
            financiero haga el seguimiento por ti.
          </p>
        </div>

        {/* Form card */}
        <div className="lg:col-span-3">
          <div className="login-float mx-auto w-full max-w-md rounded-2xl border border-outline-variant/60 bg-white/60 p-8 shadow-level-2 backdrop-blur-md">
            {confirmarCorreo ? (
              <div className="flex flex-col items-center py-8 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary-container">
                  <Icon
                    name="mark_email_read"
                    className="text-[32px] text-on-secondary-container"
                  />
                </div>
                <h2 className="mt-4 text-2xl font-bold text-on-surface">
                  Revisa tu correo
                </h2>
                <p className="mt-2 text-sm font-light leading-relaxed text-on-surface-variant">
                  Te enviamos un enlace de confirmación a{" "}
                  <strong className="font-semibold">{email}</strong>. Ábrelo
                  para activar tu cuenta y entrar a MapFlow.
                </p>
                <Link
                  href="/login"
                  className="mt-6 text-sm font-semibold text-primary hover:underline"
                >
                  Volver al inicio de sesión
                </Link>
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-on-surface">
                  Crear cuenta
                </h2>
                <p className="mt-1 text-sm font-light text-on-surface-variant">
                  Tu negocio y tu cuenta, listos en un minuto.
                </p>

                <form
                  onSubmit={crearCuenta}
                  className="mt-6 flex flex-col gap-4"
                >
                  <Campo
                    id="negocio"
                    label="Nombre de tu negocio"
                    icono="storefront"
                    placeholder="Panadería La Espiga"
                    valor={negocio}
                    onChange={setNegocio}
                    autoComplete="organization"
                  />
                  <Campo
                    id="email"
                    label="Correo electrónico"
                    icono="mail"
                    tipo="email"
                    placeholder="tu@negocio.mx"
                    valor={email}
                    onChange={setEmail}
                    autoComplete="email"
                  />
                  <Campo
                    id="password"
                    label="Contraseña"
                    icono="lock"
                    tipo="password"
                    placeholder="Mínimo 6 caracteres"
                    valor={password}
                    onChange={setPassword}
                    autoComplete="new-password"
                    minLength={6}
                  />

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
                        Creando cuenta…
                      </>
                    ) : (
                      <>
                        Crear mi cuenta
                        <Icon name="arrow_forward" className="text-[18px]" />
                      </>
                    )}
                  </button>
                </form>

                <p className="mt-5 text-center text-sm font-light text-on-surface-variant">
                  ¿Ya tienes cuenta?{" "}
                  <Link
                    href="/login"
                    className="font-semibold text-primary hover:underline"
                  >
                    Iniciar sesión
                  </Link>
                </p>
              </>
            )}
          </div>

          <div className="mx-auto mt-6 flex w-fit items-center gap-2 rounded-full bg-surface-container-high/80 px-4 py-2 text-xs font-light text-on-surface-variant backdrop-blur-sm">
            <Icon name="verified_user" className="text-[16px] text-secondary" />
            Acceso Seguro &amp; Encriptado
          </div>
        </div>
      </div>
    </div>
  );
}
