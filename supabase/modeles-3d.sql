-- Mes véhicules : stockage privé des modèles 3D (caisse détaillée du T4).
-- À exécuter une fois dans Supabase > SQL Editor (après schema.sql). Peut être relancé.
-- Le site est hébergé publiquement : le modèle n'y est pas, il n'est lisible que par les comptes de la table « foyer ».

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vehicules-modeles', 'vehicules-modeles', false, 31457280, array['model/gltf-binary', 'application/octet-stream'])
on conflict (id) do update set public = false;

drop policy if exists "vehicules_modeles_lecture" on storage.objects;
create policy "vehicules_modeles_lecture" on storage.objects
  for select to authenticated using (bucket_id = 'vehicules-modeles' and est_du_foyer());

drop policy if exists "vehicules_modeles_ajout" on storage.objects;
create policy "vehicules_modeles_ajout" on storage.objects
  for insert to authenticated with check (bucket_id = 'vehicules-modeles' and est_du_foyer());

drop policy if exists "vehicules_modeles_modif" on storage.objects;
create policy "vehicules_modeles_modif" on storage.objects
  for update to authenticated using (bucket_id = 'vehicules-modeles' and est_du_foyer());
