import * as React from "react";

const CLAVE_AJUSTES = "nexdeveloper-ajustes-v1";

export interface Config {
  organizacion: string;
  moneda: string;
  umbralAprobacion: number;
  tareasParalelas: number;
  reorganizacionAutomatica: boolean;
  confianzaMinima: number;
}

export const CONFIG_POR_DEFECTO: Config = {
  organizacion: "Mi organización",
  moneda: "EUR",
  umbralAprobacion: 150,
  tareasParalelas: 4,
  reorganizacionAutomatica: true,
  confianzaMinima: 80,
};

interface Contexto {
  config: Config;
  actualizar: (parcial: Partial<Config>) => void;
  guardar: (valor: Config) => void;
}

const Ctx = React.createContext<Contexto | null>(null);

export function ProveedorConfig({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = React.useState<Config>(CONFIG_POR_DEFECTO);

  React.useEffect(() => {
    try {
      const bruto = window.localStorage.getItem(CLAVE_AJUSTES);
      if (bruto) setConfig({ ...CONFIG_POR_DEFECTO, ...(JSON.parse(bruto) as Config) });
    } catch {
      /* almacenamiento no disponible */
    }
  }, []);

  const guardar = (valor: Config) => {
    setConfig(valor);
    try {
      window.localStorage.setItem(CLAVE_AJUSTES, JSON.stringify(valor));
    } catch {
      /* almacenamiento no disponible */
    }
  };

  return (
    <Ctx.Provider value={{ config, actualizar: (p) => setConfig((c) => ({ ...c, ...p })), guardar }}>
      {children}
    </Ctx.Provider>
  );
}

export function useConfig() {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useConfig debe usarse dentro de ProveedorConfig");
  return ctx;
}
