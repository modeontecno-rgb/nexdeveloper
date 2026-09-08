import * as React from "react";

import { cn } from "@/lib/utils";

export const claseCampo =
  "w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-primary";

export function Selector({
  etiqueta,
  valor,
  onChange,
  opciones,
  className,
}: {
  etiqueta: string;
  valor: string;
  onChange: (v: string) => void;
  opciones: { valor: string; texto: string }[];
  className?: string;
}) {
  return (
    <label className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
      {etiqueta}
      <select
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 max-w-full flex-1 rounded-md border border-input bg-surface px-2 py-1.5 text-sm text-foreground"
      >
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.texto}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Campo({
  etiqueta,
  children,
  pista,
}: {
  etiqueta: string;
  children: React.ReactNode;
  pista?: string;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{etiqueta}</p>
      <div className="mt-1.5">{React.Children.map(children,child=>React.isValidElement<{"aria-label"?:string}>(child)&&typeof child.type==='string'&&['input','select','textarea'].includes(child.type)?React.cloneElement(child,{'aria-label':child.props['aria-label']??etiqueta}):child)}</div>
      {pista ? <p className="mt-1 text-xs text-muted-foreground">{pista}</p> : null}
    </div>
  );
}

export function Boton({
  className,
  variante = "principal",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variante?: "principal" | "suave" | "peligro" }) {
  const estilos = {
    principal: "bg-primary text-primary-foreground hover:opacity-90",
    suave: "border border-border bg-surface text-foreground hover:border-primary/40",
    peligro: "border border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20",
  } as const;
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition disabled:opacity-60",
        estilos[variante],
        className,
      )}
    />
  );
}
