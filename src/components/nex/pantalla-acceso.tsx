import { Cpu, Loader2 } from "lucide-react";
import * as React from "react";

import { PastillaVersionFija } from "@/components/nex/pastilla-version";
import { PieMarca } from "@/components/nex/pie-marca";
import { useAuth } from "@/lib/nex/auth";

export function PantallaAcceso() {
  const { entrar, registrar } = useAuth();
  const [modo, setModo] = React.useState<"entrar" | "crear">("entrar");
  const [aviso, setAviso] = React.useState<string | null>(null);
  const [email, setEmail] = React.useState("");
  const [contrasena, setContrasena] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [enviando, setEnviando] = React.useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setAviso(null);
    setEnviando(true);
    try {
      if (modo === "entrar") {
        await entrar(email.trim(), contrasena);
      } else {
        const { confirmacionPendiente } = await registrar(email.trim(), contrasena);
        if (confirmacionPendiente) {
          setAviso("Cuenta creada. Revisa tu correo y confirma la dirección para poder entrar.");
        } else {
          setAviso("Cuenta creada. Ya puedes usar NexDeveloper.");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se ha podido completar la operación.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <PastillaVersionFija />
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <span className="grid size-11 place-items-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/30">
            <Cpu className="size-5" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">NexDeveloper</h1>
            <p className="mt-1 text-sm text-muted-foreground">Centro de control multiagente</p>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg border border-border bg-surface p-1 text-sm">
          {(["entrar", "crear"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setModo(m);
                setError(null);
                setAviso(null);
              }}
              className={
                "rounded-md px-3 py-1.5 font-medium transition " +
                (modo === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")
              }
            >
              {m === "entrar" ? "Iniciar sesión" : "Crear cuenta"}
            </button>
          ))}
        </div>

        <form onSubmit={enviar} className="panel space-y-4 p-6">
          <div>
            <label htmlFor="email" className="text-xs font-medium text-muted-foreground">
              Correo electrónico
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>
          <div>
            <label htmlFor="contrasena" className="text-xs font-medium text-muted-foreground">
              Contraseña
            </label>
            <input
              id="contrasena"
              type="password"
              required
              autoComplete={modo === "entrar" ? "current-password" : "new-password"}
              minLength={modo === "crear" ? 6 : undefined}
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>

          {aviso ? (
            <p className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-xs text-primary">{aviso}</p>
          ) : null}

          {error ? (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={enviando}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            {enviando ? <Loader2 className="size-4 animate-spin" /> : null}
            {modo === "entrar" ? "Entrar" : "Crear cuenta"}
          </button>

          <p className="text-center text-xs text-muted-foreground">
            {modo === "entrar"
              ? "¿Aún no tienes cuenta? Cámbiate a «Crear cuenta»."
              : "Crea aquí tu cuenta de revisor con tu correo y una contraseña de al menos 6 caracteres."}
          </p>
        </form>

        <PieMarca className="mt-6" />
      </div>
    </div>
  );
}
