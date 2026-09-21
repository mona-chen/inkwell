# Inkwell — design system

The design language for the Inkwell **admin**: the tool, the auth screens, the block editor, and
the plugin admin panes. It documents what ships in this repo — the token layer, the `Ink::`
component contracts, and the patterns admin screens are assembled from — so new views and plugin
panes drop in without inventing a second visual language.

If you change a token, a component contract, or a shared pattern, update this file in the same PR.

## Two design systems, on purpose

1. **Admin (the tool)** — one palette, dense, functional, identical regardless of which theme the
   site runs. You're operating machinery; it should look like the same machinery every time.
2. **Themes (the output)** — each theme owns its own identity. `default` is warm-cream/charcoal
   editorial, `mono` is black/green monospace, and a third theme is free to look nothing like
   either.

**Never leak admin's palette into a theme, or a theme's colors into admin.** Everything below
labeled Admin covers `app/components/ink/**`, `app/components/admin/**`, `app/views/admin/**` and
`app/views/devise/**`.

## Where the system lives

| Concern | Source of truth |
| --- | --- |
| Design tokens (light + dark) | `app/assets/tailwind/application.css` |
| Component contracts | `app/components/ink/*.rb` (Phlex) |
| Admin screen compositions | `app/components/admin/*_page.rb` |
| App-owned effects and structural CSS | `app/assets/stylesheets/ink.css`, `app/assets/stylesheets/application.css` |
| Icons | Lucide (via `lucide-rails`), wrapped by `Ink::Icon` |
| Compiled CSS — generated, never hand-edit | `app/assets/builds/tailwind.css` (`bin/rails tailwindcss:build`) |
| Theme identity | `app/themes/<slug>/` |
| Builder chrome and canvas | `plugins/page_builder/app/builder/src/styles/` |

Tailwind discovers classes through the `@source` globs at the top of `application.css`. A new view
directory that isn't already covered by a glob won't compile its classes — add a glob when you add
a directory.

## Color tokens

One semantic layer in OKLCH, declared twice (`:root` / `[data-theme="light"]` and
`[data-theme="dark"]`) and bridged to Tailwind utilities by `@theme inline`.

| Family | Utilities | Use for |
| --- | --- | --- |
| Canvas | `bg-background`, `text-foreground` | Page background and default text |
| Panels | `bg-card`, `text-card-foreground` | Elevated surfaces, list bodies |
| Floating | `bg-popover`, `text-popover-foreground` | Dropdowns, popovers, command palette |
| Brand | `bg-primary`, `text-primary-foreground`, `text-primary` | The one primary action per screen; active state |
| Quiet fills | `bg-secondary`, `bg-muted`, `text-muted-foreground`, `bg-accent`, `text-accent-foreground` | Secondary buttons, metadata, hover |
| Destructive | `bg-destructive`, `text-destructive` | Delete and other irreversible actions |
| Lines | `border-border`, `bg-input`, `ring-ring` | Borders, field fills, focus rings |
| Status | `success`, `warning`, `info`, `destructive` — each with a `*-foreground` | Flash, badges, state pills |
| Frame | `bg-sidebar`, `*-sidebar-*` | The navigation shell; graphite in both modes |

Rules:

- **Name the role, not the color.** Write `bg-primary`, never `bg-blue-600`. Raw palette classes
  (`bg-gray-900`, `text-indigo-600`) are a bug: they don't flip with the dark palette.
- One `primary` action per screen. Everything else is `secondary`, `ghost`, `outline` or `danger`.
- Status color is never the only signal — pair a tone with text (see Accessibility).

## Dark mode

Dark mode is an **application attribute**, not an OS preference:

- `Admin::Layout` renders `data-theme="light"` on `<html>`, and an inline pre-paint script applies
  the stored value before first paint — no light flash on navigation.
- `app/javascript/controllers/appearance_controller.js` owns the toggle and persists the choice to
  `localStorage["inkwell-theme"]`.
- `@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));` makes `dark:`
  utilities track that same attribute.

Because the tokens already flip, most components need no `dark:` at all — `bg-card
text-card-foreground` is correct in both modes. Reach for `dark:` only for genuine art direction,
and never gate styling on `prefers-color-scheme` directly.

## Components

