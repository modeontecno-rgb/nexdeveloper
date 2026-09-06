import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";

import type { UsuarioAccionRow, UsuarioClienteRow } from "../db-types";
import { supabase } from "../supabase";

export const clavesUsuariosClientes = {
  estado: ["usuarios-clientes", "estado"] as const,
  lista: ["usuarios_clientes"] as const,
  acciones: ["usuarios_acciones"] as const,
};

export type EstadoUsuariosClientes = {
  ok?: boolean;
  total?: number;
  ultima_sincronizacion?: string | null;
  token_cuenta?: boolean;
};

/** Roles sugeridos al crear o editar un usuario. */
export const ROLES_SUGERIDOS = ["admin", "usuario", "familia", "empleado", "cliente", "invitado"] as const;

/** Días sin acceder a partir de los cuales consideramos que un usuario está inactivo. */
export const DIAS_INACTIVO = 90;

async function llamar<T = Record<string, unknown>>(cuerpo: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("usuarios-clientes", { body: cuerpo });
  if (error) {
    let mensaje = error.message;
    try {
      const cuerpoError = (error as { context?: { body?: string } }).context?.body;
      if (cuerpoError) {
        const json = JSON.parse(cuerpoError) as { error?: string };
        if (json.error) mensaje = json.error;
      }
    } catch {
      /* se queda el mensaje original */
    }
    throw new Error(mensaje);
  }
  const respuesta = data as ({ ok?: boolean; error?: string } & T) | null;
  if (!respuesta || respuesta.ok === false) {
    throw new Error(respuesta?.error ?? "No se ha podido completar la operación.");
  }
  return respuesta;
}

export function useEstadoUsuariosClientes() {
  return useQuery({
    queryKey: clavesUsuariosClientes.estado,
    queryFn: async () => (await llamar<EstadoUsuariosClientes>({ accion: "estado" })) as EstadoUsuariosClientes,
    retry: false,
  });
}

export function useUsuariosClientes() {
  return useQuery({
    queryKey: clavesUsuariosClientes.lista,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("usuarios_clientes")
        .select("*")
        .order("email", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as UsuarioClienteRow[];
    },
  });
}

export function useAccionesUsuarios() {
  return useQuery({
    queryKey: clavesUsuariosClientes.acciones,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("usuarios_acciones")
        .select("*")
        .order("creado_el", { ascending: false })
        .limit(200);
      if (error) throw new Error(error.message);
      return (data ?? []) as UsuarioAccionRow[];
    },
  });
}

/** Mantiene la lista al día mientras el backend sincroniza. */
export function useRealtimeUsuariosClientes() {
  const qc = useQueryClient();
  React.useEffect(() => {
    const canal = supabase.channel("nexdeveloper-usuarios-clientes");
    canal.on("postgres_changes", { event: "*", schema: "public", table: "usuarios_clientes" }, () => {
      void qc.invalidateQueries({ queryKey: clavesUsuariosClientes.lista });
      void qc.invalidateQueries({ queryKey: clavesUsuariosClientes.estado });
    });
    canal.on("postgres_changes", { event: "*", schema: "public", table: "usuarios_acciones" }, () => {
      void qc.invalidateQueries({ queryKey: clavesUsuariosClientes.acciones });
    });
    void canal.subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [qc]);
}

function useInvalidar() {
  const qc = useQueryClient();
  return React.useCallback(() => {
    void qc.invalidateQueries({ queryKey: clavesUsuariosClientes.lista });
    void qc.invalidateQueries({ queryKey: clavesUsuariosClientes.acciones });
    void qc.invalidateQueries({ queryKey: clavesUsuariosClientes.estado });
  }, [qc]);
}

export function useSincronizarUsuarios() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (proyectoId?: string) =>
      llamar<{ usuarios?: UsuarioClienteRow[]; total?: number }>({
        accion: "sincronizar",
        ...(proyectoId ? { proyecto_id: proyectoId } : {}),
      }),
    onSuccess: invalidar,
  });
}

export function useListarEnVivo() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (proyectoId: string) =>
      llamar<{ usuarios?: UsuarioClienteRow[] }>({ accion: "listar", proyecto_id: proyectoId }),
    onSuccess: invalidar,
  });
}

export type DatosNuevoUsuario = {
  proyecto_id: string;
  email: string;
  nombre?: string;
  telefono?: string;
  rol?: string;
  contrasena?: string;
  confirmar?: boolean;
};

export function useCrearUsuarioCliente() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (datos: DatosNuevoUsuario) =>
      llamar<{ auth_id?: string; contrasena?: string; proyectian?: boolean }>({ accion: "crear", ...datos }),
    onSuccess: invalidar,
  });
}

export function useInvitarUsuarioCliente() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (datos: { proyecto_id: string; email: string }) =>
      llamar({ accion: "invitar", ...datos }),
    onSuccess: invalidar,
  });
}

export function useResetearContrasena() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (datos: { proyecto_id: string; auth_id: string; contrasena?: string }) =>
      llamar<{ contrasena?: string; proyectian?: boolean }>({ accion: "resetear", ...datos }),
    onSuccess: invalidar,
  });
}

export function useBloquearUsuario() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (datos: { proyecto_id: string; auth_id: string; bloquear: boolean }) =>
      llamar({
        accion: datos.bloquear ? "bloquear" : "desbloquear",
        proyecto_id: datos.proyecto_id,
        auth_id: datos.auth_id,
      }),
    onSuccess: invalidar,
  });
}

export type DatosEdicionUsuario = {
  proyecto_id: string;
  auth_id: string;
  email?: string;
  nombre?: string;
  telefono?: string;
  rol?: string;
  confirmar?: boolean;
};

export function useActualizarUsuarioCliente() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (datos: DatosEdicionUsuario) => llamar({ accion: "actualizar", ...datos }),
    onSuccess: invalidar,
  });
}

export function useBorrarUsuarioCliente() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (datos: { proyecto_id: string; auth_id: string; email: string }) =>
      llamar({ accion: "borrar", ...datos, confirmacion: "BORRAR" }),
    onSuccess: invalidar,
  });
}

export function useContrasenaProyectian() {
  return useMutation({
    mutationFn: async (datos: { proyecto_id: string; auth_id: string }) =>
      llamar<{ contrasena?: string }>({ accion: "contrasena_proyectian", ...datos }),
  });
}

/* ------------------------------- Utilidades ------------------------------- */

export function diasDesde(iso: string | null | undefined) {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return null;
  return Math.floor(ms / 86_400_000);
}

export function estaInactivo(usuario: UsuarioClienteRow) {
  const dias = diasDesde(usuario.ultimo_acceso);
  return dias === null || dias > DIAS_INACTIVO;
}

export function contarInactivos(usuarios: UsuarioClienteRow[]) {
  return usuarios.filter(estaInactivo).length;
}

/** Enlace de WhatsApp con el mensaje de acceso ya escrito. */
export function enlaceWhatsApp(telefono: string | null | undefined, mensaje: string) {
  const numero = (telefono ?? "").replace(/[^\d]/g, "");
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
}

export function mensajeAcceso(app: string, email: string, contrasena: string) {
  return `Hola, tus datos de acceso a ${app}:\nUsuario: ${email}\nContraseña: ${contrasena}\n\nPor seguridad, cámbiala la primera vez que entres.`;
}
