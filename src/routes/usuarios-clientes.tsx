import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import {
  Ban,
  Copy,
  Eye,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Encabezado } from "@/components/nex/app-shell";
import { Boton, Campo, Selector, claseCampo } from "@/components/nex/campos";
import { Dialogo } from "@/components/nex/dialogo";
import type { ProyectoRow, UsuarioClienteRow } from "@/lib/nex/db-types";
import { desde, formatoFechaHora } from "@/lib/nex/labels";
import { useProyectos } from "@/lib/nex/queries/datos";
import {
  DIAS_INACTIVO,
  ROLES_SUGERIDOS,
  contarInactivos,
  diasDesde,
  enlaceWhatsApp,
  mensajeAcceso,
  useAccionesUsuarios,
  useActualizarUsuarioCliente,
  useBloquearUsuario,
  useBorrarUsuarioCliente,
  useContrasenaProyectian,
  useCrearUsuarioCliente,
  useEstadoUsuariosClientes,
  useInvitarUsuarioCliente,
  useListarEnVivo,
  useRealtimeUsuariosClientes,
  useResetearContrasena,
  useSincronizarUsuarios,
  useUsuariosClientes,
} from "@/lib/nex/queries/usuarios-clientes";

type BusquedaUsuarios = { proyecto?: string };

const DESCRIPCION =
  "Gestiona desde un único sitio quién tiene acceso a cada una de las aplicaciones de tus clientes.";

