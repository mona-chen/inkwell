# Inkwell — design system

This is the design language for Inkwell: the admin tool, the auth screens, and the block editor.
It documents what's implemented in the codebase today (verified against `app/views`, not guessed),
so new views, plugin admin panes, and theme templates can be dropped in without reinventing
styling.

Per the project preference: **pure Tailwind utility classes only.** No scoped `<style>` blocks, no
inline `style="..."` attributes — anywhere.

## Two design systems, on purpose

Inkwell doesn't have one visual language — it has two, and that split is intentional:

1. **Admin (the tool)** — its own palette, dense, functional, identical regardless of which theme
   the site uses. You're operating machinery; it should look like the same machinery every time.
2. **Themes (the output)** — each theme owns its own identity. `default` is warm-cream/charcoal/
   gold editorial; `mono` is black/green monospace. A third theme is free to look nothing like
   either. **Never leak admin's palette into a theme, or a theme's colors into admin.**

Anything labeled "Admin" applies to `app/views/admin/**` and `app/views/devise/**`. Anything
labeled "Theme" is guidance for what a theme's own `theme.json` + views should establish for
*itself* — not a fixed palette core enforces.

## Design tokens (implemented)

Defined in `app/assets/tailwind/application.css` under `@theme`:

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
@theme {
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif; /* admin default */
  --font-serif: "Georgia", ui-serif, serif;                    /* default theme */
  --font-mono: "JetBrains Mono", ui-monospace, monospace;      /* mono theme */
}
```

Only `--font-sans` (admin's implicit default) changed; serif/mono belong to the themes and are
untouched.

## Color — Admin

**Near-black is the primary action color** (`gray-900`/`black`), matching the brand mark's
ink/charcoal. Indigo is demoted to two narrow roles: focus rings and the active sidebar item.
This is the Linear/Vercel/Attio move — a neutral, confident primary instead of a default-library
blue.

| Role | Class | Where |
|---|---|---|
| Primary action | `bg-gray-900` / hover `bg-black`, `text-white` | Save/submit buttons, primary CTAs, "New post/page" |
| Primary text link/hover | `text-gray-900`, `hover:text-gray-900` | Post titles, row links, "View all" |
| Supporting accent (focus + active-nav only) | `ring-indigo-500` / `border-indigo-500` on focus; `bg-indigo-50 text-indigo-700` on the active sidebar item | Form focus states, current-page nav indicator |
| Body text | `text-gray-900` (default), `text-gray-700` | — |
| Secondary text | `text-gray-500` | Metadata, timestamps, helper text |
| Tertiary/muted text | `text-gray-400` | Placeholders, empty states, "Plugins" group label |
| Borders (data containers only — see Elevation) | `border-gray-200` (rest), `border-gray-300` (hover/stronger) | Tables, dense lists |
| Subtle surface | `bg-gray-50` | Table headers, hover rows, page background |
| Success | `bg-green-50 text-green-800` (banner), `bg-green-100 text-green-800` (pill) | Flash notice, "published"/"approved" status |
| Danger | `bg-red-50 text-red-800` (banner), `text-red-500`/`text-red-600` (hover) | Flash alert, delete actions |
| Warning | `bg-amber-50 text-amber-700` (border `border-amber-200`) | Spam action, revision-diff highlight |

**Gray scale discipline:** 400/500 for secondary text, 600/700 only when text must read as more
prominent than metadata but isn't a heading, 200/300 for borders, 50 for backgrounds. Never use
600/700/800 as background colors.

### Theme palettes (per-theme, not shared)

`default`: page `#faf8f5`, text `#1a1a1a`, borders `#e5e0d8`, accent `#1a1a1a` (+ gold `#b8860b`
small accent), `font-serif`.

`mono`: page `#000`, text `green-400` (headings `green-300`/`green-200` on hover), borders
`green-900`, `font-mono`.

A new theme defines its own tokens in its own layout/README — never inherit `default`'s by default.

## Elevation