Admin screens are assembled from the application-owned `Ink::` Phlex components. Read the component
before writing markup: the contract, the variants and the ARIA live there, and a view that
hand-rolls a button or a table is a maintenance liability.

Inside a Phlex component that descends from `ApplicationComponent`, the `Ink::` components are
aliased to bare constants (`Button`, `Card`, `Badge`, `Table`, `Icon`, …) — that unqualified form is
the idiomatic call style. The table below lists the owning `Ink::` class.

| Component | Use for |
| --- | --- |
| `Admin::Layout` | The admin document: `<head>`, theme bootstrap, shell |
| `Ink::Shell` | The app frame — `navigation`, `topbar` and `main` slots |
| `Admin::Navigation`, `Admin::Topbar` | Sidebar entries and the header bar |
| `Ink::Toolbar`, `Ink::ToolbarTitle` | The title + actions row at the top of a screen |
| `Ink::Card` | Standalone elevated panel (`title`/`body`/`footer`) |
| `Ink::DataSection`, `Ink::Table` | Dense data containers — indexes, lists, grids |
| `Ink::SettingsLayout`, `Ink::SettingsSection` | Settings screens |
| `Ink::Button`, `Ink::ButtonTo` | Every action — `primary`, `secondary`, `default`, `ghost`, `outline`, `danger` |
| `Ink::FormBuilder`, `Ink::Choice`, `Ink::Checkbox`, `Ink::RadioButtonGroup` | Conventional Rails forms and choice fields |
| `Ink::Badge`, `Ink::Alert`, `Ink::Flash` | Status pills, inline messages, global notices |
| `Ink::Dropdown`, `Ink::CommandPalette` | Menus and ⌘K navigation |
| `Ink::Pagination`, `Ink::EmptyState` | Index footers and zero-data states |
| `Ink::DangerZone` | Irreversible actions, visually separated |
| `Ink::AuthShell` | Sign-in and account recovery |
| `Ink::Icon` | Every icon |

Typical composition:

```ruby
render DataSection.new(title: "Revisions") do |section|
  section.table(Table.new) do |table|
    table.thead do
      table.tr { table.th("Title snapshot"); table.th("Saved") }
    end
    table.tbody do
      @revisions.each do |revision|
        table.tr do
          table.td { revision.title_snapshot }
          table.td(revision.created_at.strftime("%b %-d, %Y"))
        end
      end
    end
  end
end
```

Interactivity comes from small Stimulus controllers; components emit the `data-controller` hooks, so
don't re-derive them by hand.

## Icons

Lucide, through `Ink::Icon.new(:name, size:, label:)`, with snake_case names (`:chevron_right`,
`:shopping_bag`). Sizes are `:xs :sm :md :lg :xl`.

An icon with no `label:` renders `aria-hidden`; an icon-only control must pass `label:` (or carry
its own `aria-label` on the button). There is no icon font, no hand-maintained SVG partial
directory, and no Material Symbols in admin.

## Typography

- **Inter** is the admin sans (`--font-sans`). The base layer sets admin body copy to **14px**.
- `text-sm` is the tool default. `text-[13px]`, `text-xs`, `text-[11px]` and `text-[10px]` carry
  dense chrome, metadata and micro-labels. `text-base` and up mean "reading content."
