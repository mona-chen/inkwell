module ThemePackages
  class Dependencies
    attr_reader :data
    def initialize(data)
      @data = data
    end

    def validate!
      raise Invalid, "dependencies must be an object" unless data.is_a?(Hash)
      raise Invalid, "gems must be an object of names and version requirements" unless gems.is_a?(Hash)
      gems.each do |name, requirement|
        raise Invalid, "Invalid gem declaration" unless name.match?(/\A[a-zA-Z0-9_-]+\z/) && requirement.is_a?(String)
        Gem::Requirement.new(requirement)
      rescue ArgumentError
        raise Invalid, "Invalid version requirement for #{name}"
      end
      raise Invalid, "packages must be an object" unless packages.is_a?(Hash)
      packages.each do |name, version|
        raise Invalid, "Invalid package declaration" unless name.match?(%r{\A(?:@[a-z0-9_.-]+/)?[a-z0-9_.-]+\z}i) && version.is_a?(String) && version.present?
      end
    end

    def gems = data.fetch("gems", {})
    def packages = data.fetch("packages", {})

    def missing_gems
      gems.reject { |name, requirement| Gem.loaded_specs[name] && Gem::Requirement.new(requirement).satisfied_by?(Gem.loaded_specs[name].version) }
    end

    def gemfile
      gems.map { |name, requirement| "gem #{name.dump}, #{requirement.dump}" }.join("\n") + "\n"
    end
  end
end
