import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/lib/nex/supabase";
import { formatoCosteIA } from "@/lib/nex/coste-ia";
export function ReservaPendiente({ id }: { id: string }) {
  const q = useQuery({
    queryKey: ["reserva-pendiente", id],
    queryFn: async () => {
      const r = await supabase
        .from("ia_reservas")
        .select("id,proveedor,estado,reservado,coste,creada_el,operacion")
        .eq("id", id)
        .maybeSingle();
      if (r.error) throw r.error;
      return r.data;
    },
  });
  return (
    <div className="space-y-2 rounded-xl border border-warning p-4 text-sm">
      <p className="text-lg font-semibold">Consumo pendiente de comprobar</p>
      {q.isPending ? (
        <p>Consultando la reserva…</p>
      ) : q.error ? (
        <p>No se pudo consultar el detalle. El saldo sigue sin confirmar.</p>
      ) : q.data ? (
        <>
          <p>
            {q.data.proveedor} ·{" "}
            {q.data.estado === "liquidada"
              ? "Consumo confirmado"
              : "Resultado económico sin confirmar"}
          </p>
          <p>
            {q.data.coste === null
              ? `${formatoCosteIA(q.data.reservado)} retenidos como previsión; no es un cobro confirmado.`
              : `Consumo contabilizado: ${formatoCosteIA(q.data.coste)}.`}
          </p>
        </>
      ) : (
        <p>Esta reserva no está disponible para tu cuenta.</p>
      )}
      <p>
        No se ha repetido la llamada. Comprueba el uso en la cuenta del proveedor antes de volver a
        encargar el mismo trabajo.
      </p>
      <Link to="/gasto-ia" className="inline-block underline">
        Ver gasto de IA
      </Link>
    </div>
  );
}
