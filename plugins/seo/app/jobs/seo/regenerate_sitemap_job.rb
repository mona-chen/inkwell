module Seo
  class RegenerateSitemapJob < ApplicationJob
    queue_as :low

    def perform
      # `Current` is request-scoped and unset in a background job, so resolve the site
      # per-post/page via its own association rather than reaching for Current.site here.
      published_posts = Post.published.includes(:site).order(updated_at: :desc)
      published_pages = Page.published.includes(:site).order(updated_at: :desc)

      xml = Nokogiri::XML::Builder.new do |xml|
        xml.urlset(xmlns: "http://www.sitemaps.org/schemas/sitemap/0.9") do
          published_posts.find_each do |post|
            site_url = post.site.setting("site_url", post.site.domain)
            xml.url do
              xml.loc(Rails.application.routes.url_helpers.post_url(post, host: site_url))
              xml.lastmod(post.updated_at.iso8601)
              xml.changefreq("weekly")
              xml.priority("0.8")
            end
          end
          published_pages.find_each do |page|
            site_url = page.site.setting("site_url", page.site.domain)
            xml.url do
              xml.loc(Rails.application.routes.url_helpers.page_url(page, host: site_url))
              xml.lastmod(page.updated_at.iso8601)
              xml.changefreq("monthly")
              xml.priority("0.6")
            end
          end
        end
      end
      File.write(Rails.root.join("public", "sitemap.xml"), xml.to_xml)
    end
  end
end
