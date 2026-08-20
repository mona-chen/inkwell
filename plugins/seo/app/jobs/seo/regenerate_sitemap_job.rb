module Seo
  class RegenerateSitemapJob < ApplicationJob
    queue_as :low

    def perform
      # `Current` is request-scoped and unset in a background job, so resolve the site
      # per-post via its own association rather than reaching for Current.site here.
      published = Post.published.includes(:site).order(updated_at: :desc)
      xml = Nokogiri::XML::Builder.new do |xml|
        xml.urlset(xmlns: "http://www.sitemaps.org/schemas/sitemap/0.9") do
          published.find_each do |post|
            site_url = post.site.setting("site_url", post.site.domain)
            xml.url do
              xml.loc(Rails.application.routes.url_helpers.post_url(post, host: site_url))
              xml.lastmod(post.updated_at.iso8601)
            end
          end
        end
      end
      File.write(Rails.root.join("public", "sitemap.xml"), xml.to_xml)
    end
  end
end
