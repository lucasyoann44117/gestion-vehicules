-- Mes véhicules : tables Supabase.
-- À exécuter une fois dans Supabase > SQL Editor (projet « chantier-maison »).
-- Le script peut être relancé sans risque : il ne touche pas aux tables du chantier
-- et réutilise la liste des comptes du foyer (table « foyer »).

-- Comptes autorisés (déjà créés pour l'application chantier ; sans effet sinon).
create table if not exists foyer (email text primary key);
alter table foyer enable row level security;

create or replace function est_du_foyer() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from foyer where lower(email) = lower(auth.jwt() ->> 'email')
  );
$$;
revoke execute on function est_du_foyer() from public, anon;
grant execute on function est_du_foyer() to authenticated;

-- Toutes les données des véhicules, dans un seul document JSON (une ligne « foyer »).
-- « version » augmente à chaque enregistrement : si deux téléphones enregistrent en
-- même temps, le second s'en aperçoit et fusionne au lieu d'écraser.
create table if not exists vehicules_donnees (
  id text primary key,
  donnees jsonb not null,
  version int not null default 1,
  -- Empreinte du dernier historique des factures intégré (historique.json).
  historique text,
  modifie_par text,
  updated_at timestamptz not null default now()
);
alter table vehicules_donnees enable row level security;
drop policy if exists foyer_tout on vehicules_donnees;
create policy foyer_tout on vehicules_donnees
  for all to authenticated using (est_du_foyer()) with check (est_du_foyer());
grant select, insert, update on vehicules_donnees to authenticated;

-- Filet de sécurité : chaque version remplacée est gardée (les 100 dernières).
create table if not exists vehicules_versions (
  id bigint generated always as identity primary key,
  version int,
  donnees jsonb not null,
  modifie_par text,
  remplacee_le timestamptz not null default now()
);
alter table vehicules_versions enable row level security;
drop policy if exists foyer_lecture on vehicules_versions;
create policy foyer_lecture on vehicules_versions
  for select to authenticated using (est_du_foyer());
grant select on vehicules_versions to authenticated;

create or replace function vehicules_archiver() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into vehicules_versions (version, donnees, modifie_par)
  values (old.version, old.donnees, old.modifie_par);
  delete from vehicules_versions
  where id not in (select id from vehicules_versions order by id desc limit 100);
  return new;
end;
$$;

drop trigger if exists vehicules_archiver on vehicules_donnees;
create trigger vehicules_archiver before update on vehicules_donnees
for each row execute function vehicules_archiver();
