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
    runtime = ThemePackages::Runtime.for(args[:slug]) or abort "Theme package not found"
    package = runtime.root.join("package.json")
    abort "Theme has no package.json" unless package.file?
    data = JSON.parse(package.read)
    abort "package.json requires a build script" unless data.dig("scripts", "build").present?
    install = runtime.root.join("package-lock.json").file? ? "ci" : "install"
    abort "Package installation failed" unless system("npm", install, chdir: runtime.root.to_s)
    abort "Theme build failed" unless system("npm", "run", "build", chdir: runtime.root.to_s)
    puts "Built #{args[:slug]}."
  end
end
