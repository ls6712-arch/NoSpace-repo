-- Privacy audit (round 6): follow requests belong to the two people in them.
--
-- The read policy on profile_follows let any logged-in person read every row
-- between visible profiles, including pending and declined ones: who asked to
-- follow whom, and who said no. Follower and following lists only ever show
-- accepted rows (lib/profileFollows.ts filters on status = 'accepted'), and a
-- person's own relationship with someone is read through their own row, so
-- nothing in the app needs a third person's pending or declined rows.
--
-- After this: anyone logged in can still read accepted follows (the follower
-- lists), and a pending or declined row is readable only by the person who
-- asked and the person asked. Logged-out visitors still read nothing here.
-- Safe with the code that is live today. NOT YET RUN on the live project.
drop policy if exists "profile follows are readable when signed in" on public.profile_follows;

create policy "profile follows are readable when signed in"
  on public.profile_follows for select
  using (
    (select auth.uid()) is not null
    and public.is_visible_profile(profile_follows.follower_id)
    and public.is_visible_profile(profile_follows.followed_id)
    and (
      profile_follows.status = 'accepted'
      or profile_follows.follower_id = (select auth.uid())
      or profile_follows.followed_id = (select auth.uid())
    )
  );