| Surface type | Treatment | Use for |
|---|---|---|
| Page background | `bg-gray-50` | Admin's outer canvas |
| Standalone elevated card | `bg-white rounded-lg shadow-sm` — **no border** | Dashboard stat cards, quick-actions, post editor sidebar, auth card |
| Dense/data container | `bg-white border border-gray-200 rounded-lg` | Tables, posts/pages index, media grid, comments, plugins list |
| Nested/inline block | `border border-gray-200 rounded-lg` (no shadow — shadows don't stack) | Block editor blocks, menu items |
| Floating popover | `bg-white rounded-lg shadow-lg` (no border) | Block-type picker, slash menu |

Rule of thumb: **shadow OR border, never both**, and never neither on a surface meant to read as
distinct. A stat card with `shadow-sm` on `bg-gray-50` reads "elevated"; the same card with a
border reads "outlined" — flatter, older.

## Typography

- **Inter** is the admin sans (loaded at 400/500/600). `font-medium` (500) is crisp and is the
  interactive weight.
- **Admin body copy defaults to `text-sm`.** `text-base` means "this is reading content"
  (paragraph blocks on the public site); `text-sm` means "this is tool UI."
- Weights: `font-bold` for page/post titles; `font-semibold` for static section headers inside a
  card; `font-medium` for everything interactive — buttons, nav, labels. **Never `font-semibold`
  on a button.**
- **Uppercase micro-labels** (`text-xs font-semibold text-gray-400 uppercase tracking-wide`) are
  the only form-section label and nav-group-header style. Don't introduce a second one.
- Sizes in active use: `text-xs`, `text-sm` (workhorse), `text-base`, `text-lg`, `text-xl`,
  `text-2xl`, `text-3xl`, `text-4xl`, `text-5xl` (marketing hero only).

## Spacing & radius

| Radius | Use |
|---|---|
| `rounded` (4px) | Small inline chips, per-field controls in block editor |
| `rounded-md` | Compact buttons, small inputs, media thumbnails |
| `rounded-lg` | **Default** — cards, panels, primary buttons, standard inputs, table containers |
| `rounded-xl` | Elevated/floating surfaces only — auth cards |
| `rounded-full` | Pills (status badges, filter chips). Never for admin primary buttons |

Button padding tiers: standard `px-4 py-2` (form submits, "New post"), compact `px-3 py-1.5` /
`px-2.5 py-1` (row actions, "Activate"/"Preview"), marketing `px-6 py-3` (theme CTAs). Don't
invent a fourth tier.

Card padding: `p-4` nested/compact, `p-6` standalone panels, `px-6 py-4` table-row list items.

## Components

### Buttons

```erb
<%# Primary %>
class: "bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg shadow-sm hover:bg-black active:scale-[0.98] transition"

<%# Secondary (bordered) %>
class: "text-sm px-4 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 active:scale-[0.98] transition"

<%# Danger (compact) %>
class: "text-xs px-2.5 py-1 rounded-md bg-red-50 text-red-700 hover:bg-red-100 active:scale-[0.98] transition"

<%# Ghost / text-only (delete links, row actions) %>
class: "text-red-500 text-xs hover:underline"
```

- `shadow-sm` on the primary button **only**. `active:scale-[0.98] transition` on every button
  variant except ghost text-links (press feedback — see Motion).
- Full-width submits add `w-full`. Destructive/state-changing buttons keep
  `data: { turbo_confirm: "..." }`.
- Compact success (Approve: `bg-green-50 text-green-700 hover:bg-green-100`) and warning (Spam:
  `bg-amber-50 text-amber-700 hover:bg-amber-100`) follow the danger shape.

### Forms & inputs

```erb
class: "mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
```

- Indigo is **correct** here — focus rings are one of its two permitted roles.
- Labels: `text-sm font-medium text-gray-700`. Uppercase micro-labels for form *sections*.
- The block editor's inline fields deliberately break this with `border-0 focus:ring-0` — they're
  editable document text, not dialog fields.
- Checkboxes: `rounded border-gray-300 text-gray-900 focus:ring-indigo-500`.

### Sidebar navigation

Layout lives in `app/views/layouts/admin.html.erb` (256px sidebar, 64px topbar, `bg-gray-50`
content). Nav items come from `app/views/admin/_nav.html.erb`, grouped by section:

```erb
<%# active item %>
class: "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium bg-indigo-50 text-indigo-700"
<%# inactive item %>
class: "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
<%# icon %>
class: "w-5 h-5 shrink-0"   <%# Heroicons outline, aria-hidden="true", inherits currentColor %>
```

- Icons are inline SVG partials in `app/views/admin/icons/` — no JS icon font, `aria-hidden="true"`.
- Section group headers use the uppercase micro-label style ("Content", "Design", "System").
- The brand mark (`admin/icons/_logo`) + wordmark sits at the top; the user card
  (`admin/_user_card`) with avatar initial, role, and sign-out sits at the bottom.

### Topbar

64px, `bg-white border-b border-gray-200`, page title (from `content_for :title`) on the left,
site indicator + current user + sign-out on the right.

### Tables

```erb
<%# header %>
class: "bg-gray-50 text-left text-xs text-gray-500 uppercase"
<%# row %>
class: "hover:bg-gray-50"
<%# cell %>
class: "px-6 py-3" / "px-6 py-4"
```
Titles inside cells: `font-medium text-gray-900`. Status uses the pill. Row-actions are ghost
links on the right.

### Status pills

```erb
class: "px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"  <%# positive %>
class: "px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600"    <%# neutral %>
```

### Empty states

Icon (`text-gray-400`) centered, `font-medium text-gray-900` title, `text-sm text-gray-500`
description, and a text link to the primary action. Used on posts, pages, and media indexes, the
dashboard, and comments.

### Flash messages

`px-4 py-3 rounded-lg text-sm border` — notice `bg-green-50 text-green-800 border-green-100`,
alert `bg-red-50 text-red-800 border-red-100`. Rendered in the topbar area of the admin layout.

### Dashboard

Greeting header, a 4-up stat-card grid (icon + bold count + muted label, each a link), then a
two-column split: "Recently updated" (dense list with status pills) and "Quick actions"
(2×2 bordered tiles) plus a media summary card.

## Block editor

The editor (`app/javascript/controllers/block_editor_controller.js`) is a structured block editor
— **not** a contenteditable rich-text blob. Content is stored as JSON `{ type, data }` in a
hidden field; every block is real form fields, so what's stored is always valid renderable data.

### Block types (9)

`heading` (level 1–4), `paragraph`, `image` (url/alt/caption + media-library picker), `quote`
(text + attribution), `list` (numbered toggle + one-item-per-line), `code` (language + code,
dark shell), `separator`, `callout` (info/success/warning/danger tone), `button`
(primary/secondary, label + url).

Add a type by: creating `app/views/admin/posts/blocks/_<type>.html.erb`, a render component in
`app/components/blocks/`, registering it in `BlockRenderer::REGISTRY`, and adding a line to
`app/views/admin/posts/blocks/_templates.html.erb`. That's the whole contract.

### Editor UX

- **Slash command:** typing `/` in a text block opens a floating type menu; arrow keys navigate,
  Enter/Tab inserts, Escape cancels (and removes the `/`).
- **Keyboard:** Enter in a paragraph/heading inserts a new paragraph below; Backspace on an empty
  text block removes it and refocuses the previous; `Cmd/Ctrl+Z` undoes, `Cmd/Ctrl+Shift+Z`/`+Y`
  redoes (50-step in-memory history).
- **Selection:** clicking/focusing a block highlights it (`ring`, border shift) and shows the
  floating toolbar (hover also reveals it).
- **Toolbar** (left rail): drag handle, insert above, move up, move down, insert below,
  duplicate, delete — all with `aria-label`.
- **Block picker:** the "+ Add block" button at the bottom appends a block.

### Front-end rendering

`BlockRenderer.render` is a strict allow-list dispatch to `Blocks::*Component` — there is no code
path that executes stored HTML. This structurally closes the "shortcode injection" class of
vulnerability WordPress has fought for two decades.

## Motion

- **Hover:** color/opacity transitions only (`transition-colors`, `transition-opacity`). No scale,
  no lift, no shadow-grow.
- **Press (`active:`):** `active:scale-[0.98] transition` on buttons — brief click feedback, the
  one transform allowed. This is the line: *transform only as press-feedback on buttons*.
- Sortable.js (block reorder, menu builder) is the only JS animation library.

## Accessibility

- Every icon in the sidebar and sign-out has `aria-hidden="true"`; adjacent text carries meaning.
- Icon-only buttons (block toolbar, menu-builder delete) carry `aria-label`.
- Focus states: `focus:ring-indigo-500`/`focus:border-indigo-500` on every input — carry both
  forward.
- Color isn't the only indicator: status uses text + pill, active nav uses tint + weight.
- `title` attributes are present on icon buttons but must not be the *only* affordance — keep the
  `aria-label`.

## Extending

1. **New admin view** — start from the closest existing pattern (index/edit/new under
   `app/views/admin/*`). Grep first.
2. **New block type** — follow the contract in the Block editor section.
3. **Plugin admin pane** — use `register_admin_nav(label:, path:, icon:)`; the icon name maps to an
   inline SVG partial in `app/views/admin/icons/` (fall back to `default`). Render plugin views
   inside the admin layout so they inherit the shell.
4. **New theme** — own palette, own `font-serif`/`font-mono` choice, own layout. Never import
   admin's `bg-gray-900`-as-primary or `bg-indigo-50` nav tint.
5. **If nothing fits** — extend this doc in the same PR that adds the new pattern.
