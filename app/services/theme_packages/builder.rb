require "json"

module ThemePackages
  # Explicit deployment-time build. Never called from preview or request handling.
  class Builder
    class Error < StandardError; end

    def build!(slug)
      runtime = Runtime.for(slug) or raise Error, "Theme package not found"
      package = runtime.root.join("package.json")
      raise Error, "Theme has no package.json" unless package.file?

      data = JSON.parse(package.read)
      raise Error, "package.json requires a build script" unless data.dig("scripts", "build").present?

      install = runtime.root.join("package-lock.json").file? ? "ci" : "install"
      raise Error, "Package installation failed" unless system("npm", install, chdir: runtime.root.to_s)
      raise Error, "Theme build failed" unless system("npm", "run", "build", chdir: runtime.root.to_s)

      runtime.readiness_errors.empty? ? true : raise(Error, runtime.readiness_errors.join(". "))
    rescue JSON::ParserError => error
      raise Error, "Invalid package.json: #{error.message}"
    end
  end
end
