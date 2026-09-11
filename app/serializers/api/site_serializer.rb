module Api
  class SiteSerializer < BaseSerializer
    def attributes
      site = record
      front = site.front_page
      {
        name: site.name,
        domain: site.domain,
        tagline: site.setting("tagline"),
        timezone: site.setting("timezone", "UTC"),
        logo_url: site.logo_item && absolute(site.logo_item.url),
        show_on_front: site.show_on_front,
        front_page: front && { title: front.title, slug: front.slug, path: "/pages/#{front.slug}" },
        posts_count: site.posts.published.count,
        pages_count: site.pages.published.count
      }.compact
    end
  end
end
