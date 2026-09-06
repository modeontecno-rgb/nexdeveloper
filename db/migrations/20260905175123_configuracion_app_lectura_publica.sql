-- La configuración de marca (Powered by, WhatsApp, versión) no contiene secretos y debe verse también en la pantalla de acceso
drop policy if exists "configuracion: leer" on public.configuracion_app;
create policy "configuracion: leer" on public.configuracion_app for select to anon, authenticated using (true);
