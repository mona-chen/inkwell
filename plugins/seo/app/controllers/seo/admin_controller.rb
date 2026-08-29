module Seo
  class AdminController < ::Admin::BaseController
    def show
      @settings = seo_settings
    end

    def update
      seo_settings.each do |key, _default|
        Current.site.set_setting!("seo_#{key}", params[:seo][key])
      end
        redirect_to "/plugins/seo_toolkit/seo", notice: "SEO settings updated."
    end

    def sitemap
      posts = Current.site.posts.published.order(updated_at: :desc)
      pages = Current.site.pages.published.order(updated_at: :desc)
      render xml: build_sitemap(posts, pages), layout: false
    end

    private

    def seo_settings
      {
        title_template: Current.site.setting("seo_title_template", "%title – %{site_name}"),
        default_description: Current.site.setting("seo_default_description", ""),
        default_og_image: Current.site.setting("seo_default_og_image", ""),
        twitter_handle: Current.site.setting("seo_twitter_handle", ""),
        google_analytics_id: Current.site.setting("seo_google_analytics_id", ""),
        noindex_archives: Current.site.setting("seo_noindex_archives", "0"),
      }
    end

    def build_sitemap(posts, pages)
      xml = Nokogiri::XML::Builder.new(encoding: "UTF-8")
      xml.urlset xmlns: "http://www.sitemaps.org/schemas/sitemap/0.9" do
        xml.url do
          xml.loc "https://#{Current.site.domain}/"
          xml.changefreq "daily"
          xml.priority "1.0"
        end
        posts.each do |post|
          xml.url do
            xml.loc "https://#{Current.site.domain}/posts/#{post.slug}"
            xml.lastmod post.updated_at&.iso8601
            xml.changefreq "weekly"
            xml.priority "0.8"
          end
        end
        pages.each do |page|
          xml.url do
            xml.loc "https://#{Current.site.domain}/pages/#{page.slug}"
            xml.lastmod page.updated_at&.iso8601
            xml.changefreq "monthly"
            xml.priority "0.6"
          end
        end
      end
      xml.to_xml
    end
  end
end
