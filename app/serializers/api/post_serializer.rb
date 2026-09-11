module Api
  class PostSerializer < BaseSerializer
    def attributes
      data = {
        title: record.title,
        slug: record.slug,
        excerpt: record.excerpt,
        status: record.status,
        published_at: iso(record.published_at),
        updated_at: iso(record.updated_at),
        path: "/posts/#{record.slug}",
        url: absolute("/posts/#{record.slug}"),
        author: author,
        categories: record.categories.map { |t| term(t) },
        tags: record.tags.map { |t| term(t) },
        featured_image: featured_image,
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

    def term(term)
      { name: term.name, slug: term.slug, taxonomy: term.taxonomy }
    end

    def featured_image
      image = record.featured_image
      return nil unless image

      { url: absolute(image.url), alt: record.featured_image_alt }
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
