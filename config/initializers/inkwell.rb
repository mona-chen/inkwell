# Activates every plugin the database has marked `active: true`, wiring their hooks for this
# process. Runs after all engines/models are loaded (`to_prepare` re-runs on each code reload
# in development, so hook registrations survive class-reloading instead of going stale).
Rails.application.config.to_prepare do
  Inkwell::Hooks.reset! if Rails.env.development? # avoid double-registering listeners on reload
  Inkwell::PluginManager.boot!
rescue ActiveRecord::NoDatabaseError, ActiveRecord::StatementInvalid, ActiveRecord::ConnectionNotEstablished, PG::ConnectionBad
  # DB not created/migrated yet (e.g. during `rails db:create` or assets:precompile) — nothing to boot.
  nil
end
