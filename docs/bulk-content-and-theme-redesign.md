# Content management and bundled theme redesign

## Bulk management

Posts and Pages support row selection, select all on the current page, live selection counts, and paginated lists. Publish, Unpublish, and Move to trash apply to selected rows. Trash offers Restore as drafts and Delete permanently. Both server endpoints scope selections to the current site, authorize every record before changing anything, and apply the batch transactionally. Permanent deletion requires the records to be in trash first. Publishing keeps stored content when no working draft exists.

Pages now use recoverable trash for ordinary deletion. Unpublishing or trashing the configured homepage prevents it from continuing to render publicly. Existing content and imported assets are preserved until the owner explicitly deletes trashed records.

## Imported sites

The import detail screen provides two removal actions: remove the import record while keeping its pages, or also move its linked pages to trash. Only pages whose current capture ownership matches the import are included; another import's reclaimed pages are retained. Running captures/imports cannot be removed. Removed captures are hidden from the Builder capture library. Capture assets remain available so retained/restored pages work. This change supplies deletion controls; it does not remove any existing user import automatically.

## Themes

Default 2.0 is a warm editorial publication using serif display typography, fine rules, a structured masthead, and measured reading layouts. Mono 2.0 is an ink-blue contemporary journal with sans-serif headlines and monospace metadata, replacing the old green terminal treatment.

Both include a homepage, searchable/paginated archive, post reading layout, contributor archive, normal/full-width/canvas pages, useful empty/error states, native mobile menu, RSS links, configured menus/widgets, site identity, and existing content/SEO/plugin hooks. They share an application-owned public stylesheet and view partials. Builder blocks are excluded from public prose wrappers so authored canvas styles remain authoritative.

Authenticated theme previews show real publication content without changing the active theme or replacing a configured/imported live homepage. Preview links retain the chosen theme across article/author/local navigation. Theme-default previews can inspect the bundled layouts without editing or disabling the site’s published custom template assignments. Imported original frontends continue to use their preserved runtime rather than being silently restyled.