export const Route = createFileRoute("/usuarios-clientes")({
  validateSearch: (busqueda: Record<string, unknown>): BusquedaUsuarios =>
    typeof busqueda["proyecto"] === "string" ? { proyecto: busqueda["proyecto"] } : {},
  head: () => ({
    meta: [
      { title: "Usuarios de clientes · NexDeveloper" },
      { name: "description", content: DESCRIPCION },
      { property: "og:title", content: "Usuarios de clientes · NexDeveloper" },
      { property: "og:description", content: DESCRIPCION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PantallaUsuariosClientes,
});

/* --------------------------------- Piezas -------------------------------- */

function Chip({ children, tono }: { children: React.ReactNode; tono: string }) {
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${tono}`}>{children}</span>;
}

function copiar(texto: string, aviso = "Copiado al portapapeles.") {
  void navigator.clipboard.writeText(texto).then(
    () => toast.success(aviso),
    () => toast.error("No se ha podido copiar."),
  );
}

/* -------------------------------- Pantalla -------------------------------- */

function PantallaUsuariosClientes() {
  const busqueda = useSearch({ from: "/usuarios-clientes" });
  const { data: proyectos = [] } = useProyectos();
  const { data: usuarios = [], isPending } = useUsuariosClientes();
  const estado = useEstadoUsuariosClientes();
  useRealtimeUsuariosClientes();

  const sincronizar = useSincronizarUsuarios();
  const listarEnVivo = useListarEnVivo();

  const [pestana, setPestana] = React.useState<"usuarios" | "historico">("usuarios");
  const [filtroProyecto, setFiltroProyecto] = React.useState<string>(busqueda.proyecto ?? "todos");
  const [texto, setTexto] = React.useState("");
  const [nuevo, setNuevo] = React.useState(false);
  const [editando, setEditando] = React.useState<UsuarioClienteRow | null>(null);
  const [borrando, setBorrando] = React.useState<UsuarioClienteRow | null>(null);
  const [contrasena, setContrasena] = React.useState<{
    usuario: UsuarioClienteRow;
    valor: string;
    proyectian?: boolean;
  } | null>(null);

  React.useEffect(() => {
    if (busqueda.proyecto) setFiltroProyecto(busqueda.proyecto);
  }, [busqueda.proyecto]);

  const nombreProyecto = React.useCallback(
    (id: string) => proyectos.find((p) => p.id === id)?.nombre ?? "Proyecto",
    [proyectos],
  );

  const filtrados = React.useMemo(() => {
    const t = texto.trim().toLowerCase();
    return usuarios.filter((u) => {
      if (filtroProyecto !== "todos" && u.proyecto_id !== filtroProyecto) return false;
      if (!t) return true;
      return (
        u.email.toLowerCase().includes(t) ||
        (u.nombre ?? "").toLowerCase().includes(t) ||
        (u.rol ?? "").toLowerCase().includes(t)
      );
    });
  }, [usuarios, filtroProyecto, texto]);

  const porProyecto = React.useMemo(() => {
    const mapa = new Map<string, UsuarioClienteRow[]>();
    for (const u of filtrados) {
      const lista = mapa.get(u.proyecto_id) ?? [];
      lista.push(u);
      mapa.set(u.proyecto_id, lista);
    }
    return [...mapa.entries()].sort((a, b) => nombreProyecto(a[0]).localeCompare(nombreProyecto(b[0]), "es"));
  }, [filtrados, nombreProyecto]);

  return (
    <>
      <Encabezado
        titulo="Usuarios de clientes"
        descripcion={DESCRIPCION}
        acciones={
          <div className="flex flex-wrap items-center gap-2">
            <Boton
              variante="suave"
              disabled={sincronizar.isPending}
              onClick={() =>
                sincronizar.mutate(undefined, {
                  onSuccess: () => toast.success("Sincronización en marcha. La lista se irá actualizando sola."),
                  onError: (e) => toast.error((e as Error).message),
                })
              }
            >
              {sincronizar.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Sincronizar todo
            </Boton>
            <Boton onClick={() => setNuevo(true)}>
              <Plus className="size-4" /> Nuevo usuario
            </Boton>
          </div>
        }
      />

      <section className="grid gap-3 sm:grid-cols-3">
        <Dato titulo="Usuarios en total" valor={String(estado.data?.total ?? usuarios.length)} />
        <Dato
          titulo="Última sincronización"
          valor={estado.data?.ultima_sincronizacion ? desde(estado.data.ultima_sincronizacion) : "Nunca"}
        />
        <Dato
          titulo="Acceso a los Supabase"
          valor={estado.data?.token_cuenta ? "Configurado" : "Sin configurar"}
          alerta={!estado.data?.token_cuenta}
        />
      </section>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[14rem]">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar por correo, nombre o rol en todos los proyectos"
            className={`${claseCampo} pl-9`}
          />
        </div>
        <Selector
          etiqueta="Proyecto"
          valor={filtroProyecto}
          onChange={setFiltroProyecto}
          opciones={[
            { valor: "todos", texto: "Todos" },
            ...proyectos.map((p) => ({ valor: p.id, texto: p.nombre })),
          ]}
        />
        <div className="ml-auto flex rounded-lg border border-border bg-surface p-1">
          {(["usuarios", "historico"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPestana(p)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                pestana === p ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground"
              }`}
            >
              {p === "usuarios" ? "Usuarios" : "Histórico"}
            </button>
          ))}
        </div>
      </div>

      {pestana === "historico" ? (
        <Historico proyectos={proyectos} filtroProyecto={filtroProyecto} />
      ) : (
        <div className="mt-4 space-y-4">
          {isPending ? <p className="text-sm text-muted-foreground">Cargando usuarios…</p> : null}
          {!isPending && porProyecto.length === 0 ? (
            <p className="panel p-6 text-sm text-muted-foreground">
              Todavía no hay usuarios guardados. Pulsa «Sincronizar todo» para traerlos de las aplicaciones de tus
              clientes.
            </p>
          ) : null}

          {porProyecto.map(([proyectoId, lista]) => (
            <section key={proyectoId} className="panel overflow-hidden">
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-sm font-semibold">{nombreProyecto(proyectoId)}</h2>
                  <Chip tono="border-border bg-surface text-muted-foreground">{lista.length} usuarios</Chip>
                  {contarInactivos(lista) > 0 ? (
                    <Chip tono="border-warning/40 bg-warning/10 text-warning">
                      {contarInactivos(lista)} sin entrar hace más de {DIAS_INACTIVO} días
                    </Chip>
                  ) : null}
                </div>
                <Boton
                  variante="suave"
                  className="px-2.5 py-1 text-xs"
                  disabled={listarEnVivo.isPending}
                  onClick={() =>
                    listarEnVivo.mutate(proyectoId, {
                      onSuccess: () => toast.success("Lista actualizada desde la aplicación."),
                      onError: (e) => toast.error((e as Error).message),
                    })
                  }
                >
                  <RefreshCw className="size-3.5" /> Ver en vivo
                </Boton>
              </header>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[56rem] text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr className="border-b border-border">
                      <th className="px-4 py-2 font-medium">Correo</th>
                      <th className="px-3 py-2 font-medium">Nombre</th>
                      <th className="px-3 py-2 font-medium">Rol</th>
                      <th className="px-3 py-2 font-medium">Acceso</th>
                      <th className="px-3 py-2 font-medium">Último acceso</th>
                      <th className="px-3 py-2 font-medium">Alta</th>
                      <th className="px-3 py-2 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lista.map((u) => (
                      <Fila
                        key={u.id}
                        usuario={u}
                        onContrasena={(valor, proyectian) =>
                          setContrasena({ usuario: u, valor, ...(proyectian === undefined ? {} : { proyectian }) })
                        }
                        onEditar={() => setEditando(u)}
                        onBorrar={() => setBorrando(u)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}

      <PanelNuevoUsuario
        abierto={nuevo}
        onCerrar={() => setNuevo(false)}
        proyectos={proyectos}
        proyectoPorDefecto={filtroProyecto !== "todos" ? filtroProyecto : (proyectos[0]?.id ?? "")}
      />

      <PanelEditar usuario={editando} onCerrar={() => setEditando(null)} />

      <DialogoBorrar usuario={borrando} onCerrar={() => setBorrando(null)} />

      <Dialogo
        abierto={contrasena !== null}
        titulo="Contraseña del usuario"
        descripcion="Cópiala ahora: por seguridad solo se muestra una vez."
        onCerrar={() => setContrasena(null)}
      >
        {contrasena ? (
          <ContenidoContrasena
            usuario={contrasena.usuario}
            valor={contrasena.valor}
            nombreApp={nombreProyecto(contrasena.usuario.proyecto_id)}
            {...(contrasena.proyectian === undefined ? {} : { proyectian: contrasena.proyectian })}
          />
        ) : null}
      </Dialogo>
    </>
  );
}

function Dato({ titulo, valor, alerta }: { titulo: string; valor: string; alerta?: boolean }) {
  return (
    <div className="panel p-4">
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className={`mt-1 text-lg font-semibold ${alerta ? "text-warning" : "text-foreground"}`}>{valor}</p>
    </div>
  );
}

/* ---------------------------------- Fila ---------------------------------- */

function Fila({
  usuario,
  onContrasena,
  onEditar,
  onBorrar,
}: {
  usuario: UsuarioClienteRow;
  onContrasena: (valor: string, proyectian?: boolean) => void;
  onEditar: () => void;
  onBorrar: () => void;
}) {
  const resetear = useResetearContrasena();
  const bloquear = useBloquearUsuario();
  const verProyectian = useContrasenaProyectian();

  const dias = diasDesde(usuario.ultimo_acceso);
  const inactivo = dias === null || dias > DIAS_INACTIVO;

  return (
    <tr className="border-b border-border/60 last:border-0">
      <td className="px-4 py-2.5">
        <span className="font-medium text-foreground">{usuario.email}</span>
        <span className="ml-2 text-xs text-muted-foreground">{usuario.proveedor ?? "email"}</span>
      </td>
      <td className="px-3 py-2.5 text-muted-foreground">{usuario.nombre ?? "—"}</td>
      <td className="px-3 py-2.5 text-muted-foreground">{usuario.rol ?? "—"}</td>
      <td className="px-3 py-2.5">
        <div className="flex flex-wrap gap-1.5">
          {usuario.bloqueado ? (
            <Chip tono="border-destructive/40 bg-destructive/10 text-destructive">Bloqueado</Chip>
          ) : null}
          {usuario.confirmado ? (
            <Chip tono="border-success/40 bg-success/10 text-success">Confirmado</Chip>
          ) : (
            <Chip tono="border-warning/40 bg-warning/10 text-warning">Sin confirmar</Chip>
          )}
        </div>
      </td>
      <td className={`px-3 py-2.5 ${inactivo ? "text-destructive" : "text-muted-foreground"}`}>
        {usuario.ultimo_acceso ? desde(usuario.ultimo_acceso) : "Nunca ha entrado"}
      </td>
      <td className="px-3 py-2.5 text-muted-foreground">
        {usuario.creado_en_app ? desde(usuario.creado_en_app) : "—"}
      </td>
      <td className="px-3 py-2.5">
        <div className="flex flex-wrap gap-1.5">
          <Boton
            variante="suave"
            className="px-2 py-1 text-xs"
            disabled={resetear.isPending}
            onClick={() =>
              resetear.mutate(
                { proyecto_id: usuario.proyecto_id, auth_id: usuario.auth_id },
                {
                  onSuccess: (r) => onContrasena(r.contrasena ?? "", r.proyectian),
                  onError: (e) => toast.error((e as Error).message),
                },
              )
            }
          >
            <KeyRound className="size-3.5" /> Nueva contraseña
          </Boton>
          <Boton
            variante="suave"
            className="px-2 py-1 text-xs"
            disabled={verProyectian.isPending}
            title="Ver la contraseña guardada en Proyectian"
            onClick={() =>
              verProyectian.mutate(
                { proyecto_id: usuario.proyecto_id, auth_id: usuario.auth_id },
                {
                  onSuccess: (r) => onContrasena(r.contrasena ?? "", true),
                  onError: (e) => toast.error((e as Error).message),
                },
              )
            }
          >
            <Eye className="size-3.5" /> Ver en Proyectian
          </Boton>
          <Boton variante="suave" className="px-2 py-1 text-xs" onClick={onEditar}>
            <Pencil className="size-3.5" /> Editar
          </Boton>
          <Boton
            variante="suave"
            className="px-2 py-1 text-xs"
            disabled={bloquear.isPending}
            onClick={() =>
              bloquear.mutate(
                { proyecto_id: usuario.proyecto_id, auth_id: usuario.auth_id, bloquear: !usuario.bloqueado },
                {
                  onSuccess: () => toast.success(usuario.bloqueado ? "Usuario desbloqueado." : "Usuario bloqueado."),
                  onError: (e) => toast.error((e as Error).message),
                },
              )
            }
          >
            {usuario.bloqueado ? <ShieldCheck className="size-3.5" /> : <Ban className="size-3.5" />}
            {usuario.bloqueado ? "Desbloquear" : "Bloquear"}
          </Boton>
          <Boton variante="peligro" className="px-2 py-1 text-xs" onClick={onBorrar}>
            <Trash2 className="size-3.5" /> Borrar
          </Boton>
        </div>
      </td>
    </tr>
  );
}

/* ---------------------------- Contraseña mostrada -------------------------- */

function ContenidoContrasena({
  usuario,
  valor,
  nombreApp,
  proyectian,
}: {
  usuario: UsuarioClienteRow;
  valor: string;
  nombreApp: string;
  proyectian?: boolean;
}) {
  const mensaje = mensajeAcceso(nombreApp, usuario.email, valor);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
        <code className="flex-1 break-all font-mono text-sm">{valor || "—"}</code>
        <Boton variante="suave" className="px-2 py-1 text-xs" onClick={() => copiar(valor)}>
          <Copy className="size-3.5" /> Copiar
        </Boton>
      </div>
      {proyectian ? (
        <p className="text-xs text-success">Guardada también en Proyectian (usuarios y claves).</p>
      ) : (
        <p className="text-xs text-warning">No se ha podido reflejar en Proyectian.</p>
      )}
      <Campo etiqueta="Mensaje para el cliente">
        <textarea readOnly value={mensaje} rows={5} className={claseCampo} />
      </Campo>
      <div className="flex flex-wrap gap-2">
        <Boton variante="suave" onClick={() => copiar(mensaje, "Mensaje copiado.")}>
          <Copy className="size-4" /> Copiar mensaje
        </Boton>
        <a
          href={enlaceWhatsApp(usuario.telefono, mensaje)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-medium transition hover:border-primary/40"
        >
          Enviar por WhatsApp
        </a>
      </div>
    </div>
  );
}

/* ------------------------------ Nuevo usuario ------------------------------ */

function PanelNuevoUsuario({
  abierto,
  onCerrar,
  proyectos,
  proyectoPorDefecto,
}: {
  abierto: boolean;
  onCerrar: () => void;
  proyectos: ProyectoRow[];
  proyectoPorDefecto: string;
}) {
  const crear = useCrearUsuarioCliente();
  const invitar = useInvitarUsuarioCliente();

  const [modo, setModo] = React.useState<"crear" | "invitar">("crear");
  const [proyectoId, setProyectoId] = React.useState(proyectoPorDefecto);
  const [email, setEmail] = React.useState("");
  const [nombre, setNombre] = React.useState("");
  const [telefono, setTelefono] = React.useState("");
  const [rol, setRol] = React.useState("usuario");
  const [confirmar, setConfirmar] = React.useState(true);
  const [contrasena, setContrasena] = React.useState("");
  const [resultado, setResultado] = React.useState<{ valor: string; proyectian?: boolean } | null>(null);

  React.useEffect(() => {
    if (abierto) {
      setProyectoId(proyectoPorDefecto);
      setResultado(null);
    }
  }, [abierto, proyectoPorDefecto]);

  const nombreApp = proyectos.find((p) => p.id === proyectoId)?.nombre ?? "la aplicación";

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!proyectoId || !email.trim()) return;
    if (modo === "invitar") {
      invitar.mutate(
        { proyecto_id: proyectoId, email: email.trim() },
        {
          onSuccess: () => {
            toast.success("Invitación enviada por correo.");
            onCerrar();
          },
          onError: (err) => toast.error((err as Error).message),
        },
      );
      return;
    }
    crear.mutate(
      {
        proyecto_id: proyectoId,
        email: email.trim(),
        ...(nombre.trim() ? { nombre: nombre.trim() } : {}),
        ...(telefono.trim() ? { telefono: telefono.trim() } : {}),
        ...(rol.trim() ? { rol: rol.trim() } : {}),
        ...(contrasena.trim() ? { contrasena: contrasena.trim() } : {}),
        confirmar,
      },
      {
        onSuccess: (r) =>
          setResultado({ valor: r.contrasena ?? "", ...(r.proyectian === undefined ? {} : { proyectian: r.proyectian }) }),
        onError: (err) => toast.error((err as Error).message),
      },
    );
  };

  return (
    <Dialogo
      abierto={abierto}
      titulo="Nuevo usuario"
      descripcion="Se crea directamente en la aplicación del cliente y la contraseña queda reflejada en Proyectian."
      onCerrar={onCerrar}
    >
      {resultado ? (
        <div className="space-y-3">
          <p className="text-sm text-success">Usuario creado correctamente.</p>
          <ContenidoContrasena
            usuario={
              {
                proyecto_id: proyectoId,
                email: email.trim(),
                telefono: telefono.trim() || null,
              } as UsuarioClienteRow
            }
            valor={resultado.valor}
            nombreApp={nombreApp}
            {...(resultado.proyectian === undefined ? {} : { proyectian: resultado.proyectian })}
          />
          <Boton onClick={onCerrar}>Hecho</Boton>
        </div>
      ) : (
        <form onSubmit={enviar} className="space-y-3">
          <div className="flex rounded-lg border border-border bg-surface p-1">
            {(["crear", "invitar"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setModo(m)}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  modo === m ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground"
                }`}
              >
                {m === "crear" ? "Crear con contraseña" : "Invitar por correo"}
              </button>
            ))}
          </div>

          <Campo etiqueta="Proyecto">
            <select value={proyectoId} onChange={(e) => setProyectoId(e.target.value)} className={claseCampo}>
              <option value="">Elige un proyecto</option>
              {proyectos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </Campo>

          <Campo etiqueta="Correo">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={claseCampo}
              placeholder="persona@ejemplo.com"
            />
          </Campo>

          {modo === "crear" ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Campo etiqueta="Nombre">
                  <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={claseCampo} />
                </Campo>
                <Campo etiqueta="Teléfono" pista="Con prefijo del país, por ejemplo 34600111222.">
                  <input
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    className={claseCampo}
                    placeholder="34600111222"
                  />
                </Campo>
              </div>

              <Campo etiqueta="Rol" pista="Texto libre: admin, usuario, familia, empleado…">
                <input
                  value={rol}
                  onChange={(e) => setRol(e.target.value)}
                  list="roles-sugeridos"
                  className={claseCampo}
                />
                <datalist id="roles-sugeridos">
                  {ROLES_SUGERIDOS.map((r) => (
                    <option key={r} value={r} />
                  ))}
                </datalist>
              </Campo>

              <Campo etiqueta="Contraseña" pista="Déjala vacía para generar una segura automáticamente.">
                <input value={contrasena} onChange={(e) => setContrasena(e.target.value)} className={claseCampo} />
              </Campo>

              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" checked={confirmar} onChange={(e) => setConfirmar(e.target.checked)} />
                Confirmar el correo ya (puede entrar sin verificar)
              </label>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              Se enviará una invitación por correo para que la persona ponga su propia contraseña.
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Boton type="button" variante="suave" onClick={onCerrar}>
              Cancelar
            </Boton>
            <Boton type="submit" disabled={crear.isPending || invitar.isPending}>
              {crear.isPending || invitar.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              {modo === "crear" ? "Crear usuario" : "Enviar invitación"}
            </Boton>
          </div>
        </form>
      )}
    </Dialogo>
  );
}

/* -------------------------------- Editar ---------------------------------- */

function PanelEditar({ usuario, onCerrar }: { usuario: UsuarioClienteRow | null; onCerrar: () => void }) {
  const actualizar = useActualizarUsuarioCliente();
  const [nombre, setNombre] = React.useState("");
  const [telefono, setTelefono] = React.useState("");
  const [rol, setRol] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [confirmar, setConfirmar] = React.useState(false);

  React.useEffect(() => {
    if (!usuario) return;
    setNombre(usuario.nombre ?? "");
    setTelefono(usuario.telefono ?? "");
    setRol(usuario.rol ?? "");
    setEmail(usuario.email);
    setConfirmar(usuario.confirmado);
  }, [usuario]);

  return (
    <Dialogo abierto={usuario !== null} titulo="Editar usuario" onCerrar={onCerrar}>
      {usuario ? (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            actualizar.mutate(
              {
                proyecto_id: usuario.proyecto_id,
                auth_id: usuario.auth_id,
                email: email.trim(),
                nombre: nombre.trim(),
                telefono: telefono.trim(),
                rol: rol.trim(),
                confirmar,
              },
              {
                onSuccess: () => {
                  toast.success("Usuario actualizado.");
                  onCerrar();
                },
                onError: (err) => toast.error((err as Error).message),
              },
            );
          }}
        >
          <Campo etiqueta="Correo">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={claseCampo} />
          </Campo>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo etiqueta="Nombre">
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={claseCampo} />
            </Campo>
            <Campo etiqueta="Teléfono">
              <input value={telefono} onChange={(e) => setTelefono(e.target.value)} className={claseCampo} />
            </Campo>
          </div>
          <Campo etiqueta="Rol">
            <input value={rol} onChange={(e) => setRol(e.target.value)} list="roles-sugeridos" className={claseCampo} />
          </Campo>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={confirmar} onChange={(e) => setConfirmar(e.target.checked)} />
            Correo confirmado
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <Boton type="button" variante="suave" onClick={onCerrar}>
              Cancelar
            </Boton>
            <Boton type="submit" disabled={actualizar.isPending}>
              Guardar
            </Boton>
          </div>
        </form>
      ) : null}
    </Dialogo>
  );
}

/* --------------------------------- Borrar --------------------------------- */

function DialogoBorrar({ usuario, onCerrar }: { usuario: UsuarioClienteRow | null; onCerrar: () => void }) {
  const borrar = useBorrarUsuarioCliente();
  const [texto, setTexto] = React.useState("");

  React.useEffect(() => {
    setTexto("");
  }, [usuario]);

  return (
    <Dialogo
      abierto={usuario !== null}
      titulo="Borrar usuario"
      descripcion="El usuario se elimina de la aplicación del cliente y no se puede recuperar."
      ancho="max-w-lg"
      onCerrar={onCerrar}
    >
      {usuario ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Vas a borrar a <span className="font-medium text-foreground">{usuario.email}</span>. Escribe BORRAR para
            confirmar.
          </p>
          <input value={texto} onChange={(e) => setTexto(e.target.value)} className={claseCampo} placeholder="BORRAR" />
          <div className="flex justify-end gap-2">
            <Boton variante="suave" onClick={onCerrar}>
              Cancelar
            </Boton>
            <Boton
              variante="peligro"
              disabled={texto !== "BORRAR" || borrar.isPending}
              onClick={() =>
                borrar.mutate(
                  { proyecto_id: usuario.proyecto_id, auth_id: usuario.auth_id, email: usuario.email },
                  {
                    onSuccess: () => {
                      toast.success("Usuario borrado.");
                      onCerrar();
                    },
                    onError: (err) => toast.error((err as Error).message),
                  },
                )
              }
            >
              <Trash2 className="size-4" /> Borrar definitivamente
            </Boton>
          </div>
        </div>
      ) : null}
    </Dialogo>
  );
}

/* -------------------------------- Histórico -------------------------------- */

function Historico({ proyectos, filtroProyecto }: { proyectos: ProyectoRow[]; filtroProyecto: string }) {
  const { data: acciones = [] } = useAccionesUsuarios();
  const [resultado, setResultado] = React.useState<string>("todos");

  const filtradas = acciones.filter((a) => {
    if (filtroProyecto !== "todos" && a.proyecto_id !== filtroProyecto) return false;
    if (resultado !== "todos" && a.resultado !== resultado) return false;
    return true;
  });

  return (
    <section className="panel mt-4 overflow-hidden">
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="font-display text-sm font-semibold">Histórico de acciones</h2>
        <Selector
          etiqueta="Resultado"
          valor={resultado}
          onChange={setResultado}
          opciones={[
            { valor: "todos", texto: "Todos" },
            { valor: "ok", texto: "Correctas" },
            { valor: "error", texto: "Con error" },
          ]}
        />
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[48rem] text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-4 py-2 font-medium">Cuándo</th>
              <th className="px-3 py-2 font-medium">Proyecto</th>
              <th className="px-3 py-2 font-medium">Acción</th>
              <th className="px-3 py-2 font-medium">Correo</th>
              <th className="px-3 py-2 font-medium">Resultado</th>
              <th className="px-3 py-2 font-medium">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map((a) => (
              <tr key={a.id} className="border-b border-border/60 last:border-0">
                <td className="px-4 py-2.5 text-muted-foreground">{formatoFechaHora(a.creado_el)}</td>
                <td className="px-3 py-2.5 text-muted-foreground">
                  {proyectos.find((p) => p.id === a.proyecto_id)?.nombre ?? "—"}
                </td>
                <td className="px-3 py-2.5">{a.accion}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{a.email ?? "—"}</td>
                <td className="px-3 py-2.5">
                  {a.resultado === "ok" ? (
                    <Chip tono="border-success/40 bg-success/10 text-success">Correcta</Chip>
                  ) : (
                    <Chip tono="border-destructive/40 bg-destructive/10 text-destructive">Error</Chip>
                  )}
                </td>
                <td className={`px-3 py-2.5 ${a.resultado === "error" ? "text-destructive" : "text-muted-foreground"}`}>
                  {a.detalle ?? "—"}
                  {a.proyectian ? " · reflejada en Proyectian" : ""}
                </td>
              </tr>
            ))}
            {filtradas.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-sm text-muted-foreground">
                  Todavía no hay acciones registradas.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ---------------------------- Piezas reutilizables ------------------------- */

/** Tarjeta de usuarios para la ficha de un proyecto. */
export function BloqueUsuariosProyecto({ proyectoId }: { proyectoId: string }) {
  const { data: usuarios = [] } = useUsuariosClientes();
  const delProyecto = usuarios.filter((u) => u.proyecto_id === proyectoId);
  const ultimos = [...delProyecto]
    .filter((u) => u.ultimo_acceso)
    .sort((a, b) => (b.ultimo_acceso ?? "").localeCompare(a.ultimo_acceso ?? ""))
    .slice(0, 5);

  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-sm font-semibold">Usuarios</h2>
        <Users className="size-4 text-muted-foreground" />
      </div>
      <p className="mt-2 text-2xl font-semibold">{delProyecto.length}</p>
      <p className="text-xs text-muted-foreground">personas con acceso a esta aplicación</p>

      <ul className="mt-3 space-y-1.5 text-xs">
        {ultimos.map((u) => (
          <li key={u.id} className="flex items-center justify-between gap-2">
            <span className="truncate text-foreground">{u.email}</span>
            <span className="shrink-0 text-muted-foreground">{desde(u.ultimo_acceso)}</span>
          </li>
        ))}
        {ultimos.length === 0 ? <li className="text-muted-foreground">Todavía no hay accesos registrados.</li> : null}
      </ul>

      <Link
        to="/usuarios-clientes"
        search={{ proyecto: proyectoId }}
        className="mt-3 inline-flex text-xs text-primary hover:underline"
      >
        Gestionar usuarios
      </Link>
    </div>
  );
}

/** Chip informativo cuando hay usuarios que llevan mucho sin entrar. */
export function ChipUsuariosInactivos({ proyectoId }: { proyectoId: string | null }) {
  const { data: usuarios = [] } = useUsuariosClientes();
  if (!proyectoId) return null;
  const inactivos = contarInactivos(usuarios.filter((u) => u.proyecto_id === proyectoId));
  if (inactivos === 0) return null;
  return (
    <Link
      to="/usuarios-clientes"
      search={{ proyecto: proyectoId }}
      className="inline-flex items-center gap-1.5 rounded-full border border-warning/40 bg-warning/10 px-2.5 py-0.5 text-xs text-warning transition hover:border-warning"
      title={`Personas que no entran desde hace más de ${DIAS_INACTIVO} días`}
    >
      <Users className="size-3.5" /> {inactivos} sin entrar hace tiempo
    </Link>
  );
}

/** Chip con el número de usuarios para la ficha del proyecto. */
export function ChipUsuariosProyecto({ proyectoId }: { proyectoId: string }) {
  const { data: usuarios = [] } = useUsuariosClientes();
  const total = usuarios.filter((u) => u.proyecto_id === proyectoId).length;
  return (
    <Link
      to="/usuarios-clientes"
      search={{ proyecto: proyectoId }}
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-0.5 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
      title="Usuarios con acceso a esta aplicación"
    >
      <Users className="size-3.5" /> {total} usuarios
    </Link>
  );
}
