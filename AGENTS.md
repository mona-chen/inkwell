<!-- nitro-kit:start -->
## Nitro Kit 2

This application uses Nitro Kit 2.x. Before changing Rails structure,
Hotwire interactions, or UI, use the matching project-local Nitro Kit skill.
Each skill resolves the installed gem with `bundle show nitro_kit` and reads
its version-matched documentation.

Do not use Nitro Kit 1.x APIs, `nk_*` helpers, copied Nitro components, or
application-owned `controllers/nk`. Compose the installed Phlex Kit and keep
routes, records, authorization, queries, DOM IDs, and server responses in the
application.

During migration, replace an existing form control only when Nitro Kit 2 has
a genuine semantic and behavioral equivalent. Otherwise preserve the control
as application-owned Rails and semantic HTML. Never downgrade specialized
behavior or retain copied Nitro Kit 1.x source as the fallback.
<!-- nitro-kit:end -->
