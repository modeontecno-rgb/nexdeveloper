-- Additive repair. Existing invalid rows are not deleted or reassigned.
-- Run the accompanying preflight and VALIDATE CONSTRAINT before publication.
ALTER TABLE public.personal_conversaciones
  ADD CONSTRAINT personal_conversaciones_id_owner_key UNIQUE (id, user_id);
ALTER TABLE public.proyectos
  ADD CONSTRAINT proyectos_id_owner_key UNIQUE (id, user_id);

ALTER TABLE public.personal_mensajes
  ADD CONSTRAINT personal_mensajes_conversacion_owner_fk
  FOREIGN KEY (conversacion_id, user_id)
  REFERENCES public.personal_conversaciones (id, user_id)
  ON DELETE CASCADE NOT VALID;

ALTER TABLE public.personal_documentos
  ADD CONSTRAINT personal_documentos_conversacion_owner_fk
  FOREIGN KEY (conversacion_id, user_id)
  REFERENCES public.personal_conversaciones (id, user_id)
  ON DELETE SET NULL (conversacion_id) NOT VALID;

ALTER TABLE public.ordenes
  ADD CONSTRAINT ordenes_proyecto_owner_fk
  FOREIGN KEY (proyecto_id, user_id) REFERENCES public.proyectos (id, user_id)
  ON DELETE SET NULL (proyecto_id) NOT VALID;

ALTER TABLE public.ordenes
  ADD CONSTRAINT ordenes_proyecto_origen_owner_fk
  FOREIGN KEY (proyecto_origen_id, user_id) REFERENCES public.proyectos (id, user_id)
  ON DELETE SET NULL (proyecto_origen_id) NOT VALID;
