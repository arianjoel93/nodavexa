create policy "Delete own TSC report originals" on storage.objects for delete to authenticated
using (bucket_id='tsc-reports-private' and (storage.foldername(name))[1]=(select auth.uid())::text);
