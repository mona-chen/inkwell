module ThemePackages
  class Remover
    PROTECTED = %w[default mono].freeze

    def remove!(slug)
      raise Invalid, "This bundled theme cannot be deleted" if PROTECTED.include?(slug)
      raise Invalid, "Invalid theme" unless slug.to_s.match?(Manifest::SLUG)
      target = Rails.root.join("app/themes", slug)
      raise Invalid, "Theme is not installed" unless target.directory? && !target.symlink? && target.join("theme.json").file?
      staged = Rails.root.join("tmp", "removed-theme-#{SecureRandom.hex(12)}")
      committed = false
      begin
        ThemeRepositorySource.transaction do
          # Match sync's source -> site lock order. No release can be installed
          # or activated while its references and files are being removed.
          sources = ThemeRepositorySource.order(:id).lock.to_a
          sites = Site.order(:id).lock.to_a
          raise Invalid, "Switch away from this theme on every site before deleting it" if sites.any? { |site| site.active_theme == slug }
          raise Invalid, "Theme is not installed" unless target.directory?
          File.rename(target, staged)
          sources.each do |source|
            next unless source.installed_slug == slug || source.releases.any? { |release| release["slug"] == slug }
            attrs = { releases: source.releases.reject { |release| release["slug"] == slug }, auto_update: false, auto_activate: false }
            attrs.merge!(installed_slug: nil, deployed_sha: nil, status: "removed", error_message: nil) if source.installed_slug == slug
            source.update!(attrs)
          end
          Theme.where(slug: slug).destroy_all
        end
        committed = true
      ensure
        File.rename(staged, target) if !committed && staged.exist? && !target.exist?
      end
      FileUtils.rm_rf(staged)
    end
  end
end
