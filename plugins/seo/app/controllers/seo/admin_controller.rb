module Seo
  class AdminController < ::Admin::BaseController
    def show
      @settings = seo_settings
      @section = requested_section
    end

    def update
      seo_settings.each do |key, _default|
        Current.site.set_setting!("seo_#{key}", params[:seo][key])
      end
      redirect_to "/plugins/seo_toolkit/seo?section=#{requested_section}", notice: "SEO settings updated."
    end

    def sitemap
      head :not_found and return unless Current.site.setting("seo_enable_sitemap", "1") == "1"

      posts = Current.site.posts.published.order(updated_at: :desc)
      pages = Current.site.pages.published.order(updated_at: :desc)
      render xml: build_sitemap(posts, pages), layout: false
    end

    private

    SECTIONS = %w[site-basics site-representation connections content-types categories-tags crawl social].freeze

    def requested_section
      section = params[:section].to_s
      SECTIONS.include?(section) ? section : "site-basics"
    end

    def seo_settings
      {
        site_name: Current.site.setting("seo_site_name", Current.site.name),
        alternate_name: Current.site.setting("seo_alternate_name", ""),
        title_template: Current.site.setting("seo_title_template", "%title – %{site_name}"),
        default_description: Current.site.setting("seo_default_description", ""),
        site_representation: Current.site.setting("seo_site_representation", "organization"),
        organization_name: Current.site.setting("seo_organization_name", Current.site.name),
        organization_logo: Current.site.setting("seo_organization_logo", ""),
        default_og_image: Current.site.setting("seo_default_og_image", ""),
        twitter_handle: Current.site.setting("seo_twitter_handle", ""),
        google_analytics_id: Current.site.setting("seo_google_analytics_id", ""),
        google_verification: Current.site.setting("seo_google_verification", ""),
        bing_verification: Current.site.setting("seo_bing_verification", ""),
        index_posts: Current.site.setting("seo_index_posts", "1"),
        index_pages: Current.site.setting("seo_index_pages", "1"),
        noindex_archives: Current.site.setting("seo_noindex_archives", "0"),
        enable_sitemap: Current.site.setting("seo_enable_sitemap", "1"),
        enable_breadcrumbs: Current.site.setting("seo_enable_breadcrumbs", "0"),
        index_author_archives: Current.site.setting("seo_index_author_archives", "0"),
        index_date_archives: Current.site.setting("seo_index_date_archives", "0"),
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
