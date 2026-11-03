require "json"

module ThemeRuntime
  # Loads the theme-owned local development fixtures. A theme can render this
  # folder with its own dev server; Inkwell is not required, and the resulting
  # shape is exactly the production contract.
  class Fixtures
    FILES = %w[site navigation page posts authors comments pagination].freeze

    attr_reader :root, :directory

    def self.for(theme_slug)
      runtime = ThemePackages::Runtime.for(theme_slug)
      return unless runtime

      new(runtime.root, runtime.manifest.inkwell["fixtures"].presence || "inkwell/fixtures")
    end

    def initialize(root, directory = "inkwell/fixtures")
      @root = Pathname.new(root)
      @directory = @root.join(directory)
    end

    def exist?
      fixture_files.any?
    end

    def load
      data = {}
      fixture_files.each do |name|
        value = JSON.parse(Pathname.new(name).read)
        key = File.basename(name, ".json")
        data[key] = value
      end
      Contract.normalize(data)
    rescue JSON::ParserError => error
      raise ThemePackages::Invalid, "Invalid theme fixture: #{error.message}"
    end

    def regions
      file = directory.join("regions.json")
      return {} unless file.file?

      value = JSON.parse(file.read)
      raise ThemePackages::Invalid, "regions.json must be an object" unless value.is_a?(Hash)

      value
    rescue JSON::ParserError => error
      raise ThemePackages::Invalid, "Invalid theme fixture: #{error.message}"
    end

    def validate!
      files = fixture_files
      raise ThemePackages::Invalid, "Theme fixtures are declared but absent" if declared? && files.empty?
      files.each do |file|
        value = JSON.parse(Pathname.new(file).read)
        expected = File.basename(file, ".json")
        valid = case expected
        when "site", "page", "pagination" then value.is_a?(Hash)
        else value.is_a?(Array) && value.all? { |item| item.is_a?(Hash) }
        end
        raise ThemePackages::Invalid, "#{File.basename(file)} does not match the theme data contract" unless valid
      end
      regions
      true
    rescue JSON::ParserError => error
      raise ThemePackages::Invalid, "Invalid theme fixture: #{error.message}"
    end

    private

    def declared?
      manifest = @root.join("theme.json")
      return false unless manifest.file?

      JSON.parse(manifest.read).dig("inkwell", "fixtures").present?
    rescue JSON::ParserError
      false
    end

    def fixture_files
      return [] unless directory.directory?

      FILES.filter_map { |name| directory.join("#{name}.json") }.select(&:file?)
    end
  end
end
