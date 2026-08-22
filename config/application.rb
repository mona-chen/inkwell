require_relative "boot"

require "rails"
# Pick the frameworks you want:
require "active_model/railtie"
require "active_job/railtie"
require "active_record/railtie"
require "active_storage/engine"
require "action_controller/railtie"
require "action_mailer/railtie"
require "action_mailbox/engine"
require "action_text/engine"
require "action_view/railtie"
require "action_cable/engine"
# require "rails/test_unit/railtie"

# Require the gems listed in Gemfile, including any gems
# you've limited to :test, :development, or :production.
Bundler.require(*Rails.groups)

module Inkwell
  class Application < Rails::Application
    # Initialize configuration defaults for originally generated Rails version.
    config.load_defaults 8.1

    # Core extensibility lib (Hooks, Plugin mixin, PluginManager).
    config.autoload_lib(ignore: %w[assets tasks])

    # Vendored JS bundles (e.g. the esbuild-bundled TipTap in vendor/javascript/tiptap.js).
    config.assets.paths << Rails.root.join("vendor/javascript")

    # Every folder under /plugins is a Rails::Engine (see lib/inkwell/plugin.rb) — adding
    # them here is what makes `plugins/seo/lib/seo/engine.rb` get picked up, its
    # app/{models,jobs,views} added to the autoload/view paths, and its db/migrate folder
    # included in `rails db:migrate` automatically, same as any gem-based engine.
    require Rails.root.join("lib/inkwell/plugin")

    Dir.glob(Rails.root.join("plugins/*/lib")).each do |path|
      config.autoload_paths << path
      $LOAD_PATH.unshift(path) unless $LOAD_PATH.include?(path)
    end
    Dir.glob(Rails.root.join("plugins/*")).each { |path| require File.join(path, "lib", File.basename(path)) }

    config.time_zone = "UTC"
    config.active_job.queue_adapter = :solid_queue

    # The builder's canvas theme templates are fetched per load from /page_builder_theme; keep
    # them out of the browser cache so restyling the canvas always reaches the builder.
    require_relative "../lib/page_builder_theme_no_cache"
    config.middleware.insert_before ActionDispatch::Static, PageBuilderThemeNoCache

    # Engine migrations (ActiveStorage, ActionText, ActionMailbox, and every /plugins engine)
    # aren't added to `db:migrate` automatically — Rails only migrates the app's own db/migrate
    # unless the paths are registered. Without this, plugin tables and ActiveStorage's tables
    # never get created.
    initializer "inkwell.engine_migrations" do
      Rails.application.railties._all.each do |railtie|
        next unless railtie.respond_to?(:paths)

        engine_migrations = railtie.paths["db/migrate"].existent
        next if engine_migrations.empty?

        Rails.application.paths["db/migrate"].concat(engine_migrations)
      end
    end

    # Blocks are the only supported rich content path — see BlockRenderer. Loofah is kept as
    # a defense-in-depth sanitizer for the few genuinely free-text fields (comment bodies).
    config.action_view.sanitized_allowed_tags = %w[b i em strong a code]

    # Don't generate system test files.
    config.generators.system_tests = nil
  end
end
