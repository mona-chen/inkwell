# Image Sources

Gets pictures a site does not have yet — free stock photographs, brand logos, avatars,
mascots, and screenshots of a live URL — and files them in the site's own media library.

The plugin exists because "just link the image" breaks in practice. Picture libraries disagree
about the rules, and those disagreements are legal, not stylistic:

| Library | What it gives | Licence | Notes |
| --- | --- | --- | --- |
| [Openverse](https://openverse.org) | photographs | CC (per item) | No account. By default only commercially usable licences are requested; a site can opt into the full index. |
| [Simple Icons](https://simpleicons.org) | brand / product logos | CC0 1.0 | Trademark rights stay with the brand owner. The marks are SVG, so a colour is baked in at fetch time — an SVG cannot be recoloured once it is in an `<img>`. |
| [DiceBear](https://www.dicebear.com) | avatars, mascots | CC0 / CC BY 4.0 per style | Deterministic: the query is the seed, so the same request always yields the same character. |
| [Microlink](https://microlink.io) | screenshots of a URL | service terms | Free tier is 25 requests/day and needs no key; an optional key raises the quota. |

Two rules for anything added here:

- **Nothing is hotlinked.** A published page must never point at a library's CDN. Pixabay's terms
  forbid permanent hotlinking outright ("please download them to your server first"); Unsplash's
  forbid the opposite (all uses must hotlink the API's own URLs) — which is why the adapter
  declares `may_hotlink` instead of the core guessing, and why an adapter that must hotlink would
  need a different placement path, not a different search endpoint.
- **Provenance is data on the file.** `media_items.provider`, `source_url`, `credit`,
  `credit_url` and `license` are written when the picture is filed, so a licence's attribution
  requirement can be met on the published page and stays readable even after this plugin is
  switched off.

`source_url` is the exact remote resource the bytes came from (that is the file's identity, and
what stops a second search from filing a duplicate); `credit_url` is the page a reader should
visit.

## How the Copilot gets it

Core asks one question — `Inkwell::Hooks.filter(:builder_copilot_config, …)` — and this plugin
answers with a search endpoint and the kinds it can serve. The Copilot's tool surface then
contains `search_images`; it disappears entirely when no source is switched on, so the model is
never offered a tool the server cannot fulfil.

`search_images` returns the same shape as `list_media` (`id`, `url`, `alt`, plus credit and
licence), so the model places a picture one way regardless of where it came from.

## Settings

Everything is on when the plugin is activated. **Settings → Image Sources** narrows that:
switch a source off, restrict Openverse to commercially usable licences, or paste a Microlink
key. Keys live in site settings with an `ENV` fallback and never reach the browser.

## Files

- `lib/image_sources/engine.rb` — activation, and the `builder_copilot_config` filter.
- `app/services/image_sources/adapter.rb` — the provider contract (`provider`, `kind`,
  `may_hotlink`, `attribution_required`, `default_license`, `available?`, `search`).
- `app/services/image_sources/registry.rb` — which adapters this site can actually use.
- `app/services/image_sources/sideload.rb` — fetches the bytes and files them with provenance.
- `app/services/image_sources/http.rb` — size-capped, timeout-bounded, redirect-bounded fetches
  that refuse private addresses (the search query comes from a language model).
- `app/controllers/image_sources/searches_controller.rb` — the one endpoint the browser calls.

## Later

Keyed, approval-gated libraries (Unsplash, Pexels, Pixabay) are the natural next adapters. Each
brings its own obligation — Unsplash requires hotlinking and a `download_location` ping, Pixabay
requires 24-hour caching and forbids mass downloads — so they belong behind the same adapter
contract rather than in the controller.
