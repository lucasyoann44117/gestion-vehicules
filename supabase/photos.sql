-- Mes véhicules : stockage privé des photos des véhicules.
-- À exécuter une fois dans Supabase > SQL Editor (après schema.sql). Peut être relancé.
-- Les photos ne sont visibles que par les comptes de la table « foyer ».

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vehicules-photos', 'vehicules-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false;

drop policy if exists "vehicules_photos_lecture" on storage.objects;
create policy "vehicules_photos_lecture" on storage.objects
  for select to authenticated using (bucket_id = 'vehicules-photos' and est_du_foyer());

drop policy if exists "vehicules_photos_ajout" on storage.objects;
create policy "vehicules_photos_ajout" on storage.objects
  for insert to authenticated with check (bucket_id = 'vehicules-photos' and est_du_foyer());

drop policy if exists "vehicules_photos_modif" on storage.objects;
create policy "vehicules_photos_modif" on storage.objects
  for update to authenticated using (bucket_id = 'vehicules-photos' and est_du_foyer());

drop policy if exists "vehicules_photos_suppression" on storage.objects;
create policy "vehicules_photos_suppression" on storage.objects
  for delete to authenticated using (bucket_id = 'vehicules-photos' and est_du_foyer());
