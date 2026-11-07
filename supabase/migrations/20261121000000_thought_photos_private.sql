-- Photos on thoughts move to the private moment-media bucket.
--
-- Until now addThought uploaded to the public post-media bucket and stored a
-- public URL in thoughts.media_url. Anyone with that link could open a photo on
-- a thought under a followers-only Moment, and the link kept working after the
-- thought was deleted. New thought photos are stored as a path in
-- thoughts.media_path (private bucket, signed links), and the storage policy
-- below lets a person read one only if they can see the thought itself.
--
-- Existing rows and media_url are not touched: the one live thought has no
-- photo, and the app keeps reading media_url for any older row.

alter table public.thoughts
  add column if not exists media_path text;

-- Same rule Moments use: the path must sit in the author's own folder.
alter table public.thoughts
  add constraint thoughts_media_path_owned
  check (private.media_paths_owned(array[thoughts.media_path], thoughts.user_id));

-- A thought has one photo: a private path, or a legacy public URL, never both.
alter table public.thoughts
  add constraint thoughts_media_one_source
  check (thoughts.media_path is null or thoughts.media_url is null);

create index if not exists thoughts_media_path_idx
  on public.thoughts (media_path)
  where media_path is not null;

-- Who can read a thought's photo: anyone who can read the thought, signed in or
-- not. The exists runs under the reader's own row level security on
-- public.thoughts ("thoughts follow the moment's setting", which in turn runs
-- posts' own policy). A signed-out visitor can read thoughts on a public Moment,
-- so they see its photos too (as they do the Moment's own, whose policy is also
-- anon + authenticated); a followers-only Moment's thought photo is as private
-- as the Moment; and once the thought row is deleted nobody but its author's own
-- folder rule matches.
create policy "moment-media: see photos on thoughts you can see"
  on storage.objects for select to anon, authenticated
  using (
    objects.bucket_id = 'moment-media'
    and exists (
      select 1 from public.thoughts t
      where t.media_path = objects.name
    )
  );
