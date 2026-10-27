require "zip"
require "tmpdir"
require "find"

module ThemePackages
  class Importer
    MAX_FILES = 10_000
    MAX_BYTES = 200.megabytes
    EXCLUDED = %w[.git node_modules vendor .bundle .env .DS_Store].freeze

    def initialize(destination: Rails.root.join("app/themes"))
      @destination = Pathname.new(destination)
    end

    def import_zip!(archive, slug: nil, name: nil, spa: false)
      Dir.mktmpdir("inkwell-theme") do |directory|
        root = Pathname.new(directory)
        count = bytes = 0
        Zip::File.open(archive) do |zip|
          zip.each do |entry|
            count += 1
            bytes += entry.size
            raise Invalid, "Theme archive exceeds limits" if count > MAX_FILES || bytes > MAX_BYTES
            parts = entry.name.split("/")
            raise Invalid, "Unsafe archive path" if entry.name.start_with?("/", "\\") || entry.name.include?("\\") || parts.any? { |part| [".", ".."].include?(part) } || entry.symlink?
            next if entry.directory?
            target = root.join(entry.name)
            FileUtils.mkdir_p(target.dirname)
            # Bound actual decompressed bytes as well as ZIP metadata.
            entry.get_input_stream do |input|
              File.open(target, "wb") do |output|
                written = 0
                while (chunk = input.read(64.kilobytes)) && !chunk.empty?
                  written += chunk.bytesize
                  raise Invalid, "Archive entry exceeds declared size" if written > entry.size
                  output.write(chunk)
                end
              end
            end
          end
        end
        manifests = root.glob("{,*/}theme.json")
        package_root = if manifests.one?
          manifests.first.dirname
        elsif root.children.one? && root.children.first.directory?
          root.children.first
        else
          root
        end
        import_directory!(package_root, slug: slug, name: name, spa: spa)
      end
    rescue Zip::Error => error
      raise Invalid, "Invalid ZIP archive: #{error.message}"
    end

    def import_directory!(source, slug: nil, name: nil, spa: false)
      source = Pathname.new(source).realpath
      raise Invalid, "Theme source must be a directory" unless source.directory?
      Dir.mktmpdir("inkwell-theme-stage") do |directory|
        stage = Pathname.new(directory).join("theme")
        FileUtils.mkdir_p(stage)
        copy_tree(source, stage)
        if !stage.join("theme.json").file?
          inferred_slug = slug.presence || source.basename.to_s.parameterize
          raise Invalid, "Rails themes need theme.json; static sites need index.html" unless stage.join("index.html").file?
          static_root = Pathname.new(directory).join("static")
          FileUtils.mv(stage, static_root)
          FileUtils.mkdir_p(stage.join("public"))
          FileUtils.cp_r(static_root.children, stage.join("public"))
          routes = stage.join("public").glob("**/*.html").to_h do |file|
            relative = file.relative_path_from(stage.join("public")).to_s
            route = relative == "index.html" ? "/" : "/#{relative}"
            [route, relative]
          end
          routes.dup.each do |route, file|
            routes["/index.html"] = file if route == "/"
            routes[route.delete_suffix(".html")] = file if route.end_with?(".html")
            routes[route.delete_suffix("/index.html")] = file if route.end_with?("/index.html")
          end
          stage.join("theme.json").write(JSON.pretty_generate({
            "format" => "inkwell-theme-v1", "slug" => inferred_slug, "name" => name.presence || inferred_slug.titleize,
            "kind" => "static", "public" => "public", "routes" => routes,
            **(spa ? { "spa_fallback" => "index.html" } : {})
          }))
        end
        manifest = Manifest.new(JSON.parse(stage.join("theme.json").read))
        validate_files!(stage, manifest)
        dependencies = Dependencies.new(manifest.data.fetch("dependencies", {}))
        stage.join("Gemfile.theme").write(dependencies.gemfile)
        target = @destination.join(manifest.slug)
        raise Invalid, "Theme already exists; import with a new slug" if target.exist?
        FileUtils.mkdir_p(@destination)
        # Same-filesystem rename prevents half-installed themes becoming discoverable.
        temporary = @destination.join(".import-#{SecureRandom.hex(8)}")
        begin
          FileUtils.cp_r(stage, temporary)
          File.rename(temporary, target)
        ensure
          FileUtils.rm_rf(temporary)
        end
        manifest.data
      end
    rescue JSON::ParserError => error
      raise Invalid, "Invalid theme.json: #{error.message}"
    end

    private

    def copy_tree(source, target)
      count = bytes = 0
      source.find do |path|
        relative = path.relative_path_from(source)
        next if relative.to_s == "."
        if relative.each_filename.any? { |part| EXCLUDED.include?(part) || part.start_with?(".env") }
          Find.prune if path.directory?
          next
        end
        raise Invalid, "Theme packages cannot contain symbolic links" if path.symlink?
        destination = target.join(relative)
        if path.directory?
          FileUtils.mkdir_p(destination)
        elsif path.file?
          count += 1
          bytes += path.size
          raise Invalid, "Theme source exceeds limits" if count > MAX_FILES || bytes > MAX_BYTES
          FileUtils.mkdir_p(destination.dirname)
          FileUtils.cp(path, destination)
        else
          raise Invalid, "Unsupported file in theme package"
        end
      end
    end

    def validate_files!(root, manifest)
      public_root = root.join(manifest.data.fetch("public", "public"))
      view_root = root.join(manifest.data.fetch("views", "views"))
      package = root.join("package.json")
      package_data = package.file? ? JSON.parse(package.read) : {}
      pending_build = package_data.dig("scripts", "build").is_a?(String)
      manifest.routes.each_value do |target|
        file = manifest.kind == "static" ? public_root.join(target) : view_root.join("#{target}.html.erb")
        raise Invalid, "Missing route target: #{target}" unless file.file? || (manifest.kind == "static" && pending_build)
      end
      if manifest.data["spa_fallback"] && !public_root.join(manifest.data["spa_fallback"]).file? && !pending_build
        raise Invalid, "Missing SPA entrypoint"
      end
      if manifest.kind == "rails" && !view_root.join("layouts/application.html.erb").file?
        raise Invalid, "Rails themes require views/layouts/application.html.erb"
      end
      dependencies = manifest.data.fetch("dependencies", {}).fetch("packages", {})
      if dependencies.any?
        raise Invalid, "Declared packages require package.json" unless package.file?
        declared = package_data.fetch("dependencies", {}).merge(package_data.fetch("devDependencies", {}))
        raise Invalid, "package.json must match declared package dependencies" unless dependencies.all? { |key, value| declared[key] == value }
      end
    end
  end
end
