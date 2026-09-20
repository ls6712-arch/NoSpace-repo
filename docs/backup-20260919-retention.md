# backup_20260919 retention

Before applying the pause/deletion privacy migrations on 2026-09-20, a
Postgres schema `backup_20260919` was created on project
`eyzokuhhbyidvmuqfmwm` holding copies of `profiles`, `posts`, `pursuits`,
and `connections` as they stood immediately before that work.

This schema holds real user data (not synthetic/test rows) and must not be
left in place indefinitely.

**Action required: drop `backup_20260919` after verification, target 30
days from 2026-09-20 (i.e. by 2026-10-20).**

Before dropping:
- Confirm the applied migrations ((a) pause_deletion_foundation, (b)
  consolidate_visibility_policies, (b2) pause_visibility_b2, (c)
  posts_visibility_private, (d) reactions_and_bookmarks, and the storage
  hardening policy replacement) have been live and stable with no rollback
  needed.
- Confirm no incident investigation is currently relying on the backup as
  a comparison point.

To drop it:

```sql
drop schema if exists backup_20260919 cascade;
```
