module ThemeRuntime
  # Explicit release lifecycle: activation, rollback, and route synchronization.
  # Preview/activation never run package scripts; builds are separate.
  class Releases
    class Error < StandardError; end

    class << self
      def activate!(site:, slug:, build_routes: true)
        raise Error, "Unknown theme release" unless ThemeManager.available.include?(slug.to_s)

        runtime = ThemePackages::Runtime.for(slug)
        if runtime
          errors = runtime.readiness_errors
          raise Error, errors.join(". ") if errors.any?
        end

        previous = nil
        site.with_lock do
          previous = site.active_theme
          site.update!(active_theme: slug.to_s)
          site.set_setting!("previous_theme_release", previous) if previous.present? && previous != slug.to_s
        end
        ThemeRoutes::Synchronizer.new(site: site.reload, theme_slug: slug.to_s).sync! if build_routes
        { slug: slug.to_s, previous: previous }
      end

      def rollback!(site:)
        previous = site.setting("previous_theme_release")
        raise Error, "No previous theme release is available" if previous.blank?
        raise Error, "Previous release is no longer installed" unless ThemeManager.available.include?(previous)

        before = site.active_theme
        activate!(site: site, slug: previous).merge(rolled_back_from: before)
      end
    end
  end
end
