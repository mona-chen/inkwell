namespace :themes do
  desc "Import a source directory: themes:import[DIRECTORY,SLUG,SPA]"
  task :import, [:source, :slug, :spa] => :environment do |_task, args|
    abort "A source directory is required" if args[:source].blank?
    manifest = ThemePackages::Importer.new.import_directory!(args[:source], slug: args[:slug], spa: ActiveModel::Type::Boolean.new.cast(args[:spa]))
    puts "Imported #{manifest.fetch('slug')}. Review dependencies before activation."
  end

  desc "Show a theme's declared dependencies: themes:dependencies[SLUG]"
  task :dependencies, [:slug] => :environment do |_task, args|
    runtime = ThemePackages::Runtime.for(args[:slug]) or abort "Theme package not found"
    dependencies = ThemePackages::Dependencies.new(runtime.manifest.data.fetch("dependencies", {}))
    puts dependencies.gemfile
    puts "Packages: #{dependencies.packages.to_json}"
    puts "Missing gems in the running bundle: #{dependencies.missing_gems.to_json}"
    puts "Add required gems to the host Gemfile, run bundle install, and restart Rails."
    puts "Build theme-local packages with bin/rails 'themes:build[#{args[:slug]}]'."
  end

  desc "Install packages and build a trusted theme source: themes:build[SLUG]"
  task :build, [:slug] => :environment do |_task, args|
    ThemePackages::Builder.new.build!(args[:slug])
    puts "Built #{args[:slug]}."
  rescue ThemePackages::Builder::Error => error
    abort error.message
  end
end

namespace :themes do
  desc "Backfill CMS theme routes from every site's installed manifest"
  task sync_routes: :environment do
    ThemeRoutes::Synchronizer.sync_all!
    puts "Theme routes synchronized."
  end
end
