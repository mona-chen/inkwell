module Api
  class PageSerializer < BaseSerializer
    def attributes
      data = {
        title: record.title,
        slug: record.slug,
        status: record.status,
        template: record.template,
        parent_id: record.parent_id&.to_s,
        menu_order: record.menu_order,
        updated_at: iso(record.updated_at),
        path: "/pages/#{record.slug}",
        url: absolute("/pages/#{record.slug}"),
        author: author,
        content: record.content_blocks,
        seo: seo
      }

      data[:draft_content] = record.draft_content if @include_drafts
      data.compact
    end

    private

    def author
      return nil unless record.author

      { name: record.author.name, slug: record.author.to_param }
    end

    def seo
      {
        title: record.seo_title,
        description: record.seo_description,
        canonical: record.canonical_url,
        noindex: record.noindex,
        nofollow: record.nofollow
      }.compact
    end
  end
end