- Weights: `font-semibold` is the interactive weight (buttons, nav, labels — components already set
  it, don't re-set it), `font-bold` for screen titles, `font-medium` for emphasis inside dense rows.
- **Uppercase micro-labels** (`text-[10px] font-semibold text-muted-foreground uppercase
  tracking-[0.08em]`, as used by `Ink::Table` headers) are the only eyebrow style. Don't add a
  second one.

## Elevation, radius and spacing

- **Elevation** uses Tailwind's shadow scale — `shadow-xs` for panels and controls, `shadow-sm` for
  cards, `shadow-lg` for floating surfaces. `ink.css` exposes theme-aware `--ink-shadow-*` values for
  the surfaces that stylesheet owns (the auth card). Elevation and outline don't stack: a surface is
  either elevated or bordered, not both.
- **Radius** derives from `--radius` (`0.625rem`) through the `--radius-*` scale. `rounded-lg` is the
  default for panels, buttons and inputs, `rounded-md` for compact controls, `rounded-xl`/`rounded-2xl`
  for floating surfaces, `rounded-full` for pills and avatars.
- **Spacing** is Tailwind's 4px scale. Prefer `gap-*`/`space-y-*` over ad-hoc margins so density stays
  consistent between screens.

## Motion

Hover and state changes are color/opacity transitions. Press feedback is a small transform
(`active:translate-y-px` in `Ink::Button`) — that's the only transform allowed on interaction. No
lift, no scale-up on hover. `ink.css` honors `prefers-reduced-motion` for the shell and the auth
surface.

## Accessibility

- Decorative icons are `aria-hidden` (via `Ink::Icon`); icon-only controls carry `aria-label`.
- Color is never the sole indicator: status pairs a tone with text, and the active nav item pairs
  tint with weight and `aria-current="page"`.
- Menus and dialogs wire their roles and Escape handling (`Ink::Dropdown`, `Ink::CommandPalette`).
- Focus is visible on every interactive element. Components use
  `focus-visible:ring-2 focus-visible:ring-ring/40`; `ink.css` adds a high-contrast
  `outline: 2px solid var(--ring)` for controls inside `#admin-shell`. New interactive elements must
  keep a `:focus-visible` state.

## The app stylesheets

Admin views are Tailwind utilities and `Ink::` components — there are no inline `style=` attributes
and no `<style>` blocks in `app/views/admin` or `app/views/devise`. Two application-owned
stylesheets hold what utilities can't express:

- `ink.css` — keyframes, the select chevron, theme-aware shadow values, the auth shell, the
  writing-focus mode, and a handful of `#admin-shell` rules (focus outlines, table alignment).
- `application.css` — the workspace frame (`--ink-app-*` aliases, `.admin-workspace`, topbar slot
  styling) used by admin and the public site.

Reach for a stylesheet only when a utility genuinely can't express the rule, and scope the selector
(`#admin-shell ...`) so it can't leak into themes.

## Themes

A theme is a self-contained view-path bundle in `app/themes/<slug>/` — `layouts/`, `posts/`,
`pages/`, `authors/`, `errors/`, `site/`, plus `theme.json`. `ThemeManager` prepends the active
theme's directory for the request, and Rails falls back to core `app/views` for anything the theme
omits.

That fallback only covers the templates core ships (`posts/template`, `posts/template_index`,
`errors/not_found`). These must exist in every theme or the route 500s: `layouts/application`,
`site/home`, `posts/index`, `posts/show`, `authors/show`, `pages/default`.
`spec/themes/theme_contract_spec.rb` enforces that for every theme on disk, including the page
templates `theme.json` advertises.

Each theme declares its own palette and type in its own layout — `default` uses `--editorial-*` with
a scoped `<style>` block, `mono` uses black/green monospace. Never inherit one theme's palette into
another, and never import admin's tokens into a theme.

## Builder

The Ink Builder (page editor) is a separate, source-owned surface at
`plugins/page_builder/app/builder/src/`. Its chrome runs on `--ink-editor-*` tokens keyed off
`data-ink-theme`, its canvas lives in `src/styles/canvas/`, and it shares the `inkwell-theme` storage
key with the admin toggle. Canvas and page typography come from page/theme settings — editor CSS
never recolors or resizes page text. Edit the SCSS in `src/styles/` and rebuild; never patch compiled
output. The builder's design vocabulary is the design-kit stylesheet under
`plugins/page_builder/themes/standard/1_column_layout/ink-design-kit.css`, mirrored at
`public/page_builder_theme/ink-design-kit.css` for published pages.

## Content rendering

`BlockRenderer.render` is a strict allow-list dispatch to `Blocks::*Component` — there is no code
path that executes stored HTML. This structurally closes the shortcode-injection class of
vulnerability. New block types extend the allow-list; they never introduce an HTML pass-through.

## Extending

1. **New admin view** — start from the closest `app/views/admin/*` screen and reuse the `Ink::`
   components it renders. Grep first.
2. **Plugin admin pane** — render inside the admin layout and use the same `Ink::` components; a
   plugin panel should be indistinguishable from core admin. Register nav with
   `register_admin_nav(label:, path:, icon:, section:, parent:, children:)`, where `icon` is a Lucide
   snake_case name.
3. **New block type** — follow the block component contract and extend the `BlockRenderer`
   allow-list.
4. **New theme** — own palette, own type, own layout, and the full required template set above.
5. **If nothing fits** — extend this document in the same PR that adds the pattern.
