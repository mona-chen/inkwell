class ThemeBuildJob < ApplicationJob
  queue_as :default

  def perform(site_id, slug)
    site = Site.find(site_id)
    raise ThemePackages::Builder::Error, "Unknown theme release" unless ThemeManager.available.include?(slug.to_s)

    ThemePackages::Builder.new.build!(slug)
    ThemeRoutes::Synchronizer.new(site: site, theme_slug: slug).sync!
  end
end
