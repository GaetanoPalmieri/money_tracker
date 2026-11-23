-- Bilancio 1.94.0 — foto della ricevuta sui movimenti (facoltativa, solo con la sincronizzazione collegata).
-- Le foto vanno nello stesso spazio "foto" di Noi Due, ma in una cartella personale:
--   bilancio/<il tuo id utente>/ricevute/<id movimento>-<ora>.jpg
-- Le regole di Noi Due valgono solo per la cartella "coppia/...": servono queste tre in più.
-- Da incollare in Supabase › SQL Editor › New query › Run. Se lo esegui due volte non succede nulla.
-- Non tocca le regole di Noi Due.

-- 1) Il bucket "foto", privato. Se c'è già (Noi Due lo usa dalla 1.11) questa riga non fa niente.
insert into storage.buckets (id, name, public)
values ('foto', 'foto', false)
on conflict (id) do nothing;

-- 2) Regole: ognuno legge e scrive solo nella sua cartella bilancio/<id utente>/...
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'bilancio ricevute: leggere') then
    create policy "bilancio ricevute: leggere" on storage.objects for select to authenticated
      using (bucket_id = 'foto' and (storage.foldername(name))[1] = 'bilancio'
             and (storage.foldername(name))[2] = auth.uid()::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'bilancio ricevute: caricare') then
    create policy "bilancio ricevute: caricare" on storage.objects for insert to authenticated
      with check (bucket_id = 'foto' and (storage.foldername(name))[1] = 'bilancio'
                  and (storage.foldername(name))[2] = auth.uid()::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'bilancio ricevute: sostituire') then
    create policy "bilancio ricevute: sostituire" on storage.objects for update to authenticated
      using (bucket_id = 'foto' and (storage.foldername(name))[1] = 'bilancio'
             and (storage.foldername(name))[2] = auth.uid()::text);
  end if;
end $$;

-- Per controllare:
--   select id, public from storage.buckets where id = 'foto';
--   select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'bilancio%';
