ALTER TABLE public.mesas ADD CONSTRAINT mesas_id_owner_key UNIQUE(id,user_id);
ALTER TABLE public.ordenes ADD COLUMN origen_mesa_id uuid UNIQUE REFERENCES public.mesas(id) ON DELETE SET NULL;
ALTER TABLE public.ordenes ADD CONSTRAINT orden_mesa_owner_fk FOREIGN KEY(origen_mesa_id,user_id) REFERENCES public.mesas(id,user_id) ON DELETE SET NULL(origen_mesa_id);
