# Inkwell

A from-scratch rethink of "WordPress, built today" — Rails 7.1 + Hotwire (Turbo/Stimulus) +
Tailwind + ViewComponent, with a typed hook system, plugins-as-Engines, themes-as-view-paths,
and block-structured content instead of shortcode soup.

Read **ARCHITECTURE.md** first — it explains every major design decision and what's fully
built vs. deliberately stubbed in this pass.

## Getting started (once you have Postgres + Redis running locally)

```
bundle install
bin/rails db:setup      # creates db, runs migrations (core + all plugin migrations), seeds demo content
bin/dev                 # runs the Tailwind watcher + Rails server (CSS stays in sync as you edit)
```

> `bin/dev` runs the `tailwindcss:watch` process, so any utility classes added to views,
> ViewComponents, or plugin views (`plugins/*/app/views`) are compiled automatically. If you
> run `bin/rails server` on its own, styles only reflect the last `bin/rails tailwindcss:build`
> — new plugin/component markup can appear unstyled or hidden until you rebuild.

Then visit `/` for the public site and `/admin` (login: `admin@inkwell.test` / `password123`,
seeded in `db/seeds.rb`) for the dashboard.

## Where to look first

- `lib/inkwell/hooks.rb` — the action/filter registry, the core extensibility primitive
- `plugins/seo/`, `plugins/contact_form/`, `plugins/newsletter/` — three real plugin Engines
  showing the pattern (own models, migrations, routes, hooks, admin nav)
- `app/services/theme_manager.rb` + `app/themes/{default,mono}/` — the theme-swap mechanism
- `app/services/block_renderer.rb` + `app/components/blocks/` + `app/javascript/controllers/block_editor_controller.js`
  — the block editor, end to end
- `spec/lib/inkwell/hooks_spec.rb` — proof the hook system behaves as designed

This was scaffolded without network access to rubygems.org, so it has not been `bundle install`ed
or booted in this environment — every `.rb` file has been syntax-checked (`ruby -c`) and every
`.erb` template parse-checked, but run your own `bundle install` + `db:setup` before trusting it
to boot on the first try.
