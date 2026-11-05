# Specialist website directory draft

A reviewable list of 16 specialist websites for Soosh users to visit, with
original descriptions, existing Corner mappings and optional activity prompts.

- [Readable shortlist and rights notes](websites.md)
- [Spreadsheet](websites.csv)
- [Structured draft](websites.json)

## Link-only scope

The proposed listing contains the site name, Soosh’s own short description and
a normal outbound link. It does not copy site logos, thumbnails, artwork,
articles, videos, recordings or embedded viewers. No website is described as
entirely copyright-free. Linking is distinct from reproducing its content;
reuse would require a separate item/license assessment. The rights notes are
general editorial guidance, not legal clearance for each site or jurisdiction.

## Current status

These are known-source candidates. The running environment denied live requests
to The Public Domain Review and Smithsonian with proxy 403 responses. Current
URLs, availability, terms, account/price requirements and audience suitability
have not been verified in this session. Every entry remains unapproved for
listing, with empty verification dates. The directory should be reviewed before
being shown publicly. No requirement to obtain a copyright-free license for a
normal link is implied by these editorial review fields.

## Application behavior

This PR adds review data and a validator only. It does not add a public directory,
change Corner pages or Discover, fetch remote pages, import third-party content,
change recommendations, write to a database or deploy anything. The existing
content-and-images batch is on its own branch and is not included here.

If approved for later integration, render plain outbound links and original
descriptions using existing UI icons. Do not infer a resource’s price, location
coverage, licensing or current availability from its presence in this draft.

## Validate

From the repository root:

```sh
node scripts/check-website-directory.mjs
```

This checks the draft state, unique records, HTTPS URLs, link-only/no-thumbnail
policy, explicit unverified status and valid built-in Corner keys. It makes no
network request and cannot establish a website’s legality or current terms.

Rollback is removal of this review folder and its validator. No data rollback
or migration is needed.
