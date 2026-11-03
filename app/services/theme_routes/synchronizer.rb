module ThemeRoutes
  # Keeps the CMS overlay in step with the installed manifest without changing
  # presentation. Existing metadata is preserved; only missing routes are added.
  class Synchronizer
    def initialize(site:, theme_slug: site.active_theme)
      @site = site
      @theme_slug = theme_slug
    end

    def sync!
      runtime = ThemePackages::Runtime.for(@theme_slug)
      return [] unless runtime

      runtime.manifest.routes.map do |path, target|
        route = @site.theme_routes.find_or_initialize_by(path: path, theme_release_id: @theme_slug)
        route.route_key = ThemeRoute.route_key_for(path, runtime.manifest.data, target)
        route.status = "published" if route.new_record?
        route.published_at ||= Time.current
        route.sitemap = true if route.new_record?
        route.save!
        route
      end
    end

    def self.sync_all!
      Site.find_each { |site| new(site: site).sync! }
    rescue ActiveRecord::StatementInvalid
      []
    end
  end
end
